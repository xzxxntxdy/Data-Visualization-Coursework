# 模型训练系统 - 完整设置指南

## ✅ 已完成：完整的模型训练流程

你现在拥有一个**完整的、可独立运行的模型训练系统**，包括以下功能：

### 📦 新增文件

| 文件 | 用途 |
|-----|------|
| `pose_model.py` | Vision Transformer 和简化 CNN 模型定义 |
| `data_loader.py` | 数据加载、预处理和虚拟数据集生成 |
| `train.py` | 完整的训练脚本（支持命令行参数） |
| `TRAINING_GUIDE.md` | 详细的训练指南 |
| `quick_start.py` | 快速启动脚本（Python 版本） |
| `quick_start.sh` | 快速启动脚本（Bash 版本） |
| `requirements.txt` | 已更新的依赖列表 |

### 🎯 主要功能

#### 1️⃣ **模型**
- ✅ Vision Transformer（精度高，训练慢）
- ✅ 简化 CNN 模型（速度快，精度可接受）
- ✅ 支持注意力权重捕获

#### 2️⃣ **数据**
- ✅ COCO 格式数据加载
- ✅ 本地图像文件夹加载
- ✅ 虚拟数据集自动生成（用于快速测试）
- ✅ 数据预处理和增强

#### 3️⃣ **训练**
- ✅ 完整的训练循环
- ✅ 验证和损失监控
- ✅ 学习率调度
- ✅ 自动保存最佳模型
- ✅ TensorBoard 可视化

#### 4️⃣ **快速启动**
- ✅ 一键训练脚本（支持交互式选择）
- ✅ 自动依赖安装和环境检查
- ✅ 自动虚拟数据集生成

---

## 🚀 快速开始（推荐）

### 方案 A：使用快速启动脚本（最简单）

**Python 版本**（跨平台，推荐）：
```bash
cd ~/桌面/extract_attention_project
python3 quick_start.py
```

**Bash 版本**（仅 Linux/Mac）：
```bash
cd ~/桌面/extract_attention_project
bash quick_start.sh
```

这个脚本会：
1. ✅ 检查 Python 环境和 PyTorch
2. ✅ 创建项目目录
3. ✅ 安装依赖
4. ✅ 让你选择模型类型
5. ✅ 自动生成虚拟数据集（500 张图像）
6. ✅ 开始训练
7. ✅ 提取注意力权重

### 方案 B：手动运行（更灵活）

**步骤 1：安装依赖**
```bash
cd ~/桌面/extract_attention_project
pip install -r requirements.txt
```

**步骤 2：训练模型**

使用简化的 CNN 模型（快速）：
```bash
python3 train.py \
    --model_type simple \
    --num_epochs 20 \
    --batch_size 32
```

使用 Vision Transformer（精度高）：
```bash
python3 train.py \
    --model_type transformer \
    --num_epochs 30 \
    --batch_size 16
```

**步骤 3：提取注意力权重**
```bash
python3 extract_attention_weights.py \
    --model_path ./models/best_model.pth \
    --model_type simple \
    --output_path ./output/pose_model_attention.json
```

---

## 📊 预计时间

| 步骤 | 简化模型 | Transformer 模型 | GPU 要求 |
|------|---------|-----------------|---------|
| 依赖安装 | 2-5 分钟 | 2-5 分钟 | - |
| 虚拟数据生成 | <1 分钟 | <1 分钟 | - |
| 模型训练 | 10-20 分钟 | 30-60 分钟 | NVIDIA GPU 推荐 |
| 注意力提取 | 2-5 分钟 | 2-5 分钟 | - |
| **总计** | **15-30 分钟** | **35-70 分钟** | - |

---

## 🔧 使用自己的数据（可选）

如果你有自己的数据集：

### 目录结构
```
~/桌面/extract_attention_project/dataset/
├── image_001.jpg
├── image_002.jpg
├── ...
└── annotations.json  # COCO 格式
```

### 训练命令
```bash
python3 train.py \
    --model_type simple \
    --dataset_dir ./dataset \
    --num_epochs 30 \
    --batch_size 32
```

详细说明请查看 `TRAINING_GUIDE.md`。

---

## 📈 监控训练

### 方法 1：查看日志
```bash
tail -f ./logs/training.log
```

### 方法 2：使用 TensorBoard
```bash
tensorboard --logdir=./logs
# 打开浏览器访问 http://localhost:6006
```

---

## ✨ 输出文件

训练完成后，你会得到：

```
./models/
├── best_model.pth          # ⭐ 最佳模型（推荐使用）
├── model_epoch_10.pth
├── model_epoch_20.pth
└── ...

./output/
└── pose_model_attention.json  # ⭐ 注意力权重数据（JSON 格式）

./logs/
└── training.log  # 训练日志
```

---

## 📝 下一步

1. **运行快速启动脚本**
   ```bash
   python3 quick_start.py
   ```

2. **等待训练完成**（10-70 分钟，取决于模型类型）

3. **将生成的数据复制到主项目**
   ```bash
   cp ./output/pose_model_attention.json \
      ~/桌面/Data-Visualization-Coursework/src/data/
   ```

4. **在主项目中使用数据**

---

## 🆘 常见问题

### Q: 需要 GPU 吗？
**A**: 不是必须的，但强烈推荐。CPU 训练会很慢（可能需要几小时）。

### Q: 虚拟数据集质量如何？
**A**: 虚拟数据集只是随机生成的，质量一般。但用来测试流程完全足够。如果想要更好的模型效果，需要使用真实数据。

### Q: 训练多久才会收敛？
**A**: 
- 简化模型：5-10 epoch
- Transformer 模型：15-30 epoch

如果损失不下降，可以调整学习率。

### Q: 如何使用自己的数据？
**A**: 详见 `TRAINING_GUIDE.md` 的"方案 C"部分。

### Q: 提取的注意力权重是什么格式？
**A**: JSON 格式，包含：
- `keypoint_importance`: 17 个关键点的重要性分数
- `attention_map_16x16`: 16×16 的注意力热力图

---

## 📚 相关文档

- [TRAINING_GUIDE.md](TRAINING_GUIDE.md) - 详细的训练指南
- [README.md](README.md) - 项目概述
- [EXTRACT_ATTENTION_STANDALONE_PROJECT.md](EXTRACT_ATTENTION_STANDALONE_PROJECT.md) - 项目结构说明

---

## 🎉 总结

你现在拥有：

✅ 完整的模型训练系统  
✅ 两种模型架构（简化版和 Transformer）  
✅ 虚拟数据自动生成  
✅ 一键快速启动脚本  
✅ 详细的文档说明  
✅ 注意力权重提取功能  

现在你可以：
1. 立即运行快速启动脚本训练模型
2. 或者使用自己的数据集训练
3. 获得注意力权重数据
4. 用于可视化项目

**开始训练吧！** 🚀
```bash
python3 quick_start.py
```
