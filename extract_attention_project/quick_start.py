#!/usr/bin/env python3
"""
快速启动脚本
从零到模型的自动化流程
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path


class Colors:
    """ANSI 颜色代码"""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


def print_header(text):
    """打印标题"""
    print(f"\n{Colors.BLUE}{'='*45}{Colors.NC}")
    print(f"{Colors.BLUE}  {text}{Colors.NC}")
    print(f"{Colors.BLUE}{'='*45}{Colors.NC}\n")


def print_step(step_num, total, text):
    """打印步骤"""
    print(f"{Colors.YELLOW}[{step_num}/{total}] {text}...{Colors.NC}")


def print_success(text):
    """打印成功信息"""
    print(f"{Colors.GREEN}✓ {text}{Colors.NC}\n")


def print_error(text):
    """打印错误信息"""
    print(f"{Colors.RED}✗ {text}{Colors.NC}")
    sys.exit(1)


def check_python():
    """检查 Python 版本"""
    if sys.version_info < (3, 8):
        print_error(f"Python 版本过低 (需要 3.8+，当前 {sys.version})")
    print(f"Python {sys.version.split()[0]}")


def check_dependencies():
    """检查关键依赖"""
    try:
        import torch
        print(f"PyTorch {torch.__version__}")
        if torch.cuda.is_available():
            print(f"CUDA 可用: {torch.cuda.get_device_name(0)}")
        else:
            print("CUDA 不可用，将使用 CPU（速度较慢）")
    except ImportError:
        print_error("PyTorch 未安装")


def create_directories(project_dir):
    """创建必要的目录"""
    dirs = [
        'dataset',
        'models',
        'logs',
        'test_images',
        'output',
    ]
    
    for dir_name in dirs:
        dir_path = os.path.join(project_dir, dir_name)
        os.makedirs(dir_path, exist_ok=True)


def install_dependencies(project_dir):
    """安装依赖"""
    req_file = os.path.join(project_dir, 'requirements.txt')
    
    print("升级 pip...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', '--upgrade', 'pip'],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    print("安装项目依赖...")
    result = subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', req_file],
                           capture_output=False)
    
    if result.returncode != 0:
        print_error("依赖安装失败")


def select_model_type():
    """选择模型类型"""
    print("可选项:")
    print("  1) simple      - 快速 CNN 模型（推荐，训练快）")
    print("  2) transformer - Vision Transformer（精度更高）")
    print()
    
    while True:
        choice = input("请选择 [1-2，默认 1]: ").strip() or "1"
        
        if choice == "1":
            return "simple", 20, 32
        elif choice == "2":
            return "transformer", 30, 16
        else:
            print("无效选择，请重试")


def train_model(project_dir, model_type, num_epochs, batch_size):
    """训练模型"""
    train_script = os.path.join(project_dir, 'train.py')
    
    cmd = [
        sys.executable, train_script,
        '--model_type', model_type,
        '--dataset_dir', os.path.join(project_dir, 'dataset'),
        '--dummy_num_images', '500',
        '--num_epochs', str(num_epochs),
        '--batch_size', str(batch_size),
        '--learning_rate', '1e-4',
        '--checkpoint_dir', os.path.join(project_dir, 'models'),
        '--log_dir', os.path.join(project_dir, 'logs'),
    ]
    
    print(f"配置: {model_type} 模型, {num_epochs} epochs, 批大小 {batch_size}")
    print("开始训练（这可能需要 10-60 分钟）...")
    print()
    
    result = subprocess.run(cmd)
    
    if result.returncode != 0:
        print_error("模型训练失败")


def extract_attention(project_dir, model_type):
    """提取注意力权重"""
    model_path = os.path.join(project_dir, 'models', 'best_model.pth')
    
    if not os.path.exists(model_path):
        print(f"{Colors.RED}警告: 未找到最佳模型 {model_path}{Colors.NC}")
        return False
    
    extract_script = os.path.join(project_dir, 'extract_attention_weights.py')
    
    cmd = [
        sys.executable, extract_script,
        '--model_path', model_path,
        '--model_type', model_type,
        '--test_images_dir', os.path.join(project_dir, 'test_images'),
        '--output_path', os.path.join(project_dir, 'output', 'pose_model_attention.json'),
    ]
    
    print("提取注意力权重...")
    result = subprocess.run(cmd)
    
    return result.returncode == 0


def main():
    """主函数"""
    print_header("Pose Model 快速启动脚本")
    
    # 获取项目目录
    project_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 步骤 1: 检查环境
    print_step(1, 6, "检查 Python 环境")
    check_python()
    print_success("Python 检查通过")
    
    # 步骤 2: 检查依赖
    print_step(2, 6, "检查关键库")
    check_dependencies()
    print_success("库检查完成")
    
    # 步骤 3: 创建目录
    print_step(3, 6, "创建项目目录")
    create_directories(project_dir)
    print_success("目录创建完成")
    
    # 步骤 4: 安装依赖
    print_step(4, 6, "安装依赖")
    install_dependencies(project_dir)
    print_success("依赖安装完成")
    
    # 步骤 5: 选择模型并训练
    print_step(5, 6, "选择模型并训练")
    model_type, num_epochs, batch_size = select_model_type()
    train_model(project_dir, model_type, num_epochs, batch_size)
    print_success("模型训练完成")
    
    # 步骤 6: 提取注意力权重
    print_step(6, 6, "提取注意力权重")
    if extract_attention(project_dir, model_type):
        print_success("注意力权重提取完成")
    else:
        print(f"{Colors.RED}注意力权重提取失败{Colors.NC}")
    
    # 完成
    print_header("全部步骤完成！")
    
    print(f"{Colors.GREEN}✅ 项目初始化和训练完成！{Colors.NC}\n")
    
    print("生成的文件:")
    print(f"  模型: {os.path.join(project_dir, 'models', 'best_model.pth')}")
    print(f"  注意力权重: {os.path.join(project_dir, 'output', 'pose_model_attention.json')}")
    print(f"  日志: {os.path.join(project_dir, 'logs', 'training.log')}")
    print()
    
    print("下一步:")
    print("  1. 查看训练日志: tail -f " + os.path.join(project_dir, 'logs', 'training.log'))
    print("  2. 查看输出文件: cat " + os.path.join(project_dir, 'output', 'pose_model_attention.json'))
    print("  3. 复制到主项目: cp " + os.path.join(project_dir, 'output', 'pose_model_attention.json') + 
          " ~/桌面/Data-Visualization-Coursework/src/data/")
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.RED}用户中断{Colors.NC}")
        sys.exit(0)
    except Exception as e:
        print_error(str(e))
