# Transformer 注意力权重提取项目

## 📋 项目概述

这是一个独立的 Transformer 注意力权重提取项目。用于从已训练的 Pose Transformer 模型中提取注意力权重，并生成标准的 JSON 格式数据供可视化使用。

## 📁 项目结构

```
extract_attention_project/
├── config.py                      # 项目配置文件
├── utils.py                       # 工具函数（图像预处理、注意力提取等）
├── extract_attention_weights.py   # 核心提取脚本
├── run_extraction.py              # 示例运行脚本
├── requirements.txt               # Python 依赖
├── README.md                      # 本文件
├── models/                        # 模型文件夹
│   └── (放置 .pth 模型文件)
├── test_images/                   # 测试图像文件夹
│   ├── image_001.jpg
│   ├── image_002.jpg
│   └── ...
├── output/                        # 输出文件夹
│   └── pose_model_attention.json  # 最终输出文件
└── logs/                          # 日志文件夹
    └── extraction.log
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd ~/桌面/extract_attention_project
pip install -r requirements.txt
```

### 2. 准备数据

#### 2.1 准备模型

将训练好的 Pose Transformer 模型放在 `models/` 文件夹中，或者在 `config.py` 中指定模型路径：

```python
MODEL_CONFIG = {
    'checkpoint_path': '/path/to/your/model.pth',
    ...
}
```

#### 2.2 准备测试图像

将包含完整人体的图像放在 `test_images/` 文件夹中。推荐：
- 格式：`.jpg` 或 `.png`
- 数量：50-500 张（越多越好）
- 内容：包含完整人体的图像（COCO 或类似数据集）

### 3. 配置参数

编辑 `config.py` 中的配置：

```python
# 模型配置
MODEL_CONFIG = {
    'type': 'vitpose',              # 模型类型
    'checkpoint_path': 'models/pose_model.pth',
    'input_size': [224, 224],       # 输入图像尺寸
    'num_keypoints': 17,            # 关键点数量
    ...
}

# 数据配置
DATA_CONFIG = {
    'image_dir': 'test_images/',
    'num_images_to_process': 100,   # 处理的图像数量
    ...
}

# 输出配置
OUTPUT_CONFIG = {
    'output_path': 'output/pose_model_attention.json',
    ...
}
```

### 4. 运行提取脚本

```bash
python extract_attention_weights.py
# 或
python run_extraction.py
```

### 5. 查看结果

提取完成后，查看输出文件：

```bash
cat output/pose_model_attention.json
```

## 📊 输出格式

脚本生成的 JSON 文件格式如下：

```json
{
  "keypoint_importance": [
    {"id": 0, "name": "鼻子", "importance_score": 0.9523},
    {"id": 1, "name": "左眼", "importance_score": 0.9287},
    ...
    {"id": 16, "name": "右踝", "importance_score": 0.7634}
  ],
  "attention_map_16x16": [
    [0.1234, 0.1567, 0.0987, ...],  // 16 个值
    [0.1456, 0.1823, 0.1534, ...],
    ...
    // 共 16 行
  ],
  "metadata": {
    "model_type": "vitpose",
    "num_images_processed": 100,
    "input_size": [224, 224],
    "num_keypoints": 17,
    "attention_map_size": 16
  }
}
```

**数据规范**：
- ✅ 恰好 17 个关键点（COCO 标准）
- ✅ 16×16 的注意力热力图
- ✅ 所有分数在 [0.0, 1.0] 范围内
- ✅ 基于真实模型提取的数据

## 🔧 高级配置

### 修改模型类型

支持的模型类型：
- `vitpose` - Vision Transformer 用于姿态估计（默认）
- `resnet50` - ResNet50 主干网络
- `custom` - 自定义模型（从 checkpoint_path 加载）

```python
MODEL_CONFIG = {
    'type': 'vitpose',  # 修改为 'resnet50' 或 'custom'
    ...
}
```

### 调整注意力提取层

```python
ATTENTION_CONFIG = {
    'target_layers': [11],  # 提取最后一层（12 层中的第 11 层，0-indexed）
    'attention_map_size': 16,
    ...
}
```

### 改变输出图的分辨率

```python
ATTENTION_CONFIG = {
    'attention_map_size': 32,  # 改为 32x32 或其他尺寸
}
```

## 🐛 常见问题

### 问题 1：模型加载失败

**解决方案**：
- 检查 `checkpoint_path` 路径是否正确
- 确保模型文件格式为 `.pth` 或 `.pt`
- 确保 PyTorch 版本兼容

### 问题 2：GPU 内存不足

**解决方案**：
```python
# config.py 中改为 CPU
RUN_CONFIG = {
    'device': 'cpu',  # 改为 'cpu'
    ...
}

# 或降低批处理大小
DATA_CONFIG = {
    'batch_size': 4,  # 从 8 改为 4
    ...
}
```

### 问题 3：没有找到图像

**解决方案**：
- 确保图像在 `test_images/` 文件夹中
- 检查文件扩展名（`.jpg`, `.png` 等）
- 确保文件格式正确

### 问题 4：注意力权重全为 0 或 1

**解决方案**：
- 检查模型是否正确加载
- 确保图像预处理参数正确
- 查看日志文件 `logs/extraction.log` 了解详细信息

## 📈 性能优化

### 处理更多图像

```python
DATA_CONFIG = {
    'num_images_to_process': 500,  # 增加处理的图像数量
    'batch_size': 16,              # 增加批处理大小（如果 GPU 内存允许）
    ...
}
```

### 使用 GPU

```python
RUN_CONFIG = {
    'device': 'cuda:0',  # 使用第一个 GPU
    # 或 'cuda:1' 用于第二个 GPU
}
```

## 📚 相关文档

- [PyTorch 官方文档](https://pytorch.org/)
- [Vision Transformer 论文](https://arxiv.org/abs/2010.11929)
- [COCO 数据集](https://cocodataset.org/)

## 📞 沟通清单

如果遇到问题，请提供以下信息：

1. **你的模型信息**：
   - 模型类型（ViTPose、HRNet 等）
   - 模型路径或下载链接
   - 输入尺寸和关键点数量

2. **你的图像信息**：
   - 图像数量
   - 图像来源（COCO、自拍、其他）
   - 图像分辨率

3. **错误日志**：
   - `logs/extraction.log` 中的错误信息
   - 运行命令和完整输出

## ✅ 验收标准

最终的 `pose_model_attention.json` 应满足：

- ✅ JSON 格式正确，能被解析
- ✅ 恰好 17 个关键点
- ✅ 16×16 注意力矩阵
- ✅ 所有分数在 [0.0, 1.0]
- ✅ 基于真实模型提取
- ✅ 文件大小 < 100KB

## 📝 许可证

MIT License

---

**准备好开始了吗？** 🚀

1. 放置模型文件到 `models/` 文件夹
2. 放置图像到 `test_images/` 文件夹
3. 编辑 `config.py` 配置参数
4. 运行 `python extract_attention_weights.py`
5. 查看输出 `output/pose_model_attention.json`
