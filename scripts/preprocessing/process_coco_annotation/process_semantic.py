import json
import os
import itertools
from collections import defaultdict

DATA_DIR = os.path.join("src", "data")
INPUT_FILE = os.path.join(DATA_DIR, "instances_train2017.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "semantic_data.json")

def process_semantic_data():
    print(f"Loading data from {INPUT_FILE} (this can take a moment)...")
    try:
        with open(INPUT_FILE, "r", encoding="utf-8") as f:
            coco_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: {INPUT_FILE} not found. Please place the file in src/data.")
        return

    print("Data loaded. Building category maps...")

    categories = {cat["id"]: cat["name"] for cat in coco_data["categories"]}
    print(f"Found {len(categories)} categories.")

    img_to_cats = defaultdict(set)
    annotations = coco_data["annotations"]
    total_anns = len(annotations)

    for i, ann in enumerate(annotations):
        img_to_cats[ann["image_id"]].add(ann["category_id"])
        if i and i % 100000 == 0:
            print(f"Processed {i}/{total_anns} annotations...")

    co_occurrence = defaultdict(int)
    category_counts = defaultdict(int)

    print("Computing co-occurrence counts...")
    for cats in img_to_cats.values():
        unique_cats = list(cats)
        for cat in unique_cats:
            category_counts[cat] += 1
        if len(unique_cats) > 1:
            for u, v in itertools.combinations(sorted(unique_cats), 2):
                co_occurrence[(u, v)] += 1

    nodes = [
        {
            "id": cat_id,
            "name": name,
            "count": category_counts[cat_id],
            "group": 1,
        }
        for cat_id, name in categories.items()
    ]

    min_edge_weight = min(co_occurrence.values()) if co_occurrence else 0
    max_edge_weight = max(co_occurrence.values()) if co_occurrence else 0

    links = [
        {"source": source, "target": target, "value": weight}
        for (source, target), weight in co_occurrence.items()
    ]

    output_data = {"nodes": nodes, "links": links}

    print(
        f"Done. Nodes: {len(nodes)}, links: {len(links)} "
        f"(edge weights {min_edge_weight}~{max_edge_weight}, no edges filtered)."
    )

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"Saved semantic graph data to: {OUTPUT_FILE}")

if __name__ == "__main__":
    process_semantic_data()
