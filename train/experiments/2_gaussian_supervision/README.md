# 方法 2: Gaussian Heatmap Supervision

## 方法描述
在 BBox loss 基础上，添加 **Gaussian Heatmap 作为 attention 监督**。

### 监督方式
- 为每个 GT bbox 中心生成 Gaussian 分布（σ=2.0）
- 使用 KL Divergence 监督 attention 向 Gaussian target 学习
- 联合优化：`loss = bbox_loss + λ_attn * KL(attn || gaussian)`

## 训练命令
```bash
# 在项目根目录执行（需要访问 core/ 中的模块）
cd /wanyuhao/keyunchao/train
python core/train_with_attn_supervision.py  # 默认使用 Gaussian
```

## 结果
- **平均 Correlation**: 0.4391
- **JS(attn, gt)**: 0.2788
- **Center Distance**: 0.3953
- **强相关类别** (corr > 0.5): 36% (29/80)
- **Top 1**: giraffe (0.715)

## 文件说明
- `checkpoints/` - 模型权重
- `results_attn_sup/` - 诊断结果和可视化
- `logs/` - 训练和诊断日志
- `ATTENTION_SUPERVISION_RESULTS.md` - 详细实验报告
- `INPUT_TYPE_COMPARISON.md` - 输入鲁棒性分析
- `compare_input_types.py` - 输入类型对比脚本

## 结论
⚠️ 有一定效果，但 correlation 仍偏低（0.439）。Gaussian 的平滑效应可能弱化了监督信号。
