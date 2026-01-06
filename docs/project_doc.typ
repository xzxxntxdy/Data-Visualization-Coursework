#import "template.typ": *

// 自定义简洁封面（覆盖模板封面）
#set page("a4")
#align(center)[
  #v(4cm)
  #text(size: 26pt, weight: "bold")[COCO-Verse：多视图可视化分析系统]

  #v(1cm)
  #text(size: 16pt)[数据可视化课程 · 项目文档]

  #v(2cm)
  #line(length: 50%, stroke: 0.5pt + gray)
  #v(1cm)

  #text(size: 14pt)[
    *组名*：你说的队 \
    *组员*：匡航逸、柯云超、谢博
  ]

  #v(3cm)
  #text(size: 12pt, fill: gray)[2026年1月]
]
#pagebreak()

// 使用模板的正文格式（跳过封面）
#show: project.with(
  course: "数据可视化",
  lab_name: "COCO-Verse",
  stu_name: "",
  stu_num: "",
  major: "",
  department: "",
  date: (2026, 1, 6),
  show_content_figure: true,
  watermark: "",
)

= 项目概述

== 项目背景

#indent() COCO (Common Objects in Context) 是计算机视觉领域最具影响力的大规模数据集之一。该数据集的丰富性为深入分析视觉数据中的模式和规律提供了独特的机会。本项目旨在通过交互式可视化手段，从空间分布、语义共现、人体姿态三个维度对 COCO 2017 数据集进行深入探索和分析。

== 项目目标

#indent() 本项目的核心目标是构建一个多视图可视化分析系统，帮助用户：
- 发现不同物体类别在图像中的空间分布规律
- 探索物体类别之间的语义共现关系
- 分析人体关键点的可见性和姿态分布特征
- 揭示深度学习模型从数据中学到的隐性偏差

= 数据描述

== 数据集概述

#indent() 本项目基于 COCO 2017 数据集进行可视化分析，该数据集的基本统计信息如下：

#figure(
  table(
    columns: (1fr, 1fr),
    stroke: 0.5pt + gray,
    inset: 10pt,
    [*数据维度*], [*规模*],
    [训练/验证图像], [123,287 张],
    [物体类别], [80 个常见类别],
    [实例标注], [860,000+ 边界框与分割],
    [人体关键点标注], [250,000+ 个],
    [超类别], [12 个],
  ),
  caption: [COCO 2017 数据集统计信息],
)

== 类别分布

#indent() COCO 数据集涵盖 80 个物体类别，按超类别划分如下：

#figure(
  table(
    columns: (auto, 1fr),
    stroke: 0.5pt + gray,
    inset: 8pt,
    [*超类别*], [*包含类别*],
    [人], [person],
    [交通工具], [bicycle, car, motorcycle, airplane, bus, train, truck, boat],
    [动物], [bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe],
    [室外物品], [traffic light, fire hydrant, stop sign, parking meter, bench],
    [室内物品], [chair, couch, bed, dining table, toilet],
    [厨房用品], [bottle, wine glass, cup, fork, knife, spoon, bowl],
    [食物], [banana, apple, sandwich, orange, broccoli, hot dog, pizza, donut, cake],
    [电子设备], [tv, laptop, mouse, remote, keyboard, cell phone],
  ),
  caption: [COCO 数据集类别分布],
)

== 数据预处理

#indent() 为了支持前端可视化，我们对原始 COCO 数据进行了以下预处理：

#figure(
  table(
    columns: (auto, auto, auto),
    stroke: 0.5pt + gray,
    inset: 8pt,
    [*输出文件*], [*大小*], [*内容说明*],
    [spatial_data.json], [~2MB], [8,000 条采样标注，包含位置、尺度信息],
    [semantic_data.json], [~192KB], [80×80 共现矩阵与条件概率],
    [pose_stats.json], [~1MB], [17 关键点的可见性统计与骨架定义],
    [hero_data.json], [~17KB], [门户页 Hero Image 的完整标注],
    [spatial_prior_data.json], [~9KB], [77 类别的空间先验实验数据],
  ),
  caption: [预处理数据文件],
)

= 自定义分析目标

#indent() 基于 COCO 数据集的特点，我们设定了以下三个核心分析目标：

== 目标一：空间分布分析

#info[
  *研究问题*：不同类别的物体在图像中如何分布？是否存在明显的位置偏好？
]

