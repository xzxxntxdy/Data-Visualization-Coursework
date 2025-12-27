"""
从COCO原始标注文件中提取各关键点的visibility统计
这是真实的标注数据，而不是从置信度推断的
"""

import json
import numpy as np
from pathlib import Path
from collections import defaultdict

COCO_KEYPOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
]

def extract_visibility_from_coco_annotations(annotation_file_path):
    """
    从COCO标注文件中提取关键点的visibility分布
    COCO visibility标记: 0=not labeled, 1=occluded, 2=visible
    """
    
    print(f"📖 读取COCO标注文件: {annotation_file_path}")
    
    with open(annotation_file_path, 'r', encoding='utf-8') as f:
        coco_data = json.load(f)
    
    # 初始化统计数据
    keypoint_visibility_stats = {kp: {'visible': 0, 'occluded': 0, 'not_labeled': 0} 
                                 for kp in COCO_KEYPOINT_NAMES}
    
    # 遍历所有标注
    total_keypoints = 0
    total_people = 0
    
    for annotation in coco_data['annotations']:
        # 每个annotation代表一个人
        total_people += 1
        
        # keypoints格式: [x, y, visibility] × 17
        keypoints = annotation['keypoints']
        
        # 每个关键点占3个值
        for kp_idx in range(17):
            visibility = keypoints[kp_idx * 3 + 2]
            kp_name = COCO_KEYPOINT_NAMES[kp_idx]
            
            total_keypoints += 1
            
            if visibility == 2:
                keypoint_visibility_stats[kp_name]['visible'] += 1
            elif visibility == 1:
                keypoint_visibility_stats[kp_name]['occluded'] += 1
            else:  # visibility == 0
                keypoint_visibility_stats[kp_name]['not_labeled'] += 1
    
    print(f"✓ 解析完成: {total_people} 个人物, {total_keypoints} 个关键点")
    
    # 计算百分比和可见度指标
    visibility_analysis = {}
    
    for kp_name, stats in keypoint_visibility_stats.items():
        total = sum(stats.values())
        
        visible_pct = (stats['visible'] / total * 100) if total > 0 else 0
        occluded_pct = (stats['occluded'] / total * 100) if total > 0 else 0
        not_labeled_pct = (stats['not_labeled'] / total * 100) if total > 0 else 0
        
        # 可见度分数: (visible + occluded/2) / total
        # 这反映了有标注的关键点的比例，其中visible权重更高
        visibility_score = ((stats['visible'] + stats['occluded'] * 0.5) / total * 100) if total > 0 else 0
        
        visibility_analysis[kp_name] = {
            'visible_count': stats['visible'],
            'visible_pct': visible_pct,
            'occluded_count': stats['occluded'],
            'occluded_pct': occluded_pct,
            'not_labeled_count': stats['not_labeled'],
            'not_labeled_pct': not_labeled_pct,
            'visibility_score': visibility_score,  # 0-100: higher=more visible
            'total_count': total
        }
    
    return visibility_analysis, total_people

def combine_train_val_visibility(train_file, val_file):
    """
    合并训练集和验证集的visibility统计
    """
    print("\n" + "="*80)
    print("从COCO训练集和验证集提取visibility")
    print("="*80)
    
    train_vis, train_people = extract_visibility_from_coco_annotations(train_file)
    print()
    val_vis, val_people = extract_visibility_from_coco_annotations(val_file)
    
    # 合并统计
    combined_vis = {}
    
    for kp_name in COCO_KEYPOINT_NAMES:
        train_stats = train_vis[kp_name]
        val_stats = val_vis[kp_name]
        
        total_visible = train_stats['visible_count'] + val_stats['visible_count']
        total_occluded = train_stats['occluded_count'] + val_stats['occluded_count']
        total_not_labeled = train_stats['not_labeled_count'] + val_stats['not_labeled_count']
        total = total_visible + total_occluded + total_not_labeled
        
        combined_vis[kp_name] = {
            'visible_count': total_visible,
            'visible_pct': total_visible / total * 100 if total > 0 else 0,
            'occluded_count': total_occluded,
            'occluded_pct': total_occluded / total * 100 if total > 0 else 0,
            'not_labeled_count': total_not_labeled,
            'not_labeled_pct': total_not_labeled / total * 100 if total > 0 else 0,
            'visibility_score': ((total_visible + total_occluded * 0.5) / total * 100) if total > 0 else 0,
            'total_count': total,
            'train': {
                'visible_pct': train_stats['visible_pct'],
                'occluded_pct': train_stats['occluded_pct'],
                'count': train_stats['total_count']
            },
            'val': {
                'visible_pct': val_stats['visible_pct'],
                'occluded_pct': val_stats['occluded_pct'],
                'count': val_stats['total_count']
            }
        }
    
    return combined_vis, train_people, val_people

