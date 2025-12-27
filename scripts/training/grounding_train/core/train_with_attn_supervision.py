import os
import torch
import torch.optim as optim
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision import transforms
from tqdm import tqdm
import math
import json
import argparse

from dataset import SpatialDataset
from transformer_model import TransformerBBoxWithAttn


def generate_gaussian_target(cx, cy, grid_size=16, sigma=2.0):
    """
    生成Gaussian heatmap作为attention target

    Args:
        cx, cy: bbox中心坐标，归一化到[0,1]
        grid_size: attention grid大小 (16x16)
        sigma: Gaussian标准差（控制分布的集中程度）

    Returns:
        target: [grid_size, grid_size] 归一化的概率分布
    """
    # 转换到grid坐标
    cx_grid = cx * (grid_size - 1)
    cy_grid = cy * (grid_size - 1)

    # 创建grid坐标
    x = torch.arange(grid_size, dtype=torch.float32)
    y = torch.arange(grid_size, dtype=torch.float32)
    yy, xx = torch.meshgrid(y, x, indexing='ij')

    # 计算Gaussian
    gaussian = torch.exp(-((xx - cx_grid)**2 + (yy - cy_grid)**2) / (2 * sigma**2))

    # 归一化为概率分布
    gaussian = gaussian / (gaussian.sum() + 1e-8)

    return gaussian


def compute_gt_priors(data_file, grid_size=16):
    """
    计算每个类别的GT spatial prior
    """
    print("Computing GT priors from data...")
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    annotations = data['annotations']
    
    counts = {} # category_id -> tensor [grid_size, grid_size]
    
    for ann in annotations:
        cat_id = int(ann['category_id'])
        if cat_id not in counts:
            counts[cat_id] = torch.zeros((grid_size, grid_size), dtype=torch.float32)
        
        cx = float(ann['cx'])
        cy = float(ann['cy'])
        
        x = min(grid_size - 1, max(0, int(cx * grid_size)))
        y = min(grid_size - 1, max(0, int(cy * grid_size)))
        counts[cat_id][y, x] += 1.0
        
    priors = {}
    for cat_id, count_map in counts.items():
        # 归一化为概率分布
        prob_map = count_map / (count_map.sum() + 1e-8)
        priors[cat_id] = prob_map.flatten()
        
    print(f"Computed priors for {len(priors)} categories.")
    return priors


def kl_divergence_loss(pred_attn, target_attn, eps=1e-8):
    """
    计算KL散度: KL(target || pred)

    Args:
        pred_attn: [B, L] 模型预测的attention (已经是softmax后的概率)
        target_attn: [B, L] 目标attention分布
        eps: 避免log(0)

    Returns:
        loss: scalar
    """
    pred_attn = torch.clamp(pred_attn, eps, 1.0)
    target_attn = torch.clamp(target_attn, eps, 1.0)

    # KL(target || pred) = sum(target * log(target / pred))
    kl = (target_attn * torch.log(target_attn / pred_attn)).sum(dim=1)
    return kl.mean()


