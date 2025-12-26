#!/usr/bin/env python3
"""
关键点置信度统计分析脚本
分析高置信度图像中各部位的置信度分布
"""

import json
import glob
import numpy as np
from pathlib import Path
from collections import defaultdict
import matplotlib.pyplot as plt

# COCO 17个关键点
COCO_KEYPOINT_NAMES = [
    'nose',           # 0
    'left_eye',       # 1
    'right_eye',      # 2
    'left_ear',       # 3
    'right_ear',      # 4
    'left_shoulder',  # 5
    'right_shoulder', # 6
    'left_elbow',     # 7
    'right_elbow',    # 8
    'left_wrist',     # 9
    'right_wrist',    # 10
    'left_hip',       # 11
    'right_hip',      # 12
    'left_knee',      # 13
    'right_knee',     # 14
    'left_ankle',     # 15
    'right_ankle',    # 16
]

# 人体部位分组
BODY_PARTS = {
    'head': [0, 1, 2, 3, 4],           # 鼻子、眼睛、耳朵
    'arms': [5, 6, 7, 8, 9, 10],       # 肩膀、肘、手腕
    'torso': [11, 12],                 # 髋
    'legs': [13, 14, 15, 16],          # 膝、踝
}


def analyze_keypoint_confidence(result_dir, confidence_threshold=0.8):
    """
    分析关键点置信度
    
    Args:
        result_dir: YOLO推理结果目录
        confidence_threshold: 人物置信度阈值 (0-1)
    """
    
    # 读取所有JSON文件
    json_files = sorted(glob.glob(os.path.join(result_dir, '*_keypoints.json')))
    print(f"找到 {len(json_files)} 个推理结果文件")
    
    # 统计数据
    high_conf_images = []
    low_conf_images = []
    keypoint_stats = defaultdict(list)  # 每个关键点的置信度列表
    body_part_stats = defaultdict(list)  # 每个部位的置信度列表
    
    for json_file in json_files:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        mean_conf = data['mean_confidence']
        
        # 按人物置信度分类
        if mean_conf >= confidence_threshold:
            high_conf_images.append(data)
        else:
            low_conf_images.append(data)
    
    print(f"\n=== 置信度统计 ===")
    print(f"高置信度 (>={confidence_threshold:.0%}): {len(high_conf_images)} 张图像")
    print(f"低置信度 (<{confidence_threshold:.0%}): {len(low_conf_images)} 张图像")
    
    # 分析高置信度图像中各关键点的置信度
    print(f"\n=== 高置信度图像中的关键点分析 ===")
    
    for image_data in high_conf_images:
        for kp in image_data['keypoints']:
            kp_name = kp['name']
            kp_conf = kp['confidence']
            keypoint_stats[kp_name].append(kp_conf)
            
            # 找到对应的身体部位
            kp_idx = COCO_KEYPOINT_NAMES.index(kp_name)
            for part_name, part_indices in BODY_PARTS.items():
                if kp_idx in part_indices:
                    body_part_stats[part_name].append(kp_conf)
                    break
    
    # 计算统计数据
    keypoint_analysis = {}
    for kp_name in COCO_KEYPOINT_NAMES:
        confs = keypoint_stats[kp_name]
        if confs:
            keypoint_analysis[kp_name] = {
                'mean': float(np.mean(confs)),
                'std': float(np.std(confs)),
                'min': float(np.min(confs)),
                'max': float(np.max(confs)),
                'count': len(confs)
            }
    
    body_part_analysis = {}
    for part_name, part_indices in BODY_PARTS.items():
        confs = body_part_stats[part_name]
        if confs:
            body_part_analysis[part_name] = {
                'mean': float(np.mean(confs)),
                'std': float(np.std(confs)),
                'min': float(np.min(confs)),
                'max': float(np.max(confs)),
                'count': len(confs)
            }
    
    # 打印关键点统计
    print("\n关键点置信度统计 (高置信度图像中):")
    print(f"{'关键点':<15} {'平均':<8} {'标准差':<8} {'最小':<8} {'最大':<8}")
    print("-" * 50)
    
    for kp_name in COCO_KEYPOINT_NAMES:
        if kp_name in keypoint_analysis:
            stats = keypoint_analysis[kp_name]
            print(f"{kp_name:<15} {stats['mean']:.4f}   {stats['std']:.4f}   "
                  f"{stats['min']:.4f}   {stats['max']:.4f}")
    
    # 打印身体部位统计
    print("\n\n身体部位置信度统计 (高置信度图像中):")
    print(f"{'部位':<15} {'平均':<8} {'标准差':<8} {'最小':<8} {'最大':<8}")
    print("-" * 50)
    
    for part_name in ['head', 'arms', 'torso', 'legs']:
        if part_name in body_part_analysis:
            stats = body_part_analysis[part_name]
            print(f"{part_name:<15} {stats['mean']:.4f}   {stats['std']:.4f}   "
                  f"{stats['min']:.4f}   {stats['max']:.4f}")
    
    # 保存详细结果为JSON
    output_file = os.path.join(result_dir, 'confidence_analysis.json')
    with open(output_file, 'w') as f:
        json.dump({
            'threshold': confidence_threshold,
            'high_confidence_count': len(high_conf_images),
            'low_confidence_count': len(low_conf_images),
            'keypoint_stats': keypoint_analysis,
            'body_part_stats': body_part_analysis
        }, f, indent=2)
    
    print(f"\n✅ 详细分析结果已保存到: {output_file}")
    
    # 绘制可视化
    plot_confidence_analysis(keypoint_analysis, body_part_analysis, result_dir)
    
    return keypoint_analysis, body_part_analysis


