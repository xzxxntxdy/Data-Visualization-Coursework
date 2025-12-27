# Grounding Transformer with Spatial Prior Learning

轻量级 Grounding Transformer 项目，通过 attention supervision 让模型学习数据集的空间先验分布。

## 🎯 项目目标
给定图像 + COCO 类别，输出 bbox，并验证模型的 cross-attention 是否学到了与数据集一致的**空间先验（spatial prior）**。

## 📁 项目结构

```
train/
├── core/                          # 核心代码
│   ├── dataset.py                 # 数据集类
│   ├── transformer_model.py       # 模型定义
│   ├── train_with_attn_supervision.py  # 训练脚本（支持 Gaussian/GT Prior）
│   └── analyze_spatial_priors_diagnose.py  # 诊断分析脚本
│
├── experiments/                   # 三种训练方法
│   ├── 1_baseline/                # 方法1: 仅 bbox loss (correlation ≈ 0)
│   ├── 2_gaussian_supervision/    # 方法2: Gaussian 监督 (correlation = 0.44)
│   └── 3_gt_prior_supervision/    # 方法3: GT Prior 监督 (correlation = 0.87) ✅
│
├── utils/                         # 工具脚本
│   └── visualize_attention.py
│
├── data/                          # 数据
│   ├── spatial_data.json          # 8000 个标注
│   └── spatial/                   # 图片目录
│
└── PROJECT_HANDOVER.md            # 详细项目文档
```

## 🚀 快速开始

### 1. 训练模型（推荐使用 GT Prior 方法）
```bash
# 方法3: GT Prior Supervision（最佳✅）
python core/train_with_attn_supervision.py --use_gt_prior

# 方法2: Gaussian Supervision（次优）
python core/train_with_attn_supervision.py

# 方法1: Baseline（无 attention 监督）
python experiments/1_baseline/train_transformer.py
```

### 2. 分析模型效果
```bash
python core/analyze_spatial_priors_diagnose.py \
  --model_path experiments/3_gt_prior_supervision/checkpoints/chair_transformer_gt_prior_best.pth \
  --out_dir results_analysis
```

## 📊 三种方法对比

| 方法 | Correlation | JS(attn,gt) | 训练位置 |
|------|------------|-------------|---------|
| 1. Baseline | -0.017 | 0.467 | `experiments/1_baseline/` |
| 2. Gaussian | 0.439 | 0.279 | `experiments/2_gaussian_supervision/` |
| 3. GT Prior ✅ | **0.866** | **0.070** | `experiments/3_gt_prior_supervision/` |

## 🏆 最佳方法：GT Prior Supervision

**为什么 GT Prior 最好？**
1. ✅ **精确反映数据分布**：直接使用数据集统计的真实分布
2. ✅ **稀疏监督更有效**：0/1 硬标签比 Gaussian 平滑分布效果好
3. ✅ **相关性提升 97%**：从 0.439 → 0.866
4. ✅ **BBox 性能也提升**：Loss 从 0.0094 → 0.0057

详见：`experiments/3_gt_prior_supervision/README.md`

## 📖 技术栈
- **PyTorch**: 训练框架
- **Torchvision**: 图像预处理
- **Matplotlib**: 可视化
- **模型架构**: SimpleCNN + 1-layer Cross-Attention + Conditional Query

## 📝 详细文档
完整的项目交接文档请查看：[PROJECT_HANDOVER.md](PROJECT_HANDOVER.md)

## ✅ 项目状态
**核心目标 100% 完成** 🎉
- ✅ 修复诊断脚本 Bug
- ✅ 实现 Attention Supervision
- ✅ 训练并验证 Gaussian 方法
- ✅ 训练并验证 GT Prior 方法（最佳）
- ✅ 完整的对比分析和文档

---

**最后更新**: 2025-12-25
**项目状态**: ✅ 完成
