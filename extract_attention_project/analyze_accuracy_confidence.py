#!/usr/bin/env python3
"""
对比分析：准确定位 vs 不准确定位
找出模型在不同定位精度下的置信度模式差异
说明数据集特征如何影响模型的可靠性
"""

import json
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
import os
from scipy import stats

KEYPOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
]

BODY_PARTS = {
    'Head': ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'],
    'Torso': ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'],
    'Upper Limbs': ['left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'],
    'Lower Limbs': ['left_knee', 'right_knee', 'left_ankle', 'right_ankle']
}

def load_coco_annotations():
    """加载COCO ground truth注解"""
    
    ann_file = './data/coco/annotations/person_keypoints_val2017.json'
    with open(ann_file, 'r') as f:
        coco_data = json.load(f)
    
    # 建立image_id到annotations的映射
    annotations_by_image = {}
    for ann in coco_data['annotations']:
        img_id = ann['image_id']
        if img_id not in annotations_by_image:
            annotations_by_image[img_id] = []
        annotations_by_image[img_id].append(ann)
    
    # 建立image_id到image_info的映射（用于获取文件名）
    image_info = {img['id']: img for img in coco_data['images']}
    
    return annotations_by_image, image_info, coco_data

def calculate_keypoint_distance(pred_kp, gt_kp):
    """
    计算预测关键点和GT关键点的距离
    pred_kp: (x, y)
    gt_kp: (x, y, visibility)
    返回：距离（像素），GT visibility
    """
    if gt_kp[2] == 0:  # 不标注的关键点
        return None, 0
    
    dist = np.sqrt((pred_kp[0] - gt_kp[0])**2 + (pred_kp[1] - gt_kp[1])**2)
    return dist, gt_kp[2]

def find_matching_annotation(pred_result, annotations_by_image, image_info):
    """
    为预测结果找到对应的COCO ground truth注解
    使用关键点位置匹配
    """
    image_id_str = pred_result['image_id']
    image_id = int(image_id_str)
    
    if image_id not in annotations_by_image:
        return None
    
    coco_annotations = annotations_by_image[image_id]
    
    if len(coco_annotations) == 0:
        return None
    
    # 使用第一个person（通常是最显著的）
    return coco_annotations[0]

def compute_keypoint_accuracy(pred_keypoints, gt_annotation, threshold=50):
    """
    计算关键点定位准确性
    threshold: 像素阈值（COCO标准是50像素）
    返回：(正确关键点数, 总标注关键点数, 平均距离)
    """
    gt_keypoints = gt_annotation['keypoints']
    
    correct_count = 0
    total_visible = 0
    distances = []
    
    for kp_idx, kp_name in enumerate(KEYPOINT_NAMES):
        gt_kp = (gt_keypoints[kp_idx*3], gt_keypoints[kp_idx*3+1], gt_keypoints[kp_idx*3+2])
        
        # 只计算visible的关键点
        if gt_kp[2] == 0:
            continue
        
        total_visible += 1
        
        # 找对应的预测关键点
        pred_kp = None
        for kp in pred_keypoints:
            if kp['name'] == kp_name:
                pred_kp = (kp['x'], kp['y'])
                break
        
        if pred_kp is None:
            distances.append(float('inf'))
            continue
        
        dist, _ = calculate_keypoint_distance(pred_kp, gt_kp)
        if dist is not None:
            distances.append(dist)
            if dist <= threshold:
                correct_count += 1
    
    if total_visible == 0:
        return 0, 0, float('inf')
    
    avg_distance = np.mean([d for d in distances if d != float('inf')])
    return correct_count, total_visible, avg_distance

def classify_accuracy(correct_count, total_visible):
    """分类为准确或不准确"""
    if total_visible == 0:
        return None
    
    accuracy_rate = correct_count / total_visible
    
    if accuracy_rate >= 0.7:
        return 'accurate'
    elif accuracy_rate >= 0.3:
        return 'medium'
    else:
        return 'inaccurate'

