
import os
import json
import shutil
from tqdm import tqdm

def extract_images():
    # Paths
    JSON_PATH = r"D:\Study\data_vis\Data-Visualization-Coursework\src\data\spatial_data.json"
    SOURCE_DIR = r"D:\Study\data_vis\Data-Visualization-Coursework\data\train2017" # Previously unzipped
    TARGET_DIR = r"D:\Study\data_vis\Data-Visualization-Coursework\src\data\train_images"
    
    if not os.path.exists(SOURCE_DIR):
        print(f"❌ Source directory not found: {SOURCE_DIR}")
        return

    print("📄 Loading annotation list...")
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Get distinct image IDs
    target_image_ids = set()
    for ann in data['annotations']:
        target_image_ids.add(ann['image_id'])
    
    print(f"🎯 Need to extract {len(target_image_ids)} images.")
    
    os.makedirs(TARGET_DIR, exist_ok=True)
    
    count = 0
    missing = 0
    
    for img_id in tqdm(target_image_ids, desc="Copying images"):
        filename = f"{str(img_id).zfill(12)}.jpg"
        source_path = os.path.join(SOURCE_DIR, filename)
        target_path = os.path.join(TARGET_DIR, filename)
        
        if os.path.exists(source_path):
            if not os.path.exists(target_path):
                shutil.copy2(source_path, target_path)
            count += 1
        else:
            missing += 1
            # print(f"Missing: {source_path}")
            
    print(f"✅ Copied {count} images to {TARGET_DIR}")
    if missing > 0:
        print(f"⚠️ {missing} images were missing from source.")

if __name__ == "__main__":
    extract_images()
