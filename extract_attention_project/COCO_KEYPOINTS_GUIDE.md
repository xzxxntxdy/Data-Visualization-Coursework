# COCO Keypoints 姿态估计 - 快速开始指南

## 概述

这个项目已经修改为支持 **17 个 COCO 关键点的姿态估计**。模型架构已优化，使得：

- **倒数第二层**：输出 17 个关节节点的特征向量（每个关节 768 维特征用于 Transformer，256 维用于简单模型）
- **倒数第一层**：从关节特征输出关键点坐标和置信度
- **最终输出**：关键点位置、置信度、特征向量和热力图

## 模型架构

### PoseTransformerModel (推荐)

```
输入图像 (B, 3, 256, 256)
    ↓
图像转 Patch 嵌入
    ↓
位置编码 + 类别令牌
    ↓
12 层 Transformer 编码器
    ↓
LayerNorm
    ↓
↓────────────────────────────────────────────────────┐
│ 倒数第二层：生成 17 个关节特征 (B, 17, 768)     │ ← 关键点特征
└────────────────────────────────────────────────────┘
    ↓
关键点预测头 → 关键点坐标 (B, 17, 2)
置信度预测头 → 置信度 (B, 17)
热力图预测头 → 热力图 (B, 16, 16)
```

### SimplePoseModel (轻量级)

```
输入图像 (B, 3, 256, 256)
    ↓
CNN 主干 (3 层卷积)
    ↓
全局平均池化
    ↓
↓────────────────────────────────────────────────────┐
│ 倒数第二层：生成 17 个关节特征 (B, 17, 256)     │ ← 关键点特征
└────────────────────────────────────────────────────┘
    ↓
关键点预测头 → 关键点坐标 (B, 17, 2)
置信度预测头 → 置信度 (B, 17)
热力图预测头 → 热力图 (B, 16, 16)
```

## 数据准备

### 下载 COCO 数据集

```bash
# 创建数据目录
mkdir -p data/coco

# 下载训练集 (约 13GB)
wget http://images.cocodataset.org/zips/train2017.zip -O data/coco/train2017.zip
unzip data/coco/train2017.zip -d data/coco/

# 下载验证集 (约 6GB)
wget http://images.cocodataset.org/zips/val2017.zip -O data/coco/val2017.zip
unzip data/coco/val2017.zip -d data/coco/

# 下载标注文件 (关键点标注)
wget http://images.cocodataset.org/annotations/annotations_trainval2017.zip -O data/coco/annotations.zip
unzip data/coco/annotations.zip -d data/coco/
```

### 标注文件结构

```
data/coco/
├── train2017/               # 118287 张训练图像
│   ├── 000000000001.jpg
│   ├── 000000000002.jpg
│   └── ...
├── val2017/                 # 5000 张验证图像
│   ├── 000000000042.jpg
│   └── ...
└── annotations/
    ├── person_keypoints_train2017.json    # 使用这个
    └── person_keypoints_val2017.json      # 使用这个
```

## 训练模型

### 方法 1：训练新模型（推荐）

```bash
cd extract_attention_project

# 使用简单模型快速测试
python train_coco_keypoints.py \
    --model-type simple \
    --train-image-dir ../data/coco/train2017 \
    --train-ann-file ../data/coco/annotations/person_keypoints_train2017.json \
    --val-image-dir ../data/coco/val2017 \
    --val-ann-file ../data/coco/annotations/person_keypoints_val2017.json \
    --batch-size 16 \
    --learning-rate 1e-4 \
    --num-epochs 100 \
    --max-samples 5000  # 快速测试，移除此参数用全数据集

# 或使用 Transformer 模型（更好的精度，但更慢）
python train_coco_keypoints.py \
    --model-type transformer \
    --train-image-dir ../data/coco/train2017 \
    --train-ann-file ../data/coco/annotations/person_keypoints_train2017.json \
    --val-image-dir ../data/coco/val2017 \
    --val-ann-file ../data/coco/annotations/person_keypoints_val2017.json \
    --batch-size 8 \
    --learning-rate 1e-4 \
    --num-epochs 100
```

### 方法 2：微调预训练模型

```bash
python train_coco_keypoints.py \
    --model-type simple \
    --pretrained-path ./checkpoints/pretrained_model.pth \
    --train-image-dir ../data/coco/train2017 \
    --train-ann-file ../data/coco/annotations/person_keypoints_train2017.json \
    --batch-size 32 \
    --learning-rate 5e-5  # 更小的学习率
    --num-epochs 50
```

### 训练配置参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--model-type` | simple | 模型类型：simple 或 transformer |
| `--batch-size` | 16 | 批大小 |
| `--learning-rate` | 1e-4 | 初始学习率 |
| `--num-epochs` | 100 | 总训练轮数 |
| `--lr-step` | 30 | 学习率每多少个 epochs 衰减为 1/10 |
| `--patience` | 20 | 早停止耐心值（多少个 epochs 无改进） |
| `--dim` | 256 | 特征维度 |
| `--max-samples` | None | 最多加载多少样本（用于快速测试） |

## 模型推理

### 推理单张图像

```bash
python inference.py \
    --model-path ./checkpoints/best_model.pth \
    --model-type simple \
    --image-path /path/to/image.jpg \
    --output-dir ./inference_results \
    --confidence-threshold 0.5
```

