# 方法 3: GT Prior Supervision ✅ 最佳方法

## 方法描述
在 BBox loss 基础上，使用 **数据集真实的 GT spatial prior** 作为 attention 监督。

### 监督方式
1. 统计每个类别在数据集中所有样本的 bbox 中心位置
2. 生成每个类别的 **0/1 硬标签概率分布**（精确反映数据分布）
3. 使用 KL Divergence 监督 attention 向 GT prior 学习
4. 联合优化：`loss = bbox_loss + λ_attn * KL(attn || gt_prior)`

## 训练命令
```bash
# 在项目根目录执行
cd /wanyuhao/keyunchao/train
python core/train_with_attn_supervision.py --use_gt_prior
```

## 分析命令
```bash
python core/analyze_spatial_priors_diagnose.py \
  --model_path experiments/3_gt_prior_supervision/checkpoints/chair_transformer_gt_prior_best.pth \
  --out_dir experiments/3_gt_prior_supervision/results_gt_prior
```

## 结果 🏆

### 核心指标
- **平均 Correlation**: **0.8658** 🎉
- **JS(attn, gt)**: **0.0704** (vs Gaussian 0.2788)
- **Center Distance**: **0.1381** (vs Gaussian 0.3953)
- **最终 BBox Loss**: **0.0057** (vs Gaussian 0.0094)

### Correlation 分布
- ✅ **100%** 类别 > 0.7（80/80）
- ✅ **87.5%** 类别 > 0.8（70/80）
- ✅ **31.2%** 类别 > 0.9（25/80）

### Top 10 类别
1. bed: 0.986
2. elephant: 0.968
3. cat: 0.964
4. bear: 0.959
5. airplane: 0.958
6. dog: 0.954
7. giraffe: 0.951
8. train: 0.948
9. dining table: 0.946
10. skateboard: 0.925

### 对比 Gaussian 方法
- **Correlation 提升**: 0.4391 → 0.8658 (**+97.2%**)
- **JS Divergence 改善**: 0.2788 → 0.0704 (**-74.8%**)
- **Center Distance 改善**: 0.3953 → 0.1381 (**-65.1%**)

## 文件说明
- `checkpoints/` - 模型权重
  - `chair_transformer_gt_prior_best.pth` - 最佳模型
- `results_gt_prior/` - 诊断结果和可视化
  - `diagnostics.csv` - 详细统计数据
  - `diagnostics_top.png` - 可视化图表
- `logs/` - 训练和分析日志

## 结论
✅ **最佳方法！** GT Prior 的稀疏监督（0/1 label）比 Gaussian 的平滑监督效果显著更好。
- 精确反映数据集的真实空间分布
- 稀疏性强，迫使模型学习精确位置
- 避免 Gaussian 的过度平滑问题

**建议：后续项目优先使用此方法！**
