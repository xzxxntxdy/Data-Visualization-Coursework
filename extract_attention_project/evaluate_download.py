#!/usr/bin/env python3
"""
评估是否需要下载全COCO数据集
"""

import json
import os

print("="*100)
print("COCO数据集下载评估")
print("="*100)

# 检查现有数据
val2017_path = './data/coco/val2017'
if os.path.exists(val2017_path):
    val_count = len([f for f in os.listdir(val2017_path) if f.endswith('.jpg')])
    print(f"\n✅ 现有数据：")
    print(f"   val2017: {val_count} 张图像")
else:
    print(f"\n❌ 未找到 val2017")

print(f"\n📊 COCO数据集规模对比：")
print(f"   • train2017: ~118,287 张图像 (体积 ~18GB)")
print(f"   • val2017:     ~5,000 张图像 (体积 ~1GB) ← 当前使用")
print(f"   • test2017:   ~41,000 张图像 (体积 ~6GB)")

print(f"\n🔍 样本分布预估：")
with open('./yolo_pose_results/occlusion_analysis.json', 'r') as f:
    data = json.load(f)
    
fv_count = data['overall_statistics']['fully_visible']['count']
oc_count = data['overall_statistics']['occluded']['count']
oc_ratio = oc_count / fv_count * 100

print(f"   • val2017 中被遮挡比例: {oc_ratio:.1f}% ({oc_count}/{fv_count})")
print(f"   • 若下载 train2017（扩大 ~24倍）:")
print(f"     - 预期被遮挡样本: {oc_count * 24:.0f} 个（从 {oc_count} → 更稳定的统计）")
print(f"     - 每个关键点平均: {oc_count * 24 / 17:.0f} 个被遮挡样本")

print(f"\n⚖️  成本-收益分析：")
print(f"\n   ❌ 下载全部 train2017 的代价：")
print(f"      • 网络下载: 18GB（可能需要数小时）")
print(f"      • 磁盘空间: 18GB")
print(f"      • 处理时间: 相应增加")

print(f"\n   ✅ 带来的收益：")
print(f"      • 被遮挡样本从 143 → ~3,400")
print(f"      • 统计置信度大幅提升")
print(f"      • 相关性分析更可靠")

print(f"\n🎯 推荐方案（按优先级）：")
print(f"\n   1️⃣ 【最简单】使用当前val2017数据 + 改进分析方法")
print(f"      • 按类别（头部、躯干、四肢）分析而非单个关键点")
print(f"      • 使用bootstrap重采样估计置信区间")
print(f"      • 效果：既能体现模型特性，又不增加存储")

print(f"\n   2️⃣ 【中等工作量】创建合成遮挡数据")
print(f"      • 随机遮挡val2017中的关键点")
print(f"      • 在原有基础上生成10x的遮挡样本")
print(f"      • 效果：样本增加但不需要重新下载")

print(f"\n   3️⃣ 【最完整】下载 train2017")
print(f"      • 使用完整的训练集")
print(f"      • 得到最准确的统计分析")
print(f"      • 前提：有足够的网络和磁盘空间")

print(f"\n" + "="*100)
print("我的建议：")
print("="*100)
print(f"考虑到你是做数据可视化课程作业，建议：")
print(f"  ✨ 方案1（改进分析方法）最实用 - 无需额外下载，但分析更深入")
print(f"  ✨ 方案2（合成遮挡）次选 - 数据充足且相关性好")
print(f"  ✨ 方案3（完整数据集）工作量最大，但最严谨")
