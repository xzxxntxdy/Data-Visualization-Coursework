#!/usr/bin/env python3
"""
项目验证脚本
检查所有必需的文件是否存在和完整
"""

import os
import sys
from pathlib import Path


class ProjectValidator:
    """项目验证器"""
    
    def __init__(self, project_dir):
        self.project_dir = Path(project_dir)
        self.results = {
            'files': [],
            'missing': [],
            'directories': [],
        }
    
    def check_file(self, filepath, required=True):
        """检查文件是否存在"""
        full_path = self.project_dir / filepath
        exists = full_path.exists()
        
        status = "✓" if exists else "✗"
        required_text = "(必需)" if required else "(可选)"
        
        print(f"{status} {filepath} {required_text}")
        
        if exists:
            self.results['files'].append(filepath)
        elif required:
            self.results['missing'].append(filepath)
    
    def check_directory(self, dirpath):
        """检查目录是否存在"""
        full_path = self.project_dir / dirpath
        exists = full_path.is_dir()
        
        status = "✓" if exists else "✗"
        print(f"{status} {dirpath}/")
        
        if exists:
            self.results['directories'].append(dirpath)
    
    def validate_all(self):
        """验证所有文件"""
        print("=" * 50)
        print("项目文件验证")
        print("=" * 50)
        print()
        
        # 核心模块文件
        print("📄 核心模块文件:")
        self.check_file('pose_model.py')
        self.check_file('data_loader.py')
        self.check_file('train.py')
        self.check_file('extract_attention_weights.py')
        self.check_file('utils.py')
        self.check_file('config.py')
        print()
        
        # 启动脚本
        print("🚀 启动脚本:")
        self.check_file('quick_start.py')
        self.check_file('quick_start.sh', required=False)
        print()
        
        # 文档文件
        print("📚 文档文件:")
        self.check_file('QUICK_REFERENCE.md')
        self.check_file('MODEL_TRAINING_SYSTEM.md')
        self.check_file('TRAINING_GUIDE.md')
        self.check_file('FINAL_CHECKLIST.md')
        self.check_file('train_config_examples.txt')
        self.check_file('README.md', required=False)
        self.check_file('SETUP.md', required=False)
        self.check_file('PROJECT_SUMMARY.md', required=False)
        print()
        
        # 配置文件
        print("⚙️ 配置文件:")
        self.check_file('requirements.txt')
        print()
        
        # 工作目录
        print("📁 工作目录:")
        self.check_directory('dataset')
        self.check_directory('models')
        self.check_directory('logs')
        self.check_directory('test_images')
        self.check_directory('output')
        print()
        
        # 总结
        print("=" * 50)
        print("验证结果")
        print("=" * 50)
        print(f"✓ 检测到的文件: {len(self.results['files'])}")
        print(f"✗ 缺失的文件: {len(self.results['missing'])}")
        print(f"✓ 检测到的目录: {len(self.results['directories'])}")
        print()
        
        if self.results['missing']:
            print("⚠️ 缺失的必需文件:")
            for filepath in self.results['missing']:
                print(f"  - {filepath}")
            return False
        else:
            print("✅ 所有必需文件都已存在！")
            return True
    
    def check_python_packages(self):
        """检查 Python 包"""
        print("\n" + "=" * 50)
        print("Python 包检查")
        print("=" * 50)
        print()
        
        packages = [
            ('torch', 'PyTorch'),
            ('torchvision', 'torchvision'),
            ('cv2', 'OpenCV'),
            ('PIL', 'Pillow'),
            ('numpy', 'NumPy'),
            ('tqdm', 'tqdm'),
        ]
        
        all_available = True
        
        for module_name, display_name in packages:
            try:
                __import__(module_name)
                print(f"✓ {display_name}")
            except ImportError:
                print(f"✗ {display_name} (未安装)")
                all_available = False
        
        print()
        if not all_available:
            print("❌ 部分依赖未安装")
            print("请运行: pip install -r requirements.txt")
            return False
        else:
            print("✅ 所有必需的包都已安装！")
            return True
    
    def check_gpu(self):
        """检查 GPU 支持"""
        print("\n" + "=" * 50)
        print("GPU 检查")
        print("=" * 50)
        print()
        
        try:
            import torch
            if torch.cuda.is_available():
                print(f"✓ CUDA 可用")
                print(f"  设备: {torch.cuda.get_device_name(0)}")
                print(f"  GPU 内存: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
            else:
                print("⚠️ CUDA 不可用（将使用 CPU，速度较慢）")
                print("  建议安装 CUDA 版本的 PyTorch")
        except ImportError:
            print("✗ PyTorch 未安装")
        print()


def main():
    """主函数"""
    # 获取项目目录
    if len(sys.argv) > 1:
        project_dir = sys.argv[1]
    else:
        project_dir = os.path.dirname(os.path.abspath(__file__))
    
    validator = ProjectValidator(project_dir)
    
    # 验证文件
    files_ok = validator.validate_all()
    
    # 检查包
    packages_ok = validator.check_python_packages()
    
    # 检查 GPU
    validator.check_gpu()
    
    # 最终结果
    print("=" * 50)
    print("最终验证结果")
    print("=" * 50)
    print()
    
    if files_ok and packages_ok:
        print("✅ 项目设置完成！")
        print()
        print("现在你可以运行:")
        print("  python3 quick_start.py")
        print()
        print("或者手动运行训练:")
        print("  python3 train.py --model_type simple")
        print()
        return 0
    else:
        print("❌ 项目设置不完整")
        print()
        if not files_ok:
            print("请检查是否缺少文件")
        if not packages_ok:
            print("请运行: pip install -r requirements.txt")
        print()
        return 1


if __name__ == '__main__':
    sys.exit(main())
