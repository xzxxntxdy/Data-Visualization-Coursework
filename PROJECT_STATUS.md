# COCO-Verse 项目进度跟踪

> 最后更新：2025年11月27日

## 📊 项目概览

本项目是一个 **COCO 2017 数据集多视图可视化分析系统**，包含三个核心视图：

| 视图 | 状态 | 负责人 |
|------|------|--------|
| 语义共现网络 | ✅ 已完成 | - |
| 空间/尺度视图 | ✅ 已完成 | - |
| 姿态/骨架视图 | ⏳ 待开发 | - |

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
├── process_spatial.py       # 空间数据处理 ✅ 新增
├── process_pose.py          # 姿态数据处理 ⏳ 待开发
├── src/
│   ├── index.html           # 主页面
│   ├── data/
│   │   ├── instances_train2017.json     # COCO 原始数据
│   │   ├── person_keypoints_train2017.json
│   │   ├── semantic_data.json           # 语义共现数据
│   │   └── spatial_data.json            # 空间尺度数据 ✅ 新增
│   ├── icon/                # 静态图片资源
│   └── js/
│       ├── semantic_graph.js     # 语义视图
│       ├── spatial_view.js       # 空间视图 ✅ 新增
│       └── pose_view.js          # 姿态视图 ⏳ 待开发
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
