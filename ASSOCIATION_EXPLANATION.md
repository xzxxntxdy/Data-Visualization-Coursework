# 注意力分析与姿态可视化的关联性说明

## 🔗 核心关联机制

```
COCO 数据集 (200张图像)
     ↓
      ├─ 姿态标注 (17个关键点的真实位置)
      │   └─ 保存到 pose_stats.json (mean_pose)
      │
      └─ 原始图像
          ↓
          ViT-B 模型推理
          ↓
          提取注意力热力图 (16×16)
          提取梯度贡献度
          ↓
          [关联点] ← 这里是核心！
          ↓
前端三个图表联动展示
```

---

## 📍 三个维度的具体关联

### **维度1：人体骨架 (Skeleton View - 左上)**

```javascript
// pose_model_view.js 第 286-292 行

// 使用从 pose_stats.json 加载的骨架位置，确保与 pose_view 一致
const skeleton = poseStats.skeleton;  // COCO标准19条骨架连接

skeleton.forEach(([id1, id2]) => {
  const pos1 = posePositionMap[id1 - 1];  // ← 真实的关键点位置！
  const pos2 = posePositionMap[id2 - 1];
  if (pos1 && pos2) {
    // 根据真实位置绘制线条
    g.append("line")
      .attr("x1", xScale(pos1[0]))
      .attr("y1", yScale(pos1[1]))
      .attr("x2", xScale(pos2[0]))
      .attr("y2", yScale(pos2[1]))
  }
});
```

**关键点：** 这里使用的 `posePositionMap` 直接来自 COCO 数据集中200张图像的平均人体位置
```
posePositionMap = {
  0: [0.5, 0.1],    // 鼻子
  1: [0.38, 0.08],  // 左眼
  5: [0.32, 0.28],  // 左肩
  ... 
}
```

---

### **维度2：注意力热力图 (Attention Heatmap - 右上)**

```javascript
// pose_model_view.js 第 441-455 行

const attentionData = poseModelData.attention_map_16x16;  // 从ViT-B提取

// 16×16 网格 对应 0-1 的归一化坐标空间
// 上面的骨架图也在 0-1 坐标空间中！

const cellSize = Math.min(chartWidth / 16, chartHeight / 16);

g.selectAll("rect.heatmap-cell")
  .data(cells)
  .join("rect")
  .attr("x", d => d.x * cellSize)      // ← 同样的网格坐标
  .attr("y", d => d.y * cellSize)
  .attr("fill", d => colorScale(d.value))
```

**关键关联：** 
```
骨架图的坐标系     →  [0, 1] 归一化坐标 
注意力热力图坐标系 →  [0, 1] 归一化坐标 (每个16×16网格格子代表)

结果：两个图表在同一个坐标系中！
```

**隐含验证：** 如果Transformer有效识别人体，那么：
- 骨架的中心区域（躯干、头部）应该对应热力图中的高注意力区域
- 骨架的四肢末端（手、脚）可能对应热力图中的低注意力区域

---

### **维度3：梯度流向 (Gradient Flow - 下方)**

```javascript
// pose_model_view.js 第 1033-1040 行

let gradientData;

if (poseModelData.keypoint_gradient_contributions) {
  // 使用真实计算的梯度数据
  gradientData = poseModelData.keypoint_gradient_contributions
    .slice(0, 8)
    .map(d => ({
      name: d.name,                      // ← 关键点名称（来自COCO）
      gradient_contribution: d.gradient_contribution,  // ← 从热力图计算的梯度
      flow_magnitude: d.flow_magnitude
    }));
}
```

**关键关联：**
```
keypoint_gradient_contributions 的数据来源：

extract_gradient_contribution.py 第 50-120 行：
┌────────────────────────────────────────┐
│ 遍历 17 个 COCO 关键点                  │
│   ↓                                    │
│ 获取该关键点在16×16热力图中的位置      │
│   ↓                                    │
│ 提取局部热力值计算梯度贡献度            │
│   ↓                                    │
│ 结果：每个关键点的"模型关注度"          │
└────────────────────────────────────────┘
```

