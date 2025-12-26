"""
项目配置文件
"""

import os
from pathlib import Path

# ============ 项目路径配置 ============
PROJECT_ROOT = Path(__file__).parent
MODELS_DIR = PROJECT_ROOT / "models"
TEST_IMAGES_DIR = PROJECT_ROOT / "test_images"
OUTPUT_DIR = PROJECT_ROOT / "output"
LOGS_DIR = PROJECT_ROOT / "logs"

# 确保目录存在
MODELS_DIR.mkdir(exist_ok=True)
TEST_IMAGES_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)

# ============ 模型配置 ============
MODEL_CONFIG = {
    # 模型类型：'vitpose', 'hrnet', 'resnet50', 'custom'
    'type': 'vitpose',
    
    # 模型路径 - 如果不提供，将自动下载
    'checkpoint_path': str(MODELS_DIR / "pose_model.pth"),
    
    # 模型输入配置
    'input_size': [224, 224],  # 输入图像大小 [H, W]
    'mean': [0.485, 0.456, 0.406],  # 标准化均值
    'std': [0.229, 0.224, 0.225],   # 标准化标准差
    
    # 模型输出配置
    'num_keypoints': 17,  # 关键点数量（COCO 标准）
    'num_classes': 1,     # 类别数
    
    # Vision Transformer 配置
    'patch_size': 16,
    'embed_dim': 384,
    'num_heads': 6,
    'num_layers': 12,
    'mlp_dim': 1024,
    'dropout': 0.1,
}

# ============ 数据处理配置 ============
DATA_CONFIG = {
    'image_dir': str(TEST_IMAGES_DIR),
    'image_extensions': ['.jpg', '.jpeg', '.png'],
    'num_images_to_process': 100,  # 处理的图像数量
    'batch_size': 8,
    'num_workers': 4,
}

# ============ 注意力提取配置 ============
ATTENTION_CONFIG = {
    # 要提取的注意力层
    'target_layers': [11],  # 最后一层（从0开始计数）
    
    # 是否提取 cross-attention
    'extract_cross_attention': True,
    
    # 注意力图的分辨率
    'attention_map_size': 16,  # 16x16
    
    # 是否保存所有中间注意力
    'save_intermediate': False,
}

# ============ 输出配置 ============
OUTPUT_CONFIG = {
    # 输出文件名
    'output_filename': 'pose_model_attention.json',
    'output_path': str(OUTPUT_DIR / 'pose_model_attention.json'),
    
    # 输出格式
    'format': 'json',
    
    # 是否包含元数据
    'include_metadata': True,
    
    # 保存精度
    'float_precision': 4,  # 小数位数
}

# ============ 关键点名称映射（COCO 17关键点）============
KEYPOINT_NAMES = [
    "鼻子",      # 0
    "左眼",      # 1
    "右眼",      # 2
    "左耳",      # 3
    "右耳",      # 4
    "左肩",      # 5
    "右肩",      # 6
    "左肘",      # 7
    "右肘",      # 8
    "左腕",      # 9
    "右腕",      # 10
    "左髋",      # 11
    "右髋",      # 12
    "左膝",      # 13
    "右膝",      # 14
    "左踝",      # 15
    "右踝",      # 16
]

# ============ 运行配置 ============
RUN_CONFIG = {
    'device': 'cuda:0',  # 或 'cpu'
    'seed': 42,
    'verbose': True,
    'debug': False,
}

# ============ 日志配置 ============
LOG_CONFIG = {
    'log_dir': str(LOGS_DIR),
    'log_level': 'INFO',
    'log_file': str(LOGS_DIR / 'extraction.log'),
}
