#!/usr/bin/env python3
"""
关键点检测置信度 vs COCO遮挡程度关联分析
展示检测难度与遮挡程度的关联性
"""

import json
import numpy as np
from pathlib import Path

# COCO数据路径
COCO_ANN_FILE = './data/coco/annotations/person_keypoints_val2017.json'
YOLO_RESULTS_DIR = './yolo_pose_results'

# COCO 17个关键点
COCO_KEYPOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
]

def analyze_occlusion_vs_confidence():
    """
    分析遮挡程度vs检测置信度的关联
    
    COCO visibility标志:
    - 0: 不存在 (not labeled)
    - 1: 存在但被遮挡 (occluded)
    - 2: 完全可见 (visible)
    """
    
    print("="*70)
    print("COCO遮挡程度 vs YOLOv8-Pose检测置信度分析")
    print("="*70)
    
    # 1. 加载COCO注解
    print("\n📂 加载COCO标注文件...")
    with open(COCO_ANN_FILE, 'r') as f:
        coco_data = json.load(f)
    
    # 构建image_id到注解的映射
    image_id_to_annotations = {}
    for ann in coco_data['annotations']:
        img_id = ann['image_id']
        if img_id not in image_id_to_annotations:
            image_id_to_annotations[img_id] = []
        image_id_to_annotations[img_id].append(ann)
    
    # 构建image_id到文件名的映射
    image_id_to_filename = {}
    for img in coco_data['images']:
        image_id_to_filename[img['id']] = img['file_name']
    
    print(f"✓ 加载了 {len(coco_data['annotations'])} 个标注")
    print(f"✓ 加载了 {len(coco_data['images'])} 张图像")
    
    # 2. 加载推理结果
    print("\n📂 加载推理结果...")
    import glob
    json_files = sorted(glob.glob(f'{YOLO_RESULTS_DIR}/*_keypoints.json'))
    print(f"✓ 加载了 {len(json_files)} 个推理结果")
    
    # 3. 遮挡程度统计
    occlusion_stats = {
        'fully_visible': {      # visibility == 2
            'confidences': [],
            'keypoint_counts': {}
        },
        'occluded': {            # visibility == 1
            'confidences': [],
            'keypoint_counts': {}
        },
        'not_labeled': {         # visibility == 0
            'confidences': [],
            'keypoint_counts': {}
        }
    }
    
    # 4. 遍历推理结果，匹配COCO标注
    matched_count = 0
    
    for json_file in json_files:
        try:
            image_name = Path(json_file).stem.replace('_keypoints', '')
            
            # 从文件名提取image_id
            image_id = int(image_name)
            
            if image_id not in image_id_to_annotations:
                continue
            
            # 加载推理结果
            with open(json_file, 'r') as f:
                yolo_result = json.load(f)
            
            # 获取COCO标注中第一个人（通常是主体）
            coco_ann = image_id_to_annotations[image_id][0]
            coco_keypoints = np.array(coco_ann['keypoints']).reshape(-1, 3)  # (17, 3) -> (x, y, visibility)
            
            # 获取推理结果
            yolo_keypoints = yolo_result['keypoints']
            
            # 按遮挡程度分类
            for kp_idx, (kp_name, coco_kp, yolo_kp) in enumerate(
                zip(COCO_KEYPOINT_NAMES, coco_keypoints, yolo_keypoints)
            ):
                coco_visibility = int(coco_kp[2])  # 0, 1, 或 2
                yolo_confidence = yolo_kp['confidence']
                
                # 分类
                if coco_visibility == 2:
                    category = 'fully_visible'
                elif coco_visibility == 1:
                    category = 'occluded'
                else:
                    category = 'not_labeled'
                
                occlusion_stats[category]['confidences'].append(yolo_confidence)
                
                # 统计每个关键点在不同遮挡程度下的置信度
                if kp_name not in occlusion_stats[category]['keypoint_counts']:
                    occlusion_stats[category]['keypoint_counts'][kp_name] = []
                occlusion_stats[category]['keypoint_counts'][kp_name].append(yolo_confidence)
            
            matched_count += 1
            
        except Exception as e:
            pass
    
    print(f"\n✓ 成功匹配 {matched_count} 张图像的标注和推理结果")
    
    # 5. 统计分析
    print("\n" + "="*70)
    print("遮挡程度统计 (COCO标注vs推理置信度):")
    print("="*70)
    print(f"\n{'遮挡程度':<20} {'样本数':<10} {'平均置信度':<15} {'标准差':<10} {'范围':<20}")
    print("-"*70)
    
    overall_stats = {}
    for category, label in [
        ('fully_visible', '✅ 完全可见'),
        ('occluded', '⚠️  被遮挡'),
        ('not_labeled', '❌ 未标注')
    ]:
        if occlusion_stats[category]['confidences']:
            confs = np.array(occlusion_stats[category]['confidences'])
            mean_conf = np.mean(confs)
            std_conf = np.std(confs)
            min_conf = np.min(confs)
            max_conf = np.max(confs)
            
            overall_stats[category] = {
                'count': len(confs),
                'mean': float(mean_conf),
                'std': float(std_conf),
                'min': float(min_conf),
                'max': float(max_conf)
            }
            
            print(f"{label:<20} {len(confs):<10} {mean_conf:.4f}        {std_conf:.4f}    "
                  f"[{min_conf:.3f}, {max_conf:.3f}]")
    
    # 6. 每个关键点在不同遮挡程度下的表现
    print("\n" + "="*70)
    print("关键点在不同遮挡程度下的置信度:")
    print("="*70)
    print(f"\n{'关键点':<15} {'完全可见':<15} {'被遮挡':<15} {'差异':<10}")
    print("-"*70)
    
    keypoint_analysis = {}
    for kp_name in COCO_KEYPOINT_NAMES:
        visible_confs = occlusion_stats['fully_visible']['keypoint_counts'].get(kp_name, [])
        occluded_confs = occlusion_stats['occluded']['keypoint_counts'].get(kp_name, [])
        
        if visible_confs and occluded_confs:
            visible_mean = np.mean(visible_confs)
            occluded_mean = np.mean(occluded_confs)
            diff = visible_mean - occluded_mean
            
            keypoint_analysis[kp_name] = {
                'fully_visible': {
                    'mean': float(visible_mean),
                    'std': float(np.std(visible_confs)),
                    'count': len(visible_confs)
                },
                'occluded': {
                    'mean': float(occluded_mean),
                    'std': float(np.std(occluded_confs)),
                    'count': len(occluded_confs)
                },
                'difference': float(diff)  # 正数表示完全可见时置信度更高
            }
            
            direction = "↓ 遮挡降低" if diff > 0 else "↑ 遮挡提高"
            print(f"{kp_name:<15} {visible_mean:.4f} ± {np.std(visible_confs):.3f}   "
                  f"{occluded_mean:.4f} ± {np.std(occluded_confs):.3f}   {abs(diff):+.4f} {direction}")
    
    # 7. 关键发现
    print("\n" + "="*70)
    print("关键发现:")
    print("="*70)
    
    if overall_stats['fully_visible']['mean'] > overall_stats['occluded']['mean']:
        diff_pct = (
            (overall_stats['fully_visible']['mean'] - overall_stats['occluded']['mean']) 
            / overall_stats['occluded']['mean'] * 100
        )
        print(f"\n✅ 完全可见的关键点置信度更高！")
        print(f"   完全可见: {overall_stats['fully_visible']['mean']:.4f}")
        print(f"   被遮挡:   {overall_stats['occluded']['mean']:.4f}")
        print(f"   相对提升: {diff_pct:.1f}%")
    
    # 找出最容易受遮挡影响的关键点
    worst_keypoints = sorted(
        keypoint_analysis.items(),
        key=lambda x: x[1]['difference'],
        reverse=True
    )[:5]
    
    print(f"\n⚠️  最容易受遮挡影响的5个关键点 (完全可见 vs 被遮挡置信度差异最大):")
    for kp_name, stats in worst_keypoints:
        if stats['difference'] > 0:
            print(f"   {kp_name}: {stats['fully_visible']['mean']:.4f} → {stats['occluded']['mean']:.4f} "
                  f"(下降 {stats['difference']:.4f})")
    
    # 找出最鲁棒的关键点
    robust_keypoints = sorted(
        keypoint_analysis.items(),
        key=lambda x: x[1]['difference']
    )[:5]
    
    print(f"\n✅ 最鲁棒的5个关键点 (遮挡影响最小):")
    for kp_name, stats in robust_keypoints:
        if stats['difference'] >= 0:
            print(f"   {kp_name}: 完全可见 {stats['fully_visible']['mean']:.4f}, "
                  f"被遮挡 {stats['occluded']['mean']:.4f} (仅下降 {stats['difference']:.4f})")
    
    # 8. 保存详细结果
    output = {
        'overall_statistics': overall_stats,
        'keypoint_analysis': keypoint_analysis,
        'interpretation': {
            'coco_visibility_meaning': {
                'fully_visible': 'visibility = 2',
                'occluded': 'visibility = 1',
                'not_labeled': 'visibility = 0'
            },
            'finding': f'完全可见的关键点置信度平均比被遮挡的高 {(overall_stats["fully_visible"]["mean"]/overall_stats["occluded"]["mean"]-1)*100:.1f}%'
        }
    }
    
    output_file = f'{YOLO_RESULTS_DIR}/occlusion_analysis.json'
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✅ 详细分析已保存到: {output_file}")


if __name__ == '__main__':
    analyze_occlusion_vs_confidence()
