# Transformer Cross-Attention 提取 - 独立项目说明

## 🎯 项目概述

在**独立的文件夹**（与主项目分离）中执行 Transformer 注意力权重的提取和处理，最后输出标准的数据文件给主项目使用。

---

## 📁 推荐的独立项目结构

```
~/extract_attention_project/          # 新建独立文件夹
├── extract_attention_weights.py      # 核心提取脚本
├── requirements.txt                  # Python 依赖
├── config.py                         # 配置文件
├── models/                           # 放置模型权重
│   └── pose_transformer_model.pth    # (你提供)
├── test_images/                      # 测试图像
│   ├── image_001.jpg                 # (你提供)
│   ├── image_002.jpg
│   └── ...
└── output/                           # 输出文件夹
    └── pose_model_attention.json     # ← 最终输出，给我
```

---

## 📋 我最终需要什么数据

### **1. 核心输出文件** ⭐⭐⭐
**文件名**：`pose_model_attention.json`

**位置**：`extract_attention_project/output/` 或任意位置（你告诉我路径即可）

**内容规格**（严格要求）：
```json
{
  "keypoint_importance": [
    {"id": 0, "name": "鼻子", "importance_score": 0.95},
    {"id": 1, "name": "左眼", "importance_score": 0.93},
    ... (共 17 个)
  ],
  "attention_map_16x16": [
    [0.10, 0.15, 0.12, ...],  // 16 个数字
    [0.05, 0.18, 0.14, ...],
    ...
    // 共 16 行
  ]
}
```

**数据要求**：
- ✅ `keypoint_importance` 必须是 **17 个关键点**
- ✅ `importance_score` 必须在 **[0.0, 1.0]** 范围内
- ✅ `attention_map_16x16` 必须是 **16 行 × 16 列**
- ✅ 热力图中所有值必须在 **[0.0, 1.0]** 范围内
- ✅ 使用 **真实模型提取的数据**，不是编造值

---

## 📥 你需要提供给我的数据

### **1. Pose Transformer 模型** ⭐⭐⭐
**我需要**：
- 模型文件路径或文件本身（`.pth` 或 `.pt` 格式）
- 模型架构说明（什么模型？ViTPose？HRNet-Transformer？自定义？）
- 模型加载代码（如何正确加载这个模型）
- 输入输出规格：
  - 输入图像尺寸：多少？(224×224? 256×256?)
  - 输入数据格式：RGB? BGR? 需要归一化吗?
  - 输出：关键点数量？(17? 16?)

**获取方式**（三选一）：
- 选项 A：提供已训练好的模型文件
- 选项 B：提供模型权重下载链接（GitHub/云盘）
- 选项 C：告诉我模型名称，我自己下载预训练权重（如 ViTPose-B）

---

### **2. 测试图像** ⭐⭐
**我需要**：
- 至少 **50-100 张图像**（越多越好，最好 500+ 张）
- 格式：`.jpg` 或 `.png`
- 内容：**包含完整人体的图像**（最好是 COCO 数据集或类似的标准数据集）
- 分辨率：不限，脚本会自动 resize

**获取方式**（推荐优先级）：
1. **COCO 数据集**（最好）
   - 下载：https://cocodataset.org/#download
   - 使用 `train2017` 或 `val2017` 的任意子集
   
2. **你已有的图像文件夹**
   - 路径：`~/extract_attention_project/test_images/`
   - 或告诉我在哪里，我自己找

3. **网络数据**
   - 告诉我可以下载的公开数据集链接

4. **视频或摄像头**
   - 如果有视频，我可以逐帧提取

---

### **3. 配置信息** ⭐
**我需要你告诉我**：

```yaml
# 模型相关
model:
  type: "ViTPose"  # 或其他模型名称
  checkpoint_path: "/path/to/model.pth"
  input_size: [224, 224]
  num_keypoints: 17
  num_heads: 8
  num_layers: 12

# 数据相关
data:
  image_dir: "/path/to/images/"
  image_extensions: [".jpg", ".png"]
  num_images_to_process: 500  # 处理多少张图像

# 输出相关
output:
  format: "json"
  output_path: "/path/to/pose_model_attention.json"
  include_metadata: true  # 是否包含额外信息
```

---

## 🔄 数据交付流程

### **第 1 步：你提供数据给我**
- [ ] Pose Transformer 模型（文件或下载链接）
- [ ] 模型加载代码或说明
- [ ] 测试图像文件夹路径（或图像本身）
- [ ] 模型配置信息（上面的 YAML 格式）

