#!/usr/bin/env python3
"""
从 Hugging Face 下载高质量预训练 Vision Transformer 模型
用于姿态估计的注意力可视化
"""

import torch
from pathlib import Path
from transformers import ViTForImageClassification, ViTImageProcessor
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent
MODELS_DIR = PROJECT_ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

def download_vit_model():
    """从 Hugging Face 下载 ViT 预训练模型"""
    
    logger.info("="*60)
    logger.info("🤖 下载高质量 Vision Transformer 模型")
    logger.info("="*60)
    
    model_name = "google/vit-base-patch16-224-in21k"
    logger.info(f"\n⬇️  正在从 Hugging Face 下载: {model_name}")
    logger.info("   这是一个在 ImageNet-21k 上预训练的高质量模型")
    
    try:
        # 下载模型
        logger.info("\n📥 下载模型权重...")
        model = ViTForImageClassification.from_pretrained(
            model_name,
            trust_remote_code=True
        )
        
        logger.info("📥 下载图像处理器...")
        processor = ViTImageProcessor.from_pretrained(model_name)
        
        # 保存模型
        model_path = MODELS_DIR / "vit_base_21k.pt"
        logger.info(f"\n💾 保存模型到: {model_path}")
        
        # 保存完整的模型状态
        torch.save({
            'model_state_dict': model.state_dict(),
            'model_config': model.config.to_dict(),
            'processor_config': processor.to_dict() if hasattr(processor, 'to_dict') else str(processor)
        }, model_path)
        
        logger.info(f"✅ 模型保存成功!")
        logger.info(f"   模型大小: {model_path.stat().st_size / 1024 / 1024:.1f} MB")
        
        # 验证
        logger.info("\n✓ 验证模型...")
        checkpoint = torch.load(model_path, map_location='cpu')
        params = sum(p.numel() for p in checkpoint['model_state_dict'].values())
        logger.info(f"   参数数量: {params:,}")
        
        logger.info(f"\n🎉 模型下载完成!")
        logger.info(f"   现在可以用这个模型提取注意力权重")
        
        return model_path
        
    except Exception as e:
        logger.error(f"\n❌ 下载失败: {e}")
        logger.info("\n💡 解决方案:")
        logger.info("1. 检查网络连接")
        logger.info("2. 尝试手动下载: https://huggingface.co/google/vit-base-patch16-224-in21k")
        logger.info("3. 或使用本地预训练模型")
        return None

def main():
    try:
        download_vit_model()
    except Exception as e:
        logger.error(f"错误: {e}")

if __name__ == '__main__':
    main()
