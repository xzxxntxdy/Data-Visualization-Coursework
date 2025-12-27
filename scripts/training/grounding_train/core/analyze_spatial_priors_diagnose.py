import os
import json
import math
import argparse
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image
from torchvision import transforms

from transformer_model import TransformerBBoxWithAttn


# --------------------------
# Utils
# --------------------------
def set_seed(seed=42):
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def to_prob_map(m: np.ndarray, eps=1e-12):
    m = m.astype(np.float32)
    m = m - m.min()
    m = m + eps
    return m / m.sum()


def entropy(p: np.ndarray, eps=1e-12):
    p = np.clip(p, eps, 1.0)
    return float(-(p * np.log(p)).sum())


def pearson_corr(a: np.ndarray, b: np.ndarray, eps=1e-8):
    a = a.flatten()
    b = b.flatten()
    a = a - a.mean()
    b = b - b.mean()
    denom = (np.sqrt((a*a).sum()) * np.sqrt((b*b).sum()) + eps)
    return float((a*b).sum() / denom)


def kl_div(p: np.ndarray, q: np.ndarray, eps=1e-12):
    p = np.clip(p, eps, 1.0)
    q = np.clip(q, eps, 1.0)
    return float(np.sum(p * np.log(p / q)))


def js_div(p: np.ndarray, q: np.ndarray, eps=1e-12):
    m = 0.5 * (p + q)
    return 0.5 * kl_div(p, m, eps) + 0.5 * kl_div(q, m, eps)


def barycenter(p: np.ndarray):
    """Return (cx, cy) in grid coordinates (0..W-1, 0..H-1)."""
    H, W = p.shape
    ys, xs = np.meshgrid(np.arange(H), np.arange(W), indexing="ij")
    p = p / (p.sum() + 1e-12)
    cx = float((p * xs).sum())
    cy = float((p * ys).sum())
    return cx, cy


def l2(a, b):
    return float(np.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2))


def infer_grid_from_L(L):
    side = int(math.sqrt(L))
    if side * side != L:
        raise ValueError(f"L={L} is not a square, cannot reshape.")
    return side


def make_blank_input(transform, input_type="white"):
    if input_type == "white":
        img = Image.new("RGB", (256, 256), (255, 255, 255))
        return transform(img).unsqueeze(0)
    elif input_type == "gray":
        img = Image.new("RGB", (256, 256), (127, 127, 127))
        return transform(img).unsqueeze(0)
    elif input_type == "black":
        img = Image.new("RGB", (256, 256), (0, 0, 0))
        return transform(img).unsqueeze(0)
    else:
        return torch.randn(1, 3, 256, 256)


# --------------------------
# GT prior computation
# --------------------------
def build_gt_prior_maps(annotations, grid_size):
    gt_counts = {}
    for ann in annotations:
        cid = int(ann["category_id"])
        cx = float(ann["cx"])
        cy = float(ann["cy"])
        if cid not in gt_counts:
            gt_counts[cid] = np.zeros((grid_size, grid_size), dtype=np.float32)
        x = min(grid_size - 1, max(0, int(cx * grid_size)))
        y = min(grid_size - 1, max(0, int(cy * grid_size)))
        gt_counts[cid][y, x] += 1.0

    gt_prob = {}
    counts = {}
    for cid, m in gt_counts.items():
        counts[cid] = int(m.sum())
        gt_prob[cid] = to_prob_map(m)
    return gt_prob, counts


# --------------------------
# Attention extraction
# --------------------------
@torch.no_grad()
def extract_attn_and_bbox(model, input_tensor, category_id, device, expect_attn_softmax=True):
    model.eval()
    category_ids = torch.tensor([category_id], device=device, dtype=torch.long)

    out = model(input_tensor.to(device), category_ids)  # [1,4]

    if not hasattr(model, "cross_attn") or not hasattr(model.cross_attn, "last_attn_weights"):
        raise RuntimeError("Model does not expose model.cross_attn.last_attn_weights")

    attn_weights = model.cross_attn.last_attn_weights  # [B,1,L] (your case)

    # Ensure shape [1,1,L]
    if attn_weights.dim() != 3:
        raise ValueError(f"Unexpected attn_weights shape: {attn_weights.shape}")

    if expect_attn_softmax:
        # already softmaxed, just normalize for safety
        attn_weights = attn_weights / (attn_weights.sum(dim=-1, keepdim=True) + 1e-8)
    else:
        attn_weights = F.softmax(attn_weights, dim=-1)

    L = attn_weights.shape[-1]
    side = infer_grid_from_L(L)

    attn_map = attn_weights[0, 0, :].detach().cpu().numpy().reshape(side, side)
    attn_prob = to_prob_map(attn_map)

    cx, cy, w, h = out[0].detach().cpu().numpy().tolist()
    cx = float(np.clip(cx, 0.0, 1.0))
    cy = float(np.clip(cy, 0.0, 1.0))
    w  = float(np.clip(w, 0.0, 1.0))
    h  = float(np.clip(h, 0.0, 1.0))
    return attn_prob, (cx, cy, w, h), side


