import os
import json
import math
import argparse
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
import matplotlib.pyplot as plt

from transformer_model import TransformerBBoxWithAttn


# --------------------------
# Utils
# --------------------------
def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def to_prob_map(m: np.ndarray, eps=1e-12):
    m = m.astype(np.float32)
    m = m - m.min()
    m = m + eps
    return m / m.sum()

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


# --------------------------
# Build GT prior maps (16x16)
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
# Extract attention
# --------------------------
@torch.no_grad()
def extract_attn(model, x, cid, device, expect_attn_softmax=True):
    model.eval()
    category_ids = torch.tensor([cid], device=device, dtype=torch.long)
    _ = model(x.to(device), category_ids)
    attn = model.cross_attn.last_attn_weights  # [1,1,L]
    attn = attn / (attn.sum(dim=-1, keepdim=True) + 1e-8) if expect_attn_softmax else F.softmax(attn, dim=-1)
    L = attn.shape[-1]
    side = infer_grid_from_L(L)
    attn_map = attn[0, 0].detach().cpu().numpy().reshape(side, side)
    return to_prob_map(attn_map)


# --------------------------
# Plot helper
# --------------------------
def plot_compare(gt, attn_avg, diff, title, save_path):
    fig, axes = plt.subplots(1, 3, figsize=(10, 3.5))

    axes[0].imshow(gt, cmap="viridis")
    axes[0].set_title("GT Prior")
    axes[0].axis("off")

    axes[1].imshow(attn_avg, cmap="viridis")
    axes[1].set_title("Avg Attn (Noise)")
    axes[1].axis("off")

    im = axes[2].imshow(diff, cmap="bwr")
    axes[2].set_title("Attn - GT")
    axes[2].axis("off")
    plt.colorbar(im, ax=axes[2], fraction=0.046)

    plt.suptitle(title, fontsize=12)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


# --------------------------
# Main
# --------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_file", type=str, default="spatial_data.json")
    parser.add_argument("--model_path", type=str, required=True)
    parser.add_argument("--out_dir", type=str, default="results_noise_vs_prior")
    parser.add_argument("--num_samples", type=int, default=32, help="noise samples per category")
    parser.add_argument("--topk", type=int, default=10)
    parser.add_argument("--min_count", type=int, default=50)
    parser.add_argument("--expect_attn_softmax", action="store_true")
    args = parser.parse_args()

    ensure_dir(args.out_dir)
    ensure_dir(os.path.join(args.out_dir, "topk_vis"))

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Device:", device)

    # load data
    with open(args.data_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    annotations = data["annotations"]

    # map id->name
    cat_id_to_name = {}
    for ann in annotations:
        cid = int(ann["category_id"])
        if cid not in cat_id_to_name:
            cat_id_to_name[cid] = ann.get("category", str(cid))

    # load model
    model = TransformerBBoxWithAttn(hidden_dim=256, nheads=8, num_classes=91).to(device)
    sd = torch.load(args.model_path, map_location=device)
    model.load_state_dict(sd, strict=True)
    model.eval()
    print("Loaded model:", args.model_path)

    # probe to infer grid
    probe = torch.randn(1, 3, 256, 256, device=device)
    _ = model(probe, torch.tensor([1], device=device))
    L = model.cross_attn.last_attn_weights.shape[-1]
    grid_size = infer_grid_from_L(L)
    print(f"Inferred attention grid: {grid_size}x{grid_size}")

    # build gt priors
    gt_prior, cat_counts = build_gt_prior_maps(annotations, grid_size)
    cats = sorted([(cid, cnt) for cid, cnt in cat_counts.items() if cnt >= args.min_count],
                  key=lambda x: x[1], reverse=True)
    print(f"Eligible cats (count>={args.min_count}): {len(cats)}")

    results = []

    for cid, cnt in cats:
        cat_name = cat_id_to_name.get(cid, str(cid))
        gt = gt_prior[cid]

        # average attention over multiple random noises
        attn_sum = np.zeros((grid_size, grid_size), dtype=np.float32)
        for _ in range(args.num_samples):
            x = torch.randn(1, 3, 256, 256, device=device)
            attn = extract_attn(model, x, cid, device, expect_attn_softmax=args.expect_attn_softmax)
            attn_sum += attn

        attn_avg = to_prob_map(attn_sum)

        # metrics
        corr = pearson_corr(attn_avg, gt)
        js = js_div(attn_avg, gt)
        c_attn = barycenter(attn_avg)
        c_gt = barycenter(gt)
        dist_center = l2(c_attn, c_gt)

        results.append({
            "category_id": cid,
            "category": cat_name,
            "count": cnt,
            "corr(avg_attn,gt)": corr,
            "JS(avg_attn,gt)": js,
            "dist_center(avg_attn,gt)": dist_center
        })

        print(f"[{cid:>3}] {cat_name:<15} "
              f"corr={corr:+.3f} JS={js:.3f} dist_center={dist_center:.2f}")

    df = pd.DataFrame(results)
    df.to_csv(os.path.join(args.out_dir, "noise_vs_prior_metrics.csv"), index=False, encoding="utf-8-sig")
    print("✅ Saved metrics csv:", os.path.join(args.out_dir, "noise_vs_prior_metrics.csv"))

    # choose best topk (lowest JS first, then highest corr)
    df_sorted = df.sort_values(["JS(avg_attn,gt)", "corr(avg_attn,gt)"], ascending=[True, False]).head(args.topk)
    print("\n🏆 TopK best categories:")
    print(df_sorted[["category_id", "category", "count", "corr(avg_attn,gt)", "JS(avg_attn,gt)", "dist_center(avg_attn,gt)"]])

    # visualize topk
    for _, row in df_sorted.iterrows():
        cid = int(row["category_id"])
        name = row["category"]
        gt = gt_prior[cid]

        attn_sum = np.zeros((grid_size, grid_size), dtype=np.float32)
        for _ in range(args.num_samples):
            x = torch.randn(1, 3, 256, 256, device=device)
            attn = extract_attn(model, x, cid, device, expect_attn_softmax=args.expect_attn_softmax)
            attn_sum += attn
        attn_avg = to_prob_map(attn_sum)

        diff = attn_avg - gt
        title = f"{name}({cid})  corr={row['corr(avg_attn,gt)']:.3f}  JS={row['JS(avg_attn,gt)']:.3f}"
        save_path = os.path.join(args.out_dir, "topk_vis", f"{cid}_{name}_compare.png")
        plot_compare(gt, attn_avg, diff, title, save_path)

    print(f"\n✅ Saved TopK visualizations to {os.path.join(args.out_dir, 'topk_vis')}")
    print("Done.")


if __name__ == "__main__":
    main()
