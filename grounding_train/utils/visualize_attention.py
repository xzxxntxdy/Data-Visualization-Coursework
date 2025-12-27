
import os
import torch
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
from PIL import Image
from torchvision import transforms
import cv2

from transformer_model import TransformerBBoxWithAttn

def denormalize(tensor):
    """还原归一化的图像用于显示"""
    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])
    img = tensor.permute(1, 2, 0).cpu().numpy()
    img = std * img + mean
    img = np.clip(img, 0, 1)
    return img

def visualize_attention(model_path, img_path, save_name="attention_vis.png"):
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # 加载模型
    model = TransformerBBoxWithAttn(hidden_dim=256, nheads=8).to(DEVICE)
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=DEVICE))
        print(f"Loaded model from {model_path}")
    else:
        print("Warning: Model checkpoint not found, using random weights (Demo mode).")
    
    model.eval()

    # 预处理
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    # 加载图像
    try:
        raw_image = Image.open(img_path).convert("RGB")
    except Exception as e:
        print(f"Cannot open image {img_path}: {e}")
        return

    input_tensor = transform(raw_image).unsqueeze(0).to(DEVICE)

    # 推理
    with torch.no_grad():
        output = model(input_tensor) # [1, 4]
        # 获取 Attention
        # 我们的 AttentionBlock 把权重存到了 last_attn_weights: [B, 1, L]
        attn_weights = model.cross_attn.last_attn_weights # [1, 1, L]
    
    # 处理 Attention Map
    # L = 16*16 = 256
    # Reshape to 16x16
    attn_map = attn_weights[0, 0, :].reshape(16, 16).cpu().numpy()
    
    # 放大 Attention Map 到 256x256
    attn_map_resized = cv2.resize(attn_map, (256, 256), interpolation=cv2.INTER_CUBIC)
    
    # 准备绘图
    fig, ax = plt.subplots(1, 2, figsize=(12, 6))
    
    # 1. 原始图像 + BBox
    img_display = denormalize(input_tensor[0])
    ax[0].imshow(img_display)
    
    # 解析 BBox (cx, cy, w, h) -> (x1, y1, w, h) for plotting
    cx, cy, w, h = output[0].cpu().numpy()
    # 坐标是相对 0-1 的
    H, W = 256, 256
    rect_x = (cx - w/2) * W
    rect_y = (cy - h/2) * H
    rect_w = w * W
    rect_h = h * H
    
    rect = patches.Rectangle((rect_x, rect_y), rect_w, rect_h, linewidth=2, edgecolor='r', facecolor='none')
    ax[0].add_patch(rect)
    ax[0].set_title("Prediction")
    ax[0].axis('off')

    # 2. Attention Overlay
    ax[1].imshow(img_display)
    ax[1].imshow(attn_map_resized, alpha=0.5, cmap='jet') # 叠加热力图
    ax[1].set_title("Spatial Attention (Query Token)")
    ax[1].axis('off')

    plt.tight_layout()
    plt.savefig(save_name)
    print(f"✅ Visualization saved to {save_name}")
    plt.close()

def visualize_blank_input(model_path, category_id, category_name, save_name=None, input_type="white"):
    """
    用空白/白板图像测试模型学到的空间先验分布
    
    Args:
        model_path: 模型权重路径
        category_id: COCO类别ID
        category_name: 类别名称（用于标题）
        save_name: 保存文件名
        input_type: "white" (白板), "gray" (灰色), "noise" (噪声)
    """
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    model = TransformerBBoxWithAttn(hidden_dim=256, nheads=8, num_classes=91).to(DEVICE)
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=DEVICE))
        print(f"Loaded model from {model_path}")
    else:
        print("Warning: Model not found, using random weights!")
    model.eval()
    
    # 构建无意义输入
    if input_type == "white":
        # 白板图像 (归一化后的值)
        # 白色 RGB=(1,1,1) 归一化后: (1-mean)/std
        white_normalized = (torch.ones(1, 3, 256, 256) - torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)) / torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
        input_tensor = white_normalized.to(DEVICE)
    elif input_type == "gray":
        # 灰色图像 (0.5, 0.5, 0.5)
        gray_normalized = (torch.ones(1, 3, 256, 256) * 0.5 - torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)) / torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
        input_tensor = gray_normalized.to(DEVICE)
    else:
        # 随机噪声
        input_tensor = torch.randn(1, 3, 256, 256).to(DEVICE)
    
    category_ids = torch.tensor([category_id]).to(DEVICE)
    
    with torch.no_grad():
        output = model(input_tensor, category_ids)
        attn_weights = model.cross_attn.last_attn_weights  # [1, 1, L]
        
    attn_map = attn_weights[0, 0, :].reshape(16, 16).cpu().numpy()
    attn_map_resized = cv2.resize(attn_map, (256, 256), interpolation=cv2.INTER_CUBIC)
    
    # 预测的bbox
    cx, cy, w, h = output[0].cpu().numpy()
    
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    
    # 左图：Attention Map
    im = axes[0].imshow(attn_map_resized, cmap='jet')
    axes[0].set_title(f"Attention Map\nQuery: {category_name} (id={category_id})")
    axes[0].axis('off')
    plt.colorbar(im, ax=axes[0], fraction=0.046)
    
    # 右图：Attention + 预测框
    axes[1].imshow(attn_map_resized, cmap='jet')
    # 画预测框
    rect_x = (cx - w/2) * 256
    rect_y = (cy - h/2) * 256
    rect_w = w * 256
    rect_h = h * 256
    rect = patches.Rectangle((rect_x, rect_y), rect_w, rect_h, 
                               linewidth=3, edgecolor='white', facecolor='none', linestyle='--')
    axes[1].add_patch(rect)
    # 标记中心点
    axes[1].scatter([cx * 256], [cy * 256], c='white', s=100, marker='x', linewidths=3)
    axes[1].set_title(f"Predicted BBox\ncx={cx:.3f}, cy={cy:.3f}")
    axes[1].axis('off')
    
    plt.suptitle(f"Spatial Prior for '{category_name}' (Input: {input_type} image)", fontsize=14)
    plt.tight_layout()
    
    if save_name is None:
        save_name = f"spatial_prior_{category_name}_{input_type}.png"
    plt.savefig(save_name, dpi=150, bbox_inches='tight')
    print(f"✅ Saved to {save_name}")
    plt.close()
    
    return attn_map, (cx, cy, w, h)


