#!/usr/bin/env python3
"""
下载预训练的 Pose Transformer 模型
使用 ViTPose-B 官方权重（训练更充分）
"""

import os
import sys
import json
import logging
from pathlib import Path
import torch
import urllib.request
import urllib.error

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent
MODELS_DIR = PROJECT_ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

# 官方模型下载链接
MODEL_SOURCES = {
    "vitpose_b": {
        "name": "ViTPose-B (Official Pretrained)",
        "url": "https://github.com/ViTAE-Transformer/ViTPose/releases/download/v0.1/vitpose-b-multi-coco.pth",
        "size": "~100MB"
    },
    "vitpose_s": {
        "name": "ViTPose-S (Faster, Smaller)",
        "url": "https://github.com/ViTAE-Transformer/ViTPose/releases/download/v0.1/vitpose-s-multi-coco.pth",
        "size": "~30MB"
    },
    "timm_vitpose": {
        "name": "ViT Base from timm (Pretrained on ImageNet)",
        "url": "https://huggingface.co/timm/vit_base_patch16_224.augreg2_in21k_ft_in1k/resolve/main/pytorch_model.bin",
        "size": "~350MB"
    }
}

def download_file(url, output_path, model_name):
    """下载文件，显示进度"""
    try:
        logger.info(f"\n⬇️  正在下载 {model_name}...")
        logger.info(f"   URL: {url}")
        
        def show_progress(block_num, block_size, total_size):
            downloaded = block_num * block_size
            percent = min(downloaded * 100 // total_size, 100)
            logger.info(f"   进度: {percent}% ({downloaded / 1024 / 1024:.1f}MB)")
        
        urllib.request.urlretrieve(url, output_path, reporthook=show_progress)
        logger.info(f"✅ 下载完成: {output_path}")
        return True
    except Exception as e:
        logger.error(f"❌ 下载失败: {e}")
        return False

def verify_model(model_path):
    """验证模型文件"""
    try:
        checkpoint = torch.load(model_path, map_location='cpu')
        logger.info(f"✅ 模型验证成功")
        
        if isinstance(checkpoint, dict):
            if 'model' in checkpoint:
                logger.info(f"   参数数量: {sum(p.numel() for p in checkpoint['model'].values())}")
            elif 'state_dict' in checkpoint:
                logger.info(f"   参数数量: {sum(p.numel() for p in checkpoint['state_dict'].values())}")
        
        return True
    except Exception as e:
        logger.error(f"❌ 模型验证失败: {e}")
        return False

def main():
    """主函数"""
    logger.info("="*60)
    logger.info("🤖 Pose Transformer 模型下载工具")
    logger.info("="*60)
    
    logger.info("\n可用模型:")
    for idx, (key, info) in enumerate(MODEL_SOURCES.items(), 1):
        logger.info(f"\n{idx}. {info['name']}")
        logger.info(f"   大小: {info['size']}")
    
    # 推荐使用 ViTPose-B
    choice = "1"  # 默认选择 ViTPose-B
    logger.info(f"\n使用默认选择: ViTPose-B (官方最好的预训练模型)")
    
    selected_key = list(MODEL_SOURCES.keys())[0]  # vitpose_b
    selected_info = MODEL_SOURCES[selected_key]
    
    model_path = MODELS_DIR / f"{selected_key}.pth"
    
    if model_path.exists():
        logger.info(f"\n✅ 模型已存在: {model_path}")
        if verify_model(model_path):
            logger.info("\n模型已可用，无需重新下载")
            return
    
    # 下载模型
    success = download_file(selected_info['url'], model_path, selected_info['name'])
    
    if success and verify_model(model_path):
        logger.info(f"\n🎉 模型下载并验证成功!")
        logger.info(f"   路径: {model_path}")
        
        # 保存配置
        config_file = PROJECT_ROOT / "downloaded_model_config.json"
        config = {
            "model_type": selected_key,
            "model_path": str(model_path),
            "model_name": selected_info['name'],
            "input_size": [224, 224],
            "num_keypoints": 17,
        }
        
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"\n💾 配置已保存: {config_file}")
        logger.info("\n现在你可以运行: python run_extraction.py")
        return True
    else:
        logger.error("\n❌ 模型下载或验证失败")
        logger.info("\n尝试使用镜像源...")
        
        # 如果官方源失败，尝试备用源
        logger.info("如果网络不稳定，可以尝试手动从以下链接下载:")
        logger.info("- timm 模型 (推荐): https://huggingface.co/timm")
        logger.info("- ViTPose: https://github.com/ViTAE-Transformer/ViTPose")
        return False

if __name__ == '__main__':
    main()
