"""
空间数据处理脚本 - 从 COCO instances 提取 bbox 信息
生成用于空间/尺度分析的 JSON 数据文件

输出数据结构：
- spatial_data.json: 包含采样的标注数据、类别统计、空间网格聚合
"""

import json
import os
import random
from collections import defaultdict
import math

DATA_DIR = os.path.join("src", "data")
INPUT_FILE = os.path.join(DATA_DIR, "instances_train2017.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "spatial_data.json")

# 采样数量：控制前端性能，同时保证代表性
SAMPLE_SIZE = 8000
# 空间网格分辨率 (用于热力图预聚合)
GRID_SIZE = 20

# COCO 官方尺度阈值 (像素面积)
SCALE_THRESHOLDS = {
    "small": 32 * 32,      # < 1024
    "medium": 96 * 96,     # 1024 ~ 9216
    "large": float("inf")  # > 9216
}


def get_scale_category(area):
    """根据 COCO 官方标准划分目标尺度"""
    if area < SCALE_THRESHOLDS["small"]:
        return "small"
    elif area < SCALE_THRESHOLDS["medium"]:
        return "medium"
    else:
        return "large"


def process_spatial_data():
    print(f"📂 Loading data from {INPUT_FILE}...")
    
    try:
        with open(INPUT_FILE, "r", encoding="utf-8") as f:
            coco_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: {INPUT_FILE} not found.")
        print("Please place instances_train2017.json in src/data/")
        return

    # 构建类别映射
    categories = {cat["id"]: cat["name"] for cat in coco_data["categories"]}
    # 构建超类映射 (COCO 80类 -> 12个超类)
    supercategories = {cat["id"]: cat.get("supercategory", "other") 
                       for cat in coco_data["categories"]}
    
    # 构建图像尺寸映射
    image_dims = {img["id"]: (img["width"], img["height"]) 
                  for img in coco_data["images"]}
    
    print(f"✅ Loaded {len(categories)} categories, {len(image_dims)} images")
    
    annotations = coco_data["annotations"]
    print(f"📊 Total annotations: {len(annotations)}")
    
    # ========== 1. 处理所有标注，计算归一化坐标 ==========
    processed_anns = []
    category_stats = defaultdict(lambda: {
        "count": 0,
        "areas": [],
        "aspect_ratios": [],
        "scale_dist": {"small": 0, "medium": 0, "large": 0}
    })
    
    # 空间网格计数 (按类别)
    spatial_grids = defaultdict(lambda: [[0] * GRID_SIZE for _ in range(GRID_SIZE)])
    global_grid = [[0] * GRID_SIZE for _ in range(GRID_SIZE)]
    
    for ann in annotations:
        img_id = ann["image_id"]
        cat_id = ann["category_id"]
        bbox = ann["bbox"]  # [x, y, width, height]
        area = ann.get("area", bbox[2] * bbox[3])
        
        if img_id not in image_dims:
            continue
            
        img_w, img_h = image_dims[img_id]
        if img_w <= 0 or img_h <= 0:
            continue
        
        # 计算归一化中心坐标 (0~1)
        cx = (bbox[0] + bbox[2] / 2) / img_w
        cy = (bbox[1] + bbox[3] / 2) / img_h
        
        # 归一化宽高
        norm_w = bbox[2] / img_w
        norm_h = bbox[3] / img_h
        
        # 相对面积 (占图像面积的比例)
        rel_area = (bbox[2] * bbox[3]) / (img_w * img_h)
        
        # 宽高比
        aspect_ratio = bbox[2] / max(bbox[3], 1)
        
        # 尺度分类
        scale_cat = get_scale_category(area)
        
        # 更新类别统计
        stats = category_stats[cat_id]
        stats["count"] += 1
        stats["areas"].append(rel_area)
        stats["aspect_ratios"].append(aspect_ratio)
        stats["scale_dist"][scale_cat] += 1
        
        # 更新空间网格
        grid_x = min(int(cx * GRID_SIZE), GRID_SIZE - 1)
        grid_y = min(int(cy * GRID_SIZE), GRID_SIZE - 1)
        spatial_grids[cat_id][grid_y][grid_x] += 1
        global_grid[grid_y][grid_x] += 1
        
        # 保存处理后的标注
        processed_anns.append({
            "id": ann["id"],
            "image_id": img_id,
            "category_id": cat_id,
            "category": categories[cat_id],
            "supercategory": supercategories[cat_id],
            "cx": round(cx, 4),
            "cy": round(cy, 4),
            "width": round(norm_w, 4),
            "height": round(norm_h, 4),
            "area": round(rel_area, 6),
            "aspect_ratio": round(aspect_ratio, 3),
            "raw_area": area,
            "scale": scale_cat
        })
    
    print(f"✅ Processed {len(processed_anns)} valid annotations")
    
    # ========== 2. 随机采样以控制前端数据量 ==========
    print("🔄 Sampling annotations...")
    if len(processed_anns) > SAMPLE_SIZE:
        # 分层采样：确保每个类别都有代表
        sampled = []
        cats_list = list(category_stats.keys())
        per_cat = max(SAMPLE_SIZE // len(cats_list), 50)
        
        by_cat = defaultdict(list)
        for ann in processed_anns:
            by_cat[ann["category_id"]].append(ann)
        
        sampled_ids = set()
        for cat_id in cats_list:
            cat_anns = by_cat[cat_id]
            sample_n = min(len(cat_anns), per_cat)
            cat_sampled = random.sample(cat_anns, sample_n)
            sampled.extend(cat_sampled)
            for a in cat_sampled:
                sampled_ids.add(a["id"])
        
        # 如果还不够，随机补充（使用 set 快速判断）
        if len(sampled) < SAMPLE_SIZE:
            remaining = [a for a in processed_anns if a["id"] not in sampled_ids]
            extra = min(SAMPLE_SIZE - len(sampled), len(remaining))
            if extra > 0:
                sampled.extend(random.sample(remaining, extra))
        
        processed_anns = sampled[:SAMPLE_SIZE]
        print(f"📉 Sampled down to {len(processed_anns)} annotations")
    
    # ========== 3. 计算类别统计摘要 ==========
    print("📈 Computing category statistics...")
    category_summary = []
    for cat_id, stats in category_stats.items():
        if stats["count"] == 0:
            continue
        
        areas = stats["areas"]
        ratios = stats["aspect_ratios"]
        
        category_summary.append({
            "id": cat_id,
            "name": categories[cat_id],
            "supercategory": supercategories[cat_id],
            "count": stats["count"],
            "area_stats": {
                "mean": round(sum(areas) / len(areas), 6),
                "min": round(min(areas), 6),
                "max": round(max(areas), 6),
                "median": round(sorted(areas)[len(areas) // 2], 6)
            },
            "aspect_ratio_stats": {
                "mean": round(sum(ratios) / len(ratios), 3),
                "min": round(min(ratios), 3),
                "max": round(max(ratios), 3)
            },
            "scale_distribution": stats["scale_dist"]
        })
    
    # 按数量排序
    category_summary.sort(key=lambda x: -x["count"])
    
    # ========== 4. 生成空间网格数据 (Top 10 类别) ==========
    top_categories = [c["id"] for c in category_summary[:10]]
    grid_data = {
        "global": global_grid,
        "by_category": {
            categories[cat_id]: spatial_grids[cat_id] 
            for cat_id in top_categories
        },
        "grid_size": GRID_SIZE
    }
    
    # ========== 5. 生成尺度分布直方图数据 ==========
    # 对 log(area) 做分桶统计
    def compute_histogram(values, bins=30):
        if not values:
            return []
        log_vals = [math.log10(max(v, 1e-8)) for v in values]
        min_v, max_v = min(log_vals), max(log_vals)
        if min_v == max_v:
            return [{"x": min_v, "count": len(values)}]
        
        bin_width = (max_v - min_v) / bins
        hist = [0] * bins
        for v in log_vals:
            idx = min(int((v - min_v) / bin_width), bins - 1)
            hist[idx] += 1
        
        return [
            {"x": round(min_v + (i + 0.5) * bin_width, 4), "count": c}
            for i, c in enumerate(hist) if c > 0
        ]
    
    scale_histograms = {}
    for cat in category_summary[:20]:  # Top 20 类别的直方图
        cat_areas = [a["area"] for a in processed_anns if a["category_id"] == cat["id"]]
        scale_histograms[cat["name"]] = compute_histogram(cat_areas)
    
    # ========== 6. 输出最终数据 ==========
    output_data = {
        "annotations": processed_anns,
        "categories": category_summary,
        "spatial_grid": grid_data,
        "scale_histograms": scale_histograms,
        "meta": {
            "total_annotations": len(coco_data["annotations"]),
            "sampled_count": len(processed_anns),
            "grid_resolution": GRID_SIZE,
            "scale_thresholds": {
                "small": "< 32x32",
                "medium": "32x32 ~ 96x96",
                "large": "> 96x96"
            }
        }
    }
    
    print(f"💾 Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False)
    
    file_size = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"✅ Done! File size: {file_size:.2f} MB")
    print(f"   - {len(processed_anns)} sampled annotations")
    print(f"   - {len(category_summary)} categories with stats")
    print(f"   - {GRID_SIZE}x{GRID_SIZE} spatial grid")


if __name__ == "__main__":
    process_spatial_data()
