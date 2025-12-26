"""
模型训练脚本
支持 Vision Transformer 和简单 CNN 模型的训练
"""

import os
import sys
import json
import logging
import argparse
import numpy as np
from pathlib import Path
from tqdm import tqdm

import torch
import torch.nn as nn
from torch.optim import Adam, SGD
from torch.utils.tensorboard import SummaryWriter

from pose_model import PoseTransformerModel, SimplePoseModel
from data_loader import create_dataloader, create_dummy_dataset


def setup_logging(log_dir: str):
    """设置日志"""
    os.makedirs(log_dir, exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(os.path.join(log_dir, 'training.log')),
            logging.StreamHandler(),
        ]
    )


def keypoint_loss(
    predictions: torch.Tensor,
    targets: torch.Tensor,
    visibility: torch.Tensor,
) -> torch.Tensor:
    """
    关键点位置损失
    
    Args:
        predictions: 预测的关键点 (B, num_keypoints, 2)
        targets: 目标关键点 (B, num_keypoints, 2)
        visibility: 关键点可见性 (B, num_keypoints)
        
    Returns:
        平均损失
    """
    # 只计算可见关键点的损失
    diff = predictions - targets
    dist = torch.sqrt(torch.sum(diff ** 2, dim=-1) + 1e-6)
    
    # 加权损失（只对可见关键点计算）
    loss = (dist * visibility).sum() / (visibility.sum() + 1e-6)
    return loss


def confidence_loss(
    predictions: torch.Tensor,
    targets: torch.Tensor,
) -> torch.Tensor:
    """
    置信度损失
    
    Args:
        predictions: 预测的置信度 (B, num_keypoints)
        targets: 目标置信度 (B, num_keypoints)
        
    Returns:
        平均损失
    """
    criterion = nn.BCELoss()
    return criterion(predictions, targets)


def heatmap_loss(
    predictions: torch.Tensor,
    targets: torch.Tensor,
) -> torch.Tensor:
    """
    热力图损失
    
    Args:
        predictions: 预测的热力图 (B, 16, 16)
        targets: 目标热力图 (B, 16, 16)
        
    Returns:
        平均损失
    """
    criterion = nn.MSELoss()
    return criterion(predictions, targets)


def train_epoch(
    model: nn.Module,
    dataloader,
    optimizer,
    device: str,
    epoch: int,
):
    """
    训练一个 epoch
    
    Args:
        model: 模型
        dataloader: 数据加载器
        optimizer: 优化器
        device: 设备
        epoch: epoch 序号
        
    Returns:
        平均损失
    """
    model.train()
    total_loss = 0
    
    pbar = tqdm(dataloader, desc=f'Epoch {epoch} [Train]')
    
    for batch_idx, batch in enumerate(pbar):
        # 移动到设备
        images = batch['image'].to(device)
        keypoints = batch['keypoints'].to(device)
        visibility = batch['visibility'].to(device)
        heatmap_target = batch['heatmap'].to(device)
        
        # 前向传播
        optimizer.zero_grad()
        outputs = model(images)
        
        # 计算损失
        kp_loss = keypoint_loss(
            outputs['keypoints'], keypoints, visibility
        )
        conf_loss = confidence_loss(
            outputs['confidence'], visibility
        )
        heat_loss = heatmap_loss(
            outputs['heatmap'], heatmap_target
        )
        
        # 综合损失
        loss = kp_loss + 0.5 * conf_loss + 0.5 * heat_loss
        
        # 反向传播
        loss.backward()
        optimizer.step()
        
        # 记录损失
        total_loss += loss.item()
        
        # 更新进度条
        avg_loss = total_loss / (batch_idx + 1)
        pbar.set_postfix({'loss': f'{avg_loss:.4f}'})
    
    return total_loss / len(dataloader)


