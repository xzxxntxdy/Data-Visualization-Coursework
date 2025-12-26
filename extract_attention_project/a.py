import json
import os
import requests
from tqdm import tqdm

# 1. 路径设置
# 使用你日志中显示的已下载成功的标注文件路径
ann_file = "/home/xie/fiftyone/coco-2017/raw/instances_val2017.json"
save_dir = "./images"

if not os.path.exists(save_dir):
    os.makedirs(save_dir)

# 2. 读取标注文件
print("正在读取标注文件...")
with open(ann_file, 'r') as f:
    data = json.load(f)

# 3. 筛选包含人（category_id=1）的图像信息
# 在 COCO 中，person 的 category_id 通常是 1
images = data['images']
annotations = data['annotations']

# 找出所有包含 keypoints 且属于人体的图像 ID
# (为了简单，我们直接找包含人体的图像)
person_img_ids = {ann['image_id'] for ann in annotations if ann.get('category_id') == 1}

# 过滤出这些图像的详细信息
target_images = [img for img in images if img['id'] in person_img_ids]

# 限制数量：500张
target_images = target_images[:500]

print(f"找到包含人体的图像 {len(target_images)} 张，准备下载...")

# 4. 健壮下载逻辑
success = 0
for img_info in tqdm(target_images):
    file_name = img_info['file_name']
    url = img_info['coco_url']  # 官方下载链接
    local_path = os.path.join(save_dir, file_name)

    if os.path.exists(local_path):
        success += 1
        continue

    try:
        # 使用流式下载，设置超时
        r = requests.get(url, timeout=20, stream=True)
        if r.status_code == 200:
            with open(local_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            success += 1
    except Exception as e:
        print(f"\n下载失败: {file_name}, 错误: {e}")

print(f"\n下载完成！成功保存 {success} 张图片到 {save_dir}")