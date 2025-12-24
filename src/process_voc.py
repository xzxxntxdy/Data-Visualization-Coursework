
import os
import json
import xml.etree.ElementTree as ET
import random
from tqdm import tqdm

def parse_voc_annotation(xml_path):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    size = root.find('size')
    width = int(size.find('width').text)
    height = int(size.find('height').text)
    
    objects = []
    for obj in root.findall('object'):
        name = obj.find('name').text
        bndbox = obj.find('bndbox')
        xmin = int(float(bndbox.find('xmin').text))
        ymin = int(float(bndbox.find('ymin').text))
        xmax = int(float(bndbox.find('xmax').text))
        ymax = int(float(bndbox.find('ymax').text))
        
        objects.append({
            "name": name,
            "bbox": [xmin, ymin, xmax, ymax]
        })
        
    return {
        "width": width,
        "height": height,
        "objects": objects
    }

def process_voc():
    VOC_ROOT = os.path.join("src", "data", "voc", "VOCdevkit", "VOC2007")
    IMG_DIR = os.path.join(VOC_ROOT, "JPEGImages")
    ANN_DIR = os.path.join(VOC_ROOT, "Annotations")
    SPLIT_FILE = os.path.join(VOC_ROOT, "ImageSets", "Main", "train.txt")
    OUTPUT_FILE = os.path.join("src", "data", "voc_chair_data.json")
    
    if not os.path.exists(VOC_ROOT):
        print(f"❌ VOC root not found at {VOC_ROOT}. Please run download_voc.py first.")
        return

    print("📄 Reading split file...")
    with open(SPLIT_FILE, "r") as f:
        file_ids = [line.strip() for line in f.readlines()]
    
    processed_anns = []
    chair_count = 0
    
    print(f"🔄 Processing {len(file_ids)} annotations...")
    for file_id in tqdm(file_ids):
        xml_path = os.path.join(ANN_DIR, f"{file_id}.xml")
        if not os.path.exists(xml_path):
            continue
            
        ann = parse_voc_annotation(xml_path)
        w, h = ann['width'], ann['height']
        
        has_chair = False
        for obj in ann['objects']:
            if obj['name'] == 'chair':
                has_chair = True
                bbox = obj['bbox'] # xmin, ymin, xmax, ymax
                
                # Normalize & Convert to cx, cy, w, h
                # VOC is [xmin, ymin, xmax, ymax] 1-based usually, but here handled as ints
                
                # Width/Height of box
                bw = bbox[2] - bbox[0]
                bh = bbox[3] - bbox[1]
                
                # Center
                cx = bbox[0] + bw / 2
                cy = bbox[1] + bh / 2
                
                # Validate
                if w <=0 or h <=0: continue
                
                processed_anns.append({
                    "image_id": file_id, # VOC usages filename no extension as ID usually
                    "file_name": f"{file_id}.jpg",
                    "category": "chair",
                    "cx": round(cx / w, 4),
                    "cy": round(cy / h, 4),
                    "width": round(bw / w, 4),
                    "height": round(bh / h, 4)
                })
        
        if has_chair:
            chair_count += 1
            
    print(f"✅ Found {len(processed_anns)} chair objects in {chair_count} images.")
    
    # Sampling to 8000 if needed (VOC train might not even have 8000 chairs)
    # VOC 2007 is small. Trainval has ~5k images total. Train has ~2.5k.
    # So we probably won't reach 8000. But user said "use the previously picked 8000 data".
    # If VOC is too small, we might just use ALL of them.
    # User might be confusing with COCO numbers or wants to use Train+Val.
    # Let's just use all relevant ones we found.
    
    if len(processed_anns) > 8000:
        print("📉 Sampling down to 8000...")
        processed_anns = random.sample(processed_anns, 8000)
    else:
        print(f"ℹ️ Total count ({len(processed_anns)}) < 8000. Using all.")

    output_data = {
        "annotations": processed_anns,
        "meta": {
            "source": "VOC2007_train",
            "total": len(processed_anns)
        }
    }
    
    with open(OUTPUT_FILE, "w", encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)
    print(f"💾 Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    process_voc()
