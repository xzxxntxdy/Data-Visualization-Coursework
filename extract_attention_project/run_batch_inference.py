#!/usr/bin/env python3
"""
批量运行推理脚本
对test_images目录中的所有图像进行推理
"""

import os
import json
import glob
from pathlib import Path
from inference import PoseEstimator
import cv2

def run_batch_inference(model_path, image_dir, output_dir):
    """运行批量推理"""
    
    # 创建输出目录
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    viz_dir = os.path.join(output_dir, 'visualized')
    Path(viz_dir).mkdir(parents=True, exist_ok=True)
    
    # 初始化推理器
    estimator = PoseEstimator(model_path, device='cuda')
    
    # 获取所有图像文件
    image_files = sorted(glob.glob(os.path.join(image_dir, '*.jpg')))
    print(f"找到 {len(image_files)} 张测试图像")
    
    results_summary = []
    
    for idx, image_path in enumerate(image_files, 1):
        try:
            # 运行推理
            results = estimator.estimate_from_image(image_path)
            
            # 保存结果JSON
            image_name = Path(image_path).stem
            json_path = os.path.join(output_dir, f'{image_name}_keypoints.json')
            with open(json_path, 'w') as f:
                json.dump({
                    'image': os.path.basename(image_path),
                    'keypoints': [
                        {
                            'name': results['keypoint_names'][i],
                            'x': float(results['keypoints'][i, 0]),
                            'y': float(results['keypoints'][i, 1]),
                            'confidence': float(results['confidence'][i])
                        }
                        for i in range(17)
                    ],
                    'mean_confidence': float(results['confidence'].mean())
                }, f, indent=2)
            
            # 可视化关键点
            image = cv2.imread(image_path)
            viz_image = estimator.visualize_keypoints(
                image, 
                results['keypoints'], 
                results['confidence']
            )
            viz_path = os.path.join(viz_dir, f'{image_name}_viz.jpg')
            cv2.imwrite(viz_path, viz_image)
            
            results_summary.append({
                'image': os.path.basename(image_path),
                'mean_confidence': float(results['confidence'].mean()),
                'status': 'success'
            })
            
            if idx % 50 == 0:
                print(f"已处理 {idx}/{len(image_files)} 张图像...")
                
        except Exception as e:
            print(f"错误处理 {image_path}: {str(e)}")
            results_summary.append({
                'image': os.path.basename(image_path),
                'status': 'failed',
                'error': str(e)
            })
    
    # 保存汇总结果
    summary_path = os.path.join(output_dir, 'inference_summary.json')
    with open(summary_path, 'w') as f:
        json.dump({
            'total_images': len(image_files),
            'successful': sum(1 for r in results_summary if r['status'] == 'success'),
            'failed': sum(1 for r in results_summary if r['status'] == 'failed'),
            'results': results_summary
        }, f, indent=2)
    
    print(f"\n推理完成！")
    print(f"✓ 成功处理: {sum(1 for r in results_summary if r['status'] == 'success')}/{len(image_files)}")
    print(f"✗ 失败: {sum(1 for r in results_summary if r['status'] == 'failed')}/{len(image_files)}")
    print(f"结果保存到: {output_dir}")
    print(f"可视化图像保存到: {viz_dir}")


if __name__ == '__main__':
    model_path = './checkpoints/checkpoint_epoch_50.pth'
    image_dir = './test_images'
    output_dir = './inference_results'
    
    run_batch_inference(model_path, image_dir, output_dir)
