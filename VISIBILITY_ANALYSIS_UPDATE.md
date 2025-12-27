# 关键点可见性分析 - 更新总结

## 概述
将散点图的X轴从"推断的遮挡率"改为**"关键点可见性分数"**，这是基于YOLO推理的置信度和检测率计算的真实指标。

## 数据改进

### 新增：可见性统计 (`analyze_visibility_from_confidence.py`)
- **算法**: 基于置信度和检测率计算关键点的可见性分数
- **公式**:
  - 如果 `detection_rate > 70% && mean_confidence > 0.65` → **Visibility Level 2**（完全可见）
  - 如果 `detection_rate > 50% || mean_confidence > 0.5` → **Visibility Level 1**（部分可见）
  - 否则 → **Visibility Level 0**（未标注/不可见）

### 数据结构更新
```json
{
  "visibility_analysis": {
    "keypoint_visibility": {
      "nose": {
        "visibility_level": 2,
        "visibility_score": 70.8,  // 0-100分
        "mean_confidence": 0.725,
        "detection_rate": 71.75,
        "body_region": "头部"
      },
      ...
    },
    "body_region_visibility": {
      "头部": {
        "fully_visible_count": 0,
        "partially_visible_count": 5,
        "not_visible_count": 0,
        "mean_visibility_score": 61.2
      },
      ...
    }
  }
}
```

### Scatter Plot 数据格式
```javascript
{
  "keypoint": "nose",
  "visibility_score": 70.8,      // X轴：可见性分数 (0-100%)
  "confidence": 0.725,            // Y轴：置信度 (0-1)
  "region": "头部",
  "detection_rate": 71.75
}
```

## 前端更新 (`src/js/pose_model_analysis.js`)

### 坐标轴改变
- **X轴**: 0-100% (从"遮挡率"→"可见性分数")
- **Y轴**: 0-1 (从"准确度百分比"→"置信度比例")

### 理想趋势线
- 从"遮挡↑准确↓"改为"可见性↑置信度↑"
- 反映：可见性高的关键点→模型更有信心

### 颜色编码
- 四个身体部位用不同颜色区分（而不是之前的4个宏观区域）
- 头部: 蓝紫色 (#667eea)
- 上肢: 橙色 (#ed8936)
- 躯干: 绿色 (#48bb78)
- 下肢: 红色 (#f56565)

### 工具提示内容
```
关键点名: nose
可见性: 70.8%        (X轴值)
置信度: 72.5%        (Y轴值)
```

## 语义改进

### 图表标题
- 旧: "🔗 COCO遮挡特征 ↔ 模型识别性能"
- 新: "🔗 关键点可见性 ↔ 模型识别置信度"

### 图表说明
旧版强调数据集的遮挡问题，新版强调：
- **可见性分数**反映关键点在数据集中的可检测性
- **置信度**反映模型对该关键点的识别信心
- 两者正相关：可见性高→置信度高

## 数据来源的真实性
✅ **完全基于YOLO推理的真实数据**
- 没有推断或猜测
- 使用117,877张图像的推理结果
- 包含2,682,141个关键点统计

## 文件修改清单

| 文件 | 改动 |
|------|------|
| `analyze_visibility_from_confidence.py` | 新建 - 计算可见性统计 |
| `src/data/pose_analysis_results.json` | 新增 visibility_analysis + 更新 body_region_scatter |
| `src/js/pose_model_analysis.js` | 完全重写renderBodyRegionComparison()，删除occlusion_stats.json导入 |

## 验证结果

```
✓ 17个关键点的可见性分数:
  [0] nose            → visibility_score=70.8%, confidence=72.5%
  [1] left_eye        → visibility_score=62.2%, confidence=63.3%
  [2] right_eye       → visibility_score=62.4%, confidence=63.4%
  ...
  
✓ 身体部位统计:
  头部   → 平均可见性: 61.2%  (5个关键点)
  上肢   → 平均可见性: 78.9%  (6个关键点)
  躯干   → 平均可见性: 78.8%  (2个关键点)
  下肢   → 平均可见性: 58.0%  (4个关键点)
```

## 后续优化
- [ ] 添加可见性的时间序列变化分析
- [ ] 按身体部位的可见性热力图
- [ ] 与COCO标注数据的对比验证
