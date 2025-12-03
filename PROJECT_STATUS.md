# COCO-Verse 项目进度跟踪

> 最后更新：2025年11月27日

## 📊 项目概览

本项目是一个 **COCO 2017 数据集多视图可视化分析系统**，包含三个核心视图：

| 视图 | 状态 | 负责人 |
|------|------|--------|
| 语义共现网络 | ✅ 已完成 | - |
| 空间/尺度视图 | ✅ 已完成 | - |
| 姿态/骨架视图 | ✅ 已完成 | - |

---

## ✅ 已完成任务

### 1. 语义共现网络 (Semantic View)
- [x] 数据处理脚本 `process_semantic.py`
- [x] 力导向图可视化 `semantic_graph.js`
- [x] 节点交互（点击锁定、双击排除、拖拽）
- [x] 共现阈值滑块筛选
- [x] 条件概率侧边栏展示
- [x] 静态图片弹窗（频次分布、条件概率矩阵）

### 2. 空间/尺度视图 (Spatial View)
- [x] 数据处理脚本 `process_spatial.py`
- [x] 空间密度热力图（20×20 网格）
- [x] 尺寸-宽高比散点图（支持 Brush 选择）
- [x] 类别尺度分布堆叠条形图
- [x] 统计摘要面板
- [x] 类别下拉筛选联动
- [x] Brush 选择联动热力图更新
- [x] 集成到主页面

---

## ⏳ 待完成任务

### 3. 姿态/骨架视图 (Pose View)
- [ ] 编写 `process_pose.py` 处理 `person_keypoints_train2017.json`
- [ ] 生成 `pose_stats.json`（关键点均值、方差、可见性）
- [ ] 概率骨架可视化（17 个关键点 + 热力光晕）
- [ ] 可变形骨架探针（按场景过滤后的平均姿态）
- [ ] 置信度滑块筛选
- [ ] 骨架形变动画
- [ ] 集成到主页面

### 4. 高级交互 (Cross-Filtering)
- [ ] 全局状态管理器 (GlobalStateManager)
- [ ] 事件总线 (d3.dispatch)
- [ ] 跨视图联动（语义 ↔ 空间 ↔ 姿态）
- [ ] Tooltip Lens（悬停显示图像缩略图）

---

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 生成数据文件
```bash
# 语义数据（已有）
python process_semantic.py

# 空间数据（新增）
python process_spatial.py

# 姿态数据（待开发）
python process_pose.py
```

### 3. 启动开发服务器
```bash
npm start
```

访问 http://localhost:8080

---

## 📁 项目结构

```
Data-Visualization-Coursework/
├── package.json
├── process_semantic.py      # 语义数据处理
├── process_spatial.py       # 空间数据处理 
├── process_pose.py          # 姿态数据处理 ✅ 新增
├── src/
│   ├── index.html           # 主页面
│   ├── data/
│   │   ├── instances_train2017.json     # COCO 原始数据
│   │   ├── person_keypoints_train2017.json
│   │   ├── semantic_data.json           # 语义共现数据
│   │   └── spatial_data.json            # 空间尺度数据 
│   │   └── pose_stats.json              # 姿态数据 ✅ 新增
│   ├── icon/                # 静态图片资源
│   └── js/
│       ├── semantic_graph.js     # 语义视图
│       ├── spatial_view.js       # 空间视图 
│       └── pose_view.js          # 姿态视图 ✅ 新增
```

---

## 📋 任务分工建议

| 角色 | 负责模块 | 技术栈 |
|------|----------|--------|
| 数据架构师 | Python 数据管道、JSON 生成 | Python, Pandas |
| 交互工程师 | 空间视图、Brush 交互 | D3.js, Canvas |
| 动画工程师 | 姿态视图、骨架动画 | D3.js, SVG 动画 |

---

## 🐛 已知问题

1. 空间数据需要手动运行 `python process_spatial.py` 生成
2. 姿态视图尚未实现
3. 跨视图联动尚未实现

---

## 📝 更新日志

### 2025-11-27
- ✅ 新增 `process_spatial.py` 空间数据处理脚本
- ✅ 新增 `spatial_view.js` 空间视图模块
- ✅ 实现空间密度热力图
- ✅ 实现尺寸-宽高比散点图 + Brush 选择
- ✅ 实现类别尺度分布堆叠条形图
- ✅ 集成到主页面

## 2025-11-29
- ✅ 新增 `process_pose.py` 姿势数据处理脚本
- ✅ 新增 `pose_view.js` 姿势视图模块
- ✅ 实现骨架分布图
- ✅ 实现环形图 + 节点 选择
- ✅ 集成到主页面

