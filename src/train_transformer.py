
import os
import torch
import torch.optim as optim
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import transforms
from tqdm import tqdm

from chair_dataset import SpatialDataset
from transformer_model import TransformerBBoxWithAttn

def train():
    # 配置
    DATA_FILE = r"D:\Study\data_vis\Data-Visualization-Coursework\src\data\spatial_data.json"
    IMG_DIR = r"D:\Study\data_vis\Data-Visualization-Coursework\images\spatial"  # 提取的8000条数据对应图片
    BATCH_SIZE = 64       # RTX 4060 8GB 可以跑 64
    LR = 3e-4             # 稍微提高学习率配合大batch
    EPOCHS = 30           # 多训练几轮确保学到空间分布
    NUM_WORKERS = 4       # 多进程加载数据
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    print(f"Using device: {DEVICE}")
    if DEVICE.type == 'cuda':
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

    # 数据转换 - 不做数据增强，只做基本预处理
    # 这样模型能更好地学习到原始数据中的空间位置偏差
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    # 数据集
    try:
        dataset = SpatialDataset(DATA_FILE, IMG_DIR, transform=transform)
    except FileNotFoundError as e:
        print(f"Error loading dataset: {e}")
        return

    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=NUM_WORKERS, pin_memory=True)

    # 模型
    # Use max category index 90 -> num_classes=91
    model = TransformerBBoxWithAttn(hidden_dim=256, nheads=8, num_classes=91).to(DEVICE)
    model.train()

    optimizer = optim.AdamW(model.parameters(), lr=LR)
    criterion = nn.MSELoss() # 回归坐标

    print("🚀 开始训练...")
    
    for epoch in range(EPOCHS):
        total_loss = 0
        pbar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{EPOCHS}")
        
        for images, targets, category_ids in pbar:
            images = images.to(DEVICE)
            targets = targets.to(DEVICE)
            category_ids = category_ids.to(DEVICE)
            
            optimizer.zero_grad()
            
            # Forward
            # output: [B, 4] (cx, cy, w, h)
            outputs = model(images, category_ids)
            
            loss = criterion(outputs, targets)
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            pbar.set_postfix({"loss": f"{loss.item():.4f}"})
        
        avg_loss = total_loss / len(dataloader)
        print(f"Epoch {epoch+1} done. Avg Loss: {avg_loss:.4f}")

    # 保存模型
    os.makedirs("checkpoints", exist_ok=True)
    save_path = "checkpoints/chair_transformer.pth"
    torch.save(model.state_dict(), save_path)
    print(f"💾 模型已保存至 {save_path}")

if __name__ == "__main__":
    train()
