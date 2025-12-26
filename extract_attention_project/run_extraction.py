"""
示例运行脚本
"""

import os
import sys
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from extract_attention_weights import TransformerAttentionExtractor
from config import DATA_CONFIG


def main():
    """主函数"""
    # 创建提取器并运行
    extractor = TransformerAttentionExtractor({})
    
    # 使用配置中的图像目录
    image_dir = DATA_CONFIG['image_dir']
    
    print(f"从 {image_dir} 提取注意力权重...")
    extractor.run(image_dir=image_dir)


if __name__ == '__main__':
    main()
