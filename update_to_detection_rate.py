"""
使用 detection_rate (检测率) 替代推断的遮挡率
这更准确地反映：关键点被模型成功检测的比例
"""

import json
import os

def update_pose_analysis_with_detection_rate():
    """用 detection_rate 更新数据"""
    
    data_file = 'src/data/pose_analysis_results.json'
    
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 更新chart_data中的body_region_scatter数据
    # 使用detection_rate作为X轴（表示检测率），mean作为Y轴（表示准确度）
    body_region_scatter = []
    
    for kp_name, kp_stats in data['keypoint_stats'].items():
        detection_rate = kp_stats.get('detection_rate', 0)
        mean_confidence = kp_stats.get('mean', 0)
        
        body_region_scatter.append({
            'keypoint': kp_name,
            'detection_rate': detection_rate,  # X轴：检测率（0-100）
            'confidence': mean_confidence,      # Y轴：置信度（0-1）
            'region': get_body_region(kp_name)
        })
    
    # 更新chart_data
    if 'chart_data' not in data:
        data['chart_data'] = {}
    
    data['chart_data']['body_region_scatter'] = body_region_scatter
    
    # 更新metadata，记录这次更新
    if 'metadata' not in data:
        data['metadata'] = {}
    
    data['metadata']['scatter_plot_metric'] = 'detection_rate'
    data['metadata']['scatter_plot_description'] = '关键点检测率 vs 平均置信度关系'
    
    # 保存更新后的数据
    with open(data_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ 已更新 {data_file}")
    print(f"  - body_region_scatter 使用 detection_rate 作为X轴")
    print(f"  - 共 {len(body_region_scatter)} 个关键点数据点")
    print(f"\n样例数据点:")
    for point in body_region_scatter[:3]:
        print(f"  {point['keypoint']}: 检测率={point['detection_rate']:.1f}%, 置信度={point['confidence']:.3f}")

def get_body_region(keypoint_name):
    """根据关键点名称获取所属身体部位"""
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
    return 'unknown'

if __name__ == '__main__':
    update_pose_analysis_with_detection_rate()