### **第 2 步：我生成提取脚本**
- 根据你的模型类型，编写 `extract_attention_weights.py`
- 脚本将：
  1. 加载你的模型
  2. 遍历测试图像
  3. 提取 Cross-Attention 权重
  4. 计算关键点重要性
  5. 生成 JSON 文件

### **第 3 步：你运行脚本得到数据**
```bash
cd ~/extract_attention_project
python extract_attention_weights.py
# 输出：output/pose_model_attention.json
```

### **第 4 步：你给我 JSON 文件**
- 将生成的 `pose_model_attention.json` 告诉我路径
- 或直接复制内容给我

### **第 5 步：我放入主项目**
- 我将文件放到：`/home/xie/桌面/Data-Visualization-Coursework/src/data/pose_model_attention.json`
- 前端立即可用！

---

## 📊 数据示例格式

### JSON 输出示例：

```json
{
  "keypoint_importance": [
    {"id": 0, "name": "鼻子", "importance_score": 0.9523},
    {"id": 1, "name": "左眼", "importance_score": 0.9287},
    {"id": 2, "name": "右眼", "importance_score": 0.9312},
    {"id": 3, "name": "左耳", "importance_score": 0.8756},
    {"id": 4, "name": "右耳", "importance_score": 0.8834},
    {"id": 5, "name": "左肩", "importance_score": 0.9145},
    {"id": 6, "name": "右肩", "importance_score": 0.9167},
    {"id": 7, "name": "左肘", "importance_score": 0.8523},
    {"id": 8, "name": "右肘", "importance_score": 0.8456},
    {"id": 9, "name": "左腕", "importance_score": 0.7834},
    {"id": 10, "name": "右腕", "importance_score": 0.7912},
    {"id": 11, "name": "左髋", "importance_score": 0.8934},
    {"id": 12, "name": "右髋", "importance_score": 0.8945},
    {"id": 13, "name": "左膝", "importance_score": 0.8234},
    {"id": 14, "name": "右膝", "importance_score": 0.8256},
    {"id": 15, "name": "左踝", "importance_score": 0.7523},
    {"id": 16, "name": "右踝", "importance_score": 0.7634}
  ],
  "attention_map_16x16": [
    [0.1234, 0.1567, 0.0987, 0.0756, 0.0654, 0.0543, 0.0421, 0.0312, 0.0201, 0.0198, 0.0267, 0.0398, 0.0512, 0.0634, 0.0756, 0.0923],
    [0.1456, 0.1823, 0.1534, 0.1267, 0.0934, 0.0823, 0.0712, 0.0601, 0.0467, 0.0445, 0.0534, 0.0678, 0.0812, 0.0945, 0.1078, 0.1234],
    ...
    [0.1312, 0.1645, 0.1423, 0.1089, 0.0956, 0.0845, 0.0734, 0.0623, 0.0512, 0.0501, 0.0598, 0.0745, 0.0892, 0.1034, 0.1167, 0.1345]
  ]
}
```

---

## ✅ 验收标准

最终交付的 JSON 文件应满足：

- ✅ 格式正确，能被 Python `json.load()` 正确解析
- ✅ 包含 **恰好 17 个**关键点
- ✅ 包含 **16×16** Attention 矩阵
- ✅ 所有 `importance_score` 在 [0.0, 1.0]
- ✅ 所有 Attention 值在 [0.0, 1.0]
- ✅ 数据基于**真实模型提取**，不是编造
- ✅ 文件大小合理（通常 < 100KB）

---

## 📞 沟通清单

请告诉我：

1. **你有模型吗？**
   - [ ] 有现成的模型文件（给我路径或文件）
   - [ ] 有模型名称，可以下载预训练权重（告诉我型号）
   - [ ] 没有，需要我帮你选择

2. **你有测试图像吗？**
   - [ ] 有文件夹（告诉我路径）
   - [ ] 没有，需要下载 COCO（告诉我）
   - [ ] 其他来源（说明）

3. **你的模型输入/输出规格是？**
   - 输入图像尺寸？
   - 关键点数量？
   - 模型架构说明

4. **时间要求？**
   - 急不急？
   - 需要多少张图像的数据？

---

## 🚀 快速开始

### **如果你已经有模型和图像**：

1. 告诉我：
   ```
   模型路径: ___________
   图像文件夹: ___________
   模型类型: ___________
   输入图像尺寸: ___________
   ```

2. 我会在 1-2 小时内给你：
   - `extract_attention_weights.py` 脚本
   - `requirements.txt` 依赖列表
   - 详细的运行说明

3. 你运行脚本：
   ```bash
   python extract_attention_weights.py
   ```

4. 给我生成的 `pose_model_attention.json`

5. 我放入主项目，完成！

---

**等你的信息！** 📧
