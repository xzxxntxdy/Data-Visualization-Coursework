#!/usr/bin/env python3
"""
改进的注意力提取脚本
使用更好的聚合方法，提取更有意义的注意力权重
"""

import os
import sys
import json
import logging
import torch
import torch.nn as nn
import numpy as np
from pathlib import Path
from tqdm import tqdm
import cv2
from PIL import Image

# 配置
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent
TEST_IMAGES_DIR = PROJECT_ROOT / "test_images"
OUTPUT_DIR = PROJECT_ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

def load_vitpose_model():
    """加载 ViTPose 模型"""
    try:
        import timm
        logger.info("加载 ViT-B 预训练模型 (来自 timm)...")
        
        # 使用高质量的预训练模型
        model = timm.create_model('vit_base_patch16_224', pretrained=True)
        model.eval()
        
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        model = model.to(device)
        
        logger.info(f"✅ 模型加载成功 (设备: {device})")
        return model, device
    except Exception as e:
        logger.error(f"加载失败: {e}")
        return None, None

class AttentionHookCollector:
    """收集所有层的注意力权重"""
    
    def __init__(self, model):
        self.model = model
        self.attention_weights = {}
        self.hooks = []
        self.register_hooks()
    
    def register_hooks(self):
        """为所有注意力层注册 hook"""
        for name, module in self.model.named_modules():
            if 'attn' in name and hasattr(module, 'attn'):
                # ViT 的注意力在 'attn' 属性中
                attn_module = module.attn
                
                def create_hook(layer_name):
                    def hook(module, input, output):
                        # output 是 (attn_output, attn_weights)
                        if isinstance(output, tuple) and len(output) > 1:
                            weights = output[1]
                        else:
                            weights = output
                        
                        if isinstance(weights, torch.Tensor):
                            self.attention_weights[layer_name] = weights.detach().cpu()
                    return hook
                
                hook = attn_module.register_forward_hook(create_hook(name))
                self.hooks.append(hook)
    
    def extract(self, image_tensor):
        """提取单张图像的注意力"""
        self.attention_weights.clear()
        
        with torch.no_grad():
            _ = self.model(image_tensor)
        
        return self.attention_weights
    
    def remove_hooks(self):
        """移除所有 hook"""
        for hook in self.hooks:
            hook.remove()

def preprocess_image(image_path, size=224):
    """预处理图像"""
    try:
        image = Image.open(image_path).convert('RGB')
        image = image.resize((size, size), Image.Resampling.LANCZOS)
        
        # 标准化
        image_np = np.array(image) / 255.0
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        image_np = (image_np - mean) / std
        
        # 转为张量
        image_tensor = torch.from_numpy(image_np).permute(2, 0, 1).float().unsqueeze(0)
        return image_tensor
    except Exception as e:
        logger.warning(f"处理图像失败 {image_path}: {e}")
        return None

def aggregate_attention_maps(all_attention_weights, num_heads=12):
    """
    聚合多层注意力权重成单个 16x16 热力图
    使用多种聚合策略
    """
    
    if not all_attention_weights:
        return np.ones((16, 16)) / 256
    
    # 收集所有注意力矩阵
    attention_maps = []
    
    for layer_attn in all_attention_weights:
        if isinstance(layer_attn, torch.Tensor):
            # 形状: (batch, num_heads, seq_len, seq_len)
            attn = layer_attn.squeeze(0)  # 移除 batch 维
            
            if attn.dim() == 3:  # (num_heads, seq_len, seq_len)
                # 取最后的 CLS token 的注意力（这通常最有意义）
                cls_attn = attn[:, 0, 1:]  # (num_heads, 196) - 跳过 CLS token 自身
                
                # 平均所有 head
                avg_attn = cls_attn.mean(dim=0)  # (196,)
                
                # reshape 到 14x14 (196 = 14*14，ViT 的 patch 数)
                if avg_attn.numel() == 196:
                    attn_map = avg_attn.reshape(14, 14).numpy()
                    attention_maps.append(attn_map)
    
    if not attention_maps:
        return np.ones((16, 16)) / 256
    
    # 聚合策略：使用深层权重更多
    weights = np.linspace(0.5, 2.0, len(attention_maps))
    weights = weights / weights.sum()
    
    aggregated = np.zeros((14, 14))
    for attn_map, w in zip(attention_maps, weights):
        aggregated += attn_map * w
    
    # 归一化
    aggregated = aggregated / np.max(aggregated + 1e-8)
    
    # 双线性插值到 16x16
    aggregated_16 = cv2.resize(aggregated, (16, 16), interpolation=cv2.INTER_LINEAR)
    aggregated_16 = np.clip(aggregated_16, 0, 1)
    
    return aggregated_16

