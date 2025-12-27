"""
对比不同输入类型（white, gray, black, noise）下 attention 的分布
针对 correlation top 5 类别进行可视化
"""
import os
import json
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image
from torchvision import transforms

from transformer_model import TransformerBBoxWithAttn


def set_seed(seed=42):
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def make_blank_input(transform, input_type="white"):
    """生成不同类型的空白输入"""
    if input_type == "white":
        img = Image.new("RGB", (256, 256), (255, 255, 255))
        return transform(img).unsqueeze(0)
    elif input_type == "gray":
        img = Image.new("RGB", (256, 256), (127, 127, 127))
        return transform(img).unsqueeze(0)
    elif input_type == "black":
        img = Image.new("RGB", (256, 256), (0, 0, 0))
        return transform(img).unsqueeze(0)
    else:  # noise
        return torch.randn(1, 3, 256, 256)


def extract_attn_and_bbox(model, img_tensor, category_id, device, expect_attn_softmax=False):
    """提取 attention 和 bbox"""
    with torch.no_grad():
        img_tensor = img_tensor.to(device)
        cat_tensor = torch.tensor([category_id], dtype=torch.long, device=device)
        bbox_pred = model(img_tensor, cat_tensor)

        # 从 cross_attn 获取 attention weights
        attn_weights = model.cross_attn.last_attn_weights
        if attn_weights is None:
            raise ValueError("No attention weights found")

        # [B, 1, L] -> [L]
        attn_flat = attn_weights[0, 0, :].cpu().numpy()

        if not expect_attn_softmax:
            attn_flat = np.exp(attn_flat)
            attn_flat = attn_flat / attn_flat.sum()

        L = len(attn_flat)
        side = int(np.sqrt(L))
        attn_2d = attn_flat.reshape(side, side)

        bbox_np = bbox_pred[0].cpu().numpy()

        return attn_2d, bbox_np, side


def build_gt_prior_maps(annotations, grid_size):
    """构建 GT spatial prior"""
    gt_counts = {}
    for ann in annotations:
        cid = int(ann["category_id"])
        cx, cy = float(ann["cx"]), float(ann["cy"])

        ix = int(cx * grid_size)
        iy = int(cy * grid_size)
        ix = min(ix, grid_size - 1)
        iy = min(iy, grid_size - 1)

        if cid not in gt_counts:
            gt_counts[cid] = np.zeros((grid_size, grid_size), dtype=np.float32)
        gt_counts[cid][iy, ix] += 1

    gt_prior = {}
    cat_counts = {}
    for cid, cnt_map in gt_counts.items():
        total = cnt_map.sum()
        cat_counts[cid] = int(total)
        if total > 0:
            gt_prior[cid] = cnt_map / total
        else:
            gt_prior[cid] = np.ones_like(cnt_map) / (grid_size * grid_size)

    return gt_prior, cat_counts


