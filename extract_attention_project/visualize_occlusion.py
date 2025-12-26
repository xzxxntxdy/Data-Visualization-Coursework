#!/usr/bin/env python3
"""
遮挡程度 vs 检测置信度 - 可视化分析
"""

import json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
from pathlib import Path

# 设置中文字体
matplotlib.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False

# COCO 17个关键点
COCO_KEYPOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
]

RESULT_FILE = './yolo_pose_results/occlusion_analysis.json'
OUTPUT_DIR = './yolo_pose_results'

def plot_occlusion_analysis():
    """绘制遮挡程度分析图表"""
    
    # 读取数据
    with open(RESULT_FILE, 'r') as f:
        data = json.load(f)
    
    fig = plt.figure(figsize=(18, 12))
    fig.suptitle('YOLOv8-Pose: Occlusion Level vs Detection Confidence Analysis', fontsize=18, fontweight='bold', y=0.995)
    
    # 1. 总体置信度分布对比 (柱状图 + 误差棒)
    ax1 = plt.subplot(2, 3, 1)
    categories = ['Fully Visible\n(visibility=2)', 'Occluded\n(visibility=1)', 'Not Labeled\n(visibility=0)']
    means = [
        data['overall_statistics']['fully_visible']['mean'],
        data['overall_statistics']['occluded']['mean'],
        data['overall_statistics']['not_labeled']['mean']
    ]
    stds = [
        data['overall_statistics']['fully_visible']['std'],
        data['overall_statistics']['occluded']['std'],
        data['overall_statistics']['not_labeled']['std']
    ]
    colors = ['#2ecc71', '#f39c12', '#e74c3c']
    
    bars = ax1.bar(categories, means, yerr=stds, capsize=10, alpha=0.8, 
                   color=colors, edgecolor='black', linewidth=2, error_kw={'elinewidth': 2})
    
    # 在柱子上标注数值
    for bar, mean, std in zip(bars, means, stds):
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height + std + 0.02,
                f'{mean:.4f}\n±{std:.3f}', ha='center', va='bottom', fontsize=11, fontweight='bold')
    
    ax1.set_ylabel('Mean Confidence', fontsize=12, fontweight='bold')
    ax1.set_ylim([0, 1.2])
    ax1.set_title('Overall Confidence Comparison\n(3 Occlusion Categories)', fontsize=12, fontweight='bold')
    ax1.grid(axis='y', alpha=0.3)
    
    # 2. 置信度相对下降幅度
    ax2 = plt.subplot(2, 3, 2)
    fully_visible = data['overall_statistics']['fully_visible']['mean']
    occluded = data['overall_statistics']['occluded']['mean']
    reduction_pct = ((fully_visible - occluded) / fully_visible) * 100
    
    x_pos = [0]
    reduction = [reduction_pct]
    bars2 = ax2.bar(x_pos, reduction, color='#e74c3c', alpha=0.8, edgecolor='black', linewidth=2, width=0.5)
    
    ax2.text(0, reduction_pct + 1, f'{reduction_pct:.1f}%', ha='center', va='bottom', 
            fontsize=14, fontweight='bold', color='#e74c3c')
    
    ax2.set_ylabel('Relative Reduction (%)', fontsize=12, fontweight='bold')
    ax2.set_xlim([-1, 1])
    ax2.set_ylim([0, 30])
    ax2.set_xticks([])
    ax2.set_title('Confidence Reduction\nCaused by Occlusion', fontsize=12, fontweight='bold')
    ax2.grid(axis='y', alpha=0.3)
    
    # 3. 关键点遮挡敏感性排序 (最容易受影响的top 10)
    ax3 = plt.subplot(2, 3, 3)
    kp_analysis = data['keypoint_analysis']
    
    # 计算每个关键点的置信度下降幅度
    sensitivities = []
    for kp_name, stats in kp_analysis.items():
        if stats['fully_visible']['count'] > 0 and stats['occluded']['count'] > 0:
            diff = stats['difference']
            sensitivities.append((kp_name, diff, stats['fully_visible']['mean'], stats['occluded']['mean']))
    
    # 按下降幅度排序（最大的排在前）
    sensitivities.sort(key=lambda x: x[1], reverse=True)
    top_sensitive = sensitivities[:10]
    
    kp_names = [x[0] for x in top_sensitive]
    differences = [x[1] for x in top_sensitive]
    colors_sens = ['#e74c3c' if d > 0.15 else '#f39c12' if d > 0.05 else '#2ecc71' for d in differences]
    
    bars3 = ax3.barh(range(len(kp_names)), differences, color=colors_sens, alpha=0.8, edgecolor='black')
    ax3.set_yticks(range(len(kp_names)))
    ax3.set_yticklabels(kp_names)
    ax3.set_xlabel('Confidence Decrease', fontsize=12, fontweight='bold')
    ax3.set_title('Top 10 Keypoints Most Affected\nby Occlusion', fontsize=12, fontweight='bold')
    ax3.grid(axis='x', alpha=0.3)
    
    # 在柱子末端标注数值
    for i, (bar, diff) in enumerate(zip(bars3, differences)):
        ax3.text(diff + 0.005, i, f'{diff:.3f}', va='center', fontsize=9)
    
    # 4. 关键点对比 - 完全可见 vs 被遮挡（所有关键点）
    ax4 = plt.subplot(2, 3, 4)
    
    fully_visible_confs = []
    occluded_confs = []
    kp_names_all = []
    
    for kp_name in COCO_KEYPOINT_NAMES:
        if kp_name in kp_analysis:
            stats = kp_analysis[kp_name]
            if stats['fully_visible']['count'] > 0 and stats['occluded']['count'] > 0:
                fully_visible_confs.append(stats['fully_visible']['mean'])
                occluded_confs.append(stats['occluded']['mean'])
                kp_names_all.append(kp_name)
    
    x = np.arange(len(kp_names_all))
    width = 0.35
    
    bars_fv = ax4.bar(x - width/2, fully_visible_confs, width, label='Fully Visible', 
                      color='#2ecc71', alpha=0.8, edgecolor='black')
    bars_oc = ax4.bar(x + width/2, occluded_confs, width, label='Occluded', 
                      color='#e74c3c', alpha=0.8, edgecolor='black')
    
    ax4.set_ylabel('Mean Confidence', fontsize=12, fontweight='bold')
    ax4.set_title('All Keypoints Comparison\n(Fully Visible vs Occluded)', fontsize=12, fontweight='bold')
    
    ax4.set_ylabel('平均置信度', fontsize=12, fontweight='bold')
    ax4.set_title('所有关键点对比\n(完全可见 vs 被遮挡)', fontsize=12, fontweight='bold')
    ax4.set_xticks(x)
    ax4.set_xticklabels(kp_names_all, rotation=45, ha='right', fontsize=9)
    ax4.legend(loc='upper right', fontsize=10)
    ax4.set_ylim([0, 1.1])
    ax4.grid(axis='y', alpha=0.3)
    
    # 5. 遮挡导致的置信度下降分布 (直方图)
    ax5 = plt.subplot(2, 3, 5)
    
    all_differences = [v[1] for v in sensitivities if v[1] > -0.5]  # 过滤异常值
    
    n, bins, patches = ax5.hist(all_differences, bins=12, color='#3498db', alpha=0.8, 
                               edgecolor='black', linewidth=1.5)
    
    # 给不同的柱子着色
    for i, patch in enumerate(patches):
        if bins[i] > 0.15:
            patch.set_facecolor('#e74c3c')
        elif bins[i] > 0.05:
            patch.set_facecolor('#f39c12')
        else:
            patch.set_facecolor('#2ecc71')
    
    ax5.axvline(np.mean(all_differences), color='red', linestyle='--', linewidth=2, label=f'平均: {np.mean(all_differences):.3f}')
    ax5.set_xlabel('置信度下降幅度', fontsize=12, fontweight='bold')
    ax5.set_ylabel('关键点数量', fontsize=12, fontweight='bold')
    ax5.set_title('遮挡敏感性分布', fontsize=12, fontweight='bold')
    ax5.legend(fontsize=10)
    ax5.grid(axis='y', alpha=0.3)
    
    # 6. 关键发现总结表
    ax6 = plt.subplot(2, 3, 6)
    ax6.axis('off')
    
    # 构建汇总信息
    fully_count = data['overall_statistics']['fully_visible']['count']
    occluded_count = data['overall_statistics']['occluded']['count']
    fully_mean = data['overall_statistics']['fully_visible']['mean']
    occluded_mean = data['overall_statistics']['occluded']['mean']
    
    # 找最敏感和最鲁棒的关键点
    most_sensitive = sensitivities[0]
    most_robust = sensitivities[-1]
    
    summary_text = f"""
    📊 关键发现总结
    
    ✅ 完全可见关键点:
       • 样本数: {fully_count}
       • 平均置信度: {fully_mean:.4f}
    
    ⚠️  被遮挡关键点:
       • 样本数: {occluded_count}
       • 平均置信度: {occluded_mean:.4f}
       • 相对下降: {reduction_pct:.1f}%
    
    🎯 最易受遮挡影响:
       {most_sensitive[0]}: {most_sensitive[1]:.4f}
    
    💪 最鲁棒:
       {most_robust[0]}: {most_robust[1]:.4f}
    
    💡 结论:
    模型智能地学到了遮挡与
    检测置信度的关联，对被遮挡
    的关键点自动降低置信度评估。
    """
    
    ax6.text(0.05, 0.95, summary_text, transform=ax6.transAxes, 
            fontsize=11, verticalalignment='top', family='monospace',
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.3))
    
    plt.tight_layout()
    
    # 保存图表
    png_file = f'{OUTPUT_DIR}/occlusion_analysis.png'
    pdf_file = f'{OUTPUT_DIR}/occlusion_analysis.pdf'
    
    plt.savefig(png_file, dpi=300, bbox_inches='tight')
    print(f"✅ PNG图表已保存到: {png_file}")
    
    plt.savefig(pdf_file, bbox_inches='tight')
    print(f"✅ PDF图表已保存到: {pdf_file}")
    
    plt.show()


if __name__ == '__main__':
    plot_occlusion_analysis()