具体映射关系：
```
COCO 关键点ID  →  16×16 网格中的位置  →  提取注意力  →  计算梯度
   (0-16)          (y, x)               值 (0-1)      贡献度

例如：
鼻子 (ID=0)  →  位置 (8, 4)  →  热力值 0.297  →  梯度贡献 0.25
左眼 (ID=1)  →  位置 (6, 3)  →  热力值 0.294  →  梯度贡献 0.247
```

---

## 🎯 梯度流向图的含义（最关键！）

```
柱子高度 = 该关键点对模型预测的梯度贡献度
          = 该关键点周围的注意力强度
          = 模型有多"关注"这个关键点

箭头方向 = 关键点间的梯度流向
          = 信息在骨架中的传播方向
          = 遵循 COCO 骨架连接 (19条骨)

结果：可视化"模型如何沿着人体结构流动信息"
```

---

## 📊 数据流向完整图

```
┌─────────────────────────────────────────────────────────────────┐
│ COCO 数据集 (200张)                                              │
│  ├─ mean_pose: [0.5, 0.1], [0.38, 0.08], ... (17个关键点)      │
│  └─ skeleton: [[0,1], [1,3], ...] (19条连接)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ViT-B 模型推理                                                   │
│  → attention_map_16x16: [[0.52, ...], ...] (从交叉注意力提取)    │
│  → keypoint_gradient_contributions: [{id, name, gradient, ...}]│
│  → gradient_flow_graph: [{from, to, magnitude}]                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 前端三个图表 (都在同一坐标系 [0,1]×[0,1])                        │
│                                                                  │
│  左：骨架图                    右：注意力热力图                    │
│  ├─ 骨架位置                  ├─ 网格热力值                     │
│  ├─ 关键点重要性              └─ 红=高注意力 蓝=低                │
│  └─ 交互悬停                                                    │
│                                                                  │
│  下：梯度流向图                                                  │
│  ├─ 柱子=梯度贡献                                               │
│  ├─ 箭头=信息流向                                               │
│  └─ 基于 COCO 骨架连接                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 验证关联性的方式

### **方法1：坐标对齐验证**
```
点击骨架图中的"鼻子" (位置 0.5, 0.1)
  ↓
看热力图中 (0.5, 0.1) 对应的格子
  ↓
应该是**高注意力**区域（热力图偏红）
  ↓
梯度流图中"鼻子"的柱子应该偏高
```

### **方法2：骨架拓扑验证**
```
梯度流图的箭头走向应该遵循 COCO 骨架：
  鼻子 → 左眼 → 左耳
  鼻子 → 右眼 → 右耳
  ...左肩 → 左肘 → 左腕...等等
```

### **方法3：物理合理性验证**
```
脑袋（鼻、眼、耳）的梯度通常最高
躯干（肩、髋）次之
四肢末端（腕、踝）通常较低

这反映了模型对人体结构的理解！
```

---

## 💾 关键数据源总结

| 数据 | 来源 | 用途 |
|------|------|------|
| `mean_pose` | COCO → pose_stats.json | 骨架图的关键点位置 |
| `skeleton` | COCO → pose_stats.json | 骨架图的连接线 + 梯度流箭头 |
| `attention_map_16x16` | ViT-B模型 → pose_model_attention.json | 热力图内容 |
| `keypoint_gradient_contributions` | extract_gradient_contribution.py计算 | 梯度流图的柱子高度 |
| `gradient_flow_graph` | extract_gradient_contribution.py计算 | 梯度流图的箭头 |

---

## ✨ 核心洞察

> **这不是两个独立的可视化，而是同一个数据的三个角度：**

1. **骨架图** = 模型看到的人体结构（**如何排列**）
2. **热力图** = 模型的注意力分布（**在哪看**）
3. **梯度流图** = 模型的信息流向（**如何处理**）

**如果三个图表都指向相同的结论** → 模型确实有效地理解了人体姿态！

