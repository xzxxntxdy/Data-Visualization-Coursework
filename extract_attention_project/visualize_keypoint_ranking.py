#!/usr/bin/env python3
"""
17个关键点的排名对比 - 完全可见 vs 被遮挡
分组柱状图：红色=完全可见排名(17=最高), 绿色=被遮挡排名(1=最高, 17=最低)
"""

import json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
from pathlib import Path

# 设置英文字体
matplotlib.rcParams['font.sans-serif'] = ['DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False

COCO_KEYPOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
]

RESULT_FILE = './yolo_pose_results/occlusion_analysis.json'
OUTPUT_DIR = './yolo_pose_results'

def plot_keypoint_comparison():
    """绘制分组柱状图：17个关键点的排名对比"""
    
    # 读取数据
    with open(RESULT_FILE, 'r') as f:
        data = json.load(f)
    
    kp_analysis = data['keypoint_analysis']
    
    # 提取所有关键点的置信度
    fully_visible_conf = {}
    occluded_conf = {}
    
    for kp_name in COCO_KEYPOINT_NAMES:
        if kp_name in kp_analysis:
            stats = kp_analysis[kp_name]
            fv_mean = stats['fully_visible']['mean'] if stats['fully_visible']['count'] > 0 else 0
            oc_mean = stats['occluded']['mean'] if stats['occluded']['count'] > 0 else 0
            fully_visible_conf[kp_name] = fv_mean
            occluded_conf[kp_name] = oc_mean
    
    # 计算排名
    # 完全可见：按置信度排序，最高=17，最低=1
    fv_sorted = sorted(fully_visible_conf.items(), key=lambda x: x[1], reverse=True)
    fv_ranking = {kp: 17 - i for i, (kp, _) in enumerate(fv_sorted)}
    
    # 被遮挡：按置信度排序，但反向显示（最高=1，最低=17）
    oc_sorted = sorted(occluded_conf.items(), key=lambda x: x[1])  # 从低到高排序
    oc_ranking = {kp: i + 1 for i, (kp, _) in enumerate(oc_sorted)}  # 从1到17
    
    # 创建分组柱状图
    fig, ax = plt.subplots(figsize=(16, 8))
    
    x = np.arange(len(COCO_KEYPOINT_NAMES))
    width = 0.35  # 柱子宽度
    
    # 提取每个关键点的排名
    fv_ranks = [fv_ranking[kp] for kp in COCO_KEYPOINT_NAMES]
    oc_ranks = [oc_ranking[kp] for kp in COCO_KEYPOINT_NAMES]
    
    # 绘制分组柱状图
    bars1 = ax.bar(x - width/2, fv_ranks, width, 
                   label='Fully Visible (Red)', color='#d62728', alpha=0.85, edgecolor='black', linewidth=1.5)
    bars2 = ax.bar(x + width/2, oc_ranks, width, 
                   label='Occluded (Green)', color='#2ca02c', alpha=0.85, edgecolor='black', linewidth=1.5)
    
    # 设置标签和标题
    ax.set_xlabel('Keypoints', fontsize=13, fontweight='bold')
    ax.set_ylabel('Ranking (1=lowest confidence, 17=highest confidence)', fontsize=13, fontweight='bold')
    ax.set_title('Keypoint Ranking Comparison: Fully Visible vs Occluded\n' +
                 'Red Bars: Fully Visible Ranking (17=highest) | Green Bars: Occluded Ranking (1=highest, 17=lowest)', 
                 fontsize=14, fontweight='bold', pad=20)
    ax.set_xticks(x)
    ax.set_xticklabels(COCO_KEYPOINT_NAMES, rotation=45, ha='right', fontsize=11)
    ax.set_ylim([0, 18])
    ax.set_yticks(range(1, 18, 2))
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.legend(fontsize=12, loc='upper right')
    
    # 在柱子上标注排名值
    def add_rank_labels(bars):
        for bar in bars:
            height = bar.get_height()
            if height > 0:
                ax.text(bar.get_x() + bar.get_width()/2., height + 0.2,
                       f'{int(height)}',
                       ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    add_rank_labels(bars1)
    add_rank_labels(bars2)
    
    plt.tight_layout()
    
    # 保存
    png_file = f'{OUTPUT_DIR}/keypoint_ranking_comparison.png'
    pdf_file = f'{OUTPUT_DIR}/keypoint_ranking_comparison.pdf'
    
    plt.savefig(png_file, dpi=300, bbox_inches='tight')
    print(f"✅ PNG saved: {png_file}")
    
    plt.savefig(pdf_file, bbox_inches='tight')
    print(f"✅ PDF saved: {pdf_file}")
    
    # 打印详细分析
    print("\n" + "="*100)
    print("RANKING COMPARISON ANALYSIS")
    print("="*100)
    print(f"\n{'Keypoint':<20} {'Fully Visible':<20} {'Occluded':<20} {'Rank Difference':<20}")
    print(f"{'':20} {'Conf → Rank':<20} {'Conf → Rank':<20} {'(FV - OC)':<20}")
    print("-"*100)
    
    rank_diffs = []
    for kp in COCO_KEYPOINT_NAMES:
        fv_conf = fully_visible_conf[kp]
        oc_conf = occluded_conf[kp]
        fv_rank = fv_ranking[kp]
        oc_rank = oc_ranking[kp]
        rank_diff = fv_rank - oc_rank  # 完全可见排名 - 被遮挡排名
        rank_diffs.append((kp, fv_conf, oc_conf, fv_rank, oc_rank, rank_diff))
        
        print(f"{kp:<20} {fv_conf:.4f} → {fv_rank:2d}          {oc_conf:.4f} → {oc_rank:2d}          {rank_diff:+3d}")
    
    # 分析排名差异最大的关键点
    print("\n" + "="*100)
    print("KEY FINDINGS:")
    print("="*100)
    
    # 排名下跌最多（完全可见时排名高，被遮挡时排名低）
    worst_affected = sorted(rank_diffs, key=lambda x: x[5], reverse=True)[0:5]
    print("\n⬇️  Most Affected by Occlusion (biggest rank drop: high when visible, low when occluded):")
    for kp, fv_conf, oc_conf, fv_rank, oc_rank, rank_diff in worst_affected:
        print(f"   {kp:<20} FV_rank={fv_rank:2d}, OC_rank={oc_rank:2d}  (diff {rank_diff:+3d})  |  " +
              f"Confidence: {fv_conf:.4f} → {oc_conf:.4f}")
    
    # 排名最稳定
    most_stable = sorted(rank_diffs, key=lambda x: abs(x[5]))[0:5]
    print("\n✅ Most Robust (minimal rank change):")
    for kp, fv_conf, oc_conf, fv_rank, oc_rank, rank_diff in most_stable:
        print(f"   {kp:<20} FV_rank={fv_rank:2d}, OC_rank={oc_rank:2d}  (diff {rank_diff:+3d})  |  " +
              f"Confidence: {fv_conf:.4f} → {oc_conf:.4f}")


if __name__ == '__main__':
    plot_keypoint_comparison()
