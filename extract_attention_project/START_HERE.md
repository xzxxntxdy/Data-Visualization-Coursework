# 🎯 立即开始 - 3 分钟快速启动指南

## 欢迎！👋

你已经拥有一个**完整的、可直接运行的模型训练系统**。这个指南会帮你在 3 分钟内完成所有准备工作。

---

## ⚡ 三步快速开始

### 第 1 步：打开终端（1 分钟）

```bash
# 进入项目目录
cd ~/桌面/extract_attention_project
```

### 第 2 步：安装依赖（1 分钟）

```bash
# 安装必需的 Python 包
pip install -r requirements.txt
```

**如果很慢**，可以使用国内镜像：
```bash
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple
```

### 第 3 步：开始训练（按下回车，然后等待）

```bash
# 运行快速启动脚本
python3 quick_start.py
```

**这个脚本会自动：**
- ✅ 检查 Python 环境
- ✅ 创建所有必需的目录
- ✅ 让你选择模型类型（简单或高级）
- ✅ 自动生成虚拟数据集（无需准备数据）
- ✅ 开始训练模型（20-50 分钟）
- ✅ 提取注意力权重

---

## ⏱️ 预计时间

| 步骤 | 时间 | 说明 |
|------|------|------|
| 安装依赖 | 5-10 分钟 | 首次运行会比较慢 |
| 脚本初始化 | 2-3 分钟 | 创建目录、生成数据 |
| **模型训练** | **15-40 分钟** | 取决于你选择的模型 |
| 注意力提取 | 2-5 分钟 | 很快 |
| **总计** | **25-60 分钟** | 预计 30-40 分钟 |

---

## 🎮 选择模型

当脚本问你选择模型时，输入：

**选项 1：简化 CNN 模型（推荐）**
```
输入: 1
特点: 快速（15 分钟）、内存占用少
推荐: 新手、GPU 内存小、想快速测试
```

**选项 2：Vision Transformer**
```
输入: 2
特点: 精度高（30-40 分钟）、内存占用大
推荐: 性能更重要、有较好的 GPU
```

> **建议新手选择 1**（快速完成，效果也不错）

---

## 📊 会发生什么

### 运行期间会看到：

```
[1/6] 检查 Python 环境...
✓ Python 检查通过

[2/6] 检查关键库...
✓ 库检查完成

[3/6] 创建项目目录...
✓ 目录创建完成

[4/6] 安装依赖...
✓ 依赖安装完成

[5/6] 选择模型并训练...
可选项:
  1) simple      - 快速 CNN 模型（推荐）
  2) transformer - Vision Transformer

请选择 [1-2，默认 1]: 1  ← 你输入这里

配置: simple 模型, 20 epochs, 批大小 32
开始训练...

Epoch 1/20 [Train]: 100%|████████| loss: 0.4532
Epoch 1/20 [Val]: 100%|████████| loss: 0.3821

Epoch 2/20 [Train]: 100%|████████| loss: 0.3245
...
```

### 训练完成后：

```
✅ 全部步骤完成！

生成的文件:
  模型: ./models/best_model.pth
  注意力权重: ./output/pose_model_attention.json
  日志: ./logs/training.log

下一步:
  1. 查看输出文件: cat ./output/pose_model_attention.json
  2. 复制到主项目: cp ./output/pose_model_attention.json ~/桌面/Data-Visualization-Coursework/src/data/
```

---

## 📁 生成的文件

训练完成后，你会在以下位置找到重要文件：

```
./models/best_model.pth
↓
这是训练好的模型，用来提取注意力权重

./output/pose_model_attention.json
↓
这是最终的注意力权重数据（JSON 格式）
包含 17 个关键点的重要性和 16×16 热力图

./logs/training.log
↓
训练日志，包含所有损失值和进度信息
```

---

## 🚀 完成后做什么

### 1️⃣ 查看生成的数据

```bash
# 查看输出文件的一部分
head -50 ./output/pose_model_attention.json
```

### 2️⃣ 复制到主项目

```bash
# 将数据复制到可视化项目
cp ./output/pose_model_attention.json \
   ~/桌面/Data-Visualization-Coursework/src/data/
```

### 3️⃣ 在主项目中使用

在你的可视化项目中加载这个 JSON 文件，就可以使用注意力权重数据了！

---

## ❓ 常见问题

### Q1: 需要 GPU 吗？
**A:** 不是必须的，但强烈推荐。
- 有 GPU：15-40 分钟
- 无 GPU (CPU)：几小时

### Q2: 我的网络很慢怎么办？
**A:** 依赖安装可能需要较长时间。建议：
```bash
# 使用清华镜像（更快）
pip install -r requirements.txt -i https://mirrors.tsinghua.edu.cn/pypi/web/simple
```

### Q3: 训练中途能停止吗？
**A:** 可以按 `Ctrl+C` 停止。已经训练的模型会被保存。

### Q4: 能看到训练进度吗？
**A:** 可以，脚本会显示进度条。或者在另一个终端查看：
```bash
tail -f ./logs/training.log
```

### Q5: 生成的模型质量如何？
**A:** 虚拟数据集生成的模型只是用来演示和测试。如果想要生产级别的模型，需要使用真实数据。

---

## 🆘 遇到问题？

### 问题：Python 命令不存在
```bash
# 尝试使用 python 而不是 python3
python quick_start.py

# 或检查 Python 是否安装
python --version
```

### 问题：pip 命令不存在
```bash
# 尝试使用 python -m pip
python -m pip install -r requirements.txt
```

### 问题：依赖安装失败
```bash
# 升级 pip
python -m pip install --upgrade pip

# 重新安装
pip install -r requirements.txt
```

### 问题：内存不足
```bash
# 减小批大小
python3 train.py --model_type simple --batch_size 8
```

---

## 📚 详细文档

如果你想了解更多，查看这些文件：

| 文件 | 内容 |
|------|------|
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | 快速参考（推荐） |
| [MODEL_TRAINING_SYSTEM.md](MODEL_TRAINING_SYSTEM.md) | 系统详细说明 |
| [TRAINING_GUIDE.md](TRAINING_GUIDE.md) | 训练详细指南 |
| [train_config_examples.txt](train_config_examples.txt) | 配置参数示例 |

---

## ✨ 总结

```
┌─────────────────────────────────────┐
│ 1️⃣ 打开终端                          │
│ cd ~/桌面/extract_attention_project  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 2️⃣ 安装依赖（5-10 分钟）            │
│ pip install -r requirements.txt     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 3️⃣ 运行脚本（20-50 分钟）           │
│ python3 quick_start.py              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ ✅ 完成！                             │
│ 模型: ./models/best_model.pth       │
│ 数据: ./output/pose_model_attention.│
│       json                           │
└─────────────────────────────────────┘
```

---

## 🎉 开始吧！

```bash
# 就是这一条命令！
python3 quick_start.py
```

**预计 30-50 分钟后，你就会拥有：**
- ✅ 一个训练好的深度学习模型
- ✅ 从模型中提取的注意力权重
- ✅ JSON 格式的数据，可用于可视化项目

---

## 需要帮助？

不确定要输入什么时，直接按 **Enter** 键使用默认选项（通常是推荐的）。

**祝你训练顺利！** 🚀