def get_body_region(keypoint_name):
    """获取关键点所属的身体部位"""
    head_kps = {'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'}
    upper_limbs = {'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'}
    torso = {'left_hip', 'right_hip'}
    lower_limbs = {'left_knee', 'right_knee', 'left_ankle', 'right_ankle'}
    
    if keypoint_name in head_kps:
        return '头部'
    elif keypoint_name in upper_limbs:
        return '上肢'
    elif keypoint_name in torso:
        return '躯干'
    elif keypoint_name in lower_limbs:
        return '下肢'
    return '其他'

def print_visibility_report(visibility_analysis):
    """打印可见度报告"""
    print("\n" + "="*80)
    print("📊 COCO数据集可见度统计 (train2017 + val2017)")
    print("="*80)
    
    print(f"\n{'关键点':<15} {'可见':<8} {'遮挡':<8} {'未标注':<8} {'可见度分数':<12} {'身体部位'}")
    print("-" * 80)
    
    body_region_stats = defaultdict(lambda: {'visibility_scores': [], 'counts': 0})
    
    for kp_name in COCO_KEYPOINT_NAMES:
        vis = visibility_analysis[kp_name]
        region = get_body_region(kp_name)
        
        print(f"{kp_name:<15} {vis['visible_pct']:>6.1f}% {vis['occluded_pct']:>6.1f}% "
              f"{vis['not_labeled_pct']:>6.1f}% {vis['visibility_score']:>10.1f}%  {region}")
        
        body_region_stats[region]['visibility_scores'].append(vis['visibility_score'])
        body_region_stats[region]['counts'] += 1
    
    print("\n" + "="*80)
    print("📈 按身体部位统计")
    print("="*80)
    
    for region in ['头部', '上肢', '躯干', '下肢']:
        if region in body_region_stats:
            stats = body_region_stats[region]
            avg_score = np.mean(stats['visibility_scores']) if stats['visibility_scores'] else 0
            print(f"{region:<8} → 平均可见度: {avg_score:>6.1f}%  ({stats['counts']} 个关键点)")
    
    return body_region_stats

if __name__ == '__main__':
    # 从COCO标注文件中提取可见度
    train_file = '/home/xie/下载/annotations_trainval2017/annotations/person_keypoints_train2017.json'
    val_file = '/home/xie/下载/annotations_trainval2017/annotations/person_keypoints_val2017.json'
    
    if Path(train_file).exists() and Path(val_file).exists():
        visibility_analysis, train_people, val_people = combine_train_val_visibility(train_file, val_file)
        print(f"\n📊 总统计: {train_people + val_people} 个人物")
        
        body_region_stats = print_visibility_report(visibility_analysis)
        
        # 保存结果
        coco_visibility_file = '/home/xie/桌面/Data-Visualization-Coursework/src/data/coco_keypoint_visibility.json'
        
        save_data = {
            'metadata': {
                'source': 'COCO 2017 (train + val)',
                'total_people': train_people + val_people,
                'algorithm': 'direct_extraction_from_coco_annotations',
                'visibility_definition': {
                    '2': 'visible - 关键点可见，在图像中清晰',
                    '1': 'occluded - 关键点被遮挡',
                    '0': 'not_labeled - 关键点未标注/不可见'
                }
            },
            'keypoint_visibility': visibility_analysis,
            'body_region_visibility': {
                region: {
                    'mean_visibility_score': np.mean(stats['visibility_scores']),
                    'keypoint_count': stats['counts']
                }
                for region, stats in body_region_stats.items()
            }
        }
        
        with open(coco_visibility_file, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ 结果已保存到: {coco_visibility_file}")
    else:
        print(f"❌ 未找到COCO标注文件")
        print(f"   Train: {train_file}")
        print(f"   Val: {val_file}")
