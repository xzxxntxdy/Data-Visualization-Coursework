# -*- coding: utf-8 -*-
import argparse
import json
import os
import random
import sys

import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset
from PIL import Image
import torchvision.models as models
import torchvision.transforms as T


def set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def load_coco(ann_file: str) -> dict:
    with open(ann_file, "r", encoding="utf-8") as f:
        return json.load(f)


def build_category_index(categories: list) -> tuple:
    categories_sorted = sorted(categories, key=lambda c: c["id"])
    id_to_idx = {cat["id"]: i for i, cat in enumerate(categories_sorted)}
    idx_to_id = [cat["id"] for cat in categories_sorted]
    idx_to_name = [cat["name"] for cat in categories_sorted]
    return id_to_idx, idx_to_id, idx_to_name


def build_samples(ann_file: str, min_labels: int) -> tuple:
    coco = load_coco(ann_file)
    categories = coco.get("categories", [])
    images = coco.get("images", [])
    annotations = coco.get("annotations", [])

    id_to_idx, idx_to_id, idx_to_name = build_category_index(categories)
    num_classes = len(id_to_idx)

    image_info = {img["id"]: img for img in images}
    labels = {img_id: [0] * num_classes for img_id in image_info}

    for ann in annotations:
        img_id = ann.get("image_id")
        cat_id = ann.get("category_id")
        if img_id in labels and cat_id in id_to_idx:
            labels[img_id][id_to_idx[cat_id]] = 1

    samples = []
    class_counts = [0] * num_classes
    for img_id, img in image_info.items():
        label = labels[img_id]
        if min_labels > 0 and sum(label) < min_labels:
            continue
        for i, v in enumerate(label):
            if v:
                class_counts[i] += 1
        samples.append((img["file_name"], label))

    return samples, idx_to_id, idx_to_name, class_counts


def build_transform(img_size: int) -> T.Compose:
    return T.Compose(
        [
            T.Resize((img_size, img_size)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


def print_class_stats(class_counts: list, class_names: list, topk: int = 5) -> None:
    pairs = list(zip(class_names, class_counts))
    pairs_sorted = sorted(pairs, key=lambda x: x[1], reverse=True)
    top = pairs_sorted[:topk]
    bottom = pairs_sorted[-topk:] if len(pairs_sorted) >= topk else pairs_sorted

    print("Most frequent classes:")
    for name, count in top:
        print(f"  {name}: {count}")
    print("Least frequent classes:")
    for name, count in bottom:
        print(f"  {name}: {count}")


class COCOMultiLabelDataset(Dataset):
    def __init__(
        self,
        ann_file: str,
        img_root: str,
        img_size: int = 224,
        min_labels: int = 1,
    ) -> None:
        samples, idx_to_id, idx_to_name, class_counts = build_samples(
            ann_file, min_labels
        )
        self.samples = samples
        self.class_ids = idx_to_id
        self.class_names = idx_to_name
        self.class_counts = class_counts
        self.num_classes = len(idx_to_name)
        self.img_root = img_root
        self.transform = build_transform(img_size)

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        file_name, label = self.samples[index]
        img_path = os.path.join(self.img_root, file_name)
        if not os.path.isfile(img_path):
            raise FileNotFoundError(f"Image not found: {img_path}")
        with Image.open(img_path) as img:
            img = img.convert("RGB")
            img = self.transform(img)
        target = torch.tensor(label, dtype=torch.float32)
        return img, target


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    loss_fn: nn.Module,
    device: torch.device,
) -> float:
    model.train()
    running_loss = 0.0
    total_batches = len(loader)
    seen = 0
    for batch_idx, (images, targets) in enumerate(loader, start=1):
        images = images.to(device, non_blocking=True)
        targets = targets.to(device, non_blocking=True)

        optimizer.zero_grad()
        logits = model(images)
        loss = loss_fn(logits, targets)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        seen += images.size(0)
        if total_batches > 0:
            avg_loss = running_loss / seen
            bar_width = 28
            filled = int(bar_width * batch_idx / total_batches)
            bar = "=" * filled + "." * (bar_width - filled)
            pct = batch_idx / total_batches * 100
            sys.stdout.write(
                f"\r[{bar}] {batch_idx}/{total_batches} {pct:5.1f}% loss {avg_loss:.4f}"
            )
            sys.stdout.flush()
    if total_batches > 0:
        sys.stdout.write("\n")
    return running_loss / len(loader.dataset)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a simple multi-label classifier on COCO (80 classes)."
    )
    parser.add_argument(
        "--ann",
        default=os.path.join("src", "data", "instances_train2017.json"),
        help="Path to COCO instances_train2017.json (UTF-8).",
    )
    parser.add_argument(
        "--img-root",
        default=r"D:\vlmdata\COCO2017\train2017",
        help="Directory containing COCO train2017 images.",
    )
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--img-size", type=int, default=224)
    parser.add_argument("--num-workers", type=int, default=4)
    parser.add_argument(
        "--min-labels",
        type=int,
        default=1,
        help="Drop images with fewer labels than this value.",
    )
    parser.add_argument(
        "--save",
        default="coco_multilabel_resnet18.pth",
        help="Path to save the trained checkpoint (empty to skip).",
    )
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not os.path.isfile(args.ann):
        raise FileNotFoundError(f"Annotation file not found: {args.ann}")
    if not os.path.isdir(args.img_root):
        raise FileNotFoundError(f"Image root not found: {args.img_root}")

    set_seed(args.seed)
    torch.backends.cudnn.benchmark = True

    dataset = COCOMultiLabelDataset(
        ann_file=args.ann,
        img_root=args.img_root,
        img_size=args.img_size,
        min_labels=args.min_labels,
    )
    if len(dataset) == 0:
        raise RuntimeError("No training samples found. Check annotations and filters.")

    print(f"Loaded {len(dataset)} images, {dataset.num_classes} classes.")
    print_class_stats(dataset.class_counts, dataset.class_names)

    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, dataset.num_classes)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    # Keep default BCE loss without class re-weighting to preserve dataset imbalance.
    loss_fn = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    for epoch in range(1, args.epochs + 1):
        loss = train_one_epoch(model, loader, optimizer, loss_fn, device)
        print(f"Epoch {epoch}/{args.epochs} - loss: {loss:.4f}")

    if args.save:
        checkpoint = {
            "model_state": model.state_dict(),
            "class_ids": dataset.class_ids,
            "class_names": dataset.class_names,
            "img_size": args.img_size,
        }
        torch.save(checkpoint, args.save)
        print(f"Saved checkpoint to {args.save}")


if __name__ == "__main__":
    main()
