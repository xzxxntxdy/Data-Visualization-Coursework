# -*- coding: utf-8 -*-
import argparse
import os
import json

import torch
from torch import nn
from PIL import Image, ImageDraw, ImageFont
import torchvision.models as models
import torchvision.transforms as T


def build_transform(img_size: int) -> T.Compose:
    return T.Compose(
        [
            T.Resize((img_size, img_size)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


def load_checkpoint(ckpt_path: str):
    checkpoint = torch.load(ckpt_path, map_location="cpu")
    state = checkpoint["model_state"]
    num_classes = state["fc.weight"].shape[0]

    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    model.load_state_dict(state, strict=True)

    class_names = checkpoint.get("class_names")
    if not class_names:
        class_names = [f"class_{i}" for i in range(num_classes)]
    img_size = checkpoint.get("img_size", 224)
    return model, class_names, img_size


def run_inference(
    model: nn.Module,
    image_input,
    transform: T.Compose,
    device: torch.device,
):
    if isinstance(image_input, str):
        with Image.open(image_input) as img:
            img = img.convert("RGB")
            tensor = transform(img).unsqueeze(0).to(device)
    else:
        img = image_input.convert("RGB")
        tensor = transform(img).unsqueeze(0).to(device)
    model.eval()
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.sigmoid(logits).squeeze(0).cpu().tolist()
    return probs


def make_blank_image(size: int, value: float):
    value = max(0.0, min(1.0, value))
    gray = int(round(value * 255))
    return Image.new("RGB", (size, size), color=(gray, gray, gray))


def save_barplot(probs: list, class_names: list, out_path: str, topk: int = 10) -> None:
    if not probs:
        raise ValueError("Empty probability list.")

    topk = min(topk, len(probs))
    indices = sorted(range(len(probs)), key=lambda i: probs[i], reverse=True)[:topk]
    top_pairs = [(class_names[i], probs[i]) for i in indices]

    width = 800
    bar_height = 26
    gap = 8
    margin = 20
    label_width = 220
    height = margin * 2 + topk * bar_height + (topk - 1) * gap

    image = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()

    max_prob = max(p for _, p in top_pairs) or 1.0
    bar_max_width = width - label_width - margin * 2

    y = margin
    for name, prob in top_pairs:
        bar_width = int(bar_max_width * (prob / max_prob))
        bar_left = margin + label_width
        bar_top = y
        bar_right = bar_left + bar_width
        bar_bottom = y + bar_height
        draw.rectangle([bar_left, bar_top, bar_right, bar_bottom], fill=(80, 140, 220))
        label = f"{name} ({prob:.3f})"
        draw.text((margin, y + 5), label, fill=(0, 0, 0), font=font)
        y += bar_height + gap

    image.save(out_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run inference on a single image and save a top-k bar chart."
    )
    parser.add_argument(
        "--ckpt",
        default="coco_multilabel_resnet18.pth",
        help="Checkpoint saved by train_coco_multilabel.py.",
    )
    parser.add_argument(
        "--image",
        help="Path to an input image (if omitted, use a blank image).",
    )
    parser.add_argument(
        "--out",
        default="inference_topk.png",
        help="Path to save the visualization image.",
    )
    parser.add_argument(
        "--json-out",
        help="Optional path to save probabilities as JSON.",
    )
    parser.add_argument("--topk", type=int, default=10)
    parser.add_argument(
        "--blank-value",
        type=float,
        default=0.0,
        help="Fill value in [0, 1] for the blank image.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not os.path.isfile(args.ckpt):
        raise FileNotFoundError(f"Checkpoint not found: {args.ckpt}")

    model, class_names, img_size = load_checkpoint(args.ckpt)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    transform = build_transform(img_size)
    if args.image:
        if not os.path.isfile(args.image):
            raise FileNotFoundError(f"Image not found: {args.image}")
        input_image = args.image
    else:
        input_image = make_blank_image(img_size, args.blank_value)
    probs = run_inference(model, input_image, transform, device)
    
    if args.json_out:
        data = []
        for name, p in zip(class_names, probs):
            data.append({"name": name, "score": p})
        # Sort by score descending
        data.sort(key=lambda x: x["score"], reverse=True)
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Saved JSON to {args.json_out}")

    save_barplot(probs, class_names, args.out, topk=args.topk)

    print(f"Saved visualization to {args.out}")


if __name__ == "__main__":
    main()