# --------------------------
# Plot helpers
# --------------------------
def save_diag_grid(out_path, rows, grid_size):
    """
    rows: list of dict with:
      cat_name, cid, gt_prob, attn_prob, uniform_prob, bbox
    Each row is 1 category; we draw:
      GT | Attn | Uniform | Attn-GT
    """
    n = len(rows)
    fig, axes = plt.subplots(n, 4, figsize=(14, 3.2 * n))

    if n == 1:
        axes = np.expand_dims(axes, 0)

    for i, r in enumerate(rows):
        gt = r["gt_prob"]
        attn = r["attn_prob"]
        uni = r["uniform_prob"]
        diff = attn - gt

        axes[i, 0].imshow(gt, cmap="viridis")
        axes[i, 0].set_title(f"GT Prior\n{r['category']}({r['category_id']})")
        axes[i, 0].axis("off")

        axes[i, 1].imshow(attn, cmap="viridis")
        axes[i, 1].set_title("Attn (prob)")
        axes[i, 1].axis("off")

        axes[i, 2].imshow(uni, cmap="viridis")
        axes[i, 2].set_title("Uniform")
        axes[i, 2].axis("off")

        im = axes[i, 3].imshow(diff, cmap="bwr")
        axes[i, 3].set_title("Attn - GT")
        axes[i, 3].axis("off")
        plt.colorbar(im, ax=axes[i, 3], fraction=0.046)

        # bbox center mark on attention
        cx, cy, w, h = r["bbox"]
        axes[i, 1].scatter([cx * grid_size], [cy * grid_size], c="white", s=60, marker="x")

    plt.tight_layout()
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


