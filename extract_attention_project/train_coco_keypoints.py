"""
COCO Keypoints 数据集微调脚本
用于训练和微调姿态估计模型
"""

import os
import sys
import json
import logging
import argparse
import numpy as np
from pathlib import Path
from tqdm import tqdm
from datetime import datetime
from typing import Dict, Optional

import torch
import torch.nn as nn
from torch.optim import Adam, SGD
from torch.optim.lr_scheduler import StepLR, ReduceLROnPlateau
from torch.utils.tensorboard import SummaryWriter

from pose_model import PoseTransformerModel, SimplePoseModel
from coco_dataloader import create_coco_dataloader


def setup_logging(log_dir: str):
    """设置日志系统"""
    os.makedirs(log_dir, exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(os.path.join(log_dir, 'training.log')),
            logging.StreamHandler(),
        ]
    )
    
    return logging.getLogger(__name__)


def keypoint_loss(
    predictions: torch.Tensor,
    targets: torch.Tensor,
    visibility: torch.Tensor,
) -> torch.Tensor:
    """
    关键点位置损失（仅对可见关键点计算）
    
    Args:
        predictions: 预测的关键点坐标 (B, num_keypoints, 2)
        targets: 目标关键点坐标 (B, num_keypoints, 2)
        visibility: 关键点可见性 (B, num_keypoints)
        
    Returns:
        平均损失值
    """
    # 计算欧几里得距离
    diff = predictions - targets
    dist = torch.sqrt(torch.sum(diff ** 2, dim=-1) + 1e-6)
    
    # 仅对可见关键点计算损失
    visible_dist = dist * visibility
    loss = visible_dist.sum() / (visibility.sum() + 1e-6)
    
    return loss


def confidence_loss(
    predictions: torch.Tensor,
    targets: torch.Tensor,
) -> torch.Tensor:
    """
    置信度损失（二元交叉熵）
    
    Args:
        predictions: 预测的置信度 (B, num_keypoints)
        targets: 目标置信度 (B, num_keypoints)
        
    Returns:
        平均损失值
    """
    criterion = nn.BCELoss()
    return criterion(predictions, targets)


def heatmap_loss(
    predictions: torch.Tensor,
    targets: torch.Tensor,
) -> torch.Tensor:
    """
    热力图损失（均方误差）
    
    Args:
        predictions: 预测的热力图 (B, H, W)
        targets: 目标热力图 (B, H, W)
        
    Returns:
        平均损失值
    """
    criterion = nn.MSELoss()
    return criterion(predictions, targets)


def train_epoch(
    model: nn.Module,
    dataloader,
    optimizer,
    device: torch.device,
    logger,
) -> float:
    """
    训练一个 epoch
    
    Args:
        model: 模型
        dataloader: 数据加载器
        optimizer: 优化器
        device: 设备（CPU/GPU）
        logger: 日志记录器
        
    Returns:
        平均损失值
    """
    model.train()
    total_loss = 0
    num_batches = 0
    
    pbar = tqdm(dataloader, desc="训练", leave=False)
    
    for batch in pbar:
        # 将数据移到设备
        images = batch['image'].to(device)
        keypoints_gt = batch['keypoints'].to(device)
        confidence_gt = batch['confidence'].to(device)
        heatmap_gt = batch['heatmap'].to(device)
        
        # 前向传播
        optimizer.zero_grad()
        outputs = model(images)
        
        # 计算损失
        kp_loss = keypoint_loss(outputs['keypoints'], keypoints_gt, confidence_gt)
        conf_loss = confidence_loss(outputs['confidence'], confidence_gt)
        heat_loss = heatmap_loss(outputs['heatmap'], heatmap_gt)
        
        # 加权损失
        total_batch_loss = 0.7 * kp_loss + 0.2 * conf_loss + 0.1 * heat_loss
        
        # 反向传播
        total_batch_loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        
        # 记录统计信息
        total_loss += total_batch_loss.item()
        num_batches += 1
        
        pbar.set_postfix({
            'loss': total_loss / num_batches,
            'kp_loss': kp_loss.item(),
            'conf_loss': conf_loss.item(),
        })
    
    avg_loss = total_loss / max(num_batches, 1)
    return avg_loss


