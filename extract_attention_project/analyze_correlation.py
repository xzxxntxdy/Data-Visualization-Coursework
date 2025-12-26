#!/usr/bin/env python3
"""
分析置信度与遮挡的相关性
"""

import json
import numpy as np
from scipy import stats

COCO_KEYPOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
]

RESULT_FILE = './yolo_pose_results/occlusion_analysis.json'

def analyze_correlation():
    """分析数据问题"""
    
    with open(RESULT_FILE, 'r') as f:
        data = json.load(f)
    
    kp_analysis = data['keypoint_analysis']
    
    print("="*100)
    print("关键数据问题分析")
    print("="*100)
    
    print("\n1️⃣  被遮挡样本数量太少的关键点（可能导致相关性不好）：")
    print("-"*100)
    
    small_samples = []
    for kp in COCO_KEYPOINT_NAMES:
        if kp in kp_analysis:
            oc_count = kp_analysis[kp]['occluded']['count']
            fv_count = kp_analysis[kp]['fully_visible']['count']
            small_samples.append((kp, fv_count, oc_count))
    
    # 按被遮挡样本数排序
    small_samples.sort(key=lambda x: x[2])
    
    for kp, fv_count, oc_count in small_samples:
        ratio = oc_count / fv_count * 100 if fv_count > 0 else 0
        print(f"{kp:<20} 完全可见: {fv_count:3d}  |  被遮挡: {oc_count:3d}  |  比例: {ratio:5.1f}%")
    
    print("\n" + "="*100)
    print("2️⃣  问题根源分析：")
    print("="*100)
    
    total_fv = data['overall_statistics']['fully_visible']['count']
    total_oc = data['overall_statistics']['occluded']['count']
    
    print(f"\n总样本数：")
    print(f"  • 完全可见 (visibility=2): {total_fv} 个")
    print(f"  • 被遮挡 (visibility=1):    {total_oc} 个  ← 样本非常少！")
    print(f"  • 数据比例: 被遮挡/完全可见 = {total_oc/total_fv*100:.1f}%")
    
    print(f"\n✗ 问题：")
    print(f"  1. 被遮挡样本总数只有 {total_oc} 个，远少于完全可见的 {total_fv} 个")
    print(f"  2. 平均每个关键点只有 {total_oc/17:.1f} 个被遮挡样本")
    print(f"  3. 某些关键点（如 nose）被遮挡样本仅 {kp_analysis['nose']['occluded']['count']} 个")
    print(f"  4. 样本量太少 → 统计置信度低 → 相关性不稳定")
    
    print(f"\n✓ 可能的解决方案：")
    print(f"  1. 使用整个 COCO 数据集（而非仅 val2017）")
    print(f"  2. 收集更多被遮挡的样本数据")
    print(f"  3. 使用合成遮挡（synthetic occlusion）扩大训练数据")
    print(f"  4. 分析图像级别而非关键点级别的遮挡")
    
    # 计算置信度与遮挡的相关性
    print("\n" + "="*100)
    print("3️⃣  置信度与遮挡的数值关系：")
    print("="*100)
    
    print(f"\n{'Keypoint':<20} {'FV Mean':<15} {'OC Mean':<15} {'差异':<15} {'OC样本数':<15}")
    print("-"*100)
    
    for kp in COCO_KEYPOINT_NAMES:
        if kp in kp_analysis:
            fv_mean = kp_analysis[kp]['fully_visible']['mean']
            oc_mean = kp_analysis[kp]['occluded']['mean']
            diff = fv_mean - oc_mean
            oc_count = kp_analysis[kp]['occluded']['count']
            print(f"{kp:<20} {fv_mean:<15.4f} {oc_mean:<15.4f} {diff:+.4f} ({diff/fv_mean*100:+6.2f}%) {oc_count:<15}")


if __name__ == '__main__':
    analyze_correlation()