@torch.no_grad()
def validate(
    model: nn.Module,
    dataloader,
    device: str,
    epoch: int,
):
    """
    验证模型
    
    Args:
        model: 模型
        dataloader: 数据加载器
        device: 设备
        epoch: epoch 序号
        
    Returns:
        平均损失和指标字典
    """
    model.eval()
    total_loss = 0
    
    pbar = tqdm(dataloader, desc=f'Epoch {epoch} [Val]')
    
    for batch_idx, batch in enumerate(pbar):
        # 移动到设备
        images = batch['image'].to(device)
        keypoints = batch['keypoints'].to(device)
        visibility = batch['visibility'].to(device)
        heatmap_target = batch['heatmap'].to(device)
        
        # 前向传播
        outputs = model(images)
        
        # 计算损失
        kp_loss = keypoint_loss(
            outputs['keypoints'], keypoints, visibility
        )
        conf_loss = confidence_loss(
            outputs['confidence'], visibility
        )
        heat_loss = heatmap_loss(
            outputs['heatmap'], heatmap_target
        )
        
        # 综合损失
        loss = kp_loss + 0.5 * conf_loss + 0.5 * heat_loss
        
        total_loss += loss.item()
        
        # 更新进度条
        avg_loss = total_loss / (batch_idx + 1)
        pbar.set_postfix({'loss': f'{avg_loss:.4f}'})
    
    return total_loss / len(dataloader)


