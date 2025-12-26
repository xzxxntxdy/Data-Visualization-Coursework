"""
分析模型在COCO数据集中对各身体部位的识别准确度
展示模型如何通过COCO学到"人"的特征
"""

import json
import numpy as np
from collections import defaultdict
import matplotlib.pyplot as plt
import seaborn as sns

# 加载数据
with open('src/data/coco_pose_results.json', 'r') as f:
    pose_results = json.load(f)

print(f"✓ 加载 {len(pose_results)} 张图像的推理结果\n")

# ============================================
# 1. 计算各部位的平均置信度
# ============================================
print("=" * 60)
print("1️⃣  各身体部位的平均置信度统计")
print("=" * 60)

keypoint_stats = defaultdict(lambda: {'confidences': [], 'count': 0})
person_confidences = []

for img_id, img_data in pose_results.items():
    # 收集person置信度（mean_confidence）
    person_conf = img_data.get('mean_confidence', 0)
    person_confidences.append(person_conf)
    
    # 收集各个关键点的置信度
    for kp in img_data.get('keypoints', []):
        name = kp['name']
        conf = kp['confidence']
        keypoint_stats[name]['confidences'].append(conf)
        keypoint_stats[name]['count'] += 1

# 计算统计量
keypoint_summary = {}
for name, stats in sorted(keypoint_stats.items()):
    confs = np.array(stats['confidences'])
    keypoint_summary[name] = {
        'mean': float(np.mean(confs)),
        'std': float(np.std(confs)),
        'min': float(np.min(confs)),
        'max': float(np.max(confs)),
        'median': float(np.median(confs))
    }
    
print(f"\n{'部位':<15} {'平均':<10} {'标准差':<10} {'最小':<10} {'最大':<10} {'中位数':<10}")
print("-" * 60)

for name in sorted(keypoint_summary.keys()):
    stats = keypoint_summary[name]
    print(f"{name:<15} {stats['mean']:<10.4f} {stats['std']:<10.4f} {stats['min']:<10.4f} {stats['max']:<10.4f} {stats['median']:<10.4f}")

print(f"\n👤 Person 置信度（mean_confidence）:")
print(f"   平均: {np.mean(person_confidences):.4f}")
print(f"   标准差: {np.std(person_confidences):.4f}")
print(f"   范围: [{np.min(person_confidences):.4f}, {np.max(person_confidences):.4f}]")

# ============================================
# 2. 置信度差异分析
# ============================================
print("\n" + "=" * 60)
print("2️⃣  识别准确度差异分析（从易到难）")
print("=" * 60)

sorted_keypoints = sorted(keypoint_summary.items(), key=lambda x: x[1]['mean'], reverse=True)
print(f"\n{'排名':<5} {'部位':<15} {'置信度':<10} {'差异程度'}")
print("-" * 60)

for rank, (name, stats) in enumerate(sorted_keypoints, 1):
    diff_level = "高" if stats['std'] > 0.15 else "中" if stats['std'] > 0.10 else "低"
    print(f"{rank:<5} {name:<15} {stats['mean']:<10.4f} {diff_level}")

# ============================================
# 3. 相关性分析：nose vs person
# ============================================
print("\n" + "=" * 60)
print("3️⃣  置信度相关性分析（nose vs person）")
print("=" * 60)

nose_confs = np.array([img_data['keypoints'][0]['confidence'] 
                       for img_data in pose_results.values() 
                       if img_data.get('keypoints')])
person_confs = np.array(person_confidences)

correlation = np.corrcoef(nose_confs, person_confs)[0, 1]
print(f"\nNose 置信度 vs Person 置信度 相关系数: {correlation:.4f}")
print(f"  → 若为 0.9+: 高度相关（人检测好的图，面部识别也很好）")
print(f"  → 若为 0.7-0.9: 中等相关（大部分一致，但有例外）")
print(f"  → 若为 <0.7: 弱相关（存在明显差异）")

# ============================================
# 4. 按置信度阈值筛选数据
# ============================================
print("\n" + "=" * 60)
print("4️⃣  不同阈值下的数据筛选结果")
print("=" * 60)

thresholds = {
    'person': [0.80, 0.85, 0.90, 0.95],
    'keypoint': [0.70, 0.75, 0.80, 0.85]
}

for person_thresh in thresholds['person']:
    print(f"\n👤 Person 置信度 >= {person_thresh}:")
    
    for kp_thresh in thresholds['keypoint']:
        valid_count = 0
        
        for img_data in pose_results.values():
            person_conf = img_data.get('mean_confidence', 0)
            if person_conf < person_thresh:
                continue
            
            # 检查该图中有多少关键点满足阈值
            valid_keypoints = sum(1 for kp in img_data.get('keypoints', []) 
                                if kp['confidence'] >= kp_thresh)
            
            if valid_keypoints == 17:  # 17个关键点都满足
                valid_count += 1
        
        percentage = (valid_count / len(pose_results)) * 100
        print(f"  → 同时各关键点 >= {kp_thresh}: {valid_count} 张 ({percentage:.1f}%)")

# ============================================
# 5. COCO数据集中人的特征分析
# ============================================
print("\n" + "=" * 60)
print("5️⃣  模型从COCO学到的\"人\"的特征")
print("=" * 60)

# 按身体部位分组分析
body_parts = {
    '头部': ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'],
    '上半身': ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'],
    '下半身': ['left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle']
}

print("\n按身体部位的识别难度：\n")
for body_region, keypoints in body_parts.items():
    region_confs = [keypoint_summary[kp]['mean'] for kp in keypoints]
    region_mean = np.mean(region_confs)
    region_std = np.std(region_confs)
    
    print(f"📍 {body_region}:")
    print(f"   平均置信度: {region_mean:.4f} ({'高' if region_mean > 0.85 else '中' if region_mean > 0.75 else '低'})")
    print(f"   内部差异: {region_std:.4f} ({'大' if region_std > 0.10 else '小'})")

