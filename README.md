# 🌌 COCO-Verse：多视图可视化分析系统

<p align="center">
  <img src="/images/banner.png" alt="COCO-Verse Banner" width="100%">
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
  <img src="/images/portal_demo.png" alt="Portal Demo" width="80%">
</p>

- **滚动叙事**：从单张样本图片出发，逐步展示空间定位、语义编织、姿态透视三个分析阶段
- **双层视觉架构**：AI 生成的抽象背景 + **真实样本的分析叠加层**
- **无缝转场**：从微观样本到宏观数据集的视觉过渡

### 📍 空间与尺度视图 (Spatial View)

<p align="center">
  <img src="/images/spatial_view.png" alt="Spatial View" width="80%">
</p>

- **等高线密度热力图**：可视化物体中心点的空间分布
- **位置×尺度散点图**：探索目标位置与相对面积的关系
- **类别尺度分布**：比较不同类别的小/中/大目标占比
- **Cross-Filtering 联动**：框选空间区域，联动更新其他图表
- **完整 80 类支持**：下拉选择器支持搜索全部类别

### 🕸️ 语义共现网络 (Semantic View)

<p align="center">
  <img src="/images/semantic_view.png" alt="Semantic View" width="80%">
</p>

- **力导向图**：节点大小映射类别频次，边粗细映射共现强度
- **条件概率侧边栏**：显示选中类别与其他类别的条件概率
- **共现阈值筛选**：滑块控制显示的最小共现次数
- **节点交互**：点击锁定、双击排除、拖拽调整

### 🦴 人体姿态视图 (Pose View)

<p align="center">
  <img src="/images/pose_view.png" alt="Pose View" width="80%">
</p>

- **概率骨架图**：17 个关键点的可见性热力光晕
- **关键点环形图**：各关键点的可见性统计分布
- **骨架连接可视化**：标准 COCO 骨架拓扑结构
- **场景过滤**：按共现物体筛选姿态子集

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
| `hero_image.jpg` | 变动 | 筛选出的最佳**讲故事图片** | **门户**背景、故事叙事 |
| `hero_data.json` | \~19 KB | `hero_image` 的所有标注数据 | **门户**叙事数据 |
| `overview.jpg` | \~538 KB | 随机采样的图片拼成的**概览图** | **门户**背景，展示数据集概貌 |
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
├── 🐍 find_image.py             # 生成门户主图及其数据
├── 🐍 save_overview.py          # 生成门户概览图
├── 🐍 process_semantic.py       # 语义数据处理脚本
├── 🐍 process_spatial.py        # 空间数据处理脚本
├── 🐍 process_pose.py           # 姿态数据处理脚本
│
├── 📁 src/
│   ├── 📄 index.html            # 主页面
│   │
│   ├── 📁 js/
│   │   ├── story_main.js        # 门户滚动叙事
│   │   ├── spatial_view.js      # 空间视图模块
│   │   ├── semantic_graph.js    # 语义视图模块
│   │   ├── pose_view.js         # 姿态视图模块
│   │   └── distribution_matrix.js
│   │
│   ├── 📁 data/
│   │   ├── instances_train2017.json      # COCO 实例标注 (部分或引用)
│   │   ├── person_keypoints_train2017.json
│   │   ├── hero_data.json                # 门户叙事数据
│   │   ├── semantic_data.json            # 预处理：语义
│   │   ├── spatial_data.json             # 预处理：空间
│   │   └── pose_stats.json               # 预处理：姿态
│   │
│   ├── 📁 bg/                   # 门户背景图
│   │   ├── bg_intro_lens.png
│   │   ├── bg_spatial_outdoor.png
│   │   ├── bg_semantic_social.png
│   │   └── bg_pose_biometric.png
│   │
│   └── 📁 icon/                 # 静态图标资源
│
├── 📄 main.typ                  # Typst 演示文稿
└── 📄 main.sty                  # LaTeX 样式（可选）
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

\<p align="center"\>
\<b\>COCO-Verse\</b\> · Decoding Common Objects in Context<br>
Made with ❤️ for Data Visualization Course
\</p\>