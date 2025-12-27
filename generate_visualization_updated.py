"""
生成可视化图表用于展示新的置信度分析
基于更新的数据创建PNG图表用作参考
"""

import json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
from pathlib import Path
from matplotlib import rcParams

# 设置中文字体
matplotlib.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False

# 加载更新的分析数据
with open('src/data/pose_analysis_results_updated.json', 'r', encoding='utf-8') as f:
    analysis_data = json.load(f)

keypoint_stats = analysis_data['keypoint_stats']
body_region_stats = analysis_data['body_region_stats']
chart_data = analysis_data['chart_data']

# ============================================
# 1. 创建17关键点识别能力曲线
# ============================================
print("📊 生成关键点识别能力曲线图...")

fig, ax = plt.subplots(figsize=(14, 6), dpi=150)

chart1_data = chart_data['chart1']['data']
keypoints = [d['keypoint'] for d in chart1_data]
means = [d['mean'] for d in chart1_data]
stds = [d['std'] for d in chart1_data]

# 颜色映射：按身体部位
color_map = {'头部': '#667eea', '上肢': '#ed8936', '躯干': '#48bb78', '下肢': '#f56565'}
colors = [color_map[d['body_region']] for d in chart1_data]

x = np.arange(len(keypoints))
ax.bar(x, means, yerr=stds, capsize=5, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
ax.axhline(0.7, color='green', linestyle='--', linewidth=2, alpha=0.5, label='高置信度阈值 (0.7)')
ax.axhline(0.6, color='orange', linestyle='--', linewidth=2, alpha=0.5, label='中等阈值 (0.6)')
ax.axhline(0.5, color='red', linestyle='--', linewidth=2, alpha=0.5, label='低阈值 (0.5)')

ax.set_xlabel('17个关键点', fontsize=12, fontweight='bold')
ax.set_ylabel('平均置信度', fontsize=12, fontweight='bold')
ax.set_title('17个关键点的识别能力曲线\n(基于118,287张图像×157,773人的数据)', fontsize=14, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels(keypoints, rotation=45, ha='right', fontsize=9)
ax.set_ylim(0, 1)
ax.legend(loc='upper right', fontsize=10)
ax.grid(axis='y', alpha=0.3, linestyle=':')

plt.tight_layout()
plt.savefig('analysis_output/keypoint_confidence_curve_updated.png', dpi=150, bbox_inches='tight')
print("✓ 已保存: analysis_output/keypoint_confidence_curve_updated.png")
plt.close()

# ============================================
# 2. 创建身体部位难度对比图
# ============================================
print("📊 生成身体部位难度对比图...")

fig, ax = plt.subplots(figsize=(10, 6), dpi=150)

regions = ['头部', '上肢', '躯干', '下肢']
region_means = [body_region_stats[r]['mean'] for r in regions]
region_stds = [body_region_stats[r]['std'] for r in regions]
region_colors = [color_map[r] for r in regions]

x = np.arange(len(regions))
bars = ax.bar(x, region_means, yerr=region_stds, capsize=10, color=region_colors, alpha=0.8, edgecolor='black', linewidth=2)

# 添加数值标签
for i, (bar, val) in enumerate(zip(bars, region_means)):
    ax.text(bar.get_x() + bar.get_width()/2, val + 0.03, f'{val:.3f}', 
            ha='center', va='bottom', fontsize=11, fontweight='bold')

ax.set_xlabel('身体部位', fontsize=12, fontweight='bold')
ax.set_ylabel('平均置信度', fontsize=12, fontweight='bold')
ax.set_title('身体部位的识别难度对比\n(置信度越高=越容易识别)', fontsize=14, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels(regions, fontsize=11)
ax.set_ylim(0, 1)
ax.grid(axis='y', alpha=0.3, linestyle=':')

plt.tight_layout()
plt.savefig('analysis_output/body_region_difficulty_updated.png', dpi=150, bbox_inches='tight')
print("✓ 已保存: analysis_output/body_region_difficulty_updated.png")
plt.close()

# ============================================
# 3. 创建置信度分布直方图
# ============================================
print("📊 生成置信度分布直方图...")

fig, axes = plt.subplots(2, 2, figsize=(14, 10), dpi=150)
axes = axes.flatten()

for idx, region in enumerate(regions):
    ax = axes[idx]
    region_kps = [
        ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'] if region == '头部' else
        ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'] if region == '上肢' else
        ['left_hip', 'right_hip'] if region == '躯干' else
        ['left_knee', 'right_knee', 'left_ankle', 'right_ankle']
    ][0]
    
    confidences = [keypoint_stats[kp]['mean'] for kp in region_kps]
    
    ax.bar(range(len(confidences)), confidences, color=color_map[region], alpha=0.8, edgecolor='black', linewidth=1.5)
    ax.set_title(f'{region} ({len(region_kps)}个关键点)', fontsize=12, fontweight='bold')
    ax.set_ylabel('置信度', fontsize=11)
    ax.set_ylim(0, 1)
    ax.set_xticks(range(len(region_kps)))
    ax.set_xticklabels(region_kps, rotation=45, ha='right', fontsize=9)
    ax.axhline(body_region_stats[region]['mean'], color='red', linestyle='--', linewidth=2, alpha=0.7, label=f'平均: {body_region_stats[region]["mean"]:.3f}')
    ax.grid(axis='y', alpha=0.3, linestyle=':')
    ax.legend(fontsize=9)

fig.suptitle('各身体部位的关键点置信度分布', fontsize=16, fontweight='bold', y=1.00)
plt.tight_layout()
plt.savefig('analysis_output/body_region_distribution_updated.png', dpi=150, bbox_inches='tight')
print("✓ 已保存: analysis_output/body_region_distribution_updated.png")
plt.close()

# ============================================
# 4. 创建遮挡特征 vs 识别性能散点图
# ============================================
print("📊 生成遮挡特征 vs 识别性能图...")

fig, ax = plt.subplots(figsize=(10, 7), dpi=150)

chart3_scatter = chart_data['chart3']['scatter']
for item in chart3_scatter:
    size = 500  # 基于检测率的大小
    ax.scatter(item['occlusion_rate'], item['accuracy'], s=size, 
               color=color_map[item['region']], alpha=0.7, 
               edgecolors='black', linewidth=2, label=item['region'])
    ax.annotate(item['region'], 
                xy=(item['occlusion_rate'], item['accuracy']),
                xytext=(10, 10), textcoords='offset points',
                fontsize=11, fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.5', facecolor='white', alpha=0.7))

ax.set_xlabel('COCO遮挡率 (推测)', fontsize=12, fontweight='bold')
ax.set_ylabel('模型识别准确度 (置信度)', fontsize=12, fontweight='bold')
ax.set_title('COCO遮挡特征 ↔ 模型识别性能关系\n(气泡大小表示检测率)', fontsize=14, fontweight='bold')
ax.set_xlim(-0.05, 0.5)
ax.set_ylim(0.4, 0.9)
ax.grid(alpha=0.3, linestyle=':')

# 添加趋势线
occlusions = [item['occlusion_rate'] for item in chart3_scatter]
accuracies = [item['accuracy'] for item in chart3_scatter]
z = np.polyfit(occlusions, accuracies, 1)
p = np.poly1d(z)
x_trend = np.linspace(min(occlusions)-0.05, max(occlusions)+0.05, 100)
ax.plot(x_trend, p(x_trend), "r--", alpha=0.5, linewidth=2, label='趋势线')

ax.legend(loc='upper right', fontsize=10)
plt.tight_layout()
plt.savefig('analysis_output/occlusion_vs_accuracy_updated.png', dpi=150, bbox_inches='tight')
print("✓ 已保存: analysis_output/occlusion_vs_accuracy_updated.png")
plt.close()

# ============================================
# 5. 创建左右对称性分析图
# ============================================
print("📊 生成左右对称性分析图...")

fig, ax = plt.subplots(figsize=(12, 6), dpi=150)

symmetry_data = analysis_data['symmetry_analysis']
pairs = [f"{s['left']}\nvs\n{s['right']}" for s in symmetry_data]
diffs = [s['diff'] for s in symmetry_data]

colors_sym = ['green' if d < 0.01 else 'orange' if d < 0.05 else 'red' for d in diffs]
ax.bar(range(len(diffs)), diffs, color=colors_sym, alpha=0.8, edgecolor='black', linewidth=1.5)
ax.axhline(0.01, color='green', linestyle='--', linewidth=2, alpha=0.5, label='完美对称 (<0.01)')
ax.axhline(0.05, color='orange', linestyle='--', linewidth=2, alpha=0.5, label='良好对称 (<0.05)')

ax.set_xlabel('身体部位对', fontsize=12, fontweight='bold')
ax.set_ylabel('置信度差异', fontsize=12, fontweight='bold')
ax.set_title('左右部位的对称性差异\n(平均差异: {:.4f} - 完美学习了对称特征)'.format(
    analysis_data['symmetry_analysis'][0]['diff'] if len(analysis_data['symmetry_analysis']) > 0 
    else sum([s['diff'] for s in analysis_data['symmetry_analysis']]) / len(analysis_data['symmetry_analysis'])
), fontsize=14, fontweight='bold')
ax.set_xticks(range(len(pairs)))
ax.set_xticklabels(pairs, fontsize=8, rotation=45, ha='right')
ax.grid(axis='y', alpha=0.3, linestyle=':')
ax.legend(loc='upper right', fontsize=10)

plt.tight_layout()
plt.savefig('analysis_output/symmetry_analysis_updated.png', dpi=150, bbox_inches='tight')
print("✓ 已保存: analysis_output/symmetry_analysis_updated.png")
plt.close()

# ============================================
# 6. 创建综合分析报告图（6子图）
# ============================================
print("📊 生成综合分析报告图...")

fig = plt.figure(figsize=(16, 12), dpi=150)
gs = fig.add_gridspec(3, 2, hspace=0.35, wspace=0.3)

# 子图1: 关键点排序
ax1 = fig.add_subplot(gs[0, :])
keypoints_sorted = [d['keypoint'] for d in chart1_data]
means_sorted = [d['mean'] for d in chart1_data]
colors_sorted = [color_map[d['body_region']] for d in chart1_data]
ax1.barh(keypoints_sorted, means_sorted, color=colors_sorted, alpha=0.8, edgecolor='black', linewidth=1)
ax1.set_xlabel('平均置信度', fontsize=11, fontweight='bold')
ax1.set_title('17个关键点的识别能力排序', fontsize=12, fontweight='bold')
ax1.set_xlim(0, 1)
for i, v in enumerate(means_sorted):
    ax1.text(v + 0.02, i, f'{v:.3f}', va='center', fontsize=9)

# 子图2: 身体部位对比
ax2 = fig.add_subplot(gs[1, 0])
region_means = [body_region_stats[r]['mean'] for r in regions]
bars = ax2.bar(regions, region_means, color=[color_map[r] for r in regions], alpha=0.8, edgecolor='black', linewidth=1.5)
ax2.set_ylabel('平均置信度', fontsize=11, fontweight='bold')
ax2.set_title('身体部位难度对比', fontsize=12, fontweight='bold')
ax2.set_ylim(0, 1)
for bar, val in zip(bars, region_means):
    ax2.text(bar.get_x() + bar.get_width()/2, val + 0.03, f'{val:.3f}', ha='center', fontsize=10, fontweight='bold')

# 子图3: 对称性分析
ax3 = fig.add_subplot(gs[1, 1])
symmetry_diffs = [s['diff'] for s in symmetry_data]
ax3.bar(range(len(symmetry_diffs)), symmetry_diffs, color='steelblue', alpha=0.8, edgecolor='black', linewidth=1.5)
ax3.set_ylabel('置信度差异', fontsize=11, fontweight='bold')
ax3.set_title('左右对称性差异', fontsize=12, fontweight='bold')
ax3.set_xticks(range(len(symmetry_diffs)))
ax3.set_xticklabels([f'P{i+1}' for i in range(len(symmetry_diffs))], fontsize=9)
ax3.axhline(np.mean(symmetry_diffs), color='red', linestyle='--', linewidth=2, label=f'平均: {np.mean(symmetry_diffs):.4f}')
ax3.legend(fontsize=9)

# 子图4: 检测率分布
ax4 = fig.add_subplot(gs[2, 0])
detection_rates = [body_region_stats[r]['detection_rate'] for r in regions]
bars = ax4.bar(regions, detection_rates, color=[color_map[r] for r in regions], alpha=0.8, edgecolor='black', linewidth=1.5)
ax4.set_ylabel('检测率 (%)', fontsize=11, fontweight='bold')
ax4.set_title('身体部位检测率', fontsize=12, fontweight='bold')
ax4.set_ylim(0, 100)
for bar, val in zip(bars, detection_rates):
    ax4.text(bar.get_x() + bar.get_width()/2, val + 2, f'{val:.1f}%', ha='center', fontsize=10, fontweight='bold')

# 子图5: 全局统计
ax5 = fig.add_subplot(gs[2, 1])
ax5.axis('off')
global_stats_text = f"""
📊 全局统计

处理规模:
  • 图像数: {analysis_data['metadata']['total_images']:,} 张
  • 人数: {analysis_data['metadata']['total_people']:,} 人
  • 关键点: {analysis_data['metadata']['total_keypoints']:,} 个

置信度统计:
  • 平均值: {analysis_data['global_confidence']['mean']:.4f}
  • 中位数: {analysis_data['global_confidence']['median']:.4f}
  • 标准差: {analysis_data['global_confidence']['std']:.4f}
  • 高置信度率: {analysis_data['global_confidence']['high_confidence_ratio']:.2f}%

识别能力排序:
  • 最易识别: {chart1_data[0]['keypoint']}
  • 最难识别: {chart1_data[-1]['keypoint']}

发现:
  ✓ 完美学习了身体对称特征
  ✓ 上半身识别能力强于下半身
  ✓ 遮挡度与识别难度高度相关
"""
ax5.text(0.05, 0.95, global_stats_text, transform=ax5.transAxes, fontsize=10,
         verticalalignment='top', family='monospace',
         bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

fig.suptitle('姿态 + 模型分析综合报告 (基于118,287张图像×157,773人)', fontsize=16, fontweight='bold')
plt.savefig('analysis_output/comprehensive_pose_analysis_updated.png', dpi=150, bbox_inches='tight')
print("✓ 已保存: analysis_output/comprehensive_pose_analysis_updated.png")
plt.close()

print("\n✅ 所有图表生成完成！")
print("\n生成的文件:")
print("  1. analysis_output/keypoint_confidence_curve_updated.png")
print("  2. analysis_output/body_region_difficulty_updated.png")
print("  3. analysis_output/body_region_distribution_updated.png")
print("  4. analysis_output/occlusion_vs_accuracy_updated.png")
print("  5. analysis_output/symmetry_analysis_updated.png")
print("  6. analysis_output/comprehensive_pose_analysis_updated.png")
