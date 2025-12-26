#!/usr/bin/env python3
"""
MediaPipe Pose 批量推理脚本
使用Google MediaPipe轻量级模型检测人体关键点和骨架
不需要网络下载，离线运行
"""

import os
import json
import glob
from pathlib import Path
import cv2
import numpy as np

try:
    import mediapipe as mp
except ImportError:
    print("请先安装: pip install mediapipe")
    exit(1)


# MediaPipe输出33个关键点，我们提取最常用的17个COCO关键点映射
MEDIAPIPE_TO_COCO = {
    0: 'nose',           # Nose
    2: 'left_eye',       # Left Eye Inner
    5: 'right_eye',      # Right Eye Inner
    7: 'left_ear',       # Left Ear
    8: 'right_ear',      # Right Ear
    11: 'left_shoulder', # Left Shoulder
    12: 'right_shoulder',# Right Shoulder
    13: 'left_elbow',    # Left Elbow
    14: 'right_elbow',   # Right Elbow
    15: 'left_wrist',    # Left Wrist
    16: 'right_wrist',   # Right Wrist
    23: 'left_hip',      # Left Hip
    24: 'right_hip',     # Right Hip
    25: 'left_knee',     # Left Knee
    26: 'right_knee',    # Right Knee
    27: 'left_ankle',    # Left Ankle
    28: 'right_ankle',   # Right Ankle
}

COCO_KEYPOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
]

SKELETON = [
    (0, 1), (0, 2),      # 鼻子-眼睛
    (1, 3), (2, 4),      # 眼睛-耳朵
    (5, 6),              # 肩膀
    (5, 7), (7, 9),      # 左臂
    (6, 8), (8, 10),     # 右臂
    (5, 11), (6, 12),    # 躯干
    (11, 13), (13, 15),  # 左腿
    (12, 14), (14, 16),  # 右腿
]


def draw_skeleton(image, keypoints, confidences, threshold=0.5):
    """绘制关键点和骨架"""
    h, w = image.shape[:2]
    viz_image = image.copy()
    
    # 绘制骨架
    for kp_id1, kp_id2 in SKELETON:
        if confidences[kp_id1] > threshold and confidences[kp_id2] > threshold:
            pt1 = tuple(keypoints[kp_id1].astype(int))
            pt2 = tuple(keypoints[kp_id2].astype(int))
            cv2.line(viz_image, pt1, pt2, (0, 255, 0), 2)
    
    # 绘制关键点
    for kp_id, (x, y) in enumerate(keypoints):
        if confidences[kp_id] > threshold:
            x, y = int(x), int(y)
            conf_color = int(255 * min(confidences[kp_id], 1.0))
            color = (0, conf_color, 255 - conf_color)
            cv2.circle(viz_image, (x, y), 5, color, -1)
            cv2.circle(viz_image, (x, y), 5, (255, 255, 255), 1)
    
    return viz_image


def run_mediapipe_pose_inference(image_dir, output_dir):
    """使用MediaPipe运行批量推理"""
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    viz_dir = os.path.join(output_dir, 'visualized')
    Path(viz_dir).mkdir(parents=True, exist_ok=True)
    
    print("初始化MediaPipe Pose...")
    mp_pose = mp.solutions.pose
    
    with mp_pose.Pose(
        static_image_mode=True,
        model_complexity=1,
        min_detection_confidence=0.5
    ) as pose:
        
        # 获取所有图像
        image_files = sorted(glob.glob(os.path.join(image_dir, '*.jpg')))
        if not image_files:
            print(f"❌ 在 {image_dir} 中找不到 .jpg 文件")
            return
        
        print(f"找到 {len(image_files)} 张图像")
        
        results_summary = []
        
        for idx, image_path in enumerate(image_files, 1):
            try:
                # 读取图像
                image = cv2.imread(image_path)
                if image is None:
                    raise ValueError(f"无法读取图像")
                
                h, w = image.shape[:2]
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                image_name = Path(image_path).stem
                
                # 运行推理
                results = pose.process(image_rgb)
                
                keypoints_data = []
                mean_confidence = 0.0
                
                if results.pose_landmarks:
                    # 提取17个COCO关键点
                    keypoints = np.zeros((17, 2))
                    confidences = np.zeros(17)
                    
                    coco_idx = 0
                    for mp_idx, coco_name in MEDIAPIPE_TO_COCO.items():
                        landmark = results.pose_landmarks.landmark[mp_idx]
                        keypoints[coco_idx] = [landmark.x * w, landmark.y * h]
                        confidences[coco_idx] = landmark.visibility
                        
                        keypoints_data.append({
                            'name': coco_name,
                            'x': float(keypoints[coco_idx, 0]),
                            'y': float(keypoints[coco_idx, 1]),
                            'confidence': float(confidences[coco_idx])
                        })
                        coco_idx += 1
                    
                    mean_confidence = float(confidences.mean())
                    
                    # 绘制可视化
                    viz_image = draw_skeleton(image, keypoints, confidences, threshold=0.3)
                else:
                    viz_image = image.copy()
                
                # 保存JSON结果
                json_path = os.path.join(output_dir, f'{image_name}_keypoints.json')
                with open(json_path, 'w') as f:
                    json.dump({
                        'image': os.path.basename(image_path),
                        'keypoints': keypoints_data,
                        'mean_confidence': mean_confidence
                    }, f, indent=2)
                
                # 保存可视化图像
                viz_path = os.path.join(viz_dir, f'{image_name}_viz.jpg')
                cv2.imwrite(viz_path, viz_image)
                
                results_summary.append({
                    'image': os.path.basename(image_path),
                    'mean_confidence': mean_confidence,
                    'num_keypoints': len(keypoints_data),
                    'status': 'success'
                })
                
                if idx % 50 == 0:
                    print(f"已处理 {idx}/{len(image_files)} 张图像...")
                
            except Exception as e:
                print(f"❌ 错误处理 {image_path}: {str(e)}")
                results_summary.append({
                    'image': os.path.basename(image_path),
                    'status': 'failed',
                    'error': str(e)
                })
        
        # 保存汇总结果
        summary_path = os.path.join(output_dir, 'mediapipe_inference_summary.json')
        with open(summary_path, 'w') as f:
            json.dump({
                'model': 'MediaPipe Pose',
                'total_images': len(image_files),
                'successful': sum(1 for r in results_summary if r['status'] == 'success'),
                'failed': sum(1 for r in results_summary if r['status'] == 'failed'),
                'results': results_summary
            }, f, indent=2)
        
        print(f"\n✅ 推理完成！")
        print(f"✓ 成功: {sum(1 for r in results_summary if r['status'] == 'success')}/{len(image_files)}")
        print(f"✗ 失败: {sum(1 for r in results_summary if r['status'] == 'failed')}/{len(image_files)}")
        print(f"结果保存到: {output_dir}")
        print(f"可视化图像: {viz_dir}")


if __name__ == '__main__':
    image_dir = './test_images'
    output_dir = './mediapipe_pose_results'
    
    run_mediapipe_pose_inference(image_dir, output_dir)
