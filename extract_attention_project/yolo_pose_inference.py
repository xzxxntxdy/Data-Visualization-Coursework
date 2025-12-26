#!/usr/bin/env python3
"""
YOLOv8-Pose 批量推理脚本
使用预训练YOLOv8-Pose模型检测人体关键点和骨架
"""

import os
import json
import glob
from pathlib import Path
import cv2
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:
    print("请先安装: pip install ultralytics")
    exit(1)


# COCO 17个关键点名称
COCO_KEYPOINT_NAMES = [
    'nose',           # 0
    'left_eye',       # 1
    'right_eye',      # 2
    'left_ear',       # 3
    'right_ear',      # 4
    'left_shoulder',  # 5
    'right_shoulder', # 6
    'left_elbow',     # 7
    'right_elbow',    # 8
    'left_wrist',     # 9
    'right_wrist',    # 10
    'left_hip',       # 11
    'right_hip',      # 12
    'left_knee',      # 13
    'right_knee',     # 14
    'left_ankle',     # 15
    'right_ankle',    # 16
]

# 骨架连接关系
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


def run_yolo_pose_inference(image_dir, output_dir, model_name='yolov8n-pose.pt'):
    """
    使用YOLOv8-Pose运行批量推理
    
    Args:
        image_dir: 输入图像目录
        output_dir: 输出目录
        model_name: YOLOv8模型 ('yolov8n-pose.pt', 'yolov8s-pose.pt', 等)
    """
    
    # 创建输出目录
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    viz_dir = os.path.join(output_dir, 'visualized')
    Path(viz_dir).mkdir(parents=True, exist_ok=True)
    
    print(f"加载YOLOv8-Pose模型: {model_name}")
    try:
        model = YOLO(model_name)  # 自动下载预训练模型
    except Exception as e:
        print(f"模型下载失败: {e}")
        print("请手动下载模型到 ~/.yolo/weights/ 目录:")
        print(f"  https://github.com/ultralytics/assets/releases/download/v8.3.0/{model_name}")
        return
    
    # 获取所有图像（支持绝对路径和相对路径）
    if not os.path.isabs(image_dir):
        image_dir = os.path.abspath(image_dir)
    
    image_files = sorted(glob.glob(os.path.join(image_dir, '*.jpg')))
    
    if not image_files:
        print(f"❌ 在 {image_dir} 中找不到 .jpg 文件")
        return
    print(f"找到 {len(image_files)} 张图像")
    
    results_summary = []
    
    for idx, image_path in enumerate(image_files, 1):
        try:
            # 运行推理
            results = model(image_path, verbose=False)
            result = results[0]
            
            image = cv2.imread(image_path)
            h, w = image.shape[:2]
            image_name = Path(image_path).stem
            
            # 提取关键点信息
            keypoints_data = []
            
            if result.keypoints is not None:
                # 关键点形状: (num_people, 17, 3) - 最后一维是 (x, y, confidence)
                keypoints = result.keypoints.xy[0].cpu().numpy()  # 第一个人
                confidences = result.keypoints.conf[0].cpu().numpy()
                
                for kp_id, (x, y) in enumerate(keypoints):
                    keypoints_data.append({
                        'name': COCO_KEYPOINT_NAMES[kp_id],
                        'x': float(x),
                        'y': float(y),
                        'confidence': float(confidences[kp_id])
                    })
                
                mean_confidence = float(confidences.mean())
            else:
                mean_confidence = 0.0
            
            # 保存JSON结果
            json_path = os.path.join(output_dir, f'{image_name}_keypoints.json')
            with open(json_path, 'w') as f:
                json.dump({
                    'image': os.path.basename(image_path),
                    'keypoints': keypoints_data,
                    'mean_confidence': mean_confidence
                }, f, indent=2)
            
            # 可视化结果
            viz_image = result.plot()  # YOLOv8内置可视化
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
    summary_path = os.path.join(output_dir, 'yolo_inference_summary.json')
    with open(summary_path, 'w') as f:
        json.dump({
            'model': model_name,
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
    # 使用绝对路径确保找到图像
    base_dir = os.path.dirname(os.path.abspath(__file__))
    image_dir = os.path.join(base_dir, 'test_images')
    output_dir = os.path.join(base_dir, 'yolo_pose_results')
    
    # 可选的模型选择:
    # 'yolov8n-pose.pt' - nano (最快, ~6M)
    # 'yolov8s-pose.pt' - small (~26M)
    # 'yolov8m-pose.pt' - medium (~52M)
    # 'yolov8l-pose.pt' - large (~92M)
    # 'yolov8x-pose.pt' - xlarge (~131M)
    
    model = 'yolov8n-pose.pt'  # 使用nano版本 (最快)
    
    run_yolo_pose_inference(image_dir, output_dir, model)