def train(
    config: dict,
):
    """
    训练主函数
    
    Args:
        config: 配置字典
    """
    # 设置日志
    log_dir = config.get('log_dir', './logs')
    setup_logging(log_dir)
    logger = logging.getLogger(__name__)
    
    logger.info(f"配置: {json.dumps(config, indent=2)}")
    
    # 设备
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logger.info(f"使用设备: {device}")
    
    # 创建数据集
    logger.info("创建数据集...")
    dataset_dir = config.get('dataset_dir')
    
    if not os.path.exists(dataset_dir):
        logger.info(f"数据集不存在，创建虚拟数据集...")
        dataset_dir = create_dummy_dataset(
            output_dir=dataset_dir,
            num_images=config.get('dummy_num_images', 100),
            image_size=config.get('image_size', 256),
        )
    
    # 创建数据加载器
    annotations_file = os.path.join(dataset_dir, 'annotations.json')
    
    train_dataloader = create_dataloader(
        image_dir=dataset_dir,
        annotations_file=annotations_file if os.path.exists(annotations_file) else None,
        batch_size=config.get('batch_size', 32),
        num_workers=config.get('num_workers', 4),
        shuffle=True,
        image_size=config.get('image_size', 256),
        use_augmentation=True,
    )
    
    val_dataloader = create_dataloader(
        image_dir=dataset_dir,
        annotations_file=annotations_file if os.path.exists(annotations_file) else None,
        batch_size=config.get('batch_size', 32),
        num_workers=config.get('num_workers', 4),
        shuffle=False,
        image_size=config.get('image_size', 256),
        use_augmentation=False,
    )
    
    logger.info(f"训练数据: {len(train_dataloader)} 批")
    logger.info(f"验证数据: {len(val_dataloader)} 批")
    
    # 创建模型
    logger.info("创建模型...")
    model_type = config.get('model_type', 'simple')
    
    if model_type == 'transformer':
        model = PoseTransformerModel(
            image_size=config.get('image_size', 256),
            patch_size=config.get('patch_size', 16),
            num_heads=config.get('num_heads', 8),
            num_layers=config.get('num_layers', 12),
            dim=config.get('hidden_dim', 768),
            num_keypoints=config.get('num_keypoints', 17),
            dropout=config.get('dropout', 0.1),
        )
    else:
        model = SimplePoseModel(
            num_keypoints=config.get('num_keypoints', 17),
        )
    
    model = model.to(device)
    
    # 统计参数
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    logger.info(f"模型参数: 总计 {total_params:,}, 可训练 {trainable_params:,}")
    
    # 优化器
    optimizer = Adam(
        model.parameters(),
        lr=config.get('learning_rate', 1e-4),
        weight_decay=config.get('weight_decay', 1e-5),
    )
    
    # 学习率调度器
    scheduler = torch.optim.lr_scheduler.StepLR(
        optimizer,
        step_size=config.get('scheduler_step', 10),
        gamma=config.get('scheduler_gamma', 0.1),
    )
    
    # TensorBoard
    writer = SummaryWriter(log_dir=log_dir)
    
    # 训练
    best_val_loss = float('inf')
    num_epochs = config.get('num_epochs', 50)
    checkpoint_dir = config.get('checkpoint_dir', './checkpoints')
    os.makedirs(checkpoint_dir, exist_ok=True)
    
    logger.info(f"开始训练，共 {num_epochs} epochs")
    
    for epoch in range(1, num_epochs + 1):
        # 训练
        train_loss = train_epoch(
            model, train_dataloader, optimizer, device, epoch
        )
        
        # 验证
        val_loss = validate(
            model, val_dataloader, device, epoch
        )
        
        # 学习率调度
        scheduler.step()
        
        # 记录到 TensorBoard
        writer.add_scalar('Loss/train', train_loss, epoch)
        writer.add_scalar('Loss/val', val_loss, epoch)
        writer.add_scalar('LR', optimizer.param_groups[0]['lr'], epoch)
        
        # 日志
        logger.info(
            f"Epoch {epoch}/{num_epochs} - "
            f"Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}, "
            f"LR: {optimizer.param_groups[0]['lr']:.6f}"
        )
        
        # 保存最佳模型
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            checkpoint_path = os.path.join(
                checkpoint_dir, 'best_model.pth'
            )
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_loss': val_loss,
            }, checkpoint_path)
            logger.info(f"保存最佳模型到 {checkpoint_path}")
        
        # 定期保存检查点
        if epoch % config.get('save_interval', 10) == 0:
            checkpoint_path = os.path.join(
                checkpoint_dir, f'model_epoch_{epoch}.pth'
            )
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_loss': val_loss,
            }, checkpoint_path)
            logger.info(f"保存检查点到 {checkpoint_path}")
    
    writer.close()
    logger.info("训练完成!")
    logger.info(f"最佳验证损失: {best_val_loss:.4f}")


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(description='Pose Model Training')
    
    # 数据相关
    parser.add_argument('--dataset_dir', type=str, default='./dataset',
                        help='数据集文件夹路径')
    parser.add_argument('--image_size', type=int, default=256,
                        help='输入图像大小')
    parser.add_argument('--dummy_num_images', type=int, default=500,
                        help='虚拟数据集的图像数量')
    
    # 模型相关
    parser.add_argument('--model_type', type=str, default='simple',
                        choices=['simple', 'transformer'],
                        help='模型类型')
    parser.add_argument('--num_keypoints', type=int, default=17,
                        help='关键点数量')
    parser.add_argument('--hidden_dim', type=int, default=768,
                        help='Transformer 隐层维度')
    parser.add_argument('--num_heads', type=int, default=8,
                        help='注意力头数')
    parser.add_argument('--num_layers', type=int, default=12,
                        help='Transformer 层数')
    parser.add_argument('--patch_size', type=int, default=16,
                        help='Patch 大小')
    
    # 训练相关
    parser.add_argument('--batch_size', type=int, default=32,
                        help='批大小')
    parser.add_argument('--num_epochs', type=int, default=50,
                        help='训练轮数')
    parser.add_argument('--learning_rate', type=float, default=1e-4,
                        help='学习率')
    parser.add_argument('--weight_decay', type=float, default=1e-5,
                        help='权重衰减')
    parser.add_argument('--num_workers', type=int, default=4,
                        help='数据加载工作进程数')
    
    # 调度器
    parser.add_argument('--scheduler_step', type=int, default=10,
                        help='学习率调度步长')
    parser.add_argument('--scheduler_gamma', type=float, default=0.1,
                        help='学习率调度因子')
    
    # 保存相关
    parser.add_argument('--checkpoint_dir', type=str, default='./models',
                        help='检查点保存目录')
    parser.add_argument('--log_dir', type=str, default='./logs',
                        help='日志目录')
    parser.add_argument('--save_interval', type=int, default=10,
                        help='检查点保存间隔')
    
    args = parser.parse_args()
    
    # 转换为字典
    config = vars(args)
    
    # 训练
    train(config)


if __name__ == '__main__':
    main()
