# 📑 项目索引 - 快速导航

## 🎯 你想做什么？

### 💨 "我想立即开始训练模型"

**👉 [START_HERE.md](START_HERE.md)**
- 3 分钟快速启动
- 一键命令
- 适合新手

```bash
python3 quick_start.py
```

---

### 📚 "我想了解更多细节"

**👉 [QUICK_REFERENCE.md](QUICK_REFERENCE.md)**
- 快速参考手册
- 常用命令
- 参数说明

---

### 🔧 "我想自定义训练配置"

**👉 [train_config_examples.txt](train_config_examples.txt)**
- 配置参数示例
- 详细说明
- 常用组合

**👉 [TRAINING_GUIDE.md](TRAINING_GUIDE.md)**
- 完整训练指南
- 高级配置
- 最佳实践

---

### 🏗️ "我想理解系统架构"

**👉 [MODEL_TRAINING_SYSTEM.md](MODEL_TRAINING_SYSTEM.md)**
- 系统设计
- 功能说明
- 工作流程

**👉 [PROJECT_COMPLETION_REPORT.md](PROJECT_COMPLETION_REPORT.md)**
- 完成总结
- 功能清单
- 项目统计

---

### 🐛 "遇到问题了"

**👉 [TRAINING_GUIDE.md#常见问题](TRAINING_GUIDE.md)**
- 常见问题解答
- 故障排除
- 解决方案

---

### ✅ "我想验证项目设置"

**运行验证脚本：**
```bash
python3 verify_project.py
```

---

## 📚 完整文档列表

### 🚀 快速开始（新手必读）

| 文件 | 用途 | 阅读时间 |
|------|------|---------|
| [START_HERE.md](START_HERE.md) | 3 分钟快速开始 | 3 分钟 |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | 快速参考手册 | 5 分钟 |

### 📖 详细指南

| 文件 | 用途 | 阅读时间 |
|------|------|---------|
| [MODEL_TRAINING_SYSTEM.md](MODEL_TRAINING_SYSTEM.md) | 系统说明 | 10 分钟 |
| [TRAINING_GUIDE.md](TRAINING_GUIDE.md) | 训练指南 | 15 分钟 |
| [FINAL_CHECKLIST.md](FINAL_CHECKLIST.md) | 项目清单 | 5 分钟 |

### 🎓 参考文档

| 文件 | 用途 | 查询时间 |
|------|------|---------|
| [train_config_examples.txt](train_config_examples.txt) | 配置示例 | 按需查询 |
| [README.md](README.md) | 项目概述 | 5 分钟 |
| [SETUP.md](SETUP.md) | 设置说明 | 5 分钟 |

### 📊 项目文档

| 文件 | 用途 | 查询时间 |
|------|------|---------|
| [PROJECT_COMPLETION_REPORT.md](PROJECT_COMPLETION_REPORT.md) | 完成总结 | 10 分钟 |
| [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) | 项目总结 | 5 分钟 |
| [EXTRACT_ATTENTION_STANDALONE_PROJECT.md](EXTRACT_ATTENTION_STANDALONE_PROJECT.md) | 项目说明 | 5 分钟 |

---

## 🎯 常见任务指南

### 任务 1：快速训练模型（首次）

**文件**：[START_HERE.md](START_HERE.md)
**命令**：
```bash
pip install -r requirements.txt
python3 quick_start.py
```
**预计时间**：30-50 分钟

---

### 任务 2：查看训练进度

**命令**：
```bash
# 查看日志
tail -f ./logs/training.log

# 或使用 TensorBoard
tensorboard --logdir=./logs
```

---

### 任务 3：使用自己的数据

**文件**：[TRAINING_GUIDE.md#方案C](TRAINING_GUIDE.md)
**步骤**：
1. 准备数据目录和标注文件
2. 运行训练：`python3 train.py --dataset_dir ./dataset`

---

### 任务 4：调整训练参数

**文件**：[train_config_examples.txt](train_config_examples.txt)
**例子**：
```bash
python3 train.py \
    --model_type transformer \
    --num_epochs 50 \
    --batch_size 16 \
    --learning_rate 5e-4
```

---

### 任务 5：提取注意力权重

**命令**：
```bash
python3 extract_attention_weights.py \
    --model_path ./models/best_model.pth \
    --model_type simple
```

---

### 任务 6：复制到主项目

**命令**：
```bash
cp ./output/pose_model_attention.json \
   ~/桌面/Data-Visualization-Coursework/src/data/
```

---

## 📁 文件组织

```
extract_attention_project/
│
├── 📚 文档（按推荐阅读顺序）
│   ├── START_HERE.md                    ← 从这里开始！
│   ├── QUICK_REFERENCE.md               快速参考
│   ├── MODEL_TRAINING_SYSTEM.md         系统说明
│   ├── TRAINING_GUIDE.md                详细指南
│   ├── FINAL_CHECKLIST.md               项目清单
│   ├── train_config_examples.txt        配置示例
│   ├── PROJECT_COMPLETION_REPORT.md     完成总结
│   └── ...其他说明文档
│
├── 🚀 启动脚本
│   ├── quick_start.py                   ← 推荐使用
│   └── quick_start.sh
│
├── 🧠 核心模块
│   ├── train.py                         训练脚本
│   ├── pose_model.py                    模型定义
│   ├── data_loader.py                   数据加载
│   ├── extract_attention_weights.py     权重提取
│   ├── utils.py                         工具函数
│   └── config.py                        配置
│
├── 🔧 工具
│   ├── verify_project.py                项目验证
│   └── requirements.txt                 依赖列表
│
└── 📂 工作目录
    ├── dataset/                         数据集
    ├── models/                          保存的模型
    ├── logs/                            训练日志
    ├── test_images/                     测试图像
    └── output/                          输出数据
```

---

## 🎯 使用建议

### 第一次使用？

1. ✅ 阅读 [START_HERE.md](START_HERE.md)（3 分钟）
2. ✅ 运行 `python3 quick_start.py`（30-50 分钟）
3. ✅ 完成！查看生成的数据

### 想深入了解？

1. 📖 阅读 [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
2. 📖 阅读 [MODEL_TRAINING_SYSTEM.md](MODEL_TRAINING_SYSTEM.md)
3. 📖 阅读 [TRAINING_GUIDE.md](TRAINING_GUIDE.md)

### 想自定义参数？

1. 📋 查看 [train_config_examples.txt](train_config_examples.txt)
2. 💻 运行自定义命令
3. 📊 监控训练进度

### 遇到问题？

1. 🔍 查看 [TRAINING_GUIDE.md#常见问题](TRAINING_GUIDE.md)
2. 📝 检查日志：`tail -f ./logs/training.log`
3. ✅ 运行验证：`python3 verify_project.py`

---

## 🔗 快速链接

### 启动

```bash
# 最简单的方式
python3 quick_start.py

# 或手动
pip install -r requirements.txt
python3 train.py --model_type simple
```

### 监控

```bash
# 查看日志
tail -f ./logs/training.log

# TensorBoard
tensorboard --logdir=./logs
```

### 验证

```bash
# 检查项目完整性
python3 verify_project.py
```

---

## 📞 需要帮助？

1. **快速问题**：查看 [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
2. **详细问题**：查看 [TRAINING_GUIDE.md](TRAINING_GUIDE.md)
3. **配置问题**：查看 [train_config_examples.txt](train_config_examples.txt)
4. **系统问题**：查看 [MODEL_TRAINING_SYSTEM.md](MODEL_TRAINING_SYSTEM.md)

---

## ✨ 项目亮点

- ✅ 一键启动脚本
- ✅ 虚拟数据自动生成
- ✅ 多种模型选择
- ✅ 详细文档和示例
- ✅ 完整的训练监控
- ✅ 自动环境检查

---

## 🎉 准备好了吗？

**开始吧！** 👇

```bash
python3 quick_start.py
```

或者阅读详细指南：[START_HERE.md](START_HERE.md)

---

**祝你训练顺利！** 🚀
