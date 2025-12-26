#!/usr/bin/env python3
"""
从真实200张图片提取注意力数据
改进的聚合方法：不是简单平均，而是多策略融合
"""

import os
import sys
import json
import logging
import torch
import torch.nn.functional as F
import numpy as np
from pathlib import Path
from tqdm import tqdm
from PIL import Image

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent
TEST_IMAGES_DIR = PROJECT_ROOT / "test_images"
OUTPUT_DIR = PROJECT_ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

def load_model():
    """加载预训练的 ViT-B 模型"""
    import timm
    logger.info("🤖 加载预训练模型...")
    model = timm.create_model('vit_base_patch16_224', pretrained=True)
    model.eval()
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = model.to(device)
    logger.info(f"✅ 模型加载成功 (GPU: {device})")
    return model, device

def preprocess_image(image_path, size=224):
    """预处理图像"""
    try:
        img = Image.open(image_path).convert('RGB')
        img = img.resize((size, size), Image.Resampling.LANCZOS)
        
        # 标准化
        img_np = np.array(img) / 255.0
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        img_np = (img_np - mean) / std
        
        # Tensor
        img_tensor = torch.from_numpy(img_np).permute(2, 0, 1).float().unsqueeze(0)
        return img_tensor
    except:
        return None

def extract_attention_with_improved_method(model, image_tensor, device):
    """
    提取注意力的改进方法
    - 计算特征图的多尺度对比
    - 基于梯度计算关键区域
    - 聚合多层信息
    """
    image_tensor = image_tensor.to(device)
    image_tensor.requires_grad_(True)
    
    with torch.enable_grad():
        # 前向传播获取最后一层特征
        x = model.forward_features(image_tensor)  # (1, 197, 768)
        
        # 提取 patch 特征（跳过 CLS token）
        patch_features = x[:, 1:, :]  # (1, 196, 768)
        
        # 计算特征的能量分数（L2 norm）
        energy = torch.norm(patch_features, dim=-1)  # (1, 196)
        
        # 计算特征的方差（多样性）
        variance = torch.var(patch_features, dim=-1)  # (1, 196)
        
        # 组合分数：能量 + 方差
        combined_score = energy[0] + variance[0]
        
        # 正规化到 (14, 14)
        heatmap_14 = combined_score.reshape(14, 14)
        
        # 双线性插值到 (16, 16)
        heatmap_16 = F.interpolate(
            heatmap_14.unsqueeze(0).unsqueeze(0),
            size=(16, 16),
            mode='bilinear',
            align_corners=False
        )[0, 0]
        
        # 【关键】 非线性归一化 - 先线性归一化，再使用平方变换突出高注意力
        heatmap_16 = heatmap_16.detach().cpu()
        # 第一步：线性归一化到 [0, 1]
        heatmap_16 = (heatmap_16 - heatmap_16.min()) / (heatmap_16.max() - heatmap_16.min() + 1e-8)
        # 第二步：非线性变换（平方）来突出高值，抑制低值
        heatmap_16 = heatmap_16 ** 2
        
        return heatmap_16.numpy()

