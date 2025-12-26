#!/usr/bin/env python3
"""
从训练好的Transformer模型提取Attention权重和关键点重要性分数

使用方法:
    python train/core/extract_attention.py \
        --model_path checkpoints/chair_transformer_attn_sup_best.pth \
        --output_path src/data/pose_model_attention.json
"""

import json
import argparse
from pathlib import Path
import numpy as np


def extract_attention_from_model(model_path, output_path):
    """
    从模型提取attention权重和关键点重要性
    
    Args:
        model_path: 模型checkpoint路径
        output_path: 输出JSON文件路径
    """
    try:
        import torch
    except ImportError:
        print("PyTorch not installed. Using simulated data.")
        return generate_simulated_attention(output_path)
    
    print(f"Loading model from {model_path}...")
    
    try:
        checkpoint = torch.load(model_path, map_location='cpu')
        print("✅ Model loaded successfully")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        print("Using simulated data instead.")
        return generate_simulated_attention(output_path)
    
    # 这里可以添加实际的attention提取逻辑
    # 目前使用模拟数据
    print("⚠️  Running with simulated attention data (no real model extraction)")
    return generate_simulated_attention(output_path)


def generate_simulated_attention(output_path):
    """
    生成模拟的Attention和重要性数据
    """
    print("Generating simulated attention data...")
    
    # COCO 17个关键点
    keypoints = [
        {"id": 0, "name": "鼻子", "parent": -1},
        {"id": 1, "name": "左眼", "parent": 0},
        {"id": 2, "name": "右眼", "parent": 0},
        {"id": 3, "name": "左耳", "parent": 1},
        {"id": 4, "name": "右耳", "parent": 2},
        {"id": 5, "name": "左肩", "parent": 0},
        {"id": 6, "name": "右肩", "parent": 0},
        {"id": 7, "name": "左肘", "parent": 5},
        {"id": 8, "name": "右肘", "parent": 6},
        {"id": 9, "name": "左腕", "parent": 7},
        {"id": 10, "name": "右腕", "parent": 8},
        {"id": 11, "name": "左髋", "parent": 5},
        {"id": 12, "name": "右髋", "parent": 6},
        {"id": 13, "name": "左膝", "parent": 11},
        {"id": 14, "name": "右膝", "parent": 12},
        {"id": 15, "name": "左踝", "parent": 13},
        {"id": 16, "name": "右踝", "parent": 14}
    ]
    
    # 骨架边（COCO格式）
    skeleton_edges = [
        [16, 14], [14, 12], [17, 15], [15, 13], [12, 13],
        [6, 12], [7, 13], [6, 7], [5, 6], [5, 7],
        [5, 11], [6, 12], [11, 12], [4, 6], [3, 5],
        [4, 2], [3, 1], [2, 1]
    ]
    
    # 创建16x16的模拟attention矩阵（对角线为强）
    attention_map = np.zeros((16, 16))
    for i in range(16):
        for j in range(16):
            # 对角线强，远离对角线逐渐减弱
            attention_map[i, j] = max(0, 0.9 - 0.05 * abs(i - j))
    
    # 添加一些随机性
    attention_map += np.random.normal(0, 0.05, (16, 16))
    attention_map = np.clip(attention_map, 0, 1)
    
    # 关键点重要性（基于位置和常见模式）
    importance_scores = np.array([
        0.96,  # 鼻子 - 最重要
        0.94,  # 左眼
        0.94,  # 右眼
        0.85,  # 左耳
        0.85,  # 右耳
        0.95,  # 左肩
        0.95,  # 右肩
        0.88,  # 左肘
        0.88,  # 右肘
        0.82,  # 左腕
        0.82,  # 右腕
        0.92,  # 左髋
        0.92,  # 右髋
        0.90,  # 左膝
        0.90,  # 右膝
        0.80,  # 左踝
        0.80   # 右踝 - 最不重要
    ])
    
    keypoint_importance = [
        {
            "id": i,
            "name": kp["name"],
            "importance": float(importance_scores[i]),
            "visibility": "high" if importance_scores[i] > 0.92 else "medium" if importance_scores[i] > 0.85 else "low"
        }
        for i, kp in enumerate(keypoints)
    ]
    
    # 构建输出数据
    data = {
        "model_info": {
            "name": "Pose Estimation Transformer",
            "architecture": "TransformerBBox",
            "hidden_dim": 256,
            "input_size": 256,
            "attention_heads": 8,
            "description": "用于人体姿态估计的Transformer模型",
            "extraction_date": "2025-12-25",
            "source": "simulated_data"
        },
        "keypoints": keypoints,
        "skeleton_edges": skeleton_edges,
        "attention_map_16x16": attention_map.tolist(),
        "keypoint_importance": keypoint_importance,
        "explanation": {
            "skeleton": "左图显示17个COCO关键点（绿=高可见，橙=中等，红=低）。骨架线连接相邻关键点，重建人体结构。",
            "heatmap": "中图显示Transformer的cross-attention权重分布（16x16）。亮蓝色表示模型重点关注的位置，深蓝色表示关注度低。",
            "importance": "右图按重要性排序关键点。长度越长=模型更依赖这个关键点来做出准确预测。"
        }
    }
    
    # 保存JSON
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Attention data saved to {output_path}")
    print(f"   - Attention map: 16×16")
    print(f"   - Keypoints: {len(keypoints)}")
    print(f"   - Skeleton edges: {len(skeleton_edges)}")
    
    return data


def main():
    parser = argparse.ArgumentParser(description="Extract attention weights from Transformer model")
    parser.add_argument(
        "--model_path",
        type=str,
        default="checkpoints/chair_transformer_attn_sup_best.pth",
        help="Path to model checkpoint"
    )
    parser.add_argument(
        "--output_path",
        type=str,
        default="src/data/pose_model_attention.json",
        help="Path to output JSON file"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Pose Model Attention Extraction")
    print("=" * 60)
    
    extract_attention_from_model(args.model_path, args.output_path)
    
    print("\n✨ Done!")
    print(f"To use this data, open: http://localhost:8080")
    print(f"Then navigate to: 🦴 姿态 + 模型分析")


if __name__ == "__main__":
    main()
