# 文件整理计划

## 目录结构

```
train/
├── core/                          # 核心代码
│   ├── dataset.py
│   ├── transformer_model.py
│   ├── train_with_attn_supervision.py
│   └── analyze_spatial_priors_diagnose.py
│
├── experiments/                   # 实验相关
│   ├── 1_baseline/                # 方法1: 原始方法（仅 bbox loss）
│   │   ├── train_transformer.py
│   │   ├── checkpoints/
│   │   ├── results/
│   │   └── README.md
│   │
│   ├── 2_gaussian_supervision/    # 方法2: Gaussian Heatmap 监督
│   │   ├── checkpoints/
│   │   ├── results_attn_sup/
│   │   ├── logs/
│   │   ├── compare_input_types.py
│   │   ├── ATTENTION_SUPERVISION_RESULTS.md
│   │   └── INPUT_TYPE_COMPARISON.md
│   │
│   └── 3_gt_prior_supervision/    # 方法3: GT Prior 监督（最佳✅）
│       ├── checkpoints/
│       ├── results_gt_prior/
│       ├── logs/
│       └── README.md
│
├── utils/                         # 工具脚本
│   └── visualize_attention.py
│
├── data/                          # 数据（软链接或原位置）
│   ├── spatial_data.json
│   └── spatial/                   # 图片目录
│
├── PROJECT_HANDOVER.md            # 项目交接文档
└── README.md                      # 项目说明
```

## 删除的临时文件

- check_gt_prior.py（临时检查脚本）
- compare_supervision_methods.py（临时对比脚本）
- improved_attention_supervision.py（临时改进脚本）
- gt_prior_check.png（临时图片）
- supervision_comparison.png（临时图片）
- analyze_spatial_priors.py（旧版脚本，已被 diagnose 版本替代）
