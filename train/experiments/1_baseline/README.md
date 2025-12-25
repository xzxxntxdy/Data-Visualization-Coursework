# 方法 1: Baseline（仅 BBox Loss）

## 方法描述
最原始的训练方法，**仅使用 BBox regression loss**，没有任何 attention 监督。

## 训练命令
```bash
python train_transformer.py
```

## 结果
- **BBox Loss**: 正常收敛
- **Attention 相关性**: ≈ -0.017（接近 0，基本无相关）
- **结论**: ❌ 模型 attention 接近均匀分布，未学到空间先验

## 文件说明
- `train_transformer.py` - 训练脚本
- `checkpoints/` - 模型权重
- `results/` - 诊断结果