def visualize_multiple_categories(model_path, save_name="spatial_priors_grid.png"):
    """
    可视化多个类别的空间先验分布（用白板图像）
    """
    # 选择一些有代表性的类别
    # COCO类别ID和名称
    categories = [
        (62, "chair"),
        (63, "couch"),
        (64, "potted plant"),
        (65, "bed"),
        (67, "dining table"),
        (72, "tv"),
        (1, "person"),
        (3, "car"),
        (16, "bird"),
        (17, "cat"),
        (18, "dog"),
        (44, "bottle"),
    ]
    
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    model = TransformerBBoxWithAttn(hidden_dim=256, nheads=8, num_classes=91).to(DEVICE)
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=DEVICE))
        print(f"Loaded model from {model_path}")
    model.eval()
    
    # 白板输入
    white_normalized = (torch.ones(1, 3, 256, 256) - torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)) / torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
    input_tensor = white_normalized.to(DEVICE)
    
    # 创建网格图
    n_cols = 4
    n_rows = (len(categories) + n_cols - 1) // n_cols
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(16, 4 * n_rows))
    axes = axes.flatten()
    
    for idx, (cat_id, cat_name) in enumerate(categories):
        category_ids = torch.tensor([cat_id]).to(DEVICE)
        
        with torch.no_grad():
            output = model(input_tensor, category_ids)
            attn_weights = model.cross_attn.last_attn_weights
            
        attn_map = attn_weights[0, 0, :].reshape(16, 16).cpu().numpy()
        attn_map_resized = cv2.resize(attn_map, (256, 256), interpolation=cv2.INTER_CUBIC)
        
        cx, cy, w, h = output[0].cpu().numpy()
        
        axes[idx].imshow(attn_map_resized, cmap='jet')
        # 画预测框
        rect_x = (cx - w/2) * 256
        rect_y = (cy - h/2) * 256
        rect = patches.Rectangle((rect_x, rect_y), w*256, h*256, 
                                   linewidth=2, edgecolor='white', facecolor='none')
        axes[idx].add_patch(rect)
        axes[idx].scatter([cx * 256], [cy * 256], c='white', s=50, marker='x', linewidths=2)
        axes[idx].set_title(f"{cat_name}\ncx={cx:.2f}, cy={cy:.2f}")
        axes[idx].axis('off')
    
    # 隐藏多余的子图
    for idx in range(len(categories), len(axes)):
        axes[idx].axis('off')
    
    plt.suptitle("Learned Spatial Priors (White Image Input)", fontsize=16, y=1.02)
    plt.tight_layout()
    plt.savefig(save_name, dpi=150, bbox_inches='tight')
    print(f"✅ Grid visualization saved to {save_name}")
    plt.close()


if __name__ == "__main__":
    MODEL_PATH = "checkpoints/chair_transformer.pth"
    
    # 1. 单个类别测试 - chair
    visualize_blank_input(MODEL_PATH, 62, "chair", "attn_chair_white.png", input_type="white")
    
    # 2. 多类别网格对比
    visualize_multiple_categories(MODEL_PATH, "spatial_priors_grid.png")
