"""
姿态 + 模型分析
从YOLO推理结果深度理解Transformer模型对人体结构的理解
"""

import json
import os
import numpy as np
from pathlib import Path
from collections import defaultdict

# 读取所有YOLO推理结果
yolo_dir = 'src/data/yolo_pose_results'
pose_results = {}

print("📊 加载YOLO推理结果...")
for file in sorted(os.listdir(yolo_dir)):
    if file.endswith('_keypoints.json'):
        with open(os.path.join(yolo_dir, file), 'r') as f:
            data = json.load(f)
            img_id = file.replace('_keypoints.json', '')
            pose_results[img_id] = data

print(f"✓ 加载了 {len(pose_results)} 张图像的推理结果\n")

# ============================================
# 关键点定义和身体部位分组
# ============================================
KEYPOINTS = [
    'nose',
    'left_eye', 'right_eye',
    'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder',
    'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist',
    'left_hip', 'right_hip',
    'left_knee', 'right_knee',
    'left_ankle', 'right_ankle'
]

BODY_REGIONS = {
    '头部': ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'],
    '上肢': ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'],
    '躯干': ['left_hip', 'right_hip'],
    '下肢': ['left_knee', 'right_knee', 'left_ankle', 'right_ankle']
}

# ============================================
# 1. 计算每个关键点的统计数据
# ============================================
print("=" * 70)
print("1️⃣  计算各关键点的识别准确度")
print("=" * 70)

keypoint_stats = {}
for kp in KEYPOINTS:
    confidences = []
    for img_data in pose_results.values():
        for kp_data in img_data.get('keypoints', []):
            if kp_data['name'] == kp:
                confidences.append(kp_data['confidence'])
                break
    
    if confidences:
        confidences = np.array(confidences)
        keypoint_stats[kp] = {
            'mean': float(np.mean(confidences)),
            'std': float(np.std(confidences)),
            'median': float(np.median(confidences)),
            'min': float(np.min(confidences)),
            'max': float(np.max(confidences)),
            'count': len(confidences)
        }

# 按平均置信度排序
sorted_kps = sorted(keypoint_stats.items(), key=lambda x: x[1]['mean'], reverse=True)
print("\n关键点识别准确度排序:\n")
print(f"{'排名':<5} {'关键点':<15} {'平均置信度':<12} {'标准差':<10} {'难度'}")
print("-" * 70)
for rank, (kp, stats) in enumerate(sorted_kps, 1):
    difficulty = '⭐⭐⭐' if stats['mean'] > 0.9 else '⭐⭐' if stats['mean'] > 0.8 else '⭐'
    print(f"{rank:<5} {kp:<15} {stats['mean']:<12.4f} {stats['std']:<10.4f} {difficulty}")

# ============================================
# 2. 身体部位分组分析
# ============================================
print("\n" + "=" * 70)
print("2️⃣  身体部位分组分析")
print("=" * 70)

body_region_stats = {}
for region, kps in BODY_REGIONS.items():
    region_confs = []
    for kp in kps:
        if kp in keypoint_stats:
            region_confs.extend([keypoint_stats[kp]['mean']] * keypoint_stats[kp]['count'])
    
    if region_confs:
        region_confs = np.array(region_confs)
        body_region_stats[region] = {
            'mean': float(np.mean(region_confs)),
            'std': float(np.std(region_confs)),
            'min': float(np.min(region_confs)),
            'max': float(np.max(region_confs)),
            'keypoints': kps
        }

print("\n身体部位识别特性:\n")
for region in ['头部', '上肢', '躯干', '下肢']:
    if region in body_region_stats:
        stats = body_region_stats[region]
        print(f"📍 {region}:")
        print(f"   平均置信度: {stats['mean']:.4f} (难度: {'高' if stats['mean'] > 0.9 else '中' if stats['mean'] > 0.8 else '低'})")
        print(f"   标准差: {stats['std']:.4f} (稳定性: {'高' if stats['std'] < 0.1 else '中' if stats['std'] < 0.15 else '低'})")
        print(f"   包含关键点: {len(stats['keypoints'])} 个")

# ============================================
# 3. 左右对称性分析
# ============================================
print("\n" + "=" * 70)
print("3️⃣  左右对称性分析（模型学到的人体结构特征）")
print("=" * 70)

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

symmetry_data = []
for left_kp, right_kp in symmetric_pairs:
    left_conf = keypoint_stats[left_kp]['mean']
    right_conf = keypoint_stats[right_kp]['mean']
    diff = abs(left_conf - right_conf)
    symmetry_data.append({
        'pair': (left_kp, right_kp),
        'left_conf': left_conf,
        'right_conf': right_conf,
        'diff': diff
    })