#indent() 具体分析内容包括：
- 各类别物体中心点在图像中的密度分布
- 物体尺度（小/中/大）与空间位置的关系
- 图像边缘与中心区域的目标分布差异

#indent() *分析意义*：揭示视觉构图规律，为数据增强策略提供指导依据。

== 目标二：语义共现分析

#info[
  *研究问题*：哪些物体类别经常同时出现？它们之间的关联强度如何？
]

#indent() 具体分析内容包括：
- 80 个类别之间的共现频率
- 条件概率 P(B|A)：当 A 出现时，B 出现的概率
- 语义场景聚类（如餐桌场景、街道场景）

#indent() *分析意义*：挖掘物体上下文关系，为目标检测模型提供场景理解能力。

== 目标三：人体姿态分析

#info[
  *研究问题*：人体关键点的可见性分布如何？不同身体部位的遮挡规律是什么？
]

#indent() 具体分析内容包括：
- 17 个 COCO 标准关键点的可见性统计
- 平均姿态与位置方差分析
- 按身体部位（头/上肢/躯干/下肢）的对比分析

#indent() *分析意义*：理解姿态分布规律，聚焦姿态估计算法的核心挑战。

= 可视设计

== 系统架构

#indent() COCO-Verse 系统采用模块化架构设计，如下图所示：

#figure(
  image("../assets/architecture.png", width: 90%),
  caption: [系统架构图],
)

#indent() 核心组件包括：
- *沉浸式门户 (Portal)*：基于滚动叙事的引导式入口
- *空间与尺度视图*：等高线密度图 + 散点图 + 分布条形图
- *语义共现网络*：力导向节点-链接图 + 条件概率面板
- *人体姿态视图*：概率骨架图 + 可见性雷达图
- *模型实验视图*：类别先验、空间先验、姿态模型分析

== 沉浸式门户

#figure(
  image("../assets/portal_demo.png", width: 80%),
  caption: [沉浸式门户界面],
)

#indent() 门户采用滚动叙事设计，包含 4 个阶段引导：空间→语义→姿态→进入 Dashboard。

== 视图 A：空间与尺度视图

#figure(
  image("../assets/spatial_view.png", width: 80%),
  caption: [空间与尺度视图],
)

=== 可视编码

#figure(
  table(
    columns: (1fr, 1fr),
    stroke: 0.5pt + gray,
    inset: 8pt,
    [*视觉通道*], [*数据属性*],
    [等高线颜色深度], [物体中心点密度],
    [散点 X 坐标], [归一化水平位置 (0~1)],
    [散点 Y 坐标], [相对面积 (对数刻度)],
    [散点颜色], [尺度类别 (小/中/大)],
    [条形长度], [各尺度类别占比],
  ),
  caption: [空间视图可视编码],
)

=== 交互设计

- *Brush 框选*：在散点图上框选区域，联动更新热力图和分布图
- *类别筛选*：支持 80 类别的下拉搜索
- *实时统计*：显示当前筛选条件下的目标数量和平均面积

== 视图 B：语义共现网络

#figure(
  image("../assets/semantic_view.png", width: 80%),
  caption: [语义共现网络视图],
)

=== 可视编码

#figure(
  table(
    columns: (1fr, 1fr),
    stroke: 0.5pt + gray,
    inset: 8pt,
    [*视觉通道*], [*数据属性*],
    [节点大小], [类别出现频次 (对数映射)],
    [节点颜色], [超类别 (12 种高区分度配色)],
    [边粗细], [共现次数],
    [边透明度], [共现强度],
  ),
  caption: [语义视图可视编码],
)

=== 交互设计

- *单击节点*：锁定焦点，侧边栏显示条件概率 Top-N
- *双击节点*：从图中排除该类别
- *拖拽节点*：手动调整布局位置
- *阈值滑块*：过滤低共现边，减少视觉杂乱

== 视图 C：人体姿态视图

#figure(
  image("../assets/pose_view.png", width: 80%),
  caption: [人体姿态视图],
)

=== 可视编码

#figure(
  table(
    columns: (1fr, 1fr),
    stroke: 0.5pt + gray,
    inset: 8pt,
    [*视觉通道*], [*数据属性*],
    [骨架位置], [平均姿态坐标],
    [椭圆区域], [位置不确定性 (标准差)],
    [雷达图半径], [可见性概率],
    [节点颜色], [身体部位分组],
  ),
  caption: [姿态视图可视编码],
)

=== 身体部位配色方案

