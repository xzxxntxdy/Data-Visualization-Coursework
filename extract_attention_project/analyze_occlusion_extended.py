#!/usr/bin/env python3
"""
扩展分析：使用train2017+val2017完整数据进行遮挡-置信度相关性分析
"""

import json
import numpy as np
from pathlib import Path
import os

COCO_KEYPOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
]

def analyze_extended_dataset():
    """使用train2017+val2017分析遮挡-置信度相关性"""
    
    print("="*100)
    print("扩展数据集遮挡分析 (train2017 + val2017)")
    print("="*100)
    
    # 加载注解文件
    val_ann_file = './data/coco/annotations/person_keypoints_val2017.json'
    train_ann_file = './data/coco/annotations/person_keypoints_train2017.json'
    
    # 检查文件
    if not os.path.exists(train_ann_file):
        print(f"\n❌ 找不到: {train_ann_file}")
        print(f"请先下载解压train2017数据和注解文件")
        return
    
    print(f"\n📂 数据检查：")
    print(f"✅ val2017 注解: {val_ann_file}")
    print(f"✅ train2017 注解: {train_ann_file}")
    
    # 加载两个数据集
    print(f"\n⏳ 加载注解文件...")
    with open(val_ann_file, 'r') as f:
        val_data = json.load(f)
    with open(train_ann_file, 'r') as f:
        train_data = json.load(f)
    
    print(f"✅ val2017: {len(val_data['annotations'])} 个人体标注")
    print(f"✅ train2017: {len(train_data['annotations'])} 个人体标注")
    
    # 合并数据
    all_annotations = val_data['annotations'] + train_data['annotations']
    print(f"✅ 合计: {len(all_annotations)} 个人体标注")
    
    # 分析遮挡情况
    print(f"\n📊 遮挡统计...")
    
    visibility_stats = {
        'fully_visible': {'count': 0, 'confidences': []},
        'occluded': {'count': 0, 'confidences': []},
        'not_labeled': {'count': 0, 'confidences': []}
    }
    
    keypoint_stats = {kp: {'fully_visible': [], 'occluded': [], 'not_labeled': []} 
                      for kp in COCO_KEYPOINT_NAMES}
    
    for ann in all_annotations:
        keypoints = ann['keypoints']
        
        # COCO格式: [x, y, visibility] * 17
        for kp_idx, kp_name in enumerate(COCO_KEYPOINT_NAMES):
            x = keypoints[kp_idx * 3]
            y = keypoints[kp_idx * 3 + 1]
            visibility = keypoints[kp_idx * 3 + 2]
            
            # 在YOLOv8推理中，我们无法直接获得原始置信度
            # 但我们可以统计遮挡分布
            if visibility == 2:
                keypoint_stats[kp_name]['fully_visible'].append(1)
                visibility_stats['fully_visible']['count'] += 1
            elif visibility == 1:
                keypoint_stats[kp_name]['occluded'].append(1)
                visibility_stats['occluded']['count'] += 1
            elif visibility == 0:
                keypoint_stats[kp_name]['not_labeled'].append(1)
                visibility_stats['not_labeled']['count'] += 1
    
    print(f"\n✅ 遮挡数据统计：")
    print(f"{'Visibility':<20} {'Count':<15} {'Percentage':<15}")
    print("-"*50)
    
    total = sum([visibility_stats[k]['count'] for k in visibility_stats])
    for vis_type in ['fully_visible', 'occluded', 'not_labeled']:
        count = visibility_stats[vis_type]['count']
        pct = count / total * 100 if total > 0 else 0
        print(f"{vis_type:<20} {count:<15} {pct:.1f}%")
    
    # 关键点级别统计
    print(f"\n📈 关键点级别的遮挡比例：")
    print(f"\n{'Keypoint':<20} {'Fully Visible':<20} {'Occluded':<20} {'Occlusion Rate':<20}")
    print("-"*80)
    
    kp_occlusion_rates = []
    for kp_name in COCO_KEYPOINT_NAMES:
        fv_count = len(keypoint_stats[kp_name]['fully_visible'])
        oc_count = len(keypoint_stats[kp_name]['occluded'])
        total_kp = fv_count + oc_count
        
        oc_rate = oc_count / total_kp * 100 if total_kp > 0 else 0
        kp_occlusion_rates.append((kp_name, fv_count, oc_count, oc_rate))
        
        print(f"{kp_name:<20} {fv_count:<20} {oc_count:<20} {oc_rate:>6.2f}%")
    
    # 按遮挡率排序
    print(f"\n🔍 遮挡率最高的关键点：")
    sorted_by_occlusion = sorted(kp_occlusion_rates, key=lambda x: x[3], reverse=True)
    for i, (kp, fv, oc, rate) in enumerate(sorted_by_occlusion[:5], 1):
        print(f"{i}. {kp:<20} {rate:>6.2f}% 遮挡 ({oc}/{fv+oc})")
    
    # 与之前val2017的对比
    print(f"\n📊 与 val2017-only 对比：")
    print("-"*80)
    
    with open('./yolo_pose_results/occlusion_analysis.json', 'r') as f:
        val_only = json.load(f)
    
    print(f"{'Dataset':<25} {'Fully Visible':<20} {'Occluded':<20} {'Ratio':<15}")
    print("-"*80)
    
    val_fv = val_only['overall_statistics']['fully_visible']['count']
    val_oc = val_only['overall_statistics']['occluded']['count']
    
    print(f"{'val2017 only':<25} {val_fv:<20} {val_oc:<20} {val_oc/val_fv*100:>6.2f}%")
    print(f"{'train2017+val2017':<25} {visibility_stats['fully_visible']['count']:<20} {visibility_stats['occluded']['count']:<20} {visibility_stats['occluded']['count']/visibility_stats['fully_visible']['count']*100:>6.2f}%")
    
    improvement = visibility_stats['occluded']['count'] / val_oc
    print(f"\n💡 被遮挡样本增加了 {improvement:.1f}x 倍！")
    print(f"   从 {val_oc} → {visibility_stats['occluded']['count']}")


if __name__ == '__main__':
    analyze_extended_dataset()
