"""
从 spatial_data.json 中提取对应的图片到指定文件夹
"""
import json
import os
import shutil

# 路径配置
SPATIAL_DATA_PATH = r"D:\Study\data_vis\Data-Visualization-Coursework\src\data\spatial_data.json"
SOURCE_IMAGE_DIR = r"D:\Study\data_vis\Data-Visualization-Coursework\data\train2017"
OUTPUT_IMAGE_DIR = r"D:\Study\data_vis\Data-Visualization-Coursework\images\spatial"

def main():
    # 创建输出目录
    os.makedirs(OUTPUT_IMAGE_DIR, exist_ok=True)
    
    # 读取 spatial_data.json
    print(f"正在读取 {SPATIAL_DATA_PATH}...")
    with open(SPATIAL_DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 提取所有唯一的 image_id
    annotations = data.get('annotations', [])
    image_ids = set()
    for ann in annotations:
        if 'image_id' in ann:
            image_ids.add(ann['image_id'])
    
    print(f"找到 {len(image_ids)} 个唯一的图片ID")
    
    # 复制图片
    copied_count = 0
    not_found_count = 0
    not_found_ids = []
    
    for image_id in sorted(image_ids):
        # COCO 图片文件名格式：000000XXXXXX.jpg（12位数字）
        image_filename = f"{image_id:012d}.jpg"
        source_path = os.path.join(SOURCE_IMAGE_DIR, image_filename)
        dest_path = os.path.join(OUTPUT_IMAGE_DIR, image_filename)
        
        if os.path.exists(source_path):
            shutil.copy2(source_path, dest_path)
            copied_count += 1
            if copied_count % 100 == 0:
                print(f"已复制 {copied_count} 张图片...")
        else:
            not_found_count += 1
            not_found_ids.append(image_id)
    
    print(f"\n完成！")
    print(f"成功复制: {copied_count} 张图片")
    print(f"未找到: {not_found_count} 张图片")
    print(f"图片保存目录: {OUTPUT_IMAGE_DIR}")
    
    if not_found_ids and not_found_count <= 20:
        print(f"未找到的图片ID: {not_found_ids}")
    elif not_found_ids:
        print(f"未找到的图片ID (前20个): {not_found_ids[:20]}...")

if __name__ == "__main__":
    main()
