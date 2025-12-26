"""
姿态估计推理脚本
用于从图像推理出人物的 17 个关键点位置
"""

import os
import cv2
import torch
import numpy as np
import json
from typing import Dict, List, Tuple, Optional
from pathlib import Path

from pose_model import PoseTransformerModel, SimplePoseModel


# COCO 17 个关键点定义
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

# 关键点对（用于绘制骨架）
KEYPOINT_PAIRS = [
    (0, 1), (0, 2),      # 鼻子 - 眼睛
    (1, 3), (2, 4),      # 眼睛 - 耳朵
    (5, 6),              # 肩膀
    (5, 7), (7, 9),      # 左臂
    (6, 8), (8, 10),     # 右臂
    (5, 11), (6, 12),    # 躯干
    (11, 13), (13, 15),  # 左腿
    (12, 14), (14, 16),  # 右腿
]


class PoseEstimator:
    """姿态估计推理器"""
    
    def __init__(
        self,
        model_path: str,
        model_type: str = "simple",
        image_size: int = 256,
        device: Optional[torch.device] = None,
    ):
        """
        初始化推理器
        
        Args:
            model_path: 模型权重文件路径
            model_type: 模型类型 ("transformer" 或 "simple")
            image_size: 输入图像大小
            device: 设备（CPU/GPU）
        """
        self.image_size = image_size
        self.model_type = model_type
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # 创建模型
        self._create_model()
        
        # 加载权重
        if os.path.exists(model_path):
            print(f"加载模型权重: {model_path}")
            checkpoint = torch.load(model_path, map_location=self.device)
            self.model.load_state_dict(checkpoint)
        else:
            print(f"警告: 模型文件不存在 {model_path}")
        
        self.model.to(self.device)
        self.model.eval()
    
    def _create_model(self):
        """创建模型"""
        if self.model_type == "transformer":
            self.model = PoseTransformerModel(
                image_size=self.image_size,
                patch_size=16,
                num_heads=8,
                num_layers=12,
                dim=768,
                num_keypoints=17,
            )
        else:  # simple
            self.model = SimplePoseModel(num_keypoints=17, feature_dim=256)
    
    def estimate_from_image(
        self,
        image_path: str,
        confidence_threshold: float = 0.5,
    ) -> Dict:
        """
        从图像文件估计关键点
        
        Args:
            image_path: 图像文件路径
            confidence_threshold: 置信度阈值
            
        Returns:
            包含关键点和置信度的字典
        """
        # 读取图像
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"无法读取图像: {image_path}")
        
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        original_h, original_w = image_rgb.shape[:2]
        
        # 推理
        results = self._infer(image_rgb)
        
        # 转换回原始图像尺寸
        results['keypoints'] = results['keypoints'] * np.array([original_w, original_h])
        results['original_image'] = image
        results['image_path'] = image_path
        
        return results
    
    def estimate_from_array(
        self,
        image: np.ndarray,
        confidence_threshold: float = 0.5,
    ) -> Dict:
        """
        从 numpy 数组估计关键点
        
        Args:
            image: BGR 格式的图像数组 (H, W, 3)
            confidence_threshold: 置信度阈值
            
        Returns:
            包含关键点和置信度的字典
        """
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        return self._infer(image_rgb, confidence_threshold)
    
    def _infer(
        self,
        image_rgb: np.ndarray,
        confidence_threshold: float = 0.5,
    ) -> Dict:
        """
        执行推理
        
        Args:
            image_rgb: RGB 格式的图像 (H, W, 3)
            confidence_threshold: 置信度阈值
            
        Returns:
            推理结果字典
        """
        with torch.no_grad():
            # 调整大小
            image_resized = cv2.resize(image_rgb, (self.image_size, self.image_size))
            
            # 标准化
            image_tensor = torch.tensor(image_resized, dtype=torch.float32).unsqueeze(0)
            image_tensor = image_tensor.permute(0, 3, 1, 2) / 255.0  # (1, 3, H, W)
            
            # 应用标准化
            mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
            std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
            image_tensor = (image_tensor - mean) / std
            
            image_tensor = image_tensor.to(self.device)
            
            # 推理
            outputs = self.model(image_tensor)
            
            # 提取结果
            keypoints = outputs['keypoints'][0].cpu().numpy()  # (17, 2)
            confidence = outputs['confidence'][0].cpu().numpy()  # (17,)
            features = outputs['keypoint_features'][0].cpu().numpy()  # (17, dim)
            
            # 应用置信度阈值
            valid_keypoints = confidence >= confidence_threshold
            
            # 组织结果
            results = {
                'keypoints': keypoints,  # 归一化到 [0, 1]
                'confidence': confidence,
                'features': features,  # 倒数第二层特征
                'valid_keypoints': valid_keypoints,
                'keypoint_names': COCO_KEYPOINT_NAMES,
            }
        
        return results
    
    def visualize_keypoints(
        self,
        image: np.ndarray,
        keypoints: np.ndarray,
        confidence: np.ndarray,
        confidence_threshold: float = 0.5,
        show_keypoint_names: bool = False,
    ) -> np.ndarray:
        """
        在图像上绘制关键点和骨架
        
        Args:
            image: BGR 格式的原始图像
            keypoints: 关键点坐标 (17, 2)，像素坐标
            confidence: 关键点置信度 (17,)
            confidence_threshold: 置信度阈值
            show_keypoint_names: 是否显示关键点名称
            
        Returns:
            标注后的图像
        """
        h, w = image.shape[:2]
        result_image = image.copy()
        
        # 绘制骨架
        for kp_id1, kp_id2 in KEYPOINT_PAIRS:
            if (confidence[kp_id1] > confidence_threshold and 
                confidence[kp_id2] > confidence_threshold):
                pt1 = tuple(keypoints[kp_id1].astype(int))
                pt2 = tuple(keypoints[kp_id2].astype(int))
                cv2.line(result_image, pt1, pt2, (0, 255, 0), 2)
        
        # 绘制关键点
        for kp_id, (x, y) in enumerate(keypoints):
            if confidence[kp_id] > confidence_threshold:
                x, y = int(x), int(y)
                # 根据置信度确定颜色
                conf_color = int(255 * confidence[kp_id])
                color = (0, conf_color, 255 - conf_color)
                cv2.circle(result_image, (x, y), 5, color, -1)
                cv2.circle(result_image, (x, y), 5, (255, 255, 255), 1)
                
                # 显示关键点名称
                if show_keypoint_names:
                    text = f"{COCO_KEYPOINT_NAMES[kp_id]}"
                    cv2.putText(result_image, text, (x + 5, y - 5),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        
        return result_image
    
    def export_results(
        self,
        results: Dict,
        image_keypoints: np.ndarray,
        output_json: str,
    ):
        """
        导出推理结果为 JSON
        
        Args:
            results: 推理结果字典
            image_keypoints: 像素坐标的关键点
            output_json: 输出 JSON 文件路径
        """
        export_data = {
            'keypoints': image_keypoints.tolist(),
            'confidence': results['confidence'].tolist(),
            'keypoint_names': results['keypoint_names'],
            'valid_keypoints': results['valid_keypoints'].tolist(),
        }
        
        # 为每个有效关键点添加详细信息
        keypoints_detail = []
        for kp_id, (kp_name, conf) in enumerate(
            zip(results['keypoint_names'], results['confidence'])
        ):
            if results['valid_keypoints'][kp_id]:
                keypoints_detail.append({
                    'id': kp_id,
                    'name': kp_name,
                    'position': image_keypoints[kp_id].tolist(),
                    'confidence': float(conf),
                })
        
        export_data['keypoints_detail'] = keypoints_detail
        
        os.makedirs(os.path.dirname(output_json), exist_ok=True)
        with open(output_json, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        print(f"结果已导出: {output_json}")


def main():
    """示例使用"""
    import argparse
    
    parser = argparse.ArgumentParser(description="姿态估计推理")
    parser.add_argument("--model-path", type=str, required=True,
                       help="模型权重文件路径")
    parser.add_argument("--image-path", type=str, required=True,
                       help="输入图像路径")
    parser.add_argument("--model-type", type=str, choices=["transformer", "simple"],
                       default="simple", help="模型类型")
    parser.add_argument("--output-dir", type=str, default="./inference_results",
                       help="输出目录")
    parser.add_argument("--confidence-threshold", type=float, default=0.5,
                       help="置信度阈值")
    parser.add_argument("--gpu", type=int, default=0, help="GPU ID")
    
    args = parser.parse_args()
    
    # 创建推理器
    device = torch.device(f"cuda:{args.gpu}" if torch.cuda.is_available() else "cpu")
    estimator = PoseEstimator(
        model_path=args.model_path,
        model_type=args.model_type,
        device=device,
    )
    
    # 推理
    print(f"处理图像: {args.image_path}")
    results = estimator.estimate_from_image(args.image_path, args.confidence_threshold)
    
    # 获取原始图像尺寸的关键点
    original_image = results['original_image']
    h, w = original_image.shape[:2]
    image_keypoints = results['keypoints']
    confidence = results['confidence']
    
    # 可视化
    vis_image = estimator.visualize_keypoints(
        original_image,
        image_keypoints,
        confidence,
        confidence_threshold=args.confidence_threshold,
        show_keypoint_names=True,
    )
    
    # 保存可视化结果
    os.makedirs(args.output_dir, exist_ok=True)
    
    image_name = Path(args.image_path).stem
    output_image_path = os.path.join(args.output_dir, f"{image_name}_keypoints.jpg")
    cv2.imwrite(output_image_path, vis_image)
    print(f"可视化结果已保存: {output_image_path}")
    
    # 导出 JSON
    output_json_path = os.path.join(args.output_dir, f"{image_name}_results.json")
    estimator.export_results(results, image_keypoints, output_json_path)
    
    # 打印关键点信息
    print("\n检测到的关键点:")
    for kp_id, (name, conf) in enumerate(
        zip(results['keypoint_names'], results['confidence'])
    ):
        if results['valid_keypoints'][kp_id]:
            x, y = image_keypoints[kp_id]
            print(f"  {name:15s} ({x:7.2f}, {y:7.2f}) - 置信度: {conf:.3f}")


if __name__ == "__main__":
    main()