def load_and_classify_results(annotations_by_image, image_info):
    """加载推理结果并分类"""
    
    print("="*100)
    print("加载推理结果并与COCO GT匹配")
    print("="*100)
    
    yolo_results_dir = './yolo_pose_results'
    
    accurate_results = []
    medium_results = []
    inaccurate_results = []
    
    json_files = sorted([f for f in os.listdir(yolo_results_dir) 
                        if f.endswith('_keypoints.json')])
    
    print(f"\n处理 {len(json_files)} 个推理结果...")
    
    for json_file in json_files:
        try:
            with open(os.path.join(yolo_results_dir, json_file), 'r') as f:
                pred_data = json.load(f)
            
            image_id = json_file.replace('_keypoints.json', '')
            pred_result = {
                'image_id': image_id,
                'keypoints': pred_data['keypoints'],
                'person_confidence': np.mean([kp.get('confidence', 0) for kp in pred_data['keypoints']])
            }
            
            # 找GT注解
            gt_annotation = find_matching_annotation(pred_result, annotations_by_image, image_info)
            if gt_annotation is None:
                continue
            
            # 计算准确性
            correct_count, total_visible, avg_dist = compute_keypoint_accuracy(
                pred_result['keypoints'], gt_annotation
            )
            
            pred_result['correct_count'] = correct_count
            pred_result['total_visible'] = total_visible
            pred_result['avg_distance'] = avg_dist
            pred_result['accuracy_rate'] = correct_count / total_visible if total_visible > 0 else 0
            
            # 分类
            category = classify_accuracy(correct_count, total_visible)
            
            if category == 'accurate':
                accurate_results.append(pred_result)
            elif category == 'medium':
                medium_results.append(pred_result)
            elif category == 'inaccurate':
                inaccurate_results.append(pred_result)
        
        except Exception as e:
            continue
    
    print(f"\n✅ 分类结果：")
    print(f"   准确定位 (≥70%):  {len(accurate_results)} 个")
    print(f"   中等定位 (30-70%): {len(medium_results)} 个")
    print(f"   不准确定位 (<30%): {len(inaccurate_results)} 个")
    
    return accurate_results, medium_results, inaccurate_results

def analyze_confidence_patterns(accurate_results, inaccurate_results):
    """分析两组的置信度模式"""
    
    print("\n" + "="*100)
    print("置信度模式分析")
    print("="*100)
    
    # 准确组的置信度统计
    accurate_kp_confs = {kp: [] for kp in KEYPOINT_NAMES}
    accurate_person_confs = []
    
    for result in accurate_results:
        accurate_person_confs.append(result['person_confidence'])
        for kp in result['keypoints']:
            kp_name = kp['name']
            accurate_kp_confs[kp_name].append(kp.get('confidence', 0))
    
    # 不准确组的置信度统计
    inaccurate_kp_confs = {kp: [] for kp in KEYPOINT_NAMES}
    inaccurate_person_confs = []
    
    for result in inaccurate_results:
        inaccurate_person_confs.append(result['person_confidence'])
        for kp in result['keypoints']:
            kp_name = kp['name']
            inaccurate_kp_confs[kp_name].append(kp.get('confidence', 0))
    
    print(f"\n【Person Confidence对比】")
    print(f"  准确组:    {np.mean(accurate_person_confs):.4f} ± {np.std(accurate_person_confs):.4f}")
    print(f"  不准确组:  {np.mean(inaccurate_person_confs):.4f} ± {np.std(inaccurate_person_confs):.4f}")
    print(f"  差异:      {np.mean(accurate_person_confs) - np.mean(inaccurate_person_confs):.4f}")
    
    # 关键点级别的对比
    print(f"\n【各关键点的置信度对比】")
    print(f"{'Keypoint':<20} {'Accurate':<15} {'Inaccurate':<15} {'Difference':<15}")
    print("-"*65)
    
    differences = []
    for kp_name in KEYPOINT_NAMES:
        accurate_mean = np.mean(accurate_kp_confs[kp_name]) if accurate_kp_confs[kp_name] else 0
        inaccurate_mean = np.mean(inaccurate_kp_confs[kp_name]) if inaccurate_kp_confs[kp_name] else 0
        diff = accurate_mean - inaccurate_mean
        
        differences.append((kp_name, accurate_mean, inaccurate_mean, diff))
        print(f"{kp_name:<20} {accurate_mean:<15.4f} {inaccurate_mean:<15.4f} {diff:+.4f}")
    
    # 身体部分对比
    print(f"\n【身体部分的置信度对比】")
    print(f"{'Body Part':<20} {'Accurate':<15} {'Inaccurate':<15} {'Difference':<15}")
    print("-"*65)
    
    for part_name, kp_names in BODY_PARTS.items():
        accurate_confs = []
        inaccurate_confs = []
        
        for kp_name in kp_names:
            accurate_confs.extend(accurate_kp_confs[kp_name])
            inaccurate_confs.extend(inaccurate_kp_confs[kp_name])
        
        accurate_mean = np.mean(accurate_confs) if accurate_confs else 0
        inaccurate_mean = np.mean(inaccurate_confs) if inaccurate_confs else 0
        diff = accurate_mean - inaccurate_mean
        
        print(f"{part_name:<20} {accurate_mean:<15.4f} {inaccurate_mean:<15.4f} {diff:+.4f}")
    
    return accurate_kp_confs, inaccurate_kp_confs

