"""
数据处理工具函数
"""

import json
import logging
import numpy as np
import cv2
from pathlib import Path
from typing import List, Dict, Tuple, Any
import torch
import torch.nn.functional as F
from torchvision import transforms


class ImagePreprocessor:
    """图像预处理类"""
    
    def __init__(self, input_size: Tuple[int, int], 
                 mean: List[float], 
                 std: List[float]):
        """
        初始化图像预处理器
        
        Args:
            input_size: (H, W) 输入尺寸
            mean: 标准化均值
            std: 标准化标准差
        """
        self.input_size = input_size
        self.transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std)
        ])
    
    def load_and_preprocess(self, image_path: str) -> Tuple[np.ndarray, torch.Tensor]:
        """
        加载和预处理图像
        
        Args:
            image_path: 图像路径
            
        Returns:
            原始图像和预处理后的张量
        """
        # 读取图像
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"无法读取图像: {image_path}")
        
        # BGR -> RGB
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Resize
        image_resized = cv2.resize(image_rgb, (self.input_size[1], self.input_size[0]))
        
        # 转为 PIL Image 用于 transform
        from PIL import Image
        image_pil = Image.fromarray(image_resized)
        
        # 标准化和转换为张量
        image_tensor = self.transform(image_pil)
        
        return image_resized, image_tensor.unsqueeze(0)  # 添加 batch 维度


class AttentionExtractor:
    """注意力权重提取类"""
    
    def __init__(self, num_keypoints: int, attention_map_size: int):
        """
        初始化注意力提取器
        
        Args:
            num_keypoints: 关键点数量
            attention_map_size: 注意力图大小（如 16 表示 16x16）
        """
        self.num_keypoints = num_keypoints
        self.attention_map_size = attention_map_size
        self.attention_weights = []
    
    def extract_attention_from_hooks(self, attention_dict: Dict[str, torch.Tensor]) -> Dict[str, Any]:
        """
        从 hook 获得的注意力权重中提取关键信息
        
        Args:
            attention_dict: 包含各层注意力权重的字典
            
        Returns:
            提取结果字典
        """
        result = {
            'keypoint_importance': [],
            'attention_map': None,
            'layer_attentions': {}
        }
        
        # 处理每一层的注意力
        for layer_name, attn_weights in attention_dict.items():
            # attn_weights shape: [batch, num_heads, seq_len, seq_len]
            if len(attn_weights.shape) == 4:
                # 平均所有 head 和 batch
                attn_weights = attn_weights.mean(dim=(0, 1))  # [seq_len, seq_len]
            
            result['layer_attentions'][layer_name] = attn_weights.cpu().numpy()
        
        return result
    
    def compute_keypoint_importance(self, attention_weights: np.ndarray) -> np.ndarray:
        """
        计算每个关键点的重要性分数
        
        Args:
            attention_weights: 注意力权重矩阵 [seq_len, seq_len]
            
        Returns:
            关键点重要性分数 [num_keypoints]
        """
        # 计算每个关键点的平均注意力
        # 假设 seq_len = num_patches + 1（包含 [CLS] token）
        # num_patches = (H/patch_size) * (W/patch_size)
        
        importance = np.zeros(self.num_keypoints)
        
        # 简单方法：使用注意力的最后一行（与输出相关的注意力）
        if len(attention_weights) > 0:
            # 获取最后一行注意力权重（表示最后输出对所有 token 的关注）
            last_attention = attention_weights[-1, :]
            
            # 归一化
            last_attention = (last_attention - last_attention.min()) / (last_attention.max() - last_attention.min() + 1e-8)
            
            # 将注意力映射到关键点
            # 如果 seq_len > num_keypoints，进行下采样或聚合
            if len(last_attention) > self.num_keypoints:
                # 取前 num_keypoints 个（跳过 [CLS] token）
                importance = last_attention[1:self.num_keypoints+1]
            else:
                importance = last_attention[:self.num_keypoints]
        
        return importance
    
    def generate_attention_map(self, attention_weights: np.ndarray) -> np.ndarray:
        """
        生成 Attention 热力图
        
        Args:
            attention_weights: 原始注意力权重
            
        Returns:
            16x16 的注意力热力图
        """
        # 如果输入维度过高，先进行降维
        if len(attention_weights.shape) > 2:
            attention_weights = attention_weights[0]
        
        # 调整大小到 attention_map_size x attention_map_size
        attention_map = cv2.resize(
            attention_weights,
            (self.attention_map_size, self.attention_map_size),
            interpolation=cv2.INTER_LINEAR
        )
        
        # 归一化到 [0, 1]
        attention_map = (attention_map - attention_map.min()) / (attention_map.max() - attention_map.min() + 1e-8)
        attention_map = np.clip(attention_map, 0, 1)
        
        return attention_map


class JSONDataSaver:
    """JSON 数据保存类"""
    
    def __init__(self, keypoint_names: List[str], output_path: str):
        """
        初始化 JSON 保存器
        
        Args:
            keypoint_names: 关键点名称列表
            output_path: 输出文件路径
        """
        self.keypoint_names = keypoint_names
        self.output_path = output_path
    
    def save_attention_data(self, 
                           importance_scores: np.ndarray,
                           attention_map: np.ndarray,
                           metadata: Dict[str, Any] = None,
                           float_precision: int = 4) -> None:
        """
        保存注意力数据为 JSON
        
        Args:
            importance_scores: 关键点重要性分数 [num_keypoints]
            attention_map: 注意力热力图 [H, W]
            metadata: 元数据字典
            float_precision: 浮点数精度
        """
        output_data = {
            'keypoint_importance': [],
            'attention_map_16x16': []
        }
        
        # 添加关键点重要性
        for idx, name in enumerate(self.keypoint_names):
            if idx < len(importance_scores):
                score_val = importance_scores[idx]
                # 处理 numpy 数组的情况
                if isinstance(score_val, np.ndarray):
                    # 展平数组
                    score_val = score_val.flatten()[0] if score_val.size > 0 else 0.5
                if hasattr(score_val, 'item'):
                    score = float(score_val.item())
                else:
                    score = float(score_val)
            else:
                score = 0.5
            score = round(score, float_precision)
            
            output_data['keypoint_importance'].append({
                'id': idx,
                'name': name,
                'importance_score': score
            })
        
        # 添加注意力热力图
        if attention_map is not None:
            for row in attention_map:
                output_data['attention_map_16x16'].append([
                    round(float(val), float_precision) for val in row
                ])
        
        # 添加元数据
        if metadata:
            output_data['metadata'] = metadata
        
        # 保存到文件
        output_path = Path(self.output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        logging.info(f"数据已保存到: {output_path}")
    
    @staticmethod
    def load_attention_data(json_path: str) -> Dict[str, Any]:
        """
        加载 JSON 数据
        
        Args:
            json_path: JSON 文件路径
            
        Returns:
            解析后的数据字典
        """
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data


def setup_logging(log_file: str, log_level: str = 'INFO') -> None:
    """
    设置日志
    
    Args:
        log_file: 日志文件路径
        log_level: 日志级别
    """
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
