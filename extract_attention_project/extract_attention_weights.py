"""
核心注意力权重提取脚本
支持多种 Transformer 模型的注意力权重提取
"""

import os
import sys
import logging
import torch
import torch.nn as nn
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
from tqdm import tqdm
import json

from config import (
    MODEL_CONFIG, DATA_CONFIG, ATTENTION_CONFIG, 
    OUTPUT_CONFIG, KEYPOINT_NAMES, RUN_CONFIG, LOG_CONFIG
)
from utils import (
    ImagePreprocessor, AttentionExtractor, JSONDataSaver, setup_logging
)


class AttentionHookManager:
    """注意力 Hook 管理类"""
    
    def __init__(self):
        self.attention_weights = {}
        self.hooks = []
    
    def register_attention_hooks(self, model: nn.Module) -> None:
        """
        为模型的 Transformer 块注册 Hook
        
        Args:
            model: 模型对象
        """
        for name, module in model.named_modules():
            if 'attn' in name.lower() or 'attention' in name.lower():
                hook = module.register_forward_hook(self._create_hook(name))
                self.hooks.append(hook)
                logging.info(f"为 {name} 注册 Hook")
    
    def _create_hook(self, layer_name: str):
        """创建 Hook 函数"""
        def hook(module, input, output):
            # 处理不同的注意力输出格式
            if isinstance(output, tuple):
                attn = output[0]
            else:
                attn = output
            
            if isinstance(attn, torch.Tensor):
                self.attention_weights[layer_name] = attn.detach().cpu()
        
        return hook
    
    def clear(self) -> None:
        """清除 Hook 和权重"""
        for hook in self.hooks:
            hook.remove()
        self.hooks.clear()
        self.attention_weights.clear()


