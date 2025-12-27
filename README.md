# 🌌 COCO-Verse：多视图可视化分析系统

<p align="center">
  <img src="assets/banner.png" alt="COCO-Verse Banner" width="100%">
</p>

> **COCO-Verse** 是一个基于 COCO 2017 数据集的交互式多视图可视化分析系统，通过空间分布、语义共现、人体姿态三个维度，揭示视觉数据中的深层模式与洞察。

---

## 📋 目录

- [项目概述](#-项目概述)
- [功能特性](#-功能特性)
- [系统架构](#-系统架构)
- [快速开始](#-快速开始)
- [数据处理](#-数据处理)
- [视图详解](#-视图详解)
- [实验分析](#-实验分析)
- [技术栈](#-技术栈)
- [项目结构](#-项目结构)
- [常见问题](#-常见问题)
- [团队成员](#-团队成员)

---

## 🎯 项目概述

### 背景

COCO (Common Objects in Context) 是计算机视觉领域最具影响力的大规模数据集之一，包含：
- **123,287 张** 训练/验证图像
- **80 个** 物体类别
- **860,000+** 实例标注
- **250,000+** 人体关键点标注

### 目标

本项目旨在通过可视化分析，回答以下核心问题：

| 分析维度 | 核心问题 |
|----------|----------|
| **空间分布** | 不同类别的物体在图像中如何分布？大/中/小目标的空间偏好是什么？ |
| **语义共现** | 哪些物体经常同时出现？它们之间的条件概率关系如何？ |
| **人体姿态** | 人体关键点的可见性分布如何？不同场景下的典型姿态是什么？ |

---

## ✨ 功能特性

### 🏠 沉浸式门户 (Portal)

<p align="center">
  <img src="assets/portal_demo.png" alt="Portal Demo" width="80%">
</p>

- **滚动叙事**：从单张样本图片出发，逐步展示空间定位、语义编织、姿态透视三个分析阶段
- **双层视觉架构**：AI 生成的抽象背景 + **真实样本的分析叠加层**
- **无缝转场**：从微观样本到宏观数据集的视觉过渡

### 📍 空间与尺度视图 (Spatial View)

<p align="center">
  <img src="assets/spatial_view.png" alt="Spatial View" width="80%">
</p>

- **等高线密度热力图**：可视化物体中心点的空间分布
- **位置×尺度散点图**：探索目标位置与相对面积的关系
- **类别尺度分布**：比较不同类别的小/中/大目标占比
- **Cross-Filtering 联动**：框选空间区域，联动更新其他图表
- **完整 80 类支持**：下拉选择器支持搜索全部类别

### 🕸️ 语义共现网络 (Semantic View)

<p align="center">
  <img src="assets/semantic_view.png" alt="Semantic View" width="80%">
</p>

- **力导向图**：节点大小映射类别频次，边粗细映射共现强度
- **条件概率侧边栏**：显示选中类别与其他类别的条件概率
- **共现阈值筛选**：滑块控制显示的最小共现次数
- **节点交互**：点击锁定、双击排除、拖拽调整

### 🦴 人体姿态视图 (Pose View)

<p align="center">
  <img src="assets/pose_view.png" alt="Pose View" width="80%">
</p>

- **概率骨架图**：17 个关键点的可见性热力光晕
- **关键点环形图**：各关键点的可见性统计分布
- **骨架连接可视化**：标准 COCO 骨架拓扑结构
- **场景过滤**：按共现物体筛选姿态子集

### 🧪 模型偏差实验分析 (Model Bias Analysis)

<p align="center">
  <img src="assets/类别先验偏差分析.png" alt="Model Bias Analysis" width="80%">
</p>

深入探究神经网络的"固有偏见"：

- **实验设计**：给 ResNet-18 输入完全无语义信息的图像（纯黑/纯白 Tensor）
- **惊人发现**：即使输入无任何信息，模型依然输出极高的 `person` 置信度（纯黑 54%，纯白 80%）
- **核心洞察**：揭示 COCO 数据集的类别分布偏差——因为数据集中 "人" 类图片数量极多，网络学到了"如果不知道是什么，猜是人准没错"的先验概率
- **ResNet-18 架构可视化**：清晰展示模型结构与推理流程

### 🔬 空间先验实验 (Spatial Prior Experiment)

<p align="center">
  <img src="assets/空间先验实验.png" alt="Spatial Prior Experiment" width="80%">
</p>

探索 Grounding Transformer 学习到的空间位置偏差：

- **实验核心问题**：当给训练好的目标检测 Transformer 输入完全随机的噪声图像时，用某个类别作为 Query Token，模型的注意力会均匀分布吗？
- **热力图对比**：GT 真实分布 vs 模型注意力 vs 差异图
- **高相关性验证**：平均相关性达 86.7%，证明模型学习到了数据集的空间先验
- **77 个类别测试**：完整的相关性排行榜，支持交互选择查看
- **结论**：即使输入是无意义的噪声，模型依然会将注意力集中在该类别统计上最可能出现的区域

### 🎯 综合姿态 + 模型分析 (Pose Model Analysis)

<p align="center">
  <img src="assets/综合姿态及模型分析.png" alt="Pose Model Analysis" width="80%">
</p>

从 11 万张 COCO 数据集图像的 YOLOv8 姿态推理结果中，深度理解模型学到了什么：

- **YOLOv8 姿态推理示例**：轮播展示真实图片的推理可视化结果，包含 17 个关键点的置信度
- **17 个关键点平均置信度图**：展示各关键点在海量数据上的置信度分布规律
- **COCO 可见度 vs YOLO 置信度散点图**：揭示模型预测与真实标注的相关性
- **核心洞察**：上肢置信度高于下肢（因为下体被遮挡较多），符合遮挡度效应

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                   COCO-Verse System Architecture                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      │
│   │    Portal    │      │  Dashboard   │      │ Cross-Filter │      │
│   │ (story_main) │ ──── │   (Views)    │ ──── │   (Events)   │      │
│   └──────────────┘      └──────────────┘      └──────────────┘      │
│          │                     │                     │              │
│          ▼                     ▼                     ▼              │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                 D3.js Visualization Layer                   │   │
│   │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐      │   │
│   │  │ Contour │   │ Scatter │   │  Force  │   │Skeleton │      │   │
│   │  │ Density │   │  Plot   │   │  Graph  │   │  Pose   │      │   │
│   │  └─────────┘   └─────────┘   └─────────┘   └─────────┘      │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                │                                    │
│                                ▼                                    │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  Data Processing (Python)                   │   │
│   │  ┌───────────────┐  ┌────────────────┐  ┌───────────────┐   │   │
│   │  │process_spatial│  │process_semantic│  │ process_pose  │   │   │
│   │  └───────────────┘  └────────────────┘  └───────────────┘   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                │                                    │
│                                ▼                                    │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  COCO 2017 Raw Data (JSON)                  │   │
│   │   instances_train2017.json  person_keypoints_train2017.json │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
````

-----

## 🚀 快速开始

### 环境要求

  - **Node.js** \>= 14.0
  - **npm** \>= 6.0
  - **Python** \>= 3.7 (可选，仅用于复现数据处理)
  - **Pillow** (`pip install Pillow`, 可选，用于图像生成)

### 安装步骤

```bash
# 1. 克隆仓库
git clone [https://github.com/xzxxntxdy/Data-Visualization-Coursework.git](https://github.com/xzxxntxdy/Data-Visualization-Coursework.git)
cd Data-Visualization-Coursework

# 2. 安装 Node.js 依赖 (必需)
npm install

# 3. [可选] 数据复现
# ⚠️ 注意：项目已包含预处理好的 JSON 和图片数据，通常可跳过此步。
# 若需重新生成数据，请确保已下载 COCO 数据集并运行以下脚本：

# python find_image.py        # 生成 hero_image.jpg (门户主图) 和 hero_data.json
# python save_overview.py     # 生成 overview.jpg (门户背景概览)
# python process_semantic.py  # 生成 semantic_data.json
# python process_spatial.py   # 生成 spatial_data.json
# python process_pose.py      # 生成 pose_stats.json

# 4. 启动开发服务器
npm start
```

### 访问应用

打开浏览器访问 **http://localhost:8080**

-----

## 📊 数据处理

### 数据流程图

```text
COCO 原始数据 (JSON & 图片)        预处理脚本                  前端资源
──────────────────────          ────────────────           ──────────────
instances_train2017.json   ───▶  find_image.py      ───▶  hero_data.json
keypoints_train2017.json                                   hero_image.jpg 
COCO 图片集                                                 overview.jpg
──────────────────────           save_overview.py   
COCO 图片集                                                  
──────────────────────           process_spatial.py ───▶  spatial_data.json
instances_train2017.json                                    (8,000 采样)
──────────────────────           process_semantic.py───▶  semantic_data.json
instances_train2017.json                                    (80 类共现矩阵)
──────────────────────           process_pose.py    ───▶  pose_stats.json
person_keypoints_train2017.json                             (17 关键点统计)
```

### 数据文件说明

| 文件 | 实际大小 | 内容 | 用途 |
|------|----------|------|------|
| `hero_image.jpg` | 变动 | 筛选出的最佳图片 | 门户背景、故事叙事 |
| `hero_data.json` | \~19 KB | `hero_image` 的所有标注数据 | 门户叙事数据 |
| `overview.jpg` | \~538 KB | 随机采样的图片拼成的概览图 | 门户背景，展示数据集概貌 |
| `spatial_data.json` | \~2 MB | 8,000 条采样标注、80 类别统计 | 空间视图 |
| `semantic_data.json` | \~206 KB | 80×80 共现矩阵、条件概率 | 语义视图 |
| `pose_stats.json` | \~1.0 MB | 17 关键点可见性统计、骨架定义 | 姿态视图 |

-----

## 📖 视图详解

### 1\. 空间与尺度视图

#### 可视映射

| 视觉通道 | 数据属性 |
|----------|----------|
| 等高线颜色深度 | 物体中心点密度 |
| 散点 X 坐标 | 归一化水平位置 (0\~1) |
| 散点 Y 坐标 | 相对面积 (对数刻度) |
| 散点颜色 | 尺度类别 (小/中/大) |
| 条形长度 | 各尺度类别占比 |

### 2\. 语义共现网络

#### 可视映射

| 视觉通道 | 数据属性 |
|----------|----------|
| 节点大小 | 类别出现频次 |
| 节点颜色 | 超类别 (supercategory) |
| 边粗细 | 共现次数 |
| 边透明度 | 共现强度 |

### 3\. 人体姿态视图

#### 可视映射

| 视觉通道 | 数据属性 |
|----------|----------|
| 关键点大小 | 可见性概率 |
| 关键点颜色 | 身体部位分组 |
| 骨架连线 | COCO 标准骨架定义 |
| 热力光晕 | 位置不确定性 |

-----

## 🔬 实验分析

本项目包含三个深度实验，探究深度学习模型从数据集中学到的隐性偏差：

### 1\. 模型偏差实验 (ResNet-18 类别先验)

**实验目的**：验证神经网络是否学习到了数据集的类别分布偏差

**实验设计**：
- 输入：完全无语义的纯色 Tensor（纯黑 `torch.zeros` / 纯白 `torch.ones`）
- 模型：在 COCO 多标签分类任务上训练的 ResNet-18
- 输出：80 个类别的预测概率

**关键发现**：
| 输入类型 | Person 预测概率 | 结论 |
|----------|-----------------|------|
| 纯黑 Tensor | 54.0% | 模型有强烈的 "人" 类先验 |
| 纯白 Tensor | 80.1% | 先验偏差更加明显 |

**意义**：揭示了 COCO 数据集中 "person" 类别占比过高导致的模型偏差

### 2\. 空间先验实验 (Grounding Transformer)

**实验目的**：验证目标检测 Transformer 是否学习到了类别的空间位置偏差

**实验设计**：
- 输入：随机噪声图像 `torch.randn(1, 3, 256, 256)`
- Query：各类别的 embedding
- 提取：Cross-Attention 权重，reshape 为 16×16 空间分布

**关键指标**：
| 指标 | 数值 |
|------|------|
| 平均相关性 | 86.7% |
| 测试类别数 | 77 |
| 最高相关性 (bed) | 98.5% |

**结论**：模型的注意力分布与 COCO 数据集的真实位置分布高度相关，证明 Transformer 学习到了空间先验

### 3\. 姿态模型分析 (YOLOv8 Pose)

**实验目的**：分析姿态检测模型在大规模数据上的表现规律

**数据规模**：
- 图像数量：117,266 张
- 人体实例：约 26 万个
- 关键点：17 个 COCO 标准关键点

**关键发现**：
| 身体部位 | 置信度特征 | 原因分析 |
|----------|------------|----------|
| 头部/面部 | 最高 (>90%) | 通常可见，特征明显 |
| 上肢 | 较高 (70-90%) | 动作多样但通常可见 |
| 下肢 | 最低 (<60%) | 遮挡较多（桌子、其他人等） |

-----

## 🛠️ 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| D3.js | ^7.4.4 | 核心可视化库 |
| d3-hexbin | ^0.2.2 | 六边形分箱 |
| Parcel | ^1.12.5 | 模块打包器 |

### 后端/数据处理

| 技术 | 用途 |
|------|------|
| Python 3 | 数据预处理脚本 |
| Pillow | 图像处理 (拼图/裁剪) |
| JSON | 数据交换格式 |

-----

## 📁 项目结构

```
Data-Visualization-Coursework/
│
├── 📄 package.json              # 项目配置
├── 📄 README.md                 # 项目说明（本文件）
├── 📄 PROJECT_STATUS.md         # 开发进度跟踪
│
├── � scripts/                  # 数据处理脚本
│   ├── 📁 preprocessing/        # 预处理脚本
│   │   ├── generate_story_img/  # 门户图片生成
│   │   └── process_coco_annotation/  # COCO 标注处理
│   ├── 📁 training/             # 模型训练相关
│   │   ├── class_bias_train/    # ResNet-18 类别偏差实验
│   │   └── grounding_train/     # Grounding Transformer 空间先验实验
│   └── 📁 yolo_analysis/        # YOLOv8 姿态分析
│
├── 📁 checkpoints/              # 模型权重文件
│   ├── coco_multilabel_resnet18.pth  # ResNet-18 多标签分类
│   ├── chair_transformer.pth         # Grounding Transformer
│   └── yolov8n-pose.pt               # YOLOv8 姿态模型
│
├── 📁 src/
│   ├── 📄 index.html            # 主页面
│   │
│   ├── 📁 js/
│   │   ├── story_main.js        # 门户滚动叙事
│   │   ├── spatial_view.js      # 空间视图模块
│   │   ├── semantic_graph.js    # 语义视图模块
│   │   ├── pose_view.js         # 姿态视图模块
│   │   ├── bias_view.js         # 模型偏差实验视图
│   │   ├── spatial_prior_view.js     # 空间先验实验视图
│   │   ├── pose_model_analysis.js    # 姿态模型分析视图
│   │   ├── image_explorer.js    # YOLOv8 推理示例浏览器
│   │   └── distribution_matrix.js
│   │
│   ├── 📁 data/
│   │   ├── instances_train2017.json      # COCO 实例标注
│   │   ├── person_keypoints_train2017.json
│   │   ├── hero_data.json                # 门户叙事数据
│   │   ├── semantic_data.json            # 预处理：语义
│   │   ├── spatial_data.json             # 预处理：空间
│   │   ├── pose_stats.json               # 预处理：姿态
│   │   ├── spatial_prior_data.json       # 空间先验实验数据
│   │   ├── pose_analysis_results.json    # 姿态模型分析数据
│   │   ├── coco_pose_results.json        # YOLOv8 推理结果
│   │   └── coco_vs_yolo_scatter.json     # COCO vs YOLO 对比数据
│   │
│   ├── 📁 visualized/           # YOLOv8 推理可视化图片
│   ├── 📁 network_img/          # 网络架构图
│   ├── 📁 bg/                   # 门户背景图
│   └── 📁 icon/                 # 静态图标资源
│
├── 📁 assets/                   # README 展示图片
│   ├── banner.png
│   ├── spatial_view.png
│   ├── semantic_view.png
│   ├── pose_view.png
│   ├── 类别先验偏差分析.png
│   ├── 空间先验实验.png
│   └── 综合姿态及模型分析.png
│
└── 📄 presentation.typ          # Typst 演示文稿
```

-----

## ❓ 常见问题

### 1\. 安装模块速度慢？

```bash
# 切换到国内镜像源
npm config set registry [https://registry.npmmirror.com](https://registry.npmmirror.com)
```

### 2\. 需要运行 Python 脚本吗？

**不需要**。项目中 `src/data/` 目录下已经包含了所有可视化所需的预处理数据（JSON 和 JPG）。Python 脚本仅供查阅数据处理逻辑或重新生成数据使用。

### 3\. 端口被占用？

修改 `package.json` 中的启动命令：

```json
"scripts": {
    "start": "parcel serve src/index.html --port 3000"
}
```

-----

## 👥 团队成员

| 成员 | 负责模块 |
|------|----------|
| 成员 A | 空间视图、数据处理 |
| 成员 B | 语义视图、交互设计 |
| 成员 C | 姿态视图、门户设计 |

-----

## 📜 许可证

本项目仅用于课程学习，数据来源于 [COCO Dataset](https://cocodataset.org/)。

-----

<p align="center">
  <b>COCO-Verse</b> · Decoding Common Objects in Context<br>
  Made with ❤️ for Data Visualization Course
</p>