# --------------------------
# Main
# --------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_file", type=str, default="spatial_data.json")
    parser.add_argument("--model_path", type=str, default="experiments/3_gt_prior_supervision/checkpoints/chair_transformer_gt_prior_best.pth")
    parser.add_argument("--out_dir", type=str, default="results")
    parser.add_argument("--input_type", type=str, default="white",
                        choices=["white", "gray", "black", "noise"])
    parser.add_argument("--max_cats", type=int, default=80)
    parser.add_argument("--min_count", type=int, default=50)
    parser.add_argument("--expect_attn_softmax", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    set_seed(args.seed)
    ensure_dir(args.out_dir)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Device:", device)

    with open(args.data_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    annotations = data["annotations"]
    print(f"Loaded {len(annotations)} annotations")

    # build cat name map
    cat_id_to_name = {}
    for ann in annotations:
        cid = int(ann["category_id"])
        if cid not in cat_id_to_name:
            cat_id_to_name[cid] = ann.get("category", str(cid))

    # transform (must match training)
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    # load model
    model = TransformerBBoxWithAttn(hidden_dim=256, nheads=8, num_classes=91).to(device)
    if not os.path.exists(args.model_path):
        raise FileNotFoundError(args.model_path)
    sd = torch.load(args.model_path, map_location=device)
    model.load_state_dict(sd, strict=True)
    model.eval()
    print("Loaded model:", args.model_path)

    # infer grid size by probing attention once
    probe_input = make_blank_input(transform, args.input_type).to(device)
    probe_cid = int(annotations[0]["category_id"])
    attn_prob, bbox, grid_size = extract_attn_and_bbox(
        model, probe_input, probe_cid, device,
        expect_attn_softmax=args.expect_attn_softmax
    )
    print(f"Inferred attention grid: {grid_size}x{grid_size}")

    # build GT priors
    gt_prior, cat_counts = build_gt_prior_maps(annotations, grid_size=grid_size)

    # select cats by count
    sorted_cats = sorted(cat_counts.items(), key=lambda x: x[1], reverse=True)
    selected = [cid for cid, cnt in sorted_cats if cnt >= args.min_count][:args.max_cats]
    print(f"Selected {len(selected)} categories, min_count={args.min_count}")

    # uniform baseline
    uniform = np.ones((grid_size, grid_size), dtype=np.float32)
    uniform = uniform / uniform.sum()
    H_uniform = entropy(uniform)

    # run diagnostics
    rows = []
    for cid in selected:
        cat_name = cat_id_to_name.get(cid, str(cid))
        gt = gt_prior[cid]
        attn, bbox, _ = extract_attn_and_bbox(
            model, probe_input, cid, device,
            expect_attn_softmax=args.expect_attn_softmax
        )

        # metrics
        corr = pearson_corr(attn, gt)
        H_attn = entropy(attn)
        H_gt = entropy(gt)

        js_attn_gt = js_div(attn, gt)
        js_attn_uni = js_div(attn, uniform)
        js_gt_uni = js_div(gt, uniform)

        kl_attn_gt = kl_div(attn, gt)
        kl_gt_attn = kl_div(gt, attn)

        # barycenters
        c_attn = barycenter(attn)
        c_gt = barycenter(gt)
        c_uni = barycenter(uniform)

        dist_attn_gt = l2(c_attn, c_gt)
        dist_gt_uni = l2(c_gt, c_uni)
        dist_attn_uni = l2(c_attn, c_uni)

        # bbox center distance (bbox center vs GT barycenter)
        # bbox center in [0,1] -> grid coords
        bbox_center_grid = (bbox[0] * (grid_size - 1), bbox[1] * (grid_size - 1))
        dist_bbox_gt = l2(bbox_center_grid, c_gt)

        row = {
            "category_id": cid,
            "category": cat_name,
            "count": cat_counts[cid],
            "corr(attn,gt)": corr,
            "H_attn": H_attn,
            "H_gt": H_gt,
            "H_uniform": H_uniform,
            "JS(attn,gt)": js_attn_gt,
            "JS(attn,uniform)": js_attn_uni,
            "JS(gt,uniform)": js_gt_uni,
            "KL(attn||gt)": kl_attn_gt,
            "KL(gt||attn)": kl_gt_attn,
            "attn_center_x": c_attn[0],
            "attn_center_y": c_attn[1],
            "gt_center_x": c_gt[0],
            "gt_center_y": c_gt[1],
            "dist_center(attn,gt)": dist_attn_gt,
            "dist_center(attn,uniform)": dist_attn_uni,
            "dist_center(gt,uniform)": dist_gt_uni,
            "bbox_cx": bbox[0],
            "bbox_cy": bbox[1],
            "bbox_w": bbox[2],
            "bbox_h": bbox[3],
            "dist_bbox_center_to_gt_center": dist_bbox_gt,
        }
        rows.append({**row, "gt_prob": gt, "attn_prob": attn, "uniform_prob": uniform, "bbox": bbox})

        # print short line
        print(f"[{cid:>3}] {cat_name:<15} "
              f"corr={corr:+.3f}  JS(attn,gt)={js_attn_gt:.3f}  "
              f"JS(attn,uni)={js_attn_uni:.3f}  "
              f"H_attn={H_attn:.2f}/{H_uniform:.2f}  "
              f"dist_center(attn,gt)={dist_attn_gt:.2f}  "
              f"dist_bbox_to_gt={dist_bbox_gt:.2f}")

    # save csv
    df = pd.DataFrame([{k: v for k, v in r.items() if not isinstance(v, (np.ndarray, tuple))}
                       for r in rows])
    df = df.sort_values(by="JS(attn,uniform)", ascending=True)  # closest to uniform first
    csv_path = os.path.join(args.out_dir, "diagnostics.csv")
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"✅ Saved diagnostics to {csv_path}")

    # Make top-k visualization:
    # choose categories with lowest JS(attn,uniform) (most uniform) and highest JS(attn,uniform) (least uniform)
    k = min(6, len(rows))
    most_uniform = sorted(rows, key=lambda r: r["JS(attn,uniform)"])[:k]
    least_uniform = sorted(rows, key=lambda r: r["JS(attn,uniform)"], reverse=True)[:k]

    # combine
    diag_rows = most_uniform + least_uniform
    out_img = os.path.join(args.out_dir, "diagnostics_top.png")
    save_diag_grid(out_img, diag_rows, grid_size)
    print(f"✅ Saved diagnostic visualization to {out_img}")

    print("Done.")


if __name__ == "__main__":
    main()