def compare_input_types_top5():
    """对比不同输入类型下 top 5 correlation 类别的 attention"""
    set_seed(42)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # 读取 diagnostics.csv 找到 top 5 correlation 类别
    diag_path = "results_attn_sup/diagnostics.csv"
    df = pd.read_csv(diag_path)
    top5 = df.nlargest(5, 'corr(attn,gt)')

    print("\n=== Top 5 Correlation 类别 ===")
    for idx, row in top5.iterrows():
        print(f"{row['category']:<20} corr={row['corr(attn,gt)']:+.3f}")

    top5_cats = top5[['category_id', 'category']].values.tolist()

    # 加载数据
    with open("spatial_data.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    annotations = data["annotations"]

    # Transform
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    # 加载模型
    model_path = "checkpoints/chair_transformer_attn_sup_best.pth"
    model = TransformerBBoxWithAttn(hidden_dim=256, nheads=8, num_classes=91).to(device)
    sd = torch.load(model_path, map_location=device)
    model.load_state_dict(sd, strict=True)
    model.eval()
    print(f"Loaded model: {model_path}")

    # 推断 grid size
    probe_input = make_blank_input(transform, "white").to(device)
    probe_cid = int(annotations[0]["category_id"])
    attn_prob, bbox, grid_size = extract_attn_and_bbox(model, probe_input, probe_cid, device)
    print(f"Grid size: {grid_size}x{grid_size}")

    # 构建 GT prior
    gt_prior, _ = build_gt_prior_maps(annotations, grid_size)

    # 对比不同输入类型
    input_types = ["white", "gray", "black", "noise"]

    # 创建大图：5 行（类别） x 5 列（GT + 4种输入）
    fig, axes = plt.subplots(5, 5, figsize=(20, 20))
    fig.suptitle('Attention 对比：不同输入类型 (Top 5 Correlation 类别)', fontsize=16, fontweight='bold')

    for row_idx, (cat_id, cat_name) in enumerate(top5_cats):
        cat_id = int(cat_id)

        # 第 0 列：GT Prior
        ax = axes[row_idx, 0]
        gt = gt_prior[cat_id]
        im = ax.imshow(gt, cmap='hot', interpolation='nearest')
        ax.set_title(f"GT Prior\n{cat_name} (ID={cat_id})", fontsize=10, fontweight='bold')
        ax.axis('off')
        plt.colorbar(im, ax=ax, fraction=0.046)

        # 第 1-4 列：不同输入类型的 attention
        for col_idx, input_type in enumerate(input_types, start=1):
            ax = axes[row_idx, col_idx]

            # 生成输入
            if input_type == "noise":
                # 每次重新生成随机噪声
                blank_input = torch.randn(1, 3, 256, 256).to(device)
            else:
                blank_input = make_blank_input(transform, input_type).to(device)

            # 提取 attention
            attn, bbox, _ = extract_attn_and_bbox(model, blank_input, cat_id, device)

            # 可视化
            im = ax.imshow(attn, cmap='hot', interpolation='nearest')

            # 计算与 GT 的 correlation
            corr = np.corrcoef(attn.flatten(), gt.flatten())[0, 1]

            ax.set_title(f"Attn ({input_type})\ncorr={corr:+.3f}", fontsize=10)
            ax.axis('off')
            plt.colorbar(im, ax=ax, fraction=0.046)

    plt.tight_layout()

    # 保存
    out_path = "results_attn_sup/input_type_comparison_top5.png"
    plt.savefig(out_path, dpi=150, bbox_inches='tight')
    print(f"\n✅ 保存对比图到: {out_path}")
    plt.close()

    # 统计不同输入类型的平均 correlation
    print("\n=== 不同输入类型的平均 Correlation (Top 5 类别) ===")

    stats = {itype: [] for itype in input_types}

    for cat_id, cat_name in top5_cats:
        cat_id = int(cat_id)
        gt = gt_prior[cat_id]

        for input_type in input_types:
            if input_type == "noise":
                # 多次测试取平均
                corrs = []
                for _ in range(5):
                    blank_input = torch.randn(1, 3, 256, 256).to(device)
                    attn, _, _ = extract_attn_and_bbox(model, blank_input, cat_id, device)
                    corr = np.corrcoef(attn.flatten(), gt.flatten())[0, 1]
                    corrs.append(corr)
                avg_corr = np.mean(corrs)
                stats[input_type].append(avg_corr)
            else:
                blank_input = make_blank_input(transform, input_type).to(device)
                attn, _, _ = extract_attn_and_bbox(model, blank_input, cat_id, device)
                corr = np.corrcoef(attn.flatten(), gt.flatten())[0, 1]
                stats[input_type].append(corr)

    print(f"{'输入类型':<15} {'平均 Corr':<15} {'标准差':<15}")
    print("-" * 45)
    for input_type in input_types:
        mean_corr = np.mean(stats[input_type])
        std_corr = np.std(stats[input_type])
        print(f"{input_type:<15} {mean_corr:+.3f}           {std_corr:.3f}")

    print("\n✅ 对比实验完成！")


if __name__ == "__main__":
    compare_input_types_top5()