def plot_confidence_analysis(keypoint_stats, body_part_stats, output_dir):
    """绘制置信度分析图表"""
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('关键点置信度分析 (高置信度图像)', fontsize=16, fontweight='bold')
    
    # 1. 关键点平均置信度柱状图
    ax = axes[0, 0]
    kp_names = list(keypoint_stats.keys())
    kp_means = [keypoint_stats[kp]['mean'] for kp in kp_names]
    colors = plt.cm.viridis(np.linspace(0, 1, len(kp_names)))
    ax.bar(range(len(kp_names)), kp_means, color=colors)
    ax.set_xticks(range(len(kp_names)))
    ax.set_xticklabels(kp_names, rotation=45, ha='right')
    ax.set_ylabel('平均置信度')
    ax.set_title('各关键点平均置信度')
    ax.set_ylim([0, 1])
    ax.grid(axis='y', alpha=0.3)
    
    # 2. 关键点置信度范围（误差棒）
    ax = axes[0, 1]
    kp_names = list(keypoint_stats.keys())
    kp_means = [keypoint_stats[kp]['mean'] for kp in kp_names]
    kp_stds = [keypoint_stats[kp]['std'] for kp in kp_names]
    ax.errorbar(range(len(kp_names)), kp_means, yerr=kp_stds, 
                fmt='o', capsize=5, capthick=2, alpha=0.7)
    ax.set_xticks(range(len(kp_names)))
    ax.set_xticklabels(kp_names, rotation=45, ha='right')
    ax.set_ylabel('置信度')
    ax.set_title('关键点置信度范围 (±标准差)')
    ax.set_ylim([0, 1.1])
    ax.grid(alpha=0.3)
    
    # 3. 身体部位平均置信度
    ax = axes[1, 0]
    part_names = list(body_part_stats.keys())
    part_means = [body_part_stats[p]['mean'] for p in part_names]
    part_colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
    bars = ax.bar(part_names, part_means, color=part_colors, alpha=0.8, edgecolor='black', linewidth=2)
    ax.set_ylabel('平均置信度', fontsize=12)
    ax.set_title('身体部位平均置信度', fontsize=12, fontweight='bold')
    ax.set_ylim([0, 1])
    
    # 在柱子上显示数值
    for bar, mean in zip(bars, part_means):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{mean:.3f}', ha='center', va='bottom', fontweight='bold')
    
    ax.grid(axis='y', alpha=0.3)
    
    # 4. 身体部位置信度范围
    ax = axes[1, 1]
    part_names = list(body_part_stats.keys())
    part_means = [body_part_stats[p]['mean'] for p in part_names]
    part_stds = [body_part_stats[p]['std'] for p in part_names]
    ax.errorbar(range(len(part_names)), part_means, yerr=part_stds,
                fmt='s', markersize=10, capsize=8, capthick=3, alpha=0.7, 
                color='darkblue', ecolor='darkred')
    ax.set_xticks(range(len(part_names)))
    ax.set_xticklabels(part_names)
    ax.set_ylabel('置信度')
    ax.set_title('身体部位置信度范围 (±标准差)')
    ax.set_ylim([0, 1.1])
    ax.grid(alpha=0.3)
    
    plt.tight_layout()
    
    # 保存图表
    plot_file = os.path.join(output_dir, 'confidence_analysis.png')
    plt.savefig(plot_file, dpi=300, bbox_inches='tight')
    print(f"✅ 可视化图表已保存到: {plot_file}")
    
    # 也保存为PDF
    pdf_file = os.path.join(output_dir, 'confidence_analysis.pdf')
    plt.savefig(pdf_file, bbox_inches='tight')
    print(f"✅ PDF版本已保存到: {pdf_file}")


if __name__ == '__main__':
    import os
    
    result_dir = './yolo_pose_results'
    
    # 分析高置信度图像 (>= 80%)
    print("=" * 60)
    print("分析高置信度图像 (mean_confidence >= 80%)")
    print("=" * 60)
    keypoint_stats, body_part_stats = analyze_keypoint_confidence(
        result_dir, 
        confidence_threshold=0.8
    )
    
    # 也可以分析更高的置信度
    print("\n\n" + "=" * 60)
    print("分析高置信度图像 (mean_confidence >= 90%)")
    print("=" * 60)
    keypoint_stats_90, body_part_stats_90 = analyze_keypoint_confidence(
        result_dir,
        confidence_threshold=0.9
    )