- *头部* (紫色)：nose, eyes, ears
- *上肢* (橙色)：shoulders, elbows, wrists
- *躯干* (绿色)：hips
- *下肢* (红色)：knees, ankles

= 模型实验设计

#indent() 为深入验证数据集对深度学习模型的影响，我们设计了三个辅助实验：

== 实验一：类别先验偏差 (ResNet-18)

#figure(
  image("../assets/类别先验偏差分析.png", width: 80%),
  caption: [ResNet-18 类别先验偏差实验],
)

=== 实验目的

#indent() 验证神经网络是否学习到了数据集的类别分布偏差。

=== 方法

#tip[
  - *模型*：ResNet-18，*自己训练* COCO 80 类多标签分类任务
  - *输入*：无语义的纯色 Tensor (`torch.zeros` 或 `torch.ones`)
  - *输出*：80 个类别的预测概率
]

=== 关键发现

#figure(
  table(
    columns: (auto, auto, auto),
    stroke: 0.5pt + gray,
    inset: 8pt,
    [*输入类型*], [*Person 预测概率*], [*结论*],
    [纯黑 Tensor], [54.0%], [模型存在强烈的人类先验],
    [纯白 Tensor], [80.1%], [先验偏差更加明显],
  ),
  caption: [ResNet-18 类别先验实验结果],
)

== 实验二：空间先验实验 (Grounding Transformer)

#figure(
  image("../assets/空间先验实验.png", width: 80%),
  caption: [Grounding Transformer 空间先验实验],
)

=== 实验目的

#indent() 验证目标检测 Transformer 是否学习到了类别的空间位置偏差。

=== 方法

#tip[
  - *模型*：SimpleCNN + Cross-Attention，*自己训练*
  - *监督*：GT Prior + Attention Supervision (KL Loss)
  - *输入*：随机噪声图像 `torch.randn(1, 3, 256, 256)`
  - *Query*：各类别的 embedding
  - *输出*：16×16 Cross-Attention 权重分布
]

=== 关键发现

#figure(
  table(
    columns: (auto, auto),
    stroke: 0.5pt + gray,
    inset: 8pt,
    [*指标*], [*数值*],
    [平均相关性 (Attention vs GT)], [86.7%],
    [测试类别数], [77 个],
    [最高相关性 (bed)], [98.5%],
  ),
  caption: [Grounding Transformer 空间先验实验结果],
)

#success[
  *结论*：模型的注意力分布与真实位置分布高度相关，证明 Transformer 学习到了空间先验。
]

== 实验三：姿态模型分析 (YOLOv8 Pose)

#figure(
  image("../assets/综合姿态及模型分析.png", width: 80%),
  caption: [YOLOv8 姿态模型分析],
)

=== 实验目的

#indent() 分析姿态检测模型在大规模数据上的表现规律。

=== 方法

#tip[
  - *模型*：YOLOv8n-pose，*预训练权重*
  - *任务*：对 COCO 训练集进行推理
  - *规模*：117,266 张图像，约 26 万人体实例
]

=== 关键发现

#figure(
  table(
    columns: (auto, auto, auto),
    stroke: 0.5pt + gray,
    inset: 8pt,
    [*身体部位*], [*平均置信度*], [*原因分析*],
    [头部/面部], [≥90%], [特征明显，通常可见],
    [上肢], [70-90%], [动作多样但通常可见],
    [下肢], [≤60%], [遮挡较多（桌子、人群等）],
  ),
  caption: [YOLOv8 姿态分析结果],
)

= 分析发现

== 发现一：物体空间分布遵循视觉先验

#indent() 通过空间视图分析，我们发现不同类别的物体在图像中具有显著的位置偏好：

- *交通工具*（car, bus）：高密度区域集中在图像*下半部分*，符合"车在地面"的视觉先验
- *天空物体*（airplane, kite）：倾向于出现在图像*上半部分*
- *雨伞*（umbrella）：由于多为手持状态，分布在图像*中上区域*

#warning[
  *启示*：这种空间偏差会被模型学习，可能导致在非常规场景下的检测失败。数据增强（如随机翻转）有助于缓解此问题。
]

== 发现二：语义场景存在明显的物体聚类

#indent() 语义共现网络揭示了多个典型的"场景簇"：

- *餐桌场景*：dining table ↔ chair (P=0.43), cup (P=0.40), bottle (P=0.35)
- *厨房场景*：refrigerator ↔ microwave, oven, sink
- *交通场景*：car ↔ traffic light, person, truck
- *运动场景*：sports ball ↔ person, tennis racket

