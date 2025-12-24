
import os
import json
import zipfile
import shutil
from tqdm import tqdm

def prepare_subset():
    ZIP_PATH = r"D:\Study\data_vis\Data-Visualization-Coursework\data\train2017.zip"
    JSON_PATH = r"D:\Study\data_vis\Data-Visualization-Coursework\src\data\spatial_data.json"
    TARGET_DIR = r"D:\Study\data_vis\Data-Visualization-Coursework\src\data\train_images"
    
    if not os.path.exists(ZIP_PATH):
        print(f"❌ Zip file not found: {ZIP_PATH}")
        return

    print("📄 Loading annotation list...")
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Get distinct image IDs from the extracted annotations
    # spatial_data.json has list of objects under "annotations"
    target_image_ids = set()
    for ann in data['annotations']:
        target_image_ids.add(ann['image_id'])
    
    print(f"🎯 Need to extract {len(target_image_ids)} distinct images for {len(data['annotations'])} annotations.")
    
    os.makedirs(TARGET_DIR, exist_ok=True)
    
    print("📂 Opening Zip file...")
    with zipfile.ZipFile(ZIP_PATH, 'r') as zf:
        # List all files in zip
        all_files = zf.namelist()
        # Build map: image_id -> filename inside zip
        # Zip structure usually: "train2017/000000123456.jpg" or just "000000123456.jpg"
        
        # Helper to extract ID from filename
        # 000000123456.jpg -> 123456
        
        count = 0
        for member in tqdm(all_files, desc="Scanning zip"):
            if member.endswith('/') or member.endswith('\\'): continue
            
            basename = os.path.basename(member)
            if not basename.lower().endswith('.jpg'): continue
            
            # extract id
            try:
                img_id = int(os.path.splitext(basename)[0])
            except ValueError:
                continue
                
            if img_id in target_image_ids:
                # Extract
                target_path = os.path.join(TARGET_DIR, basename)
                if not os.path.exists(target_path):
                    with zf.open(member) as source, open(target_path, "wb") as target:
                        shutil.copyfileobj(source, target)
                count += 1
                
    print(f"✅ Extracted {count} images to {TARGET_DIR}")

if __name__ == "__main__":
    prepare_subset()