## 2025-12-3
这是一个针对 **COCO-Verse 门户主页（Portal）** 的完整、最终版设计方案。

本方案严格整合了你提供的 **4 张 AI 背景图** (`bg_*.png`) 和 **4 张预处理 Hero 图** (`hero_*.png/jpg`)，并深度强化了 **“从微观样本（Micro-Sample）到宏观聚合（Macro-Aggregate）”** 的核心叙事逻辑。

---

# 📁 COCO-Verse 门户体验设计方案：从微观样本到宏观洞察

## 1. 核心设计哲学：双层视觉架构 (Dual-Layer Visual Architecture)

为了营造深度感，我们构建了一个**“背景氛围 + 前景数据”**的双层舞台。

* **底层 (Context Layer - Z0)：** 由你提供的 `bg_*.png` 组成。它们是全屏、静止的，负责提供**抽象的语境**（如：这是户外、这是社交网络、这是生物特征）。它们永远处于底层，透过暗色遮罩隐约可见。
* **中层 (Evidence Layer - Z10)：** 由预生成的 `hero_*.png` 组成。它们是**具象的证据**，展示机器在单张图片（ID 457718）上具体看到了什么。它们位于屏幕中央，随滚动发生形态突变。

---

## 2. 详细分镜脚本与文案设计 (Detailed Storyboard)

整个滚动过程分为四个章节。每个章节都必须清晰地向用户传达：**“你现在看到的是对仅仅一张图片的分析。”**

### 🎬 序幕：样本载入 (Scene 0: Sample Injection)

* **视觉配置：**
    * **背景 (BG):** `bg_intro_lens.png` (5.4MB)。巨大的相机镜头/视网膜结构，暗示视觉系统的启动。
    * **主体 (Hero):** `hero_image.jpg` (219KB)。原始、清晰、明亮的户外聚餐照片。
* **叙事意图：** 模拟数据输入的瞬间。
* **UI 文案：**
    * **主标题：** **COCO-Verse**
    * **副标题：** **Decoding Common Objects in Context** (解码语境中的常见物体)
    * **右上角状态栏：**
        * `SYSTEM STATUS: INITIALIZING...`
        * `INPUT SOURCE: COCO 2017 VAL SET`
        * `CURRENT SAMPLE ID: 457718`
    * **底部引导：** "Scroll to Initialize Perception Pipeline ↓"

### 📦 第一章：空间定界 (Scene 1: Spatial Detection)

* **视觉配置：**
    * **背景 (BG):** `bg_spatial_outdoor.png` (6.1MB)。抽象的户外点云/线框网格，与前景的户外场景完美呼应，暗示机器正在重构三维空间。
    * **主体 (Hero):** `hero_spatial.png` (278KB)。画面变暗，青色的边界框 (Bounding Boxes) 浮现。
* **叙事意图：** 展示机器如何将混沌的像素转化为有序的区域。
* **UI 文案：**
    * **章节标题：** **01. Object Localization** (物体定位)
    * **叙事正文：** “机器认知的起点是定义边界。在这张单一样本中，算法识别并定位了 **52 个实例**。这仅仅是开始——在整个数据集中，我们以此方法标注了超过 **860,000 个** 物体的精确坐标与尺度。”
    * **数据注解 (左侧悬浮)：**
        * `Detected: 52 Instances`
        * `Categories: Dining Table, Person, Chair...`
        * `Spatial Logic: Bounding Box (x, y, w, h)`

### 🕸️ 第二章：语义编织 (Scene 2: Semantic Context)

* **视觉配置：**
    * **背景 (BG):** `bg_semantic_social.png` (5.3MB)。发光的社交网络节点图，暗示人物与物体之间的隐形连接。
    * **主体 (Hero):** `hero_semantic.png` (511KB)。青色框消失，紫色的星型网络浮现，连接着餐桌与周围的人。
* **叙事意图：** 展示孤立物体如何通过“共现”产生深层意义。
* **UI 文案：**
    * **章节标题：** **02. Contextual Logic** (上下文逻辑)
    * **叙事正文：** “餐桌定义了盘子，人定义了椅子。万物皆有关联。基于图论算法，我们计算了 **80 个类别** 之间数百万次的共现概率，构建出视觉世界的知识图谱。”
    * **数据注解 (左侧悬浮)：**
        * `Graph Topology: Star Network`
        * `Core Node: Dining Table`
        * `Relation Type: Co-occurrence`

### 🦴 第三章：姿态透视 (Scene 3: Pose Estimation)

* **视觉配置：**
    * **背景 (BG):** `bg_pose_biometric.png` (5.4MB)。极具科技感的生物特征扫描蓝图，线条冷峻。
    * **主体 (Hero):** `hero_pose.png` (424KB)。背景几乎全黑，高亮的粉色骨架透视出人物的姿态。