#success[
  *启示*：上下文信息对目标检测至关重要，模型可利用物体共现关系提升遮挡场景的检测能力。
]

== 发现三：下肢是姿态估计的主要挑战

#figure(
  image("../assets/pose_all.png", width: 60%),
  caption: [人体姿态可见性分析],
)

#indent() 人体姿态分析揭示了关键点可见性的不均衡分布：

- *最稳定*：肩膀 (~51% 可见性)、鼻子、眼睛 —— 位置方差小，是姿态"锚点"
- *最易被遮挡*：脚踝 (~28% 可见性)、膝盖 —— 大量半身像导致下肢数据稀缺
- *变化最大*：手腕、手肘 —— 活动范围广，位置方差大

#warning[
  *启示*：姿态估计算法应重点关注下肢估计，可考虑引入遮挡推理机制。
]

== 发现四：模型确实学习到了数据集偏差

#indent() 三个模型实验共同验证了深度学习模型会学习数据集的隐性偏差：

+ *类别先验*：即使输入无意义的纯色图像，ResNet-18 仍然以 54-80% 的概率预测"person"类
+ *空间先验*：Grounding Transformer 的注意力分布与真实位置分布相关性达 86.7%
+ *遮挡先验*：YOLOv8 对下肢的置信度显著低于上身

= 技术实现

== 技术栈

#figure(
  table(
    columns: (auto, auto, auto),
    stroke: 0.5pt + gray,
    inset: 8pt,
    [*层级*], [*技术*], [*用途*],
    [前端可视化], [D3.js 7.4.4], [核心可视化库],
    [前端构建], [Parcel 1.12.5], [模块打包器],
    [数据处理], [Python 3 + Pandas], [JSON 预处理],
    [模型训练], [PyTorch], [ResNet-18, Transformer],
    [姿态检测], [Ultralytics YOLOv8], [预训练模型推理],
    [图像处理], [Pillow, OpenCV], [图像拼接与可视化],
  ),
  caption: [技术栈],
)

== 项目结构

```
Data-Visualization-Coursework/
├── src/
│   ├── index.html              # 主页面
│   ├── js/                     # 可视化模块
│   │   ├── story_main.js       # 门户滚动叙事
│   │   ├── spatial_view.js     # 空间视图
│   │   ├── semantic_graph.js   # 语义视图
│   │   ├── pose_view.js        # 姿态视图
│   │   ├── bias_view.js        # 模型偏差实验
│   │   └── spatial_prior_view.js
│   └── data/                   # 预处理数据
├── scripts/                    # 数据处理与模型训练
│   ├── preprocessing/          # COCO 数据预处理
│   └── training/               # 模型训练代码
├── checkpoints/                # 模型权重
└── assets/                     # 文档图片资源
```

= 总结与展望

== 项目贡献

+ 构建了 COCO 数据集的*多视图交互式分析系统*
+ 实现了*空间-语义-姿态*三维度的数据探索
+ 设计了*Cross-Filtering*联动交互机制
+ 完成了*3 个深度模型实验*，揭示数据集对模型的隐性影响

== 技术亮点

- 沉浸式门户的*滚动叙事*设计，引导用户逐步深入
- 统一的*设计语言*系统，保证视觉一致性
- 完整的*80 类别*支持，覆盖 COCO 全部物体
- *117,266 张*图像的大规模姿态分析

== 未来改进方向

- 增加时序分析能力，支持视频数据
- 扩展到更多数据集（LVIS、Objects365）
- 添加模型预测结果与真实标注的对比分析
- 优化大规模数据的渲染性能

#conclusion[
  COCO-Verse 通过可视化分析，揭示了 COCO 数据集中的空间分布规律、语义共现模式和姿态遮挡特点，并通过模型实验验证了深度学习模型会学习到这些数据偏差。
]

#v(2cm)

#align(center)[
  #text(size: 14pt, weight: "bold")[COCO-Verse]

  #text(size: 11pt)[Decoding Common Objects in Context]

  #v(0.5cm)

  #text(size: 10pt, fill: gray)[
    代码仓库：https://github.com/xzxxntxdy/Data-Visualization-Coursework
  ]

  #v(0.3cm)

  #text(size: 10pt, fill: gray)[
    在线演示：https://datavis-five.vercel.app/
  ]
]
