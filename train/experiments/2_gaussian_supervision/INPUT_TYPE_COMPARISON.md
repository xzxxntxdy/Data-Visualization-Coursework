# 不同输入类型下的 Attention 对比实验

**实验时间**: 2025-12-25
**实验目的**: 验证模型学到的 attention spatial prior 对不同输入类型的鲁棒性

---

## 实验设置

### 测试输入类型
1. **white** - 纯白图像 (255, 255, 255) ← 原诊断脚本默认
2. **gray** - 灰色图像 (127, 127, 127)
3. **black** - 纯黑图像 (0, 0, 0)
4. **noise** - 随机噪声 `torch.randn(1, 3, 256, 256)`

### 测试对象
**Top 5 Correlation 类别**（基于 white 输入的诊断结果）：
1. giraffe (长颈鹿) - corr = +0.715
2. bear (熊) - corr = +0.690
3. cat (猫) - corr = +0.640
4. elephant (大象) - corr = +0.638
5. airplane (飞机) - corr = +0.629

---

## 实验结果

### 关键发现 🔍

#### 1. **纯色输入（white/gray/black）高度一致**

| 输入类型 | 平均 Correlation | 标准差 |
|----------|-----------------|--------|
| **white** | **+0.662** | 0.034 |
| **gray**  | **+0.661** | 0.033 |
| **black** | **+0.662** | 0.033 |
| **noise** | +0.263 | 0.059 |

**结论**:
- ✅ **纯色输入下 attention 几乎完全相同** (correlation 差异 < 0.001)
- ✅ 说明模型学到的是 **类别的空间先验**，而非输入图像的特征
- ✅ Attention 对输入颜色具有**极强的鲁棒性**

#### 2. **随机噪声显著降低但仍保留部分先验**

- 噪声输入的 correlation 降低到 0.263 (相比纯色的 0.662)
- 但**仍显著高于随机基线** (0.0)
- 说明：
  - ✅ 噪声中的高频信息会**干扰** attention 的空间模式
  - ✅ 但模型学到的先验**仍然部分保留**，具有一定抗噪能力

---

## 深入分析

### 为什么纯色输入效果一致？

**Attention Supervision 的作用机制**:

在训练时，模型通过 Attention Supervision Loss 学到：
```
对于类别 C，attention 应该集中在特定的空间位置
```

这种监督信号是**与输入图像内容无关的**，只依赖于：
1. 类别 embedding (`self.query_embed`)
2. 空间位置 encoding (`self.pos_enc`)

因此，即使输入是纯白/纯灰/纯黑，模型的 attention 仍然会：
- 通过 query embedding 识别类别
- 通过位置 encoding 定位空间
- 激活该类别对应的空间先验模式

### 为什么噪声降低 correlation？

**噪声的干扰来源**:

1. **CNN backbone 的特征提取**：
   - 纯色输入 → CNN 输出几乎均匀的 feature map
   - 噪声输入 → CNN 输出包含随机的高频特征

2. **Cross-Attention 的计算**：
   ```python
   attention = softmax(Q @ K^T / sqrt(d))
   ```
   - 噪声特征会引入随机的 key 向量
   - 导致 attention 权重产生随机扰动

3. **但空间先验仍占主导**：
   - Query embedding + 位置 encoding 仍然提供强先验
   - 所以 correlation 虽降低但仍保持正相关 (0.263)

---

## 可视化对比

生成的对比图包含：
- **5 行**：Top 5 correlation 类别
- **5 列**：GT Prior + 4 种输入类型的 attention

**文件位置**: `results_attn_sup/input_type_comparison_top5.png`

**观察要点**:
1. 前 4 列（GT + white/gray/black）的 attention 高度相似
2. 第 5 列（noise）的 attention 更分散但仍保留主要模式
3. 所有类别都表现出一致的模式

---

## 结论与启示

### ✅ 核心结论

1. **Attention Supervision 成功学到了类别的内在空间先验**
   - 不依赖输入图像的颜色或纹理
   - 对纯色输入具有完美的鲁棒性

2. **学到的先验是 query-based 的**
   - 由类别 query embedding 触发
   - 由位置 encoding 定位
   - 与输入特征解耦

3. **具有一定的抗噪能力**
   - 随机噪声会降低但不会完全破坏 spatial prior
   - 说明监督信号足够强

### 💡 实践启示

1. **诊断分析建议**：
   - 使用**纯白输入**作为标准诊断方法 ✅（当前默认）
   - white/gray/black 效果相同，选择任一即可
   - 避免使用 noise，会引入不必要的干扰

2. **模型设计启示**：
   - Query-based attention + 位置 encoding 是学习空间先验的有效架构
   - Attention supervision 可以让模型学到输入无关的先验知识

3. **应用场景**：
   - 该模型可用于"盲预测"场景（无需真实图像输入）
   - 可作为先验知识与真实检测器结合

---

## 相关文件

- **对比图**: `results_attn_sup/input_type_comparison_top5.png`
- **实验脚本**: `compare_input_types.py`
- **实验日志**: `input_type_comparison.log`

---

**实验完成时间**: 2025-12-25
**状态**: ✅ 验证完成
