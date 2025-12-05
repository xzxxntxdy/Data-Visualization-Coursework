<<<<<<< HEAD
# 🌌 COCO-Verse：多视图可视化分析系统

<p align="center">
  <img src="docs/images/banner.png" alt="COCO-Verse Banner" width="100%">
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
=======
# COCO-Verse: 多视图数据可视化分析系统

<div align="center">

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![D3.js](https://img.shields.io/badge/D3.js-v7.4.4-orange.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

**基于 COCO 2017 数据集的交互式可视化分析平台**

[功能特性](#功能特性) • [快速开始](#快速开始) • [项目结构](#项目结构) • [技术栈](#技术栈) • [使用说明](#使用说明)

</div>

---

## 📖 项目简介

**COCO-Verse** 是一个针对 COCO 2017 数据集（Common Objects in Context）设计的多维度可视化分析系统。该项目通过三个核心视图深度挖掘计算机视觉数据集的内在特征，帮助研究者、数据科学家和机器学习工程师更好地理解数据集的分布规律、类别关系和目标特征。

### 核心价值

- 🔍 **深度洞察**：揭示 COCO 数据集中 80 个类别间的语义共现关系
- 📊 **多维分析**：从空间、尺度、姿态三个维度全面解析目标特征
- 🎨 **交互探索**：提供丰富的交互式操作，支持动态筛选和跨视图联动
- 🚀 **性能优化**：采用数据采样和预聚合策略，确保流畅的可视化体验
>>>>>>> e5370d800bfd33b28a36a8756e683e6cfc0f6d7a

---

## ✨ 功能特性

<<<<<<< HEAD
### 🏠 沉浸式门户 (Portal)

<p align="center">
  <img src="docs/images/portal_demo.png" alt="Portal Demo" width="80%">
</p>

<!-- 📸 占位图：portal_demo.gif - 门户滚动动画演示 -->

- **滚动叙事**：从单张样本图片出发，逐步展示空间定位、语义编织、姿态透视三个分析阶段
- **双层视觉架构**：AI 生成的抽象背景 + 真实样本的分析叠加层
- **无缝转场**：从微观样本到宏观数据集的视觉过渡

### 📍 空间与尺度视图 (Spatial View)

<p align="center">
  <img src="docs/images/spatial_view.png" alt="Spatial View" width="80%">
</p>

<!-- 📸 占位图：spatial_view.png - 空间视图完整界面截图 -->

- **等高线密度热力图**：可视化物体中心点的空间分布
- **位置×尺度散点图**：探索目标位置与相对面积的关系
- **类别尺度分布**：比较不同类别的小/中/大目标占比
- **Cross-Filtering 联动**：框选空间区域，联动更新其他图表
- **完整 80 类支持**：下拉选择器支持搜索全部类别

### 🕸️ 语义共现网络 (Semantic View)

<p align="center">
  <img src="docs/images/semantic_view.png" alt="Semantic View" width="80%">
</p>

<!-- 📸 占位图：semantic_view.png - 语义视图完整界面截图 -->

- **力导向图**：节点大小映射类别频次，边粗细映射共现强度
- **条件概率侧边栏**：显示选中类别与其他类别的条件概率
- **共现阈值筛选**：滑块控制显示的最小共现次数
- **节点交互**：点击锁定、双击排除、拖拽调整

### 🦴 人体姿态视图 (Pose View)

<p align="center">
  <img src="docs/images/pose_view.png" alt="Pose View" width="80%">
</p>

<!-- 📸 占位图：pose_view.png - 姿态视图完整界面截图 -->

- **概率骨架图**：17 个关键点的可见性热力光晕
- **关键点环形图**：各关键点的可见性统计分布
- **骨架连接可视化**：标准 COCO 骨架拓扑结构
- **场景过滤**：按共现物体筛选姿态子集

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        COCO-Verse 系统架构                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Portal     │    │  Dashboard   │    │  Cross-Filter│      │
│  │  (story_main)│───▶│   (Views)    │◀──▶│   (Events)   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    D3.js 可视化层                         │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│  │  │ Contour │  │ Scatter │  │  Force  │  │Skeleton │    │   │
│  │  │ Density │  │  Plot   │  │  Graph  │  │  Pose   │    │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    数据处理层 (Python)                    │   │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  │   │
│  │  │process_spatial│ │process_semantic│ │ process_pose │  │   │
│  │  └───────────────┘ └───────────────┘ └───────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              COCO 2017 原始数据 (JSON)                   │   │
│  │  instances_train2017.json  person_keypoints_train2017.json  │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
=======
### 1️⃣ 语义共现网络 (Semantic Co-occurrence Network)

基于力导向图（Force-Directed Graph）的类别关系可视化，展示 COCO 数据集中不同物体类别在同一图像中共同出现的频率和概率。

**核心功能：**
- 🎯 **节点交互**
  - 单击锁定节点，高亮显示邻居关系
  - 双击排除节点，过滤无关类别
  - 拖拽调整节点位置
- 📈 **阈值筛选**：通过滑块动态调整共现阈值，过滤弱关联边
- 📊 **统计面板**：实时展示选中节点的条件概率分布
- 🖼️ **静态分析图**：弹窗查看频次分布和条件概率矩阵热力图

**数据洞察：**
- 揭示"人物-物品"（如 person ↔ chair）、"场景-对象"（如 dining table ↔ bowl）等典型共现模式
- 识别"孤立类别"（如 traffic light、stop sign）在数据集中的独立性

---

### 2️⃣ 空间/尺度分析视图 (Spatial & Scale Analysis)

采用多图表组合分析目标在图像中的空间分布和尺度特征。

**核心功能：**
- 🗺️ **空间密度热力图**
  - 20×20 网格聚合的 2D 密度分布
  - 颜色映射从蓝色（低密度）到红色（高密度）
- 📐 **尺寸-宽高比散点图**
  - X 轴：归一化宽度（0-1）
  - Y 轴：归一化高度（0-1）
  - 点大小：目标面积
  - 支持 Brush 框选交互
- 📊 **类别尺度分布堆叠条形图**
  - 按 COCO 官方标准划分 small/medium/large 三档
  - 堆叠展示各类别在不同尺度的占比
- 🔄 **联动交互**
  - 类别下拉筛选自动更新所有子图
  - Brush 选择同步更新热力图和统计面板

**数据洞察：**
- 发现目标的"中心偏好"（多数目标集中在图像中心区域）
- 识别"尺度偏差"（如 person 多为 medium/large，fork 多为 small）

---

### 3️⃣ 姿态/骨架分析视图 (Pose & Skeleton Analysis)

针对人体关键点数据的概率骨架可视化（基于 person_keypoints 标注）。

**核心功能：**
- 🦴 **人体节点分析图**
  - 在标准化坐标空间（0-1）中绘制 17 个 COCO 关键点的平均位置
  - 使用高饱和度鲜艳色彩区分不同关键点（头部、躯干、四肢）
  - 平滑曲线连接骨骼，骨架绘制采用入场动画
  - 每个关键点配有淡雅网格背景，便于空间定位
- 🎯 **不确定性可视化**
  - **1σ 核心边界**：实线椭圆表示 68% 置信区间
  - **3σ 最大边界**：虚线椭圆表示 99.7% 置信区间  
- 🕸️ **可见性环形图**
  - 17 个关键点按环形排列，扇区半径表示可见性概率
  - 彩色扇区和珠子（beads）采用与节点一致的高亮配色
  - 支持悬停聚焦，自动淡化非相关关键点
  - 扇形渐进式入场动画，增强视觉吸引力
- 🔄 **跨图联动交互**
  - 在任一图表中悬停关键点，另一图表同步高亮
  - Voronoi 区域检测实现精准的悬停感知
  - 实时显示详细统计信息（坐标、偏差、可见性）


**数据洞察：**
- 揭示人体关键点在空间中的平均分布（如头部集中在上方，脚踝在下方）
- 通过误差椭圆识别不稳定关键点（如手腕、脚踝的方差较大）
- 可见性雷达图直观对比各关键点的标注质量（如躯干关键点可见性通常高于四肢末端）
- 分析对称性：左右关键点（如左右肩、左右髋）的统计特征对比
>>>>>>> e5370d800bfd33b28a36a8756e683e6cfc0f6d7a

---

## 🚀 快速开始

### 环境要求

<<<<<<< HEAD
- **Node.js** >= 14.0
- **npm** >= 6.0
- **Python** >= 3.7 (用于数据预处理)

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/xzxxntxdy/Data-Visualization-Coursework.git
cd Data-Visualization-Coursework

# 2. 安装 Node.js 依赖
npm install

# 3. 下载 COCO 数据集标注文件（如尚未下载）
# 将以下文件放入 src/data/ 目录：
# - instances_train2017.json
# - person_keypoints_train2017.json

# 4. 生成预处理数据
python process_semantic.py   # 生成 semantic_data.json
python process_spatial.py    # 生成 spatial_data.json
python process_pose.py       # 生成 pose_stats.json

# 5. 启动开发服务器
npm start
```

### 访问应用

打开浏览器访问 **http://localhost:8080**

---

## 📊 数据处理

### 数据流程图

```
COCO 原始数据                    预处理脚本                     前端 JSON
─────────────                   ─────────────                  ──────────
instances_train2017.json  ───▶  process_spatial.py  ───▶  spatial_data.json
        │                              │                        (8,000 采样)
        │                              │
        └──────────────────▶  process_semantic.py  ───▶  semantic_data.json
                                       │                    (80 类共现矩阵)
                                       │
person_keypoints_train2017.json ───▶  process_pose.py  ───▶  pose_stats.json
                                                            (17 关键点统计)
```

### 数据文件说明

| 文件 | 大小 | 内容 |
|------|------|------|
| `spatial_data.json` | ~2MB | 8,000 条采样标注、80 类别统计、20×20 空间网格 |
| `semantic_data.json` | ~500KB | 80×80 共现矩阵、条件概率、类别频次 |
| `pose_stats.json` | ~100KB | 17 关键点可见性统计、骨架连接定义 |

---

## 📖 视图详解

### 1. 空间与尺度视图

#### 可视映射

| 视觉通道 | 数据属性 |
|----------|----------|
| 等高线颜色深度 | 物体中心点密度 |
| 散点 X 坐标 | 归一化水平位置 (0~1) |
| 散点 Y 坐标 | 相对面积 (对数刻度) |
| 散点颜色 | 尺度类别 (小/中/大) |
| 条形长度 | 各尺度类别占比 |

#### 交互设计

```
框选空间热力图区域
        │
        ├──▶ 散点图高亮选中区域的点
        │
        └──▶ 类别分布图更新为选中区域的统计

点击类别分布图的某一类
        │
        ├──▶ 热力图叠加该类别的点分布
        │
        └──▶ 散点图高亮该类别
```

### 2. 语义共现网络

#### 可视映射

| 视觉通道 | 数据属性 |
|----------|----------|
| 节点大小 | 类别出现频次 |
| 节点颜色 | 超类别 (supercategory) |
| 边粗细 | 共现次数 |
| 边透明度 | 共现强度 |

#### 交互设计

- **单击节点**：锁定显示该节点的条件概率
- **双击节点**：从图中排除该节点
- **拖拽节点**：调整节点位置
- **滑块筛选**：过滤共现次数低于阈值的边

### 3. 人体姿态视图

#### 可视映射

| 视觉通道 | 数据属性 |
|----------|----------|
| 关键点大小 | 可见性概率 |
| 关键点颜色 | 身体部位分组 |
| 骨架连线 | COCO 标准骨架定义 |
| 热力光晕 | 位置不确定性 |

---

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
| JSON | 数据交换格式 |

### 设计系统

```javascript
const DESIGN = {
    colors: {
        primary: "#3b82f6",      // 主强调色
        scale: {
            small: "#10b981",    // 翡翠绿
            medium: "#f59e0b",   // 琥珀橙
            large: "#ef4444",    // 玫瑰红
        },
    },
    font: {
        title: { size: "15px", weight: 600 },
        caption: { size: "11px", weight: 400 },
    },
};
```
=======
- **Node.js**: ≥ 14.0.0
- **npm**: ≥ 6.0.0
- **浏览器**: 支持 ES6+ 的现代浏览器（Chrome、Firefox、Edge、Safari）

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/xzxxntxdy/Data-Visualization-Coursework.git
cd Data-Visualization-Coursework
```

2. **安装依赖**
```bash
npm install
# 或使用国内镜像加速
npm install --registry=https://registry.npmmirror.com
```

3. **准备数据文件**

请从 [COCO 官网](https://cocodataset.org/#download) 下载以下文件并放置在 `src/data/` 目录下：
- `instances_train2017.json` (241 MB)
- `person_keypoints_train2017.json` (439 MB)

4. **生成可视化数据**
```bash
# 生成语义共现数据
python process_semantic.py

# 生成空间/尺度数据
python process_spatial.py

# 生成姿态骨架数据
python process_pose.py
```

5. **启动开发服务器**
```bash
npm start
```

6. **访问应用**

打开浏览器访问 http://localhost:8080
>>>>>>> e5370d800bfd33b28a36a8756e683e6cfc0f6d7a

---

## 📁 项目结构

```
Data-Visualization-Coursework/
<<<<<<< HEAD
│
├── 📄 package.json              # 项目配置
├── 📄 README.md                 # 项目说明（本文件）
├── 📄 PROJECT_STATUS.md         # 开发进度跟踪
│
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
│   │   ├── instances_train2017.json      # COCO 实例标注
│   │   ├── person_keypoints_train2017.json
│   │   ├── semantic_data.json            # 预处理：语义
│   │   ├── spatial_data.json             # 预处理：空间
│   │   └── pose_stats.json               # 预处理：姿态
│   │
│   ├── 📁 bg/                   # 门户背景图
=======
├── package.json                      # 项目配置文件
├── README.md                         # 项目说明文档
├── PROJECT_STATUS.md                 # 开发进度跟踪
├── process_semantic.py               # 语义数据处理脚本
├── process_spatial.py                # 空间数据处理脚本
├── process_pose.py                   # 姿态数据处理脚本
├── generate_hero_layers.py           # 生成英雄图层脚本
├── convert.py                        # 数据转换工具
├── find_image.py                     # 图像查找工具
├── src/
│   ├── index.html                    # 主页面 HTML
│   ├── bg/                           # 背景图资源
>>>>>>> e5370d800bfd33b28a36a8756e683e6cfc0f6d7a
│   │   ├── bg_intro_lens.png
│   │   ├── bg_spatial_outdoor.png
│   │   ├── bg_semantic_social.png
│   │   └── bg_pose_biometric.png
<<<<<<< HEAD
│   │
│   └── 📁 icon/                 # 静态图标资源
│
├── 📄 main.typ                  # Typst 演示文稿
└── 📄 main.sty                  # LaTeX 样式（可选）
=======
│   ├── data/                         # 数据文件目录
│   │   ├── semantic_data.json        # 语义共现数据
│   │   ├── spatial_data.json         # 空间尺度数据
│   │   ├── pose_stats.json           # 姿态统计数据
│   │   ├── hero_data.json            # 英雄图层数据
│   │   └── *.jpg                     # 示例图像
│   ├── icon/                         # 图标资源
│   └── js/                           # JavaScript 模块
│       ├── story_main.js             # 主故事逻辑（Portal 层）
│       ├── semantic_graph.js         # 语义网络可视化
│       ├── spatial_view_v2.js        # 空间视图可视化
│       ├── pose_view.js              # 姿态视图可视化
│       └── distribution_matrix.js    # 分布矩阵工具
└── dist/                             # 构建输出目录（自动生成）
>>>>>>> e5370d800bfd33b28a36a8756e683e6cfc0f6d7a
```

---

<<<<<<< HEAD
## ❓ 常见问题

### 1. 安装模块速度慢？

```bash
# 切换到国内镜像源
npm config set registry https://registry.npmmirror.com
```

### 2. 缺少数据文件？

确保已运行数据预处理脚本：

```bash
python process_semantic.py
python process_spatial.py
python process_pose.py
```

### 3. 端口被占用？

修改 `package.json` 中的启动命令：

```json
"scripts": {
    "start": "parcel serve src/index.html --port 3000"
}
```

### 4. Parcel 缓存问题？

```bash
# Windows
rmdir /s /q .cache dist

# macOS/Linux
rm -rf .cache dist

# 重新启动
npm start
```

=======
## 🛠️ 技术栈

### 前端框架与库

| 技术 | 版本 | 用途 |
|------|------|------|
| **D3.js** | 7.4.4 | 核心可视化库（力导向图、热力图、散点图） |
| **d3-hexbin** | 0.2.2 | 六边形分箱聚合 |
| **Parcel** | 1.12.5 | 零配置打包工具（开发服务器 + 热更新） |

### 后端数据处理

| 技术 | 用途 |
|------|------|
| **Python 3.x** | 数据预处理脚本 |
| **NumPy** | 数值计算和统计分析 |
| **JSON** | 数据序列化和存储 |

### 核心算法

- **Force Simulation**: D3.js 力导向布局算法
- **Gaussian KDE**: 核密度估计（用于空间热力图）
- **Weighted Average**: 加权平均计算（用于姿态骨架）

---

## 📚 使用说明

### 语义共现网络操作指南

1. **探索类别关系**
   - 节点大小表示类别在数据集中的出现频次
   - 连线粗细表示两类别共同出现的次数
   
2. **交互操作**
   - **单击节点**：锁定该类别，高亮显示所有相关连线
   - **双击节点**：排除该类别（节点变为灰色），可再次双击恢复
   - **拖拽节点**：手动调整节点位置，便于观察局部结构
   
3. **筛选控制**
   - 拖动"共现阈值"滑块过滤弱关联（如 < 100 次共现）
   - 点击"重置所有筛选"恢复初始状态
   
4. **查看详细统计**
   - 右侧面板显示选中类别的条件概率 P(B|A)
   - 点击"查看静态分析图"查看频次分布和概率矩阵

### 空间/尺度视图操作指南

1. **类别筛选**
   - 使用顶部下拉菜单选择特定类别
   - 选择"All Categories"查看全数据集统计
   
2. **Brush 交互**
   - 在散点图中按住鼠标拖拽框选区域
   - 热力图自动更新为选中样本的密度分布
   
3. **数据解读**
   - 热力图颜色越红表示该区域目标密度越高
   - 散点图中点的大小表示 BBox 面积（越大越显著）
   - 堆叠条形图展示各类别在 small/medium/large 的占比

### 姿态/骨架视图操作指南

1. **探索关键点分布**
   - 左侧"人体节点分析"图展示 17 个关键点在标准化坐标空间的平均位置
   - 右侧"可见性环形展示"用扇区半径直观表示各关键点的可见性概率
   
2. **交互悬停探索**
   - **悬停关键点**：在任一图表中移动鼠标到关键点附近
   - **自动高亮**：当前关键点放大并显示误差边界（1σ/3σ椭圆和概率密度场）
   - **跨图联动**：两个图表同步高亮同一关键点
   - **详细信息**：工具提示显示关键点名称、所属部位、可见性、坐标、偏差值
   
3. **解读可视化元素**
   - **节点颜色**：每个关键点有独特的高饱和度颜色（头部、躯干、左臂、右臂、左腿、右腿分组）
   - **骨架连线**：深灰色平滑曲线表示人体骨骼拓扑（如肩-肘-腕、髋-膝-踝）
   - **误差椭圆**：
     - 实线椭圆 = 1σ（68% 置信区间）
     - 虚线椭圆 = 3σ（99.7% 置信区间）
     - 椭圆越大表示该关键点位置越不稳定
   - **概率密度场**：彩色渐变光晕覆盖 3σ 范围，中心最亮
   - **雷达图扇区**：扇区半径越长，该关键点在数据集中被标注的概率越高
   
4. **观察数据规律**
   - **对称性验证**：比较左右对称关键点（如左肩 vs 右肩）的可见性和位置偏差
   - **部位稳定性**：躯干关键点（肩、髋）通常误差较小；四肢末端（手腕、脚踝）误差较大
   - **可见性差异**：头部和躯干可见性通常 > 90%；手腕和脚踝可能 < 70%（易被遮挡）

---

## 🎯 数据处理说明

### process_semantic.py

**功能**：从 `instances_train2017.json` 提取类别共现矩阵

**输出**：`semantic_data.json`
```json
{
  "nodes": [
    {"id": 1, "name": "person", "count": 262465, "group": 1}
  ],
  "links": [
    {"source": 1, "target": 64, "value": 15234, "conditional_prob": {...}}
  ],
  "categoryCount": 80
}
```

**关键指标**：
- `count`: 类别在训练集中的总出现次数
- `value`: 两类别共同出现的图像数量
- `conditional_prob`: P(B|A) 条件概率矩阵

---

### process_spatial.py

**功能**：提取 BBox 的空间位置、尺寸、宽高比信息

**输出**：`spatial_data.json`
```json
{
  "samples": [
    {
      "id": 123456,
      "category_id": 1,
      "category_name": "person",
      "normalized_bbox": [0.32, 0.45, 0.15, 0.38],
      "area": 5120,
      "scale": "medium",
      "aspect_ratio": 0.395
    }
  ],
  "category_stats": {...},
  "spatial_grid": [...]
}
```

**采样策略**：
- 从训练集中随机采样 8000 个标注
- 保证各类别按比例分布
- 预聚合 20×20 空间网格密度

---

### process_pose.py

**功能**：统计人体关键点的平均位置、方差和可见性

**输出**：`pose_stats.json`
```json
{
  "overall": {
    "mean_keypoints": [...],  // 17×3 (x, y, visibility)
    "std_keypoints": [...],
    "num_samples": 5000
  },
  "by_scale": {...},
  "by_scene": {...}
}
```

**关键点编号**（COCO 17-point skeleton）：
```
0:鼻子, 1:左眼, 2:右眼, 3:左耳, 4:右耳, 5:左肩, 6:右肩,
7:左肘, 8:右肘, 9:左腕, 10:右腕, 11:左髋, 12:右髋,
13:左膝, 14:右膝, 15:左踝, 16:右踝
```

---

## 🎨 设计理念

### Portal 层设计

项目采用"Portal → Dashboard"的叙事结构：

1. **Intro 阶段**：项目介绍和数据集概览
2. **视图选择阶段**：通过鼠标滚轮切换 Spatial/Semantic/Pose 三个主题
3. **视图跃迁**：点击 CTA 按钮进入对应的交互式 Dashboard
4. **返回机制**：通过左上角"返回样本视图"按钮回到 Portal 层

### 视觉风格

- **配色方案**：深色背景 + 马卡龙色系节点/图表
- **交互反馈**：Hover 高亮 + Tooltip + 平滑过渡动画
- **响应式布局**：支持 1024px+ 分辨率的显示器

---

## 📊 性能优化

| 策略 | 说明 | 效果 |
|------|------|------|
| **数据采样** | 从 118k 标注中采样 8k 用于空间视图 | 渲染时间从 5s 降至 0.3s |
| **空间预聚合** | 20×20 网格预计算密度 | 热力图更新延迟 < 50ms |
| **力导向优化** | 限制最大迭代次数 300 | 语义网络初始化 < 2s |
| **Debounce** | 滑块输入防抖 120ms | 避免频繁重绘 |
| **Canvas 混合** | 姿态热力光晕使用 Canvas | 支持高分辨率骨架图 |

---

## 🐛 常见问题

### Q1: 运行 `npm install` 很慢怎么办？

**A**: 切换到国内镜像源：
```bash
npm config set registry https://registry.npmmirror.com
```

### Q2: 数据处理脚本报错 "FileNotFoundError"？

**A**: 请确保已下载 COCO 数据集文件并放置在 `src/data/` 目录：
- `instances_train2017.json`
- `person_keypoints_train2017.json`

### Q3: 页面空白或无法加载？

**A**: 请检查：
1. 是否运行了所有数据处理脚本（生成 JSON 文件）
2. 浏览器控制台是否有 CORS 错误（需通过 `npm start` 启动服务器，不能直接打开 HTML）
3. 是否使用了现代浏览器（不支持 IE）

### Q4: 语义网络节点重叠严重？

**A**: 尝试以下操作：
1. 拖拽节点手动调整位置
2. 刷新页面重新生成布局（力导向算法有随机性）
3. 提高共现阈值过滤部分节点

### Q5: 如何导出可视化结果？

**A**: 浏览器右键点击图表区域 → "另存为图片"，或使用截图工具。

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

>>>>>>> e5370d800bfd33b28a36a8756e683e6cfc0f6d7a
---

## 👥 团队成员

<<<<<<< HEAD
| 成员 | 负责模块 |
|------|----------|
| 成员 A | 空间视图、数据处理 |
| 成员 B | 语义视图、交互设计 |
| 成员 C | 姿态视图、门户设计 |

---

## 📜 许可证

本项目仅用于课程学习，数据来源于 [COCO Dataset](https://cocodataset.org/)。

---

<p align="center">
  <b>COCO-Verse</b> · Decoding Common Objects in Context<br>
  Made with ❤️ for Data Visualization Course
</p>
=======
- **项目负责人**: [xzxxntxdy](https://github.com/xzxxntxdy)


>>>>>>> e5370d800bfd33b28a36a8756e683e6cfc0f6d7a
