import os
import random
from math import ceil

from PIL import Image

# ================= 配置路径 =================
# 你的本地图片路径（保持和你原来的脚本一致）
COCO_IMAGE_DIR = r"D:\vlmdata\COCO2017\train2017"

# 输出路径（保持和你原来的脚本一致）
ANN_DIR = "src/data"
OUTPUT_IMAGE_PATH = os.path.join(ANN_DIR, "overview.jpg")

# ================= 可调参数 =================
NUM_IMAGES = 64       # 随机抽取多少张图片来拼（建议是列数的倍数）
GRID_COLS = 8         # 概览图每行放多少张
TILE_SIZE = 128       # 每张小图缩放后的尺寸（像素）

# ================= 生成概览图 =================
def main():
    # 1. 收集所有 jpg 图片
    all_images = [
        f for f in os.listdir(COCO_IMAGE_DIR)
        if f.lower().endswith(".jpg")
    ]

    if not all_images:
        print("❌ 在 COCO_IMAGE_DIR 下没有找到 jpg 图片，请检查路径。")
        return

    # 2. 随机选择图片
    random.shuffle(all_images)
    selected = all_images[:min(NUM_IMAGES, len(all_images))]
    num_selected = len(selected)

    # 计算需要多少行
    rows = ceil(num_selected / GRID_COLS)

    # 3. 创建空白画布
    canvas_width = GRID_COLS * TILE_SIZE
    canvas_height = rows * TILE_SIZE
    overview = Image.new("RGB", (canvas_width, canvas_height), (0, 0, 0))

    print(f"🎨 一共选取 {num_selected} 张图片，"
          f"拼成 {rows} 行 x {GRID_COLS} 列，"
          f"画布大小：{canvas_width}x{canvas_height}")

    # 4. 逐张缩放并粘贴
    for idx, fname in enumerate(selected):
        img_path = os.path.join(COCO_IMAGE_DIR, fname)
        try:
            img = Image.open(img_path).convert("RGB")
        except Exception as e:
            print(f"⚠️ 打开图片失败，跳过: {img_path}，错误: {e}")
            continue

        # 统一缩放为固定大小
        img = img.resize((TILE_SIZE, TILE_SIZE), Image.Resampling.LANCZOS)

        row = idx // GRID_COLS
        col = idx % GRID_COLS

        x = col * TILE_SIZE
        y = row * TILE_SIZE

        overview.paste(img, (x, y))

    # 5. 保存结果
    os.makedirs(os.path.dirname(OUTPUT_IMAGE_PATH), exist_ok=True)
    overview.save(OUTPUT_IMAGE_PATH, quality=95)
    print(f"✅ 概览图已保存到: {OUTPUT_IMAGE_PATH}")


if __name__ == "__main__":
    main()