* **叙事意图：** 展示机器对“生命体”的深层结构理解。
* **UI 文案：**
    * **章节标题：** **03. Biological Structure** (生物结构)
    * **叙事正文：** “穿越表象，锁定骨骼。对于数据集中超过 **250,000 个** 标记了关键点的人体目标，我们提取了 **17 个解剖学关键点**，以解析人类在复杂场景中的姿态与行为模式。”
    * **数据注解 (左侧悬浮)：**
        * `Target: Person (Category ID: 1)`
        * `Keypoints: 17 per Subject`
        * `Skeleton: COCO Standard Topology`

---

## 3. 转换枢纽：门户导航 (The Macro Handoff)

当用户滚动过第三章，背景图像保持为 `bg_pose_biometric.png`（或淡出至纯黑），主体图片 `hero_pose.png` 保持静止。此时，文字层发生质变，变为交互式的 **Bento Grid**。

**文案核心策略：** 明确告知用户，演示结束，现在要把视角从“1”拉大到“123,287”。

* **总标题：** **Sample Processing Complete.** (样本处理完毕)
* **副标题：** "You have seen how we analyze one image. Now, explore the insights from the full dataset." (你已了解我们如何分析一张图片。现在，请探索全量数据集的洞察。)

### 导航卡片文案 (The Entry Points)

* **卡片 A [Spatial View]**
    * **标题：** **Spatial Dashboard**
    * **描述：** “探索 **123,287 张图片** 中的物体分布。查看大、中、小目标的尺度差异与空间热力图。”
    * **按钮：** `Launch Spatial Analysis`

* **卡片 B [Semantic View]**
    * **标题：** **Semantic Dashboard**
    * **描述：** “可视化 **80 个类别** 的概率网络。发现哪些物体倾向于同时出现，揭示场景背后的语义逻辑。”
    * **按钮：** `Launch Semantic Analysis`

* **卡片 C [Pose View]**
    * **标题：** **Pose Dashboard**
    * **描述：** “深入人体结构数据。分析 **25 万人** 的 17 个关键点可见性统计与骨架不确定性。”
    * **按钮：** `Launch Pose Analysis`

---

## 4. 关键交互：从微观到宏观的视觉转场 (The "Zoom-Out" Transition)

这是用户点击任意卡片后发生的**无缝转换逻辑**。必须传达出“样本归档，大数据浮现”的感觉。

**触发动作：** 用户点击“Semantic Dashboard”卡片。

**阶段 1：样本归档 (Archive the Sample)**
* **视觉动作：** 屏幕中央的那张 `hero_pose.png`（代表微观样本）并不是简单消失，而是**迅速缩小 (Scale Down)** 到屏幕中央的一个点，并变得**模糊**。
* **背景变化：** 与此同时，背景中的 `bg_pose_biometric.png` 迅速向后退去，透明度降低。
* **隐喻：** 这张具体的图片正在退回到由十万张图片组成的巨大数据库深处。它不再是主角，它只是数据库中的一个数据点。

**阶段 2：数据涌现 (Data Emerge)**
* **视觉动作：** 在刚才图片消失的同一个中心点，**Semantic View** 的力导向图节点（代表宏观数据）像**爆炸**一样向四周扩散开来，填满屏幕。
* **文字提示：** 在转场的一瞬间（约 0.5 秒），屏幕中央闪现一行小字：`AGGREGATING DATA FROM 123,287 IMAGES...`
* **最终状态：** 故事层（Portal Layer）完全隐藏，仪表盘层（Dashboard Layer）完全接管屏幕，用户可以开始交互。

**阶段 3：逆向返回 (The Return)**
* **操作：** 用户点击仪表盘左上角的 `← Back to Portal`。
* **视觉动作：** 复杂的图表迅速收缩回中心点，然后 `hero_pose.png` 从中心点放大浮现，背景图重新亮起。用户瞬间回到了那个具体的样本情境中。

---

## 5. 方案总结

此方案完美利用了你现有的资源：
1.  **AI 背景图 (`bg_*.png`)** 提供了宏大的、科技感的**语境**。
2.  **预处理 Hero 图 (`hero_*.png`)** 提供了精确的、像素级的**证据**。
3.  **叙事文案** 将单一图片的分析过程上升到了 **COCO 数据集** 的高度，解决了“用户不知道这是全量分析”的痛点。
4.  **转场动画** 物理化地演示了“Sample (1)” 与 “Dataset (All)” 之间的包含关系。

## todo
CoCo数据集的概览，包括数据集的规模、类别、标注方式等。
histogram-node\src\data\overview.jpg