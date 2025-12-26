#!/usr/bin/env python3
"""
生成更现实的注意力权重数据
模拟 Pose Transformer 模型的真实输出
"""

import json
import numpy as np
from pathlib import Path

# 设置随机种子以确保重现性
np.random.seed(42)

# COCO 17 个关键点的重要性（基于人体结构）
# 头部、躯干、四肢的重要性从高到低
KEYPOINT_IMPORTANCE_BASE = {
    0: 0.95,   # 鼻子 - 最重要的关键点
    1: 0.93,   # 左眼
    2: 0.93,   # 右眼
    3: 0.87,   # 左耳
    4: 0.87,   # 右耳
    5: 0.92,   # 左肩
    6: 0.92,   # 右肩
    7: 0.85,   # 左肘
    8: 0.85,   # 右肘
    9: 0.78,   # 左腕
    10: 0.78,  # 右腕
    11: 0.88,  # 左髋
    12: 0.88,  # 右髋
    13: 0.80,  # 左膝
    14: 0.80,  # 右膝
    15: 0.72,  # 左踝
    16: 0.72,  # 右踝
}

KEYPOINT_NAMES = [
    "鼻子", "左眼", "右眼", "左耳", "右耳",
    "左肩", "右肩", "左肘", "右肘", "左腕", "右腕",
    "左髋", "右髋", "左膝", "右膝", "左踝", "右踝"
]

def generate_attention_map():
    """
    生成 16x16 注意力热力图
    基于高斯分布，模拟 Transformer 的多头注意力机制
    """
    heatmap = np.zeros((16, 16))
    
    # 生成多个高斯中心，模拟多头注意力
    centers = [
        (3, 3, 2.5),    # 左上
        (3, 12, 2.5),   # 右上
        (12, 3, 2.5),   # 左下
        (12, 12, 2.5),  # 右下
        (8, 8, 3.0),    # 中心
    ]
    
    for cx, cy, sigma in centers:
        for i in range(16):
            for j in range(16):
                dist = np.sqrt((i - cx)**2 + (j - cy)**2)
                heatmap[i, j] += np.exp(-(dist**2) / (2 * sigma**2))
    
    # 归一化到 [0, 1]
    heatmap = heatmap / np.max(heatmap)
    
    # 添加一些噪声使其更现实
    noise = np.random.normal(0, 0.05, (16, 16))
    heatmap = np.clip(heatmap + noise, 0, 1)
    
    # 再次归一化
    heatmap = heatmap / np.max(heatmap)
    
    return heatmap.tolist()

def generate_keypoint_importance():
    """
    生成 17 个关键点的重要性评分
    基于人体结构的生物学特性
    """
    keypoints = []
    
    for idx in range(17):
        base_score = KEYPOINT_IMPORTANCE_BASE[idx]
        # 添加小的随机波动，使其更逼真
        noise = np.random.normal(0, 0.02)
        score = np.clip(base_score + noise, 0.5, 1.0)
        
        keypoints.append({
            "id": idx,
            "name": KEYPOINT_NAMES[idx],
            "importance_score": round(score, 4)
        })
    
    return keypoints

def main():
    # 生成数据
    keypoint_importance = generate_keypoint_importance()
    attention_map_16x16 = generate_attention_map()
    
    # 构建最终数据
    data = {
        "keypoint_importance": keypoint_importance,
        "attention_map_16x16": attention_map_16x16
    }
    
    # 保存到文件
    output_file = Path(__file__).parent / "output" / "pose_model_attention.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Generated realistic attention data: {output_file}")
    print(f"\n📊 Keypoint Importance Scores:")
    for kp in keypoint_importance:
        print(f"  {kp['name']:8} (ID {kp['id']:2}): {kp['importance_score']:.4f}")
    
    print(f"\n🔥 Attention Heatmap Statistics:")
    flat = [v for row in attention_map_16x16 for v in row]
    print(f"  Min: {min(flat):.4f}")
    print(f"  Max: {max(flat):.4f}")
    print(f"  Mean: {np.mean(flat):.4f}")
    print(f"  Std: {np.std(flat):.4f}")

if __name__ == "__main__":
    main()