输出包括：
1. 标注了关键点和骨架的图像
2. JSON 格式的详细结果

### Python API 使用

```python
from inference import PoseEstimator

# 初始化推理器
estimator = PoseEstimator(
    model_path="./checkpoints/best_model.pth",
    model_type="simple",
)

# 从图像推理
results = estimator.estimate_from_image(
    image_path="./test_image.jpg",
    confidence_threshold=0.5,
)

# 访问结果
keypoints = results['keypoints']  # (17, 2)，像素坐标
confidence = results['confidence']  # (17,)，置信度
features = results['keypoint_features']  # (17, 256)，倒数第二层特征

# 可视化
vis_image = estimator.visualize_keypoints(
    image=results['original_image'],
    keypoints=keypoints,
    confidence=confidence,
    show_keypoint_names=True,
)

# 导出结果
estimator.export_results(results, keypoints, "results.json")
```

## 关键点信息

### 17 个 COCO 关键点

```
0  - nose           (鼻子)
1  - left_eye       (左眼)
2  - right_eye      (右眼)
3  - left_ear       (左耳)
4  - right_ear      (右耳)
5  - left_shoulder  (左肩)
6  - right_shoulder (右肩)
7  - left_elbow     (左肘)
8  - right_elbow    (右肘)
9  - left_wrist     (左腕)
10 - right_wrist    (右腕)
11 - left_hip       (左髋)
12 - right_hip      (右髋)
13 - left_knee      (左膝)
14 - right_knee     (右膝)
15 - left_ankle     (左踝)
16 - right_ankle    (右踝)
```

### 模型输出说明

**keypoints**: 关键点坐标
- 形状: (17, 2)
- 范围: [0, 1]（归一化到图像尺寸）
- 乘以图像宽高得到像素坐标

**confidence**: 关键点置信度
- 形状: (17,)
- 范围: [0, 1]
- 高置信度表示该关键点被正确检测

**keypoint_features**: 关键点特征（倒数第二层）
- 形状: (17, 768) for Transformer 或 (17, 256) for Simple
- 可用于进一步的分析或作为其他任务的特征

**heatmap**: 热力图
- 形状: (16, 16)
- 显示模型对人体位置的注意力分布

## 批量推理

```python
import os
import cv2
from pathlib import Path
from inference import PoseEstimator

estimator = PoseEstimator(
    model_path="./checkpoints/best_model.pth",
    model_type="simple",
)

# 处理文件夹中的所有图像
image_dir = "./test_images"
for image_file in os.listdir(image_dir):
    if image_file.endswith(('.jpg', '.png')):
        image_path = os.path.join(image_dir, image_file)
        
        # 推理
        results = estimator.estimate_from_image(image_path)
        
        # 提取信息
        keypoints = results['keypoints']
        confidence = results['confidence']
        
        print(f"处理: {image_file}")
        print(f"  检测到 {sum(confidence > 0.5)} 个置信度 > 0.5 的关键点")
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `pose_model.py` | 模型定义（PoseTransformerModel 和 SimplePoseModel） |
| `coco_dataloader.py` | COCO 数据集加载器 |
| `train_coco_keypoints.py` | 训练脚本 |
| `inference.py` | 推理脚本和 API |
| `COCO_KEYPOINTS_GUIDE.md` | 本文档 |

## 常见问题

### Q1: 模型需要多长时间训练？

- **SimplePoseModel**：约 2-3 小时（V100 GPU，32 批大小，100 epochs）
- **PoseTransformerModel**：约 8-12 小时（V100 GPU，8 批大小，100 epochs）

### Q2: 如何提高模型精度？

1. 增加训练 epochs
2. 使用更大的批大小（如果显存允许）
3. 使用 Transformer 模型代替简单模型
4. 调整学习率和衰减策略
5. 使用数据增强

### Q3: 如何只导出关键点坐标？

```python
results = estimator.estimate_from_image("image.jpg")
keypoints_pixel = results['keypoints'] * [image_width, image_height]

# 保存为 CSV
import csv
with open("keypoints.csv", "w") as f:
    writer = csv.writer(f)
    writer.writerow(["kp_id", "name", "x", "y", "confidence"])
    for i, (name, (x, y)) in enumerate(zip(
        results['keypoint_names'],
        keypoints_pixel
    )):
        conf = results['confidence'][i]
        writer.writerow([i, name, x, y, conf])
```

### Q4: 关键点置信度如何解释？

- 0.0-0.3：置信度低，可能检测不准确
- 0.3-0.7：置信度中等，使用时需谨慎
- 0.7-1.0：置信度高，可信任的检测

### Q5: 如何加速推理？

```python
# 使用 ONNX 加速
import torch.onnx
torch.onnx.export(
    model,
    dummy_input,
    "model.onnx",
    opset_version=12,
)

# 或使用 TorchScript
scripted_model = torch.jit.script(model)
```

## 系统要求

- Python >= 3.7
- PyTorch >= 1.9
- OpenCV >= 4.0
- NumPy >= 1.19
- CUDA >= 10.0（可选，推荐用于训练）

## 安装依赖

```bash
pip install torch torchvision
pip install opencv-python
pip install numpy
pip install tqdm
pip install tensorboard
```

## 许可证

该项目采用 MIT 许可证。