def validate(
    model: nn.Module,
    dataloader,
    device: torch.device,
    logger,
) -> Dict[str, float]:
    """
    验证模型
    
    Args:
        model: 模型
        dataloader: 验证数据加载器
        device: 设备
        logger: 日志记录器
        
    Returns:
        包含各种指标的字典
    """
    model.eval()
    total_loss = 0
    total_kp_dist = 0
    num_visible_kps = 0
    num_batches = 0
    
    with torch.no_grad():
        pbar = tqdm(dataloader, desc="验证", leave=False)
        
        for batch in pbar:
            # 将数据移到设备
            images = batch['image'].to(device)
            keypoints_gt = batch['keypoints'].to(device)
            confidence_gt = batch['confidence'].to(device)
            heatmap_gt = batch['heatmap'].to(device)
            
            # 前向传播
            outputs = model(images)
            
            # 计算损失
            kp_loss = keypoint_loss(outputs['keypoints'], keypoints_gt, confidence_gt)
            conf_loss = confidence_loss(outputs['confidence'], confidence_gt)
            heat_loss = heatmap_loss(outputs['heatmap'], heatmap_gt)
            
            # 加权损失
            batch_loss = 0.7 * kp_loss + 0.2 * conf_loss + 0.1 * heat_loss
            total_loss += batch_loss.item()
            
            # 计算关键点距离误差
            diff = outputs['keypoints'] - keypoints_gt
            dist = torch.sqrt(torch.sum(diff ** 2, dim=-1) + 1e-6)
            visible_mask = confidence_gt > 0
            
            if visible_mask.sum() > 0:
                total_kp_dist += (dist * visible_mask).sum().item()
                num_visible_kps += visible_mask.sum().item()
            
            num_batches += 1
            pbar.set_postfix({'loss': total_loss / num_batches})
    
    avg_loss = total_loss / max(num_batches, 1)
    avg_kp_dist = total_kp_dist / max(num_visible_kps, 1) if num_visible_kps > 0 else 0
    
    return {
        'loss': avg_loss,
        'keypoint_distance': avg_kp_dist,
    }