def train(args):
    # ==========================
    # ✅ 训练配置
    # ==========================
    DATA_FILE = r"spatial_data.json"
    IMG_DIR = r"spatial"

    BATCH_SIZE = 128
    LR = 6e-4
    EPOCHS = 50              # 增加epoch数以让attention充分学习
    NUM_WORKERS = 8
    WEIGHT_DECAY = 1e-4

    # ✨ Attention supervision 超参数
    LAMBDA_ATTN = 0.5        # attention loss权重（可调整0.1~2.0）
    GAUSSIAN_SIGMA = 2.0     # Gaussian标准差（越小越集中）
    GRID_SIZE = 16           # attention grid大小

    CHECKPOINT_DIR = "checkpoints"
    
    if args.use_gt_prior:
        SAVE_PATH = os.path.join(CHECKPOINT_DIR, "chair_transformer_gt_prior_best.pth")
        LAST_PATH = os.path.join(CHECKPOINT_DIR, "chair_transformer_gt_prior_last.pth")
        print(f"✨ Using GT Prior Supervision")
    else:
        SAVE_PATH = os.path.join(CHECKPOINT_DIR, "chair_transformer_attn_sup_best.pth")
        LAST_PATH = os.path.join(CHECKPOINT_DIR, "chair_transformer_attn_sup_last.pth")
        print(f"✨ Using Gaussian Target Supervision (σ={GAUSSIAN_SIGMA})")

    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.backends.cudnn.benchmark = True

    print(f"Using device: {DEVICE}")
    if DEVICE.type == 'cuda':
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

    print(f"\n✨ Attention Supervision Config:")
    print(f"   λ_attn = {LAMBDA_ATTN}")
    print(f"   Grid size = {GRID_SIZE}x{GRID_SIZE}\n")
    
    gt_priors = None
    if args.use_gt_prior:
        gt_priors = compute_gt_priors(DATA_FILE, GRID_SIZE)
        # Move to device
        for k in gt_priors:
            gt_priors[k] = gt_priors[k].to(DEVICE)

    # ==========================
    # ✅ 数据集
    # ==========================
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        ),
    ])

    try:
        dataset = SpatialDataset(DATA_FILE, IMG_DIR, transform=transform)
    except FileNotFoundError as e:
        print(f"Error loading dataset: {e}")
        return

    dataloader = DataLoader(
        dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=NUM_WORKERS,
        pin_memory=True,
        persistent_workers=True,
        prefetch_factor=4
    )

    # ==========================
    # ✅ 模型
    # ==========================
    model = TransformerBBoxWithAttn(hidden_dim=256, nheads=8, num_classes=91).to(DEVICE)

    criterion_bbox = nn.SmoothL1Loss(beta=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)
    scaler = torch.cuda.amp.GradScaler(enabled=(DEVICE.type == "cuda"))

    # ==========================
    # ✅ 断点续训
    # ==========================
    start_epoch = 0
    best_loss = float("inf")

    if os.path.exists(LAST_PATH):
        print(f"🔁 Found checkpoint: {LAST_PATH}, resuming...")
        ckpt = torch.load(LAST_PATH, map_location=DEVICE, weights_only=False)
        model.load_state_dict(ckpt["model"])
        optimizer.load_state_dict(ckpt["optimizer"])
        scheduler.load_state_dict(ckpt["scheduler"])
        scaler.load_state_dict(ckpt["scaler"])
        start_epoch = ckpt["epoch"] + 1
        best_loss = ckpt.get("best_loss", best_loss)
        print(f"✅ Resumed from epoch {start_epoch}, best_loss={best_loss:.4f}")

    os.makedirs(CHECKPOINT_DIR, exist_ok=True)

    # ==========================
    # ✅ 训练循环
    # ==========================
    print("🚀 开始训练（带Attention Supervision）...\n")

    for epoch in range(start_epoch, EPOCHS):
        model.train()
        total_loss = 0
        total_bbox_loss = 0
        total_attn_loss = 0

        pbar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{EPOCHS}", ncols=140)

        for step, (images, targets, category_ids) in enumerate(pbar):
            images = images.to(DEVICE, non_blocking=True)
            targets = targets.to(DEVICE, non_blocking=True)  # [B, 4] (cx, cy, w, h)
            category_ids = category_ids.to(DEVICE, non_blocking=True)

            if epoch == start_epoch and step == 0:
                print("🔍 targets range check:")
                print(f"   min={targets.min().item():.4f}, max={targets.max().item():.4f}")

            optimizer.zero_grad(set_to_none=True)

            with torch.cuda.amp.autocast(enabled=(DEVICE.type == "cuda")):
                # Forward pass
                outputs = model(images, category_ids)  # [B,4]

                # 获取attention weights
                if hasattr(model, "cross_attn") and hasattr(model.cross_attn, "last_attn_weights"):
                    attn_weights = model.cross_attn.last_attn_weights  # [B,1,L]
                    attn_weights = attn_weights.squeeze(1)  # [B, L]

                    # 生成attention target
                    if args.use_gt_prior:
                        attn_targets = []
                        for i in range(targets.size(0)):
                            cat_id = int(category_ids[i].item())
                            if cat_id in gt_priors:
                                target = gt_priors[cat_id]
                            else:
                                # Fallback if no prior found (should be rare)
                                target = torch.ones(GRID_SIZE*GRID_SIZE, device=DEVICE) / (GRID_SIZE*GRID_SIZE)
                            attn_targets.append(target)
                        attn_targets = torch.stack(attn_targets) # already on device
                    else:
                        # Gaussian centered at GT bbox center
                        B = targets.size(0)
                        attn_targets = []
                        for i in range(B):
                            cx, cy = targets[i, 0].item(), targets[i, 1].item()
                            target_map = generate_gaussian_target(cx, cy, GRID_SIZE, GAUSSIAN_SIGMA)
                            attn_targets.append(target_map.flatten())

                        attn_targets = torch.stack(attn_targets).to(DEVICE)  # [B, L]

                    # Attention supervision loss (KL divergence)
                    loss_attn = kl_divergence_loss(attn_weights, attn_targets)
                else:
                    loss_attn = torch.tensor(0.0, device=DEVICE)

                # BBox regression loss
                loss_bbox = criterion_bbox(outputs, targets)

                # 总损失
                loss = loss_bbox + LAMBDA_ATTN * loss_attn

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            total_loss += loss.item()
            total_bbox_loss += loss_bbox.item()
            total_attn_loss += loss_attn.item()

            pbar.set_postfix(
                loss=f"{loss.item():.4f}",
                bbox=f"{loss_bbox.item():.4f}",
                attn=f"{loss_attn.item():.4f}",
                lr=f"{optimizer.param_groups[0]['lr']:.2e}"
            )

        avg_loss = total_loss / len(dataloader)
        avg_bbox = total_bbox_loss / len(dataloader)
        avg_attn = total_attn_loss / len(dataloader)

        print(f"✅ Epoch {epoch+1} done. Avg Loss: {avg_loss:.4f} (bbox: {avg_bbox:.4f}, attn: {avg_attn:.4f})")

        scheduler.step()

        # ==========================
        # ✅ 保存checkpoints
        # ==========================
        torch.save({
            "epoch": epoch,
            "model": model.state_dict(),
            "optimizer": optimizer.state_dict(),
            "scheduler": scheduler.state_dict(),
            "scaler": scaler.state_dict(),
            "best_loss": best_loss
        }, LAST_PATH)

        if avg_loss < best_loss:
            best_loss = avg_loss
            torch.save(model.state_dict(), SAVE_PATH)
            print(f"🏆 New best model saved! best_loss={best_loss:.4f} -> {SAVE_PATH}")

    print("\n🎉 Training complete!")
    print(f"✅ Best model saved at {SAVE_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--use_gt_prior', action='store_true', help='Use GT prior instead of Gaussian target')
    args = parser.parse_args()
    train(args)
