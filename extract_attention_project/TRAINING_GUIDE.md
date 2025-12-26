# Pose Model 训练指南

## 📋 概述

本指南帮助你快速训练一个自己的姿态估计模型，然后用来提取注意力权重。

---

## 🚀 快速开始（推荐）

如果你想快速开始，只需要运行以下命令：

```bash
cd ~/桌面/extract_attention_project

# 1. 安装依赖
pip install -r requirements.txt

# 2. 使用虚拟数据集训练（自动生成 500 张随机图像）
python train.py \
    --model_type simple \
    --num_epochs 20 \
    --batch_size 32 \
    --learning_rate 1e-4

# 3. 提取注意力权重
python extract_attention_weights.py \
    --model_path ./models/best_model.pth \
    --test_images_dir ./test_images \
    --output_path ./output/pose_model_attention.json
```

**预计时间**：
- 虚拟数据集训练：10-30 分钟（取决于 GPU）
- 注意力提取：2-5 分钟

---

## 📊 完整训练流程

### 方案 A：使用虚拟数据集（推荐新手）

如果你还没有真实数据，可以使用虚拟数据集快速开始：

```bash
python train.py \
    --model_type simple \
    --dataset_dir ./dataset \
    --dummy_num_images 500 \
    --num_epochs 30 \
    --batch_size 32 \
    --learning_rate 1e-4
```

**参数说明**：
- `--model_type simple`: 使用简化的 CNN 模型（快速训练）
- `--dummy_num_images 500`: 生成 500 张虚拟图像
- `--num_epochs 30`: 训练 30 个 epoch
- `--batch_size 32`: 批大小 32

**输出**：
- 模型保存在 `./models/best_model.pth`
- 日志保存在 `./logs/training.log`
- TensorBoard 事件文件在 `./logs/`

### 方案 B：使用 Transformer 模型（性能更好）

如果你有较好的 GPU，可以使用 Vision Transformer 模型：

```bash
python train.py \
    --model_type transformer \
    --dataset_dir ./dataset \
    --dummy_num_images 1000 \
    --image_size 256 \
    --hidden_dim 768 \
    --num_heads 8 \
    --num_layers 12 \
    --num_epochs 50 \
    --batch_size 16 \
    --learning_rate 1e-4
```

**参数说明**：
- `--model_type transformer`: 使用 Vision Transformer
- `--hidden_dim 768`: 隐层维度（越大越慢，但性能更好）
- `--num_heads 8`: 注意力头数
- `--num_layers 12`: Transformer 层数

**预计时间**：
- 生成虚拟数据：1 分钟
- 训练：30-60 分钟（取决于 GPU）

### 方案 C：使用自己的数据集

如果你有自己的图像和标注数据：

#### 1. 准备数据目录结构

```
./dataset/
├── image_001.jpg
├── image_002.jpg
├── ...
└── annotations.json  # COCO 格式的标注文件
```

#### 2. 准备 COCO 格式的标注文件

**annotations.json** 的格式：

```json
{
  "info": {
    "description": "My Pose Dataset",
    "version": "1.0",
    "year": 2024
  },
  "images": [
    {
      "id": 1,
      "file_name": "image_001.jpg",
      "height": 480,
      "width": 640
    },
    ...
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "keypoints": [x0, y0, v0, x1, y1, v1, ...],  // 17*3=51 个数字
      "num_keypoints": 17,
      "area": 0,
      "iscrowd": 0,
      "bbox": [0, 0, 640, 480]
    },
    ...
  ],
  "categories": [
    {
      "id": 1,
      "name": "person",
      "supercategory": "person",
      "keypoints": [
        "nose", "left_eye", "right_eye", "left_ear", "right_ear",
        "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
        "left_wrist", "right_wrist", "left_hip", "right_hip",
        "left_knee", "right_knee", "left_ankle", "right_ankle"
      ],
      "skeleton": []
    }
  ]
}
```

**关键点顺序** (COCO 17 个关键点):
```
0: 鼻子
1: 左眼
2: 右眼
3: 左耳
4: 右耳
5: 左肩
6: 右肩
7: 左肘
8: 右肘
9: 左腕
10: 右腕
11: 左髋
12: 右髋
13: 左膝
14: 右膝
15: 左踝
16: 右踝
```

**关键点可见性标志** (v):
```
0: 点不在图像中
1: 点在图像中但被遮挡
2: 点在图像中且可见
```

#### 3. 运行训练

```bash
python train.py \
    --model_type simple \
    --dataset_dir ./dataset \
    --num_epochs 30 \
    --batch_size 32 \
    --learning_rate 1e-4
```

---

## 🛠️ 训练参数详解

