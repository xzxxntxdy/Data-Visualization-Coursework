import os
import torch
import torch.optim as optim
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import transforms
from tqdm import tqdm

from dataset import SpatialDataset
from transformer_model import TransformerBBoxWithAttn


def train():
    # ==========================
    # ✅ RTX3090 训练推荐配置
    # ==========================
    DATA_FILE = r"spatial_data.json"
    IMG_DIR = r"spatial"

    BATCH_SIZE = 128         # 3090 24GB 通常可以
    LR = 6e-4                # batch=128 推荐
    EPOCHS = 40              # 多跑点更稳
    NUM_WORKERS = 8          # CPU 核多就加
    WEIGHT_DECAY = 1e-4

    CHECKPOINT_DIR = "checkpoints"
    SAVE_PATH = os.path.join(CHECKPOINT_DIR, "chair_transformer_best.pth")
    LAST_PATH = os.path.join(CHECKPOINT_DIR, "chair_transformer_last.pth")

    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # ✅ cudnn benchmark（输入固定尺寸加速）
    torch.backends.cudnn.benchmark = True

    print(f"Using device: {DEVICE}")
    if DEVICE.type == 'cuda':
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

    # ==========================
    # ✅ 数据转换（无增强，保留偏差）
    # ==========================
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        ),
    ])

    # ==========================
    # ✅ 数据集
    # ==========================
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

    # ✅ 更稳定的 bbox 回归 loss（比MSE抗异常值更强）
    criterion = nn.SmoothL1Loss(beta=0.1)

    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    # ✅ AMP 混合精度（3090 性能提升明显）
    scaler = torch.cuda.amp.GradScaler(enabled=(DEVICE.type == "cuda"))

    # ==========================
    # ✅ 断点续训
    # ==========================
    start_epoch = 0
    best_loss = float("inf")

    if os.path.exists(LAST_PATH):
        print(f"🔁 Found checkpoint: {LAST_PATH}, resuming...")
        ckpt = torch.load(LAST_PATH, map_location=DEVICE)
        model.load_state_dict(ckpt["model"])
        optimizer.load_state_dict(ckpt["optimizer"])
        scheduler.load_state_dict(ckpt["scheduler"])
        scaler.load_state_dict(ckpt["scaler"])
        start_epoch = ckpt["epoch"] + 1
        best_loss = ckpt.get("best_loss", best_loss)
        print(f"✅ Resumed from epoch {start_epoch}, best_loss={best_loss:.4f}")

    os.makedirs(CHECKPOINT_DIR, exist_ok=True)

    # ==========================
    # ✅ 训练
    # ==========================
    print("🚀 开始训练...")

    for epoch in range(start_epoch, EPOCHS):
        model.train()
        total_loss = 0

        pbar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{EPOCHS}", ncols=120)

        for step, (images, targets, category_ids) in enumerate(pbar):
            images = images.to(DEVICE, non_blocking=True)
            targets = targets.to(DEVICE, non_blocking=True)
            category_ids = category_ids.to(DEVICE, non_blocking=True)

            # ✅ 打印 target 范围，帮助检查是不是 0-1 坐标
            if epoch == start_epoch and step == 0:
                print("🔍 targets range check:")
                print(f"   min={targets.min().item():.4f}, max={targets.max().item():.4f}")
                if targets.max().item() > 2:
                    print("⚠️ 看起来 targets 可能是像素坐标（不是0~1归一化坐标）。训练仍可跑，但建议确认是否一致。")

            optimizer.zero_grad(set_to_none=True)

            with torch.cuda.amp.autocast(enabled=(DEVICE.type == "cuda")):
                outputs = model(images, category_ids)  # [B,4]
                loss = criterion(outputs, targets)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            total_loss += loss.item()
            pbar.set_postfix(loss=f"{loss.item():.4f}", lr=f"{optimizer.param_groups[0]['lr']:.2e}")

        avg_loss = total_loss / len(dataloader)
        print(f"✅ Epoch {epoch+1} done. Avg Loss: {avg_loss:.4f}")

        scheduler.step()

        # ==========================
        # ✅ 保存 last checkpoint（用于断点续训）
        # ==========================
        torch.save({
            "epoch": epoch,
            "model": model.state_dict(),
            "optimizer": optimizer.state_dict(),
            "scheduler": scheduler.state_dict(),
            "scaler": scaler.state_dict(),
            "best_loss": best_loss
        }, LAST_PATH)

        # ==========================
        # ✅ 保存 best checkpoint
        # ==========================
        if avg_loss < best_loss:
            best_loss = avg_loss
            torch.save(model.state_dict(), SAVE_PATH)
            print(f"🏆 New best model saved! best_loss={best_loss:.4f} -> {SAVE_PATH}")

    print("🎉 Training complete!")
    print(f"✅ Best model saved at {SAVE_PATH}")


if __name__ == "__main__":
    train()
