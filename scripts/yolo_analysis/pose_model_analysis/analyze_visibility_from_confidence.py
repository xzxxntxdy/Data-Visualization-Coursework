"""
基于置信度分布生成关键点可见性统计
将置信度分布转换为COCO标准的可见性指标：
- visibility=2: 完全可见（高置信度）
- visibility=1: 被遮挡（中等置信度）  
- visibility=0: 未标注（低置信度或不可见）
"""

import json
import numpy as np
from pathlib import Path

def calculate_visibility_from_confidence():
    """
    基于置信度统计计算关键点的可见性分布
    使用百分位数划分：
    - 置信度 > 75th percentile: 完全可见 (visibility=2)
    - 置信度在 25th-75th: 被遮挡/部分可见 (visibility=1)
    - 置信度 < 25th percentile: 未标注/不可见 (visibility=0)
    """
    
    data_file = Path('src/data/pose_analysis_results.json')
    
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    keypoint_stats = data['keypoint_stats']
    
    # 为每个关键点计算可见性统计
    visibility_stats = {}
    body_region_visibility = {}
    
    for kp_name, stats in keypoint_stats.items():
        mean_conf = stats['mean']
        std_conf = stats['std']
        detected_rate = stats['detection_rate']  # 0-100
        detected_count = stats['detected_count']
        total_count = stats['total_count']
        
        # 计算可见性分布
        # 基于检测率和置信度
        # 检测率高 + 置信度高 = 完全可见
        # 检测率中等或置信度中等 = 被遮挡/部分可见
        # 检测率低 = 未标注
        
        detected_ratio = detected_count / total_count if total_count > 0 else 0
        
        # 可见性指标（0-2 的分数）
        if detected_ratio > 0.7 and mean_conf > 0.65:
            visibility_level = 2  # 完全可见
            visibility_pct = detected_ratio * 100
        elif detected_ratio > 0.5 or mean_conf > 0.5:
            visibility_level = 1  # 部分可见/被遮挡
            visibility_pct = (detected_ratio + mean_conf) / 2 * 100
        else:
            visibility_level = 0  # 未标注/不可见
            visibility_pct = 0
        
        # 获取身体部位
        body_region = get_body_region(kp_name)
        
        visibility_stats[kp_name] = {
            'visibility_level': visibility_level,
            'visibility_score': visibility_pct,  # 0-100分
            'mean_confidence': mean_conf,
            'std_confidence': std_conf,
            'detection_rate': detected_rate,
            'detected_ratio': detected_ratio * 100,  # 转换为百分比
            'body_region': body_region,
            'interpretation': get_visibility_interpretation(visibility_level)
        }
        
        # 累计身体部位的可见性统计
        if body_region not in body_region_visibility:
            body_region_visibility[body_region] = {
                'fully_visible_count': 0,
                'partially_visible_count': 0,
                'not_visible_count': 0,
                'mean_visibility_score': 0,
                'keypoints': []
            }
        
        if visibility_level == 2:
            body_region_visibility[body_region]['fully_visible_count'] += 1
        elif visibility_level == 1:
            body_region_visibility[body_region]['partially_visible_count'] += 1
        else:
            body_region_visibility[body_region]['not_visible_count'] += 1
        
        body_region_visibility[body_region]['keypoints'].append({
            'name': kp_name,
            'visibility_level': visibility_level,
            'visibility_score': visibility_pct
        })
    
    # 计算每个身体部位的平均可见性分数
    for region, stats in body_region_visibility.items():
        scores = [kp['visibility_score'] for kp in stats['keypoints']]
        stats['mean_visibility_score'] = np.mean(scores) if scores else 0
        # 删除临时keypoints列表
        del stats['keypoints']
    
    # 更新pose_analysis_results.json
    data['visibility_analysis'] = {
        'keypoint_visibility': visibility_stats,
        'body_region_visibility': body_region_visibility,
        'metadata': {
            'algorithm': 'confidence_based_visibility_estimation',
            'visibility_levels': {
                '2': '完全可见 - 高检测率且高置信度',
                '1': '部分可见 - 中等检测率或中等置信度',
                '0': '未标注/不可见 - 低检测率或低置信度'
            }
        }
    }
    
    # 更新chart_data中的scatter数据，使用visibility_score代替occlusion
    scatter_data = []
    for kp_name, kp_stats in keypoint_stats.items():
        vis_info = visibility_stats[kp_name]
        scatter_data.append({
            'keypoint': kp_name,
            'visibility_score': vis_info['visibility_score'],  # X轴：可见性分数(0-100)
            'confidence': kp_stats['mean'],                     # Y轴：置信度(0-1)
            'region': vis_info['body_region'],
            'detection_rate': kp_stats['detection_rate']
        })
    
    if 'chart_data' not in data:
        data['chart_data'] = {}
    data['chart_data']['body_region_scatter'] = scatter_data
    
    # 保存更新后的数据
    with open(data_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("✓ 已添加可见性统计到 src/data/pose_analysis_results.json")
    print("\n=== 可见性分析摘要 ===")
    print("\n按关键点:")
    for kp_name, vis_stat in list(visibility_stats.items())[:5]:
        print(f"  {kp_name:15} → visibility={vis_stat['visibility_level']} "
              f"score={vis_stat['visibility_score']:.1f}% "
              f"({vis_stat['interpretation']})")
    
    print("\n按身体部位:")
    for region, stats in body_region_visibility.items():
        total = (stats['fully_visible_count'] + stats['partially_visible_count'] + 
                stats['not_visible_count'])
        print(f"  {region:6} → 完全可见:{stats['fully_visible_count']}/{total} "
              f"平均分数:{stats['mean_visibility_score']:.1f}%")
    
    print(f"\n✓ 生成了 {len(scatter_data)} 个关键点的可见性数据点")
    return visibility_stats, body_region_visibility

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

def get_visibility_interpretation(visibility_level):
    """获取可见性等级的解释"""
    if visibility_level == 2:
        return '完全可见'
    elif visibility_level == 1:
        return '部分可见'
    else:
        return '未标注/不可见'

if __name__ == '__main__':
    calculate_visibility_from_confidence()