### 模型参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--model_type` | `simple` | 模型类型：`simple` 或 `transformer` |
| `--num_keypoints` | `17` | 关键点数量 |
| `--image_size` | `256` | 输入图像大小（像素） |
| `--hidden_dim` | `768` | (Transformer) 隐层维度 |
| `--num_heads` | `8` | (Transformer) 注意力头数 |
| `--num_layers` | `12` | (Transformer) 编码器层数 |
| `--patch_size` | `16` | (Transformer) Patch 大小 |

### 训练参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--batch_size` | `32` | 批大小 |
| `--num_epochs` | `50` | 总训练轮数 |
| `--learning_rate` | `1e-4` | 初始学习率 |
| `--weight_decay` | `1e-5` | L2 正则化系数 |
| `--num_workers` | `4` | 数据加载进程数 |

### 调度器参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--scheduler_step` | `10` | 学习率调度步长（epoch） |
| `--scheduler_gamma` | `0.1` | 学习率衰减因子 |

### 保存参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--checkpoint_dir` | `./models` | 模型保存目录 |
| `--log_dir` | `./logs` | 日志目录 |
| `--save_interval` | `10` | 检查点保存间隔（epoch） |

---

## 📈 监控训练进度

### 方法 1：使用 TensorBoard

```bash
# 在项目目录运行
tensorboard --logdir=./logs

# 然后在浏览器打开 http://localhost:6006
```

### 方法 2：查看日志

```bash
tail -f ./logs/training.log
```

---

## ✅ 训练完成后

### 1. 确认模型文件

训练完成后，你应该在 `./models/` 目录下看到：

```
./models/
├── best_model.pth         # 最佳模型（推荐使用）
├── model_epoch_10.pth
├── model_epoch_20.pth
└── ...
```

### 2. 使用模型提取注意力权重

```bash
python extract_attention_weights.py \
    --model_path ./models/best_model.pth \
    --model_type simple \
    --test_images_dir ./test_images \
    --output_path ./output/pose_model_attention.json
```

### 3. 查看输出文件

```bash
cat ./output/pose_model_attention.json
```

---

## 🐛 常见问题

### Q1: GPU 内存不足

**解决方案**：
- 减小 `--batch_size`（例如改为 8 或 16）
- 减小 `--image_size`（例如改为 224）
- 使用 `--model_type simple` 而不是 `transformer`

### Q2: 训练速度太慢

**解决方案**：
- 增加 `--num_workers`（例如改为 8）
- 使用 `--model_type simple` 模型
- 确保使用 GPU（检查 CUDA 是否可用）

### Q3: 损失不下降

**解决方案**：
- 增加学习率（例如 `--learning_rate 5e-4`）
- 减少学习率衰减（例如 `--scheduler_gamma 0.5`）
- 增加训练轮数（例如 `--num_epochs 100`）

### Q4: 模型不保存

**检查**：
- `./models/` 目录是否存在和可写
- 磁盘空间是否充足
- 查看日志文件中是否有错误信息

---

## 📝 配置文件（可选）

你也可以创建一个 `train_config.yaml` 文件来保存配置：

```yaml
# train_config.yaml
model:
  type: simple
  num_keypoints: 17
  image_size: 256

training:
  batch_size: 32
  num_epochs: 30
  learning_rate: 1e-4
  weight_decay: 1e-5

data:
  dataset_dir: ./dataset
  num_workers: 4

logging:
  log_dir: ./logs
  checkpoint_dir: ./models
  save_interval: 10
```

然后使用 `train.py` 的配置文件加载功能（需要修改代码以支持）。

---

## 🎯 下一步

训练完成后：

1. ✅ 确认 `./models/best_model.pth` 存在
2. ✅ 运行 `extract_attention_weights.py` 提取注意力权重
3. ✅ 生成 `pose_model_attention.json`
4. ✅ 将文件复制到主项目中使用

---

## 📚 参考资源

- [PyTorch 官方文档](https://pytorch.org/docs/)
- [COCO 数据集格式](https://cocodataset.org/#format-data)
- [Vision Transformer](https://arxiv.org/abs/2010.11929)
- [ViTPose](https://github.com/vitpose-pytorch/vitpose)

---

## 💡 提示

- **从小规模开始**：先用虚拟数据集训练 10-20 epoch，确保所有代码工作正常
- **逐步扩大**：如果代码工作正常，再使用更大的数据集和更多 epoch
- **保存检查点**：定期保存检查点，这样即使训练中断也不会丢失进度
- **监控指标**：使用 TensorBoard 监控损失和学习率，及时调整参数

---

祝你训练顺利！ 🚀