# 左右对称性分析
print("\n\n👁️  左右对称性分析（模型如何识别左右特征）：\n")
symmetric_pairs = [
    ('left_eye', 'right_eye'),
    ('left_ear', 'right_ear'),
    ('left_shoulder', 'right_shoulder'),
    ('left_elbow', 'right_elbow'),
    ('left_wrist', 'right_wrist'),
    ('left_hip', 'right_hip'),
    ('left_knee', 'right_knee'),
    ('left_ankle', 'right_ankle')
]

left_right_diffs = []
for left_kp, right_kp in symmetric_pairs:
    left_conf = keypoint_summary[left_kp]['mean']
    right_conf = keypoint_summary[right_kp]['mean']
    diff = abs(left_conf - right_conf)
    left_right_diffs.append(diff)
    
    print(f"{left_kp:<15} vs {right_kp:<15}: 差异 = {diff:.4f}", end="")
    if diff > 0.05:
        print(" ⚠️  存在显著差异")
    else:
        print()

avg_lr_diff = np.mean(left_right_diffs)
print(f"\n平均左右差异: {avg_lr_diff:.4f}")
if avg_lr_diff > 0.05:
    print("➜ 模型在识别左右部位时存在显著偏差（可能反映COCO中左侧更易识别的特点）")
else:
    print("➜ 模型对左右部位的识别相对对称")

# ============================================
# 生成可视化
# ============================================
print("\n" + "=" * 60)
print("6️⃣  生成可视化图表...")
print("=" * 60)

fig, axes = plt.subplots(2, 2, figsize=(14, 10))
fig.suptitle('COCO数据集上的姿态估计置信度分析', fontsize=16, fontweight='bold')

# 图1: 各部位平均置信度
ax = axes[0, 0]
names = list(keypoint_summary.keys())
means = [keypoint_summary[n]['mean'] for n in names]
stds = [keypoint_summary[n]['std'] for n in names]
colors = ['#2ecc71' if m > 0.85 else '#f39c12' if m > 0.75 else '#e74c3c' for m in means]
ax.barh(names, means, xerr=stds, color=colors, alpha=0.7, capsize=5)
ax.set_xlabel('平均置信度')
ax.set_title('各身体部位的平均置信度')
ax.set_xlim([0, 1])
for i, (name, mean) in enumerate(zip(names, means)):
    ax.text(mean + 0.02, i, f'{mean:.3f}', va='center', fontsize=9)

# 图2: 置信度分布
ax = axes[0, 1]
ax.hist(person_confidences, bins=30, color='#3498db', alpha=0.7, edgecolor='black')
ax.axvline(np.mean(person_confidences), color='red', linestyle='--', linewidth=2, label=f'平均: {np.mean(person_confidences):.3f}')
ax.set_xlabel('Person 置信度')
ax.set_ylabel('图像数量')
ax.set_title('Person 置信度分布')
ax.legend()

# 图3: 身体部位分组
ax = axes[1, 0]
region_means = []
region_names = []
for region, keypoints in body_parts.items():
    region_mean = np.mean([keypoint_summary[kp]['mean'] for kp in keypoints])
    region_means.append(region_mean)
    region_names.append(region)
colors_region = ['#2ecc71' if m > 0.85 else '#f39c12' if m > 0.75 else '#e74c3c' for m in region_means]
ax.bar(region_names, region_means, color=colors_region, alpha=0.7, edgecolor='black')
ax.set_ylabel('平均置信度')
ax.set_title('按身体部位分组的识别准确度')
ax.set_ylim([0, 1])
for i, (name, val) in enumerate(zip(region_names, region_means)):
    ax.text(i, val + 0.02, f'{val:.3f}', ha='center', fontweight='bold')

# 图4: 左右对称性
ax = axes[1, 1]
lr_pair_names = [f"{left.split('_')[0]}\n{right.split('_')[0]}" for left, right in symmetric_pairs]
ax.bar(range(len(symmetric_pairs)), left_right_diffs, color='#9b59b6', alpha=0.7, edgecolor='black')
ax.axhline(0.05, color='red', linestyle='--', linewidth=1, label='显著差异阈值')
ax.set_xticks(range(len(symmetric_pairs)))
ax.set_xticklabels([f"{s[0]}\nvs\n{s[1]}" for s in [p for p in symmetric_pairs]], fontsize=8)
ax.set_ylabel('置信度差异')
ax.set_title('左右部位的对称性差异')
ax.legend()

plt.tight_layout()
plt.savefig('analysis_output/pose_confidence_analysis.png', dpi=150, bbox_inches='tight')
print("✓ 已保存可视化: analysis_output/pose_confidence_analysis.png")

# ============================================
# 导出结果为JSON
# ============================================
output_data = {
    'keypoint_stats': keypoint_summary,
    'person_stats': {
        'mean': float(np.mean(person_confidences)),
        'std': float(np.std(person_confidences)),
        'min': float(np.min(person_confidences)),
        'max': float(np.max(person_confidences))
    },
    'correlations': {
        'nose_vs_person': float(correlation)
    },
    'body_regions': {}
}

for region, keypoints in body_parts.items():
    region_confs = [keypoint_summary[kp]['mean'] for kp in keypoints]
    output_data['body_regions'][region] = {
        'mean': float(np.mean(region_confs)),
        'std': float(np.std(region_confs))
    }

with open('analysis_output/pose_confidence_stats.json', 'w') as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)

print("✓ 已保存统计数据: analysis_output/pose_confidence_stats.json")
print("\n" + "=" * 60)
print("✅ 分析完成！")
print("=" * 60)