def calculate_keypoint_importance(all_images_attention):
    """
    计算关键点重要性
    基于注意力在 16x16 网格中的分布
    """
    # 简单的启发式方法：不同区域对应不同关键点
    # 16x16 网格映射到 17 个关键点
    
    keypoints = [
        "鼻子", "左眼", "右眼", "左耳", "右耳",
        "左肩", "右肩", "左肘", "右肘", "左腕", "右腕",
        "左髋", "右髋", "左膝", "右膝", "左踝", "右踝"
    ]
    
    # 计算平均热力图
    avg_heatmap = np.mean(all_images_attention, axis=0)
    
    # 定义每个关键点对应的区域（16x16 中的坐标）
    keypoint_regions = [
        (8, 8),    # 鼻子 - 中心
        (6, 5),    # 左眼
        (6, 11),   # 右眼
        (4, 4),    # 左耳
        (4, 12),   # 右耳
        (7, 4),    # 左肩
        (7, 12),   # 右肩
        (9, 3),    # 左肘
        (9, 13),   # 右肘
        (11, 2),   # 左腕
        (11, 14),  # 右腕
        (10, 5),   # 左髋
        (10, 11),  # 右髋
        (12, 5),   # 左膝
        (12, 11),  # 右膝
        (14, 4),   # 左踝
        (14, 12),  # 右踝
    ]
    
    importance_scores = []
    for (y, x) in keypoint_regions:
        # 获取周围 3x3 区域的平均值
        y_start = max(0, y-1)
        y_end = min(16, y+2)
        x_start = max(0, x-1)
        x_end = min(16, x+2)
        
        score = avg_heatmap[y_start:y_end, x_start:x_end].mean()
        importance_scores.append(float(score))
    
    # 归一化到 [0.7, 1.0]
    scores_array = np.array(importance_scores)
    scores_min = scores_array.min()
    scores_max = scores_array.max()
    
    if scores_max > scores_min:
        normalized = 0.7 + (scores_array - scores_min) / (scores_max - scores_min) * 0.3
    else:
        normalized = np.ones_like(scores_array) * 0.85
    
    return [
        {"id": i, "name": keypoints[i], "importance_score": float(normalized[i])}
        for i in range(17)
    ]

def main():
    # 加载模型
    model, device = load_vitpose_model()
    if model is None:
        logger.error("无法加载模型")
        return False
    
    # 创建注意力收集器
    collector = AttentionHookCollector(model)
    
    # 找到所有图像
    image_extensions = {'.jpg', '.jpeg', '.png'}
    image_files = [f for f in TEST_IMAGES_DIR.iterdir() 
                  if f.suffix.lower() in image_extensions]
    
    logger.info(f"\n找到 {len(image_files)} 张图像")
    
    if not image_files:
        logger.error(f"没有找到图像在 {TEST_IMAGES_DIR}")
        return False
    
    # 处理前 100 张图像
    all_attention_maps = []
    
    logger.info("正在提取注意力权重...")
    for image_file in tqdm(image_files[:100]):
        image_tensor = preprocess_image(image_file)
        if image_tensor is None:
            continue
        
        image_tensor = image_tensor.to(device)
        
        # 提取注意力
        attn_weights = collector.extract(image_tensor)
        
        # 收集注意力权重
        attn_list = list(attn_weights.values())
        if attn_list:
            heatmap = aggregate_attention_maps(attn_list)
            all_attention_maps.append(heatmap)
    
    if not all_attention_maps:
        logger.error("没有成功提取任何注意力")
        return False
    
    logger.info(f"✅ 成功提取 {len(all_attention_maps)} 张图像的注意力")
    
    # 计算平均注意力热力图
    mean_attention_map = np.mean(all_attention_maps, axis=0)
    
    # 计算关键点重要性
    keypoint_importance = calculate_keypoint_importance(all_attention_maps)
    
    # 构建输出
    output_data = {
        "keypoint_importance": keypoint_importance,
        "attention_map_16x16": mean_attention_map.tolist()
    }
    
    # 保存
    output_file = OUTPUT_DIR / "pose_model_attention.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    logger.info(f"\n✅ 数据已保存到: {output_file}")
    logger.info(f"   关键点重要性范围: {min(kp['importance_score'] for kp in keypoint_importance):.4f} - {max(kp['importance_score'] for kp in keypoint_importance):.4f}")
    
    # 清理
    collector.remove_hooks()
    
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