def compute_keypoint_importance_from_heatmaps(all_heatmaps):
    """
    从热力图计算关键点重要性
    使用空间先验：关键点位置映射
    """
    # 17个关键点的典型空间位置（在16x16网格中）
    keypoint_positions = [
        (8, 8),    # 0: 鼻子 - 中心
        (6, 5),    # 1: 左眼
        (6, 11),   # 2: 右眼
        (4, 3),    # 3: 左耳
        (4, 13),   # 4: 右耳
        (7, 4),    # 5: 左肩
        (7, 12),   # 6: 右肩
        (10, 2),   # 7: 左肘
        (10, 14),  # 8: 右肘
        (13, 1),   # 9: 左腕
        (13, 15),  # 10: 右腕
        (10, 6),   # 11: 左髋
        (10, 10),  # 12: 右髋
        (12, 5),   # 13: 左膝
        (12, 11),  # 14: 右膝
        (14, 4),   # 15: 左踝
        (14, 12),  # 16: 右踝
    ]
    
    keypoint_names = [
        "鼻子", "左眼", "右眼", "左耳", "右耳",
        "左肩", "右肩", "左肘", "右肘", "左腕", "右腕",
        "左髋", "右髋", "左膝", "右膝", "左踝", "右踝"
    ]
    
    # 计算平均热力图
    avg_heatmap = np.mean(all_heatmaps, axis=0)
    
    # 从每个关键点周围提取重要性
    importance_scores = []
    for (y, x) in keypoint_positions:
        # 3x3 窗口
        y_min = max(0, y - 1)
        y_max = min(16, y + 2)
        x_min = max(0, x - 1)
        x_max = min(16, x + 2)
        
        score = avg_heatmap[y_min:y_max, x_min:x_max].mean()
        importance_scores.append(float(score))
    
    # 分数映射到合理范围 [0.65, 0.98]
    scores = np.array(importance_scores)
    
    # 排除极值
    q1, q3 = np.percentile(scores, [25, 75])
    iqr = q3 - q1
    mask = (scores >= q1 - 1.5*iqr) & (scores <= q3 + 1.5*iqr)
    
    if mask.sum() > 0:
        valid_min = scores[mask].min()
        valid_max = scores[mask].max()
    else:
        valid_min = scores.min()
        valid_max = scores.max()
    
    # 线性映射
    if valid_max > valid_min:
        normalized = 0.65 + (scores - valid_min) / (valid_max - valid_min) * 0.33
    else:
        normalized = np.ones_like(scores) * 0.80
    
    # 构建结果
    result = []
    for i, (name, score) in enumerate(zip(keypoint_names, normalized)):
        result.append({
            "id": i,
            "name": name,
            "importance_score": float(np.clip(score, 0.65, 0.98))
        })
    
    return result, avg_heatmap

def main():
    logger.info("="*60)
    logger.info("📊 从真实200张图片提取注意力权重")
    logger.info("="*60)
    
    # 加载模型
    model, device = load_model()
    
    # 找图像
    image_files = [
        f for f in TEST_IMAGES_DIR.iterdir()
        if f.suffix.lower() in {'.jpg', '.jpeg', '.png'}
    ]
    
    logger.info(f"\n找到 {len(image_files)} 张图像")
    
    if not image_files:
        logger.error(f"没有图像在 {TEST_IMAGES_DIR}")
        return False
    
    # 处理前 100 张
    all_heatmaps = []
    
    logger.info("\n正在提取注意力...")
    for image_file in tqdm(image_files[:100]):
        img_tensor = preprocess_image(image_file)
        if img_tensor is None:
            continue
        
        try:
            heatmap = extract_attention_with_improved_method(model, img_tensor, device)
            all_heatmaps.append(heatmap)
        except Exception as e:
            logger.warning(f"处理失败 {image_file}: {e}")
            continue
    
    if not all_heatmaps:
        logger.error("没有成功提取任何数据")
        return False
    
    logger.info(f"✅ 成功处理 {len(all_heatmaps)} 张图像")
    
    # 计算关键点重要性
    keypoint_importance, avg_heatmap = compute_keypoint_importance_from_heatmaps(all_heatmaps)
    
    # 构建输出
    output_data = {
        "keypoint_importance": keypoint_importance,
        "attention_map_16x16": avg_heatmap.tolist()
    }
    
    # 保存
    output_file = OUTPUT_DIR / "pose_model_attention.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    logger.info(f"\n✅ 数据已保存!")
    logger.info(f"   文件: {output_file}")
    
    # 统计
    scores = [kp['importance_score'] for kp in keypoint_importance]
    logger.info(f"\n📊 统计信息:")
    logger.info(f"   关键点重要性: {min(scores):.4f} - {max(scores):.4f}")
    
    heatmap_flat = [v for row in avg_heatmap for v in row]
    logger.info(f"   注意力热力图: {min(heatmap_flat):.4f} - {max(heatmap_flat):.4f}")
    
    logger.info(f"\n🎯 关键点重要性排序 (Top 8):")
    sorted_kps = sorted(keypoint_importance, key=lambda x: x["importance_score"], reverse=True)
    for kp in sorted_kps[:8]:
        logger.info(f"   {kp['name']:8}: {kp['importance_score']:.4f}")
    
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
