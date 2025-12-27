"""
从occlusion_analysis.json提取各关键点的遮挡度数据
用于与识别准确度对比展示
"""

import json
import numpy as np

# 加载遮挡度分析数据
with open('src/data/yolo_pose_results/occlusion_analysis.json', 'r') as f:
    occlusion_data = json.load(f)

# 关键点列表
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

# 从occlusion_analysis.json中提取遮挡度数据
occlusion_rate = {}
for kp in KEYPOINTS:
    if kp in occlusion_data['keypoint_analysis']:
        stats = occlusion_data['keypoint_analysis'][kp]
        
        # 计算遮挡率: (被遮挡的数量) / (被遮挡+完全可见)
        occluded_count = stats.get('occluded', {}).get('count', 0)
        fully_visible_count = stats.get('fully_visible', {}).get('count', 0)
        total = occluded_count + fully_visible_count
        
        if total > 0:
            occlusion_rate[kp] = occluded_count / total
        else:
            occlusion_rate[kp] = 0

# 组织成身体部位分组数据
body_regions = {
    '头部': ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'],
    '上肢': ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'],
    '躯干': ['left_hip', 'right_hip'],
    '下肢': ['left_knee', 'right_knee', 'left_ankle', 'right_ankle']
}

print("=" * 70)
print("各身体部位的遮挡度统计")
print("=" * 70)

region_occlusion = {}
for region, keypoints in body_regions.items():
    occlusions = [occlusion_rate.get(kp, 0) for kp in keypoints]
    avg_occlusion = np.mean(occlusions)
    region_occlusion[region] = {
        'mean': float(avg_occlusion),
        'std': float(np.std(occlusions)),
        'min': float(np.min(occlusions)),
        'max': float(np.max(occlusions))
    }
    
    print(f"\n📍 {region}:")
    print(f"   平均遮挡率: {avg_occlusion:.1%}")
    print(f"   标准差: {np.std(occlusions):.4f}")

# 生成图表数据
chart_data = {
    'title': '各身体部位的遮挡度',
    'regions': []
}

for region in ['头部', '上肢', '躯干', '下肢']:
    chart_data['regions'].append({
        'name': region,
        'occlusion_rate': region_occlusion[region]['mean']
    })

# 保存数据供visualization使用
output_data = {
    'keypoint_occlusion_rate': occlusion_rate,
    'region_occlusion_stats': region_occlusion,
    'chart_data': chart_data
}

with open('src/data/occlusion_stats.json', 'w') as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)

print("\n✓ 已生成: src/data/occlusion_stats.json")