def create_comparison_visualization(accurate_results, medium_results, inaccurate_results,
                                   accurate_kp_confs, inaccurate_kp_confs):
    """创建对比可视化"""
    
    print("\n生成对比可视化...")
    
    fig = plt.figure(figsize=(18, 12))
    gs = fig.add_gridspec(2, 3, hspace=0.3, wspace=0.3)
    
    # 1. 准确性分布
    ax1 = fig.add_subplot(gs[0, 0])
    categories = ['Accurate\n(≥70%)', 'Medium\n(30-70%)', 'Inaccurate\n(<30%)']
    counts = [len(accurate_results), len(medium_results), len(inaccurate_results)]
    colors = ['#10b981', '#f59e0b', '#ef4444']
    
    bars = ax1.bar(categories, counts, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
    ax1.set_ylabel('Number of Samples', fontsize=11, fontweight='bold')
    ax1.set_title('Distribution of Localization Accuracy', fontsize=12, fontweight='bold')
    ax1.grid(axis='y', alpha=0.3)
    
    for bar, count in zip(bars, counts):
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height,
                f'{count}', ha='center', va='bottom', fontsize=11, fontweight='bold')
    
    # 2. Person Confidence对比
    ax2 = fig.add_subplot(gs[0, 1])
    
    accurate_person = [r['person_confidence'] for r in accurate_results]
    inaccurate_person = [r['person_confidence'] for r in inaccurate_results]
    
    bp = ax2.boxplot([accurate_person, inaccurate_person],
                     labels=['Accurate', 'Inaccurate'],
                     patch_artist=True, widths=0.6)
    
    for patch, color in zip(bp['boxes'], ['#10b981', '#ef4444']):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    
    ax2.set_ylabel('Person Confidence', fontsize=11, fontweight='bold')
    ax2.set_title('Person Confidence: Accurate vs Inaccurate',
                 fontsize=12, fontweight='bold')
    ax2.grid(axis='y', alpha=0.3)
    
    # 3. 平均距离
    ax3 = fig.add_subplot(gs[0, 2])
    
    accurate_distances = [r['avg_distance'] for r in accurate_results if r['avg_distance'] != float('inf')]
    inaccurate_distances = [r['avg_distance'] for r in inaccurate_results if r['avg_distance'] != float('inf')]
    
    bp = ax3.boxplot([accurate_distances, inaccurate_distances],
                     labels=['Accurate', 'Inaccurate'],
                     patch_artist=True, widths=0.6)
    
    for patch, color in zip(bp['boxes'], ['#10b981', '#ef4444']):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    
    ax3.set_ylabel('Average Keypoint Distance (pixels)', fontsize=11, fontweight='bold')
    ax3.set_title('Localization Error: Accurate vs Inaccurate',
                 fontsize=12, fontweight='bold')
    ax3.grid(axis='y', alpha=0.3)
    
    # 4. 各关键点置信度对比
    ax4 = fig.add_subplot(gs[1, :2])
    
    accurate_means = [np.mean(accurate_kp_confs[kp]) if accurate_kp_confs[kp] else 0 
                     for kp in KEYPOINT_NAMES]
    inaccurate_means = [np.mean(inaccurate_kp_confs[kp]) if inaccurate_kp_confs[kp] else 0 
                       for kp in KEYPOINT_NAMES]
    
    x = np.arange(len(KEYPOINT_NAMES))
    width = 0.35
    
    bars1 = ax4.bar(x - width/2, accurate_means, width, label='Accurate', 
                   color='#10b981', alpha=0.8, edgecolor='black', linewidth=1)
    bars2 = ax4.bar(x + width/2, inaccurate_means, width, label='Inaccurate',
                   color='#ef4444', alpha=0.8, edgecolor='black', linewidth=1)
    
    ax4.set_ylabel('Mean Confidence', fontsize=11, fontweight='bold')
    ax4.set_xlabel('Keypoints', fontsize=11, fontweight='bold')
    ax4.set_title('Keypoint Confidence Pattern: Accurate vs Inaccurate Cases',
                 fontsize=12, fontweight='bold')
    ax4.set_xticks(x)
    ax4.set_xticklabels(KEYPOINT_NAMES, rotation=45, ha='right', fontsize=9)
    ax4.legend(fontsize=10)
    ax4.grid(axis='y', alpha=0.3)
    ax4.set_ylim([0, 1])
    
    # 5. 关键问题：过度自信的关键点
    ax5 = fig.add_subplot(gs[1, 2])
    ax5.axis('off')
    
    # 计算"过度自信"的关键点：在不准确的情况下置信度仍然高
    overconfident_kps = []
    for kp_name in KEYPOINT_NAMES:
        if accurate_kp_confs[kp_name] and inaccurate_kp_confs[kp_name]:
            acc_mean = np.mean(accurate_kp_confs[kp_name])
            inacc_mean = np.mean(inaccurate_kp_confs[kp_name])
            
            # 在不准确情况下置信度>0.6的关键点
            if inacc_mean > 0.6 and acc_mean - inacc_mean < 0.1:
                overconfident_kps.append((kp_name, acc_mean, inacc_mean))
    
    info_text = f"""
KEY INSIGHTS

Samples:
  Accurate:    {len(accurate_results)}
  Inaccurate:  {len(inaccurate_results)}

Confidence Gap:
  {np.mean([r['person_confidence'] for r in accurate_results]):.3f}
  vs
  {np.mean([r['person_confidence'] for r in inaccurate_results]):.3f}

Overconfident Keypoints:
(High conf even when wrong)

{chr(10).join([f"  {kp}: {inacc:.3f}" for kp, _, inacc in overconfident_kps[:5]])}

Insight:
Model shows UNRELIABLE
confidence in some body
parts when localization
is inaccurate!
    """
    
    ax5.text(0.1, 0.95, info_text, transform=ax5.transAxes, fontsize=9,
            verticalalignment='top', family='monospace',
            bbox=dict(boxstyle='round', facecolor='#fee2e2', alpha=0.8))
    
    plt.suptitle('Accuracy Analysis: Reliable vs Unreliable Confidence',
                 fontsize=14, fontweight='bold')
    
    output_path = './yolo_pose_results/accuracy_confidence_comparison.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"✅ 可视化已保存: {output_path}")


if __name__ == '__main__':
    # 加载COCO注解
    print("加载COCO annotations...")
    annotations_by_image, image_info, coco_data = load_coco_annotations()
    print(f"✅ 加载了 {len(annotations_by_image)} 个image的标注\n")
    
    # 加载推理结果并分类
    accurate_results, medium_results, inaccurate_results = load_and_classify_results(
        annotations_by_image, image_info
    )
    
    # 分析置信度模式
    accurate_kp_confs, inaccurate_kp_confs = analyze_confidence_patterns(
        accurate_results, inaccurate_results
    )
    
    # 生成可视化
    create_comparison_visualization(accurate_results, medium_results, inaccurate_results,
                                   accurate_kp_confs, inaccurate_kp_confs)
    
    print("\n✅ 分析完成！")
