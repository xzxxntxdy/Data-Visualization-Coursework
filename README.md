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

<!-- 📸 占位图：portal_demo.gif - 门户滚动动画演示 -->

- **滚动叙事**：从单张样本图片出发，逐步展示空间定位、语义编织、姿态透视三个分析阶段
- **双层视觉架构**：AI 生成的抽象背景 + 真实样本的分析叠加层
- **无缝转场**：从微观样本到宏观数据集的视觉过渡

### 📍 空间与尺度视图 (Spatial View)

<p align="center">
  <img src="/images/spatial_view.png" alt="Spatial View" width="80%">
</p>

<!-- 📸 占位图：spatial_view.png - 空间视图完整界面截图 -->

- **等高线密度热力图**：可视化物体中心点的空间分布
- **位置×尺度散点图**：探索目标位置与相对面积的关系
- **类别尺度分布**：比较不同类别的小/中/大目标占比
- **Cross-Filtering 联动**：框选空间区域，联动更新其他图表
- **完整 80 类支持**：下拉选择器支持搜索全部类别

### 🕸️ 语义共现网络 (Semantic View)

<p align="center">
  <img src="/images/semantic_view.png" alt="Semantic View" width="80%">
</p>

<!-- 📸 占位图：semantic_view.png - 语义视图完整界面截图 -->

- **力导向图**：节点大小映射类别频次，边粗细映射共现强度
- **条件概率侧边栏**：显示选中类别与其他类别的条件概率
- **共现阈值筛选**：滑块控制显示的最小共现次数
- **节点交互**：点击锁定、双击排除、拖拽调整

### 🦴 人体姿态视图 (Pose View)

<p align="center">
  <img src="/images/pose_view.png" alt="Pose View" width="80%">
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

---

## 🚀 快速开始

### 环境要求

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

---

## 📁 项目结构

```
Data-Visualization-Coursework/
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

---

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

---

## 👥 团队成员

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