def main(args):
    """主训练函数"""
    
    # 设置日志
    logger = setup_logging(args.log_dir)
    logger.info(f"开始训练，配置: {vars(args)}")
    
    # 设置随机种子
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    
    # 设备
    device = torch.device(f"cuda:{args.gpu}" if torch.cuda.is_available() else "cpu")
    logger.info(f"使用设备: {device}")
    
    # 创建模型
    logger.info(f"创建模型: {args.model_type}")
    if args.model_type == "transformer":
        model = PoseTransformerModel(
            image_size=args.image_size,
            patch_size=args.patch_size,
            num_heads=args.num_heads,
            num_layers=args.num_layers,
            dim=args.dim,
            num_keypoints=17,
        )
    else:
        model = SimplePoseModel(num_keypoints=17, feature_dim=args.dim)
    
    model = model.to(device)
    
    # 计算参数数量
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    logger.info(f"模型参数: {total_params:,} (可训练: {trainable_params:,})")
    
    # 加载预训练权重（如果有）
    if args.pretrained_path and os.path.exists(args.pretrained_path):
        logger.info(f"加载预训练权重: {args.pretrained_path}")
        checkpoint = torch.load(args.pretrained_path, map_location=device)
        model.load_state_dict(checkpoint, strict=False)
    
    # 创建数据加载器
    logger.info("创建数据加载器...")
    
    train_loader = create_coco_dataloader(
        image_dir=args.train_image_dir,
        annotations_file=args.train_ann_file,
        batch_size=args.batch_size,
        image_size=args.image_size,
        use_augmentation=True,
        num_workers=args.num_workers,
        max_samples=args.max_samples,
    )
    
    val_loader = None
    if args.val_image_dir and args.val_ann_file:
        val_loader = create_coco_dataloader(
            image_dir=args.val_image_dir,
            annotations_file=args.val_ann_file,
            batch_size=args.batch_size,
            image_size=args.image_size,
            use_augmentation=False,
            num_workers=args.num_workers,
            max_samples=args.max_samples,
        )
    
    logger.info(f"训练集大小: {len(train_loader.dataset)}")
    if val_loader:
        logger.info(f"验证集大小: {len(val_loader.dataset)}")
    
    # 创建优化器
    optimizer = Adam(model.parameters(), lr=args.learning_rate, weight_decay=args.weight_decay)
    scheduler = StepLR(optimizer, step_size=args.lr_step, gamma=0.1)
    
    # TensorBoard 日志
    writer = SummaryWriter(log_dir=args.log_dir)
    
    # 训练循环
    best_loss = float('inf')
    patience_counter = 0
    
    for epoch in range(args.num_epochs):
        logger.info(f"\nEpoch {epoch + 1}/{args.num_epochs}")
        
        # 训练
        train_loss = train_epoch(model, train_loader, optimizer, device, logger)
        logger.info(f"训练损失: {train_loss:.6f}")
        writer.add_scalar('Loss/train', train_loss, epoch)
        
        # 验证
        if val_loader:
            val_metrics = validate(model, val_loader, device, logger)
            logger.info(f"验证损失: {val_metrics['loss']:.6f}")
            logger.info(f"关键点距离: {val_metrics['keypoint_distance']:.6f}")
            writer.add_scalar('Loss/val', val_metrics['loss'], epoch)
            writer.add_scalar('Metrics/keypoint_distance', val_metrics['keypoint_distance'], epoch)
            
            # 保存最佳模型
            if val_metrics['loss'] < best_loss:
                best_loss = val_metrics['loss']
                patience_counter = 0
                model_path = os.path.join(args.checkpoint_dir, f"best_model.pth")
                torch.save(model.state_dict(), model_path)
                logger.info(f"保存最佳模型: {model_path}")
            else:
                patience_counter += 1
                if patience_counter >= args.patience:
                    logger.info(f"早停止（无改进 {args.patience} 个 epochs）")
                    break
        
        # 学习率调度
        scheduler.step()
        logger.info(f"当前学习率: {optimizer.param_groups[0]['lr']:.6f}")
        
        # 定期保存检查点
        if (epoch + 1) % args.save_interval == 0:
            checkpoint_path = os.path.join(
                args.checkpoint_dir,
                f"checkpoint_epoch_{epoch + 1}.pth"
            )
            torch.save(model.state_dict(), checkpoint_path)
            logger.info(f"保存检查点: {checkpoint_path}")
    
    logger.info("训练完成！")
    writer.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="COCO Keypoints 数据集微调脚本")
    
    # 数据路径
    parser.add_argument("--train-image-dir", type=str, required=True,
                        help="COCO 训练集图像文件夹")
    parser.add_argument("--train-ann-file", type=str, required=True,
                        help="COCO 训练集标注文件 (person_keypoints_train2017.json)")
    parser.add_argument("--val-image-dir", type=str, default=None,
                        help="COCO 验证集图像文件夹")
    parser.add_argument("--val-ann-file", type=str, default=None,
                        help="COCO 验证集标注文件 (person_keypoints_val2017.json)")
    
    # 模型配置
    parser.add_argument("--model-type", type=str, choices=["transformer", "simple"],
                        default="simple", help="模型类型")
    parser.add_argument("--image-size", type=int, default=256, help="输入图像大小")
    parser.add_argument("--patch-size", type=int, default=16, help="Patch 大小（仅限 Transformer）")
    parser.add_argument("--num-heads", type=int, default=8, help="注意力头数（仅限 Transformer）")
    parser.add_argument("--num-layers", type=int, default=12, help="Transformer 层数")
    parser.add_argument("--dim", type=int, default=256, help="特征维度")
    
    # 训练配置
    parser.add_argument("--batch-size", type=int, default=16, help="批大小")
    parser.add_argument("--learning-rate", type=float, default=1e-4, help="学习率")
    parser.add_argument("--weight-decay", type=float, default=1e-5, help="权重衰减")
    parser.add_argument("--num-epochs", type=int, default=100, help="总 epochs")
    parser.add_argument("--lr-step", type=int, default=30, help="学习率衰减步数")
    parser.add_argument("--patience", type=int, default=20, help="早停止耐心")
    parser.add_argument("--num-workers", type=int, default=4, help="数据加载工作线程")
    
    # 其他
    parser.add_argument("--pretrained-path", type=str, default=None,
                        help="预训练模型路径")
    parser.add_argument("--checkpoint-dir", type=str, default="./checkpoints",
                        help="检查点保存目录")
    parser.add_argument("--log-dir", type=str, default="./logs",
                        help="日志目录")
    parser.add_argument("--save-interval", type=int, default=10,
                        help="保存检查点的间隔（epochs）")
    parser.add_argument("--max-samples", type=int, default=None,
                        help="最多加载的样本数（用于快速测试）")
    parser.add_argument("--gpu", type=int, default=0, help="GPU ID")
    parser.add_argument("--seed", type=int, default=42, help="随机种子")
    
    args = parser.parse_args()
    
    # 创建必要的目录
    os.makedirs(args.checkpoint_dir, exist_ok=True)
    os.makedirs(args.log_dir, exist_ok=True)
    
    # 开始训练
    main(args)