class TransformerAttentionExtractor:
    """Transformer 注意力提取器"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化提取器
        
        Args:
            config: 配置字典
        """
        self.config = config
        self.device = torch.device(RUN_CONFIG.get('device', 'cpu'))
        self.model = None
        self.preprocessor = None
        self.hook_manager = AttentionHookManager()
        
        # 设置日志
        setup_logging(
            LOG_CONFIG['log_file'],
            LOG_CONFIG['log_level']
        )
    
    def load_model(self) -> None:
        """加载模型"""
        logging.info(f"加载模型: {MODEL_CONFIG['type']}")
        
        model_type = MODEL_CONFIG.get('type', 'vitpose').lower()
        
        try:
            if model_type == 'vitpose':
                self.model = self._load_vitpose()
            elif model_type == 'resnet50':
                self.model = self._load_resnet50()
            elif model_type == 'custom':
                self.model = self._load_custom_model()
            else:
                raise ValueError(f"不支持的模型类型: {model_type}")
            
            self.model = self.model.to(self.device)
            self.model.eval()
            
            # 初始化图像预处理器
            self.preprocessor = ImagePreprocessor(
                input_size=tuple(MODEL_CONFIG['input_size']),
                mean=MODEL_CONFIG['mean'],
                std=MODEL_CONFIG['std']
            )
            
            logging.info("模型加载成功")
        except Exception as e:
            logging.error(f"模型加载失败: {e}")
            raise
    
    def _load_vitpose(self) -> nn.Module:
        """加载 ViTPose 模型"""
        try:
            import timm
            import os
            
            # 设置模型缓存目录到项目的 models 文件夹
            models_dir = os.path.join(os.path.dirname(__file__), 'models')
            os.makedirs(models_dir, exist_ok=True)
            os.environ['TIMM_HOME'] = models_dir
            os.environ['TORCH_HOME'] = models_dir
            
            logging.info(f"模型将下载到: {models_dir}")
            
            # 尝试加载预训练模型
            model = timm.create_model(
                'vit_base_patch16_224',
                pretrained=True,
                num_classes=MODEL_CONFIG['num_keypoints']
            )
            
            logging.info("ViTPose 模型加载成功 (timm)")
            return model
        except Exception as e:
            logging.warning(f"ViTPose 加载失败: {e}，使用简单 Vision Transformer")
            return self._create_simple_vit()
    
    def _load_resnet50(self) -> nn.Module:
        """加载 ResNet50 模型"""
        from torchvision.models import resnet50
        model = resnet50(pretrained=True)
        # 修改最后一层
        model.fc = nn.Linear(2048, MODEL_CONFIG['num_keypoints'])
        return model
    
    def _load_custom_model(self) -> nn.Module:
        """加载自定义模型"""
        checkpoint_path = MODEL_CONFIG.get('checkpoint_path')
        
        if checkpoint_path and os.path.exists(checkpoint_path):
            logging.info(f"从 {checkpoint_path} 加载自定义模型")
            model = torch.load(checkpoint_path, map_location=self.device)
            return model
        else:
            logging.warning("未找到自定义模型，使用简单 ViT")
            return self._create_simple_vit()
    
    def _create_simple_vit(self) -> nn.Module:
        """创建简单的 Vision Transformer 模型"""
        class SimpleViT(nn.Module):
            def __init__(self, num_keypoints=17):
                super().__init__()
                # 特征提取
                self.features = nn.Sequential(
                    nn.Conv2d(3, 64, 7, stride=2, padding=3),
                    nn.BatchNorm2d(64),
                    nn.ReLU(),
                    nn.MaxPool2d(3, stride=2, padding=1),
                    nn.Conv2d(64, 128, 3, padding=1),
                    nn.BatchNorm2d(128),
                    nn.ReLU(),
                    nn.MaxPool2d(3, stride=2, padding=1),
                )
                
                # 自注意力层
                self.self_attn = nn.MultiheadAttention(
                    embed_dim=128,
                    num_heads=8,
                    batch_first=True
                )
                
                # 回归头
                self.regressor = nn.Sequential(
                    nn.AdaptiveAvgPool2d((1, 1)),
                    nn.Flatten(),
                    nn.Linear(128, 256),
                    nn.ReLU(),
                    nn.Linear(256, num_keypoints * 2)
                )
            
            def forward(self, x):
                x = self.features(x)
                
                # 准备自注意力的输入 [batch, seq_len, dim]
                b, c, h, w = x.shape
                x_flat = x.view(b, c, -1).transpose(1, 2)
                
                # 自注意力
                attn_out, attn_weights = self.self_attn(x_flat, x_flat, x_flat)
                
                # 回归
                x_pooled = x.view(b, c, h*w).mean(dim=-1, keepdim=True).unsqueeze(-1)
                keypoints = self.regressor(x)
                
                return keypoints
        
        return SimpleViT(num_keypoints=MODEL_CONFIG['num_keypoints'])
    
    def extract_from_images(self, image_paths: List[str]) -> Dict[str, Any]:
        """
        从一组图像中提取注意力权重
        
        Args:
            image_paths: 图像路径列表
            
        Returns:
            提取结果
        """
        all_importance_scores = []
        all_attention_maps = []
        
        # 注册 Hook
        self.hook_manager.register_attention_hooks(self.model)
        
        with torch.no_grad():
            for image_path in tqdm(image_paths, desc="提取注意力"):
                try:
                    # 预处理图像
                    _, image_tensor = self.preprocessor.load_and_preprocess(image_path)
                    image_tensor = image_tensor.to(self.device)
                    
                    # 前向传播
                    _ = self.model(image_tensor)
                    
                    # 提取注意力权重
                    if self.hook_manager.attention_weights:
                        # 获取最后一层的注意力
                        last_attn = list(self.hook_manager.attention_weights.values())[-1]
                        last_attn_np = last_attn.numpy()
                        
                        # 初始化提取器
                        extractor = AttentionExtractor(
                            num_keypoints=MODEL_CONFIG['num_keypoints'],
                            attention_map_size=ATTENTION_CONFIG['attention_map_size']
                        )
                        
                        # 计算关键点重要性
                        importance = extractor.compute_keypoint_importance(last_attn_np)
                        all_importance_scores.append(importance)
                        
                        # 生成注意力热力图
                        attn_map = extractor.generate_attention_map(last_attn_np)
                        all_attention_maps.append(attn_map)
                    
                    # 清除 Hook 数据
                    self.hook_manager.attention_weights.clear()
                
                except Exception as e:
                    logging.warning(f"处理图像失败 {image_path}: {e}")
                    continue
        
        # 清除 Hook
        self.hook_manager.clear()
        
        # 聚合结果
        if all_importance_scores:
            avg_importance = np.mean(all_importance_scores, axis=0)
        else:
            avg_importance = np.ones(MODEL_CONFIG['num_keypoints']) * 0.5
        
        if all_attention_maps:
            avg_attention_map = np.mean(all_attention_maps, axis=0)
        else:
            avg_attention_map = np.ones((16, 16)) * 0.5
        
        return {
            'keypoint_importance': avg_importance,
            'attention_map': avg_attention_map,
            'num_images_processed': len(all_importance_scores)
        }
    
    def extract_from_directory(self, image_dir: str) -> Dict[str, Any]:
        """
        从目录中提取所有图像的注意力权重
        
        Args:
            image_dir: 图像目录路径
            
        Returns:
            提取结果
        """
        image_dir = Path(image_dir)
        
        # 收集所有图像
        image_paths = []
        extensions = DATA_CONFIG.get('image_extensions', ['.jpg', '.jpeg', '.png'])
        
        for ext in extensions:
            image_paths.extend(image_dir.glob(f'**/*{ext}'))
            image_paths.extend(image_dir.glob(f'**/*{ext.upper()}'))
        
        if not image_paths:
            logging.warning(f"未在 {image_dir} 中找到图像")
            return None
        
        # 限制处理的图像数量
        num_to_process = DATA_CONFIG.get('num_images_to_process', 100)
        image_paths = image_paths[:num_to_process]
        
        logging.info(f"找到 {len(image_paths)} 张图像，将处理 {len(image_paths)} 张")
        
        return self.extract_from_images([str(p) for p in image_paths])
    
    def run(self, image_dir: Optional[str] = None) -> None:
        """
        运行完整的提取流程
        
        Args:
            image_dir: 图像目录，如果为 None 则使用配置中的路径
        """
        if image_dir is None:
            image_dir = DATA_CONFIG['image_dir']
        
        # 加载模型
        self.load_model()
        
        # 提取注意力
        logging.info("开始提取注意力权重...")
        result = self.extract_from_directory(image_dir)
        
        if result is None:
            logging.error("没有处理任何图像，退出")
            return
        
        # 保存结果
        saver = JSONDataSaver(
            keypoint_names=KEYPOINT_NAMES,
            output_path=OUTPUT_CONFIG['output_path']
        )
        
        metadata = {
            'model_type': MODEL_CONFIG['type'],
            'num_images_processed': result['num_images_processed'],
            'input_size': MODEL_CONFIG['input_size'],
            'num_keypoints': MODEL_CONFIG['num_keypoints'],
            'attention_map_size': ATTENTION_CONFIG['attention_map_size']
        }
        
        saver.save_attention_data(
            importance_scores=result['keypoint_importance'],
            attention_map=result['attention_map'],
            metadata=metadata,
            float_precision=OUTPUT_CONFIG.get('float_precision', 4)
        )
        
        logging.info(f"提取完成！输出文件: {OUTPUT_CONFIG['output_path']}")


if __name__ == '__main__':
    extractor = TransformerAttentionExtractor(MODEL_CONFIG)
    extractor.run()
