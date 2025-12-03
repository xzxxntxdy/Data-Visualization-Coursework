import json
import os
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont

# Paths
DATA_DIR = Path("src/data")
HERO_IMAGE = DATA_DIR / "hero_image.jpg"
HERO_JSON = DATA_DIR / "hero_data.json"
OUTPUT_SPATIAL = DATA_DIR / "hero_spatial.png"
OUTPUT_SEMANTIC = DATA_DIR / "hero_semantic.png"
OUTPUT_POSE = DATA_DIR / "hero_pose.png"

# Visual constants
CYAN = (0, 255, 255)
PURPLE = (160, 32, 240)
PINK = (255, 0, 255)
DARKEN_ALPHA = 0.35

# COCO 17-keypoint skeleton pairs (index based)
COCO_SKELETON: List[Tuple[int, int]] = [
    (5, 7),
    (7, 9),
    (6, 8),
    (8, 10),
    (5, 6),
    (5, 11),
    (6, 12),
    (11, 12),
    (11, 13),
    (13, 15),
    (12, 14),
    (14, 16),
    (0, 1),
    (0, 2),
    (1, 3),
    (2, 4),
    (0, 5),
    (0, 6),
]

# Categories that link to the dining table hub in the semantic view
CONNECT_CATEGORIES = {
    "person",
    "chair",
    "spoon",
    "fork",
    "knife",
    "cup",
    "bottle",
    "wine glass",
    "bowl",
    "bench",
}


def load_data() -> Dict:
    if not HERO_JSON.exists():
        raise FileNotFoundError(f"Missing data file: {HERO_JSON}")
    with HERO_JSON.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_base_image() -> Image.Image:
    if not HERO_IMAGE.exists():
        raise FileNotFoundError(f"Missing base image: {HERO_IMAGE}")
    image = Image.open(HERO_IMAGE).convert("RGBA")
    overlay = Image.new(
        "RGBA",
        image.size,
        (0, 0, 0, int(255 * DARKEN_ALPHA)),
    )
    return Image.alpha_composite(image, overlay)


def clamp_box(
    x1: float, y1: float, x2: float, y2: float, width: int, height: int
) -> Tuple[float, float, float, float]:
    return (
        max(0, x1),
        max(0, y1),
        min(width - 1, x2),
        min(height - 1, y2),
    )


def draw_spatial_layer(base: Image.Image, data: Dict) -> None:
    image = base.copy()
    draw = ImageDraw.Draw(image, "RGBA")
    font = ImageFont.load_default()
    width, height = image.size

    for obj in data.get("spatial", []):
        bbox = obj.get("bbox", [0, 0, 0, 0])
        x1, y1, w, h = bbox
        x2, y2 = x1 + w, y1 + h
        x1, y1, x2, y2 = clamp_box(x1, y1, x2, y2, width, height)

        # Outline opacity is full for non-small targets, slightly dimmed for small ones.
        line_alpha = int(255 * 0.6) if obj.get("scale") == "small" else 255
        line_color = CYAN + (line_alpha,)

        # ✅ 不再填充内部，只画框线
        draw.rectangle(
            [x1, y1, x2, y2],
            outline=line_color,
            width=2,
            # fill=None  # 等价于不写 fill
        )

        label = obj.get("category", "")
        if label:
            pad = 2
            text_box = draw.textbbox((x1, y1), label, font=font)
            text_w = text_box[2] - text_box[0]
            text_h = text_box[3] - text_box[1]
            bg_x2 = min(x1 + text_w + pad * 2, width)
            bg_y2 = min(y1 + text_h + pad * 2, height)
            # 这里的小标签底色我保留了，如果你也不想盖住原图，可以同样去掉这块填充
            draw.rectangle([x1, y1, bg_x2, bg_y2], fill=CYAN + (255,))
            draw.text((x1 + pad, y1 + pad - 1), label, fill=(0, 0, 0), font=font)

    image.save(OUTPUT_SPATIAL)



def draw_semantic_layer(base: Image.Image, data: Dict) -> None:
    image = base.copy()
    draw = ImageDraw.Draw(image, "RGBA")

    centers = []
    hub_center = None
    hub_area = -1.0

    for obj in data.get("spatial", []):
        x, y, w, h = obj.get("bbox", [0, 0, 0, 0])
        cx, cy = x + w / 2, y + h / 2
        area = obj.get("area", w * h)
        centers.append({"category": obj.get("category", ""), "center": (cx, cy), "area": area})

        if obj.get("category") == "dining table" and area > hub_area:
            hub_center = (cx, cy)
            hub_area = area

    if hub_center:
        for entry in centers:
            cat = entry["category"]
            if cat == "dining table":
                continue
            if cat in CONNECT_CATEGORIES:
                draw.line(
                    [hub_center, entry["center"]],
                    fill=PURPLE + (int(255 * 0.6),),
                    width=1,
                )

    node_radius = 5
    glow_radius = node_radius + 3
    for entry in centers:
        cx, cy = entry["center"]
        draw.ellipse(
            [cx - glow_radius, cy - glow_radius, cx + glow_radius, cy + glow_radius],
            fill=PURPLE + (60,),
        )
        draw.ellipse(
            [cx - node_radius, cy - node_radius, cx + node_radius, cy + node_radius],
            fill=PURPLE + (200,),
            outline=PURPLE + (255,),
            width=1,
        )

    image.save(OUTPUT_SEMANTIC)


def draw_pose_layer(base: Image.Image, data: Dict) -> None:
    image = base.copy()
    draw = ImageDraw.Draw(image, "RGBA")
    joint_radius = 3

    for person in data.get("pose", []):
        keypoints = person.get("keypoints", [])
        coords = [
            (keypoints[i], keypoints[i + 1], keypoints[i + 2])
            for i in range(0, len(keypoints), 3)
        ]

        for a, b in COCO_SKELETON:
            if max(a, b) >= len(coords):
                continue
            x1, y1, v1 = coords[a]
            x2, y2, v2 = coords[b]
            if v1 > 0 and v2 > 0:
                draw.line(
                    [(x1, y1), (x2, y2)],
                    fill=PINK + (255,),
                    width=3,
                )

        for x, y, v in coords:
            if v > 0:
                draw.ellipse(
                    [
                        x - joint_radius,
                        y - joint_radius,
                        x + joint_radius,
                        y + joint_radius,
                    ],
                    fill=(255, 255, 255, 255),
                    outline=PINK + (200,),
                    width=1,
                )

    image.save(OUTPUT_POSE)


def main() -> None:
    data = load_data()
    base = load_base_image()

    draw_spatial_layer(base, data)
    draw_semantic_layer(base, data)
    draw_pose_layer(base, data)
    print("Generated hero_spatial.png, hero_semantic.png, and hero_pose.png in src/data.")


if __name__ == "__main__":
    main()
