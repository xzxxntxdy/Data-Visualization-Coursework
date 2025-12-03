import json
import os
import shutil
from collections import defaultdict
import heapq

# ================= 配置路径 =================
# 你的本地图片路径
COCO_IMAGE_DIR = r"D:\vlmdata\COCO2017\train2017"

# 你的标注文件路径
ANN_DIR = "src/data"
INSTANCES_PATH = os.path.join(ANN_DIR, "instances_train2017.json")
KEYPOINTS_PATH = os.path.join(ANN_DIR, "person_keypoints_train2017.json")
CAPTIONS_PATH = os.path.join(ANN_DIR, "captions_train2017.json")

# 输出路径
OUTPUT_IMAGE_PATH = os.path.join(ANN_DIR, "hero_image.jpg")
OUTPUT_JSON_PATH = os.path.join(ANN_DIR, "hero_data.json")

# ================= 筛选标准 =================
# 我们寻找一张"讲故事"的完美图片
TARGET_PERSON_COUNT = (3, 6)  # 人数在 3 到 6 之间
MIN_TOTAL_OBJECTS = 8         # 至少有 8 个物体（看起来丰富）
MIN_UNIQUE_CATEGORIES = 4     # 至少有 4 种不同类别的物体（语义丰富）

print("🚀 开始加载 COCO 标注文件... (这可能需要几秒钟)")

# 1. 加载 Instances
with open(INSTANCES_PATH, 'r') as f:
    instances_data = json.load(f)

# 建立类别 ID 到 名称 的映射
cat_id_to_name = {cat['id']: cat['name'] for cat in instances_data['categories']}

# 2. 预处理：按 Image ID 组织标注
img_anns = defaultdict(list)
for ann in instances_data['annotations']:
    img_anns[ann['image_id']].append(ann)

print(f"✅ Instances 加载完毕，共 {len(img_anns)} 张有标注的图片。开始筛选候选者...")

# 3. 筛选算法
candidates = []

for img_id, anns in img_anns.items():
    # 统计信息
    person_count = 0
    categories = set()
    bbox_areas = [] # 用于检查尺度多样性
    
    for ann in anns:
        cat_name = cat_id_to_name.get(ann['category_id'])
        categories.add(cat_name)
        bbox_areas.append(ann['bbox'][2] * ann['bbox'][3]) # w * h
        if cat_name == 'person':
            person_count += 1
            
    # --- 筛选条件 ---
    # 条件1: 人数合适 (为了展示 Pose)
    if not (TARGET_PERSON_COUNT[0] <= person_count <= TARGET_PERSON_COUNT[1]):
        continue
        
    # 条件2: 语义丰富 (为了展示 Semantic)
    if len(categories) < MIN_UNIQUE_CATEGORIES:
        continue
        
    # 条件3: 物体总数 (为了展示 Spatial 这种密集感)
    if len(anns) < MIN_TOTAL_OBJECTS:
        continue
        
    # 条件4: 尺度多样性 (Small < 32^2, Large > 96^2)
    has_small = any(area < 32*32 for area in bbox_areas)
    has_large = any(area > 96*96 for area in bbox_areas)
    
    if not (has_small and has_large):
        continue

    # 如果通过所有筛选，计算一个“完美分数”
    # 分数 = 物体数量 + 类别数量 * 2 (我们更看重类别丰富度)
    score = len(anns) + len(categories) * 2
    candidates.append((score, img_id, anns))

# 取分数最高的 Top 1
if not candidates:
    print("❌ 未找到符合条件的完美图片，请放宽筛选标准。")
    exit()

# 按分数排序，取最好的一个
best_candidate = sorted(candidates, key=lambda x: x[0], reverse=True)[0]
score, best_img_id, best_anns = best_candidate

print(f"🎉 找到最佳 Hero Image! ID: {best_img_id} (得分: {score})")

# ================= 获取详细数据 =================

# 4. 获取对应的图片文件名
# 在 instances_data['images'] 中查找文件名
file_name = next((img['file_name'] for img in instances_data['images'] if img['id'] == best_img_id), None)
if not file_name:
    print(f"❌ 找不到 ID {best_img_id} 对应的文件名")
    exit()

src_img_path = os.path.join(COCO_IMAGE_DIR, file_name)
if not os.path.exists(src_img_path):
    print(f"❌ 本地图片文件不存在: {src_img_path}")
    print("请检查 COCO_IMAGE_DIR 路径配置是否正确。")
    exit()

# 5. 加载 Keypoints (仅针对这张图)
print("正在提取姿态数据...")
with open(KEYPOINTS_PATH, 'r') as f:
    kp_data = json.load(f)
    
# 找到对应 image_id 的 keypoints annotation
hero_keypoints = [ann for ann in kp_data['annotations'] if ann['image_id'] == best_img_id]

# 6. 加载 Captions (仅针对这张图)
print("正在提取描述数据...")
with open(CAPTIONS_PATH, 'r') as f:
    cap_data = json.load(f)

hero_captions = [ann['caption'] for ann in cap_data['annotations'] if ann['image_id'] == best_img_id]

# ================= 生成最终数据结构 =================

# 处理 bbox 数据，增加 scale 标签
processed_objects = []
for ann in best_anns:
    area = ann['bbox'][2] * ann['bbox'][3]
    scale = "medium"
    if area < 32 * 32: scale = "small"
    elif area > 96 * 96: scale = "large"
    
    processed_objects.append({
        "id": ann['id'],
        "category": cat_id_to_name[ann['category_id']],
        "bbox": ann['bbox'], # [x, y, w, h]
        "area": area,
        "scale": scale,
        "iscrowd": ann['iscrowd']
    })

# 简化 keypoints 数据
processed_poses = []
for ann in hero_keypoints:
    # COCO keypoints 格式: [x1, y1, v1, x2, y2, v2, ...]
    # v=0: not labeled, v=1: labeled but not visible, v=2: labeled and visible
    if ann['num_keypoints'] > 0:
        processed_poses.append({
            "id": ann['id'],
            "keypoints": ann['keypoints'],
            "bbox": ann['bbox'] # 人体的框，用于对齐
        })

hero_data = {
    "meta": {
        "image_id": best_img_id,
        "file_name": file_name,
        "captions": hero_captions
    },
    "spatial": processed_objects, # 用于场景一
    "semantic": {
        # 简单构建一个共现列表，实际前端可视化时可以只连接这些物体
        "categories": list(set(obj['category'] for obj in processed_objects))
    },
    "pose": processed_poses # 用于场景三
}

# ================= 写入文件 =================

# 1. 复制图片
print(f"正在复制图片: {file_name} -> hero_image.jpg")
shutil.copy2(src_img_path, OUTPUT_IMAGE_PATH)

# 2. 写入 JSON
print("正在保存 hero_data.json...")
with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(hero_data, f, indent=2, ensure_ascii=False)

print("✅ 全部完成！")
print(f"图片位置: {OUTPUT_IMAGE_PATH}")
print(f"数据位置: {OUTPUT_JSON_PATH}")