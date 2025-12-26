#!/usr/bin/env python3
"""
COCO train2017 数据集下载指南
人体姿势检测 (Keypoints Detection)
"""

print("="*100)
print("COCO train2017 数据集下载指南")
print("="*100)

print("\n📥 需要下载的文件：\n")

print("1️⃣  训练集图像 (train2017)")
print("   • 文件名: train2017.zip")
print("   • 体积: ~18GB")
print("   • 张数: ~118,287 张图像")
print("   • 链接: http://images.cocodataset.org/zips/train2017.zip")

print("\n2️⃣  注解文件（已包含关键点标注）")
print("   • 文件名: annotations_trainval2017.zip")
print("   • 体积: ~240MB")
print("   • 包含: 所有train和val的注解，包括人体关键点")
print("   • 链接: http://images.cocodataset.org/annotations/annotations_trainval2017.zip")

print("\n" + "="*100)
print("下载和解压步骤：")
print("="*100)

print("\n方案A: 使用wget命令（推荐，可后台运行）")
print("-" * 100)
print("""
# 进入数据目录
cd /home/xie/桌面/Data-Visualization-Coursework/extract_attention_project/data/coco

# 下载训练集图像（~18GB，需要很长时间）
wget -c http://images.cocodataset.org/zips/train2017.zip

# 下载注解文件（~240MB）
wget -c http://images.cocodataset.org/annotations/annotations_trainval2017.zip

# 解压图像
unzip -q train2017.zip

# 解压注解（会自动放到 annotations/ 目录）
unzip -q annotations_trainval2017.zip

# 验证目录结构
ls -la
# 应该看到：
#   train2017/          (新增，~118,287张图像)
#   val2017/            (已存在)
#   annotations/        (已存在，包含新的 *.json 文件)
""")

print("\n方案B: 使用浏览器下载（如果网络限制）")
print("-" * 100)
print("""
1. 访问: https://cocodataset.org/#download
2. 手动下载两个文件：
   • train2017.zip (18GB)
   • annotations_trainval2017.zip (240MB)
3. 移到: /home/xie/桌面/Data-Visualization-Coursework/extract_attention_project/data/coco/
4. 运行解压命令:
   cd /home/xie/桌面/Data-Visualization-Coursework/extract_attention_project/data/coco/
   unzip -q train2017.zip
   unzip -q annotations_trainval2017.zip
""")

print("\n" + "="*100)
print("⏱️  预计时间和空间需求：")
print("="*100)
print("""
网络下载:
  • train2017.zip (18GB):           1-3小时（取决于网速）
  • annotations_trainval2017.zip:   几分钟

解压时间: 
  • 总共: 15-30分钟

磁盘空间:
  • train2017.zip:    18GB
  • annotations*.zip: 240MB
  • 解压后 train2017/:  36GB
  • 总需求: ~55GB

建议: 先确保磁盘有足够空间！
""")

print("="*100)
print("下载完成后，运行这个脚本来重新分析：")
print("="*100)
print("""
cd /home/xie/桌面/Data-Visualization-Coursework/extract_attention_project
python analyze_occlusion_extended.py
""")

print("\n💡 提示：")
print("-" * 100)
print("• 如果网络不稳定，使用 -c 参数可断点续传")
print("• 可以在后台运行: nohup wget ... &")
print("• 校验下载完整性: sha256sum train2017.zip (官网提供checksum)")