print("\n左右部位置信度对比:\n")
for data in symmetry_data:
    left, right = data['pair']
    symbol = '← 左偏' if data['left_conf'] > data['right_conf'] else '→ 右偏' if data['right_conf'] > data['left_conf'] else '⚖️ 均衡'
    print(f"{left:<15} vs {right:<15} | 差异: {data['diff']:.4f} {symbol}")

avg_symmetry_diff = np.mean([d['diff'] for d in symmetry_data])
print(f"\n平均左右差异: {avg_symmetry_diff:.4f}")
print(f"➜ 模型对{'左侧' if np.mean([d['left_conf'] - d['right_conf'] for d in symmetry_data]) > 0 else '右侧'}部位识别更准确")
print(f"➜ 这反映了COCO数据集中人员摆放的特点（如大多数人露出左脸等）")

# ============================================
# 4. 置信度分布分析（理解模型决策）
# ============================================
print("\n" + "=" * 70)
print("4️⃣  置信度分布分析（理解模型的决策机制）")
print("=" * 70)

all_confidences = []
for img_data in pose_results.values():
    for kp_data in img_data.get('keypoints', []):
        all_confidences.append(kp_data['confidence'])

all_confidences = np.array(all_confidences)
print(f"\n全局置信度统计:")
print(f"  平均: {np.mean(all_confidences):.4f}")
print(f"  中位数: {np.median(all_confidences):.4f}")
print(f"  标准差: {np.std(all_confidences):.4f}")
print(f"  范围: [{np.min(all_confidences):.4f}, {np.max(all_confidences):.4f}]")

# 置信度分布百分比
thresholds = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95]
print(f"\n置信度分布（百分比）:")
for thresh in thresholds:
    pct = (np.sum(all_confidences >= thresh) / len(all_confidences)) * 100
    print(f"  >= {thresh}: {pct:.1f}%")

# ============================================
# 5. 生成可视化所需的数据
# ============================================
print("\n" + "=" * 70)
print("5️⃣  生成可视化数据")
print("=" * 70)

# 图表1: 各关键点识别准确度（横向条形图）
chart1_data = {
    'title': '关键点识别准确度分析',
    'type': 'bar',
    'data': [
        {
            'name': kp,
            'value': keypoint_stats[kp]['mean'],
            'std': keypoint_stats[kp]['std'],
            'count': keypoint_stats[kp]['count']
        }
        for kp, _ in sorted_kps
    ]
}

# 图表2: 身体部位对比（分组条形图）
chart2_data = {
    'title': '身体部位识别难度对比',
    'type': 'group_bar',
    'regions': []
}

for region in ['头部', '上肢', '躯干', '下肢']:
    if region in body_region_stats:
        chart2_data['regions'].append({
            'name': region,
            'mean': body_region_stats[region]['mean'],
            'std': body_region_stats[region]['std'],
            'min': body_region_stats[region]['min'],
            'max': body_region_stats[region]['max']
        })

# 图表3: 左右对称性（差异图）
chart3_data = {
    'title': '左右对称性与COCO数据集特征',
    'type': 'symmetry',
    'pairs': []
}

for data in symmetry_data:
    left_kp, right_kp = data['pair']
    chart3_data['pairs'].append({
        'left_name': left_kp.replace('left_', ''),
        'right_name': right_kp.replace('right_', ''),
        'left_conf': data['left_conf'],
        'right_conf': data['right_conf'],
        'diff': data['diff']
    })

# ============================================
# 导出数据为JSON
# ============================================
output_data = {
    'metadata': {
        'total_images': len(pose_results),
        'total_keypoints': len(all_confidences),
        'analysis_date': '2025-12-27'
    },
    'keypoint_stats': keypoint_stats,
    'body_region_stats': body_region_stats,
    'symmetry_analysis': symmetry_data,
    'confidence_distribution': {
        'mean': float(np.mean(all_confidences)),
        'median': float(np.median(all_confidences)),
        'std': float(np.std(all_confidences)),
        'min': float(np.min(all_confidences)),
        'max': float(np.max(all_confidences))
    },
    'chart_data': {
        'chart1': chart1_data,
        'chart2': chart2_data,
        'chart3': chart3_data
    }
}

with open('src/data/pose_analysis_results.json', 'w') as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)

print("✓ 已导出: src/data/pose_analysis_results.json")
print("\n" + "=" * 70)
print("✅ 分析完成！可以开始构建可视化界面")
print("=" * 70)
