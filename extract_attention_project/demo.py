"""
快速演示脚本
展示如何使用修改后的姿态估计模型
"""

import torch
import numpy as np
from pose_model import PoseTransformerModel, SimplePoseModel


def demo_model_architecture():
    """演示模型架构"""
    print("=" * 80)
    print("COCO 关键点姿态估计模型 - 架构演示")
    print("=" * 80)
    
    # 创建模型
    print("\n1. 创建 SimplePoseModel...")
    model = SimplePoseModel(num_keypoints=17, feature_dim=256)
    model.eval()
    
    # 创建输入
    print("2. 生成输入图像（批大小=1，图像大小=256x256）...")
    batch_images = torch.randn(1, 3, 256, 256)
    
    # 推理
    print("3. 执行推理...")
    with torch.no_grad():
        outputs = model(batch_images)
    
    # 输出说明
    print("\n" + "=" * 80)
    print("模型输出说明")
    print("=" * 80)
    
    print("\n📌 关键点坐标 (keypoints)")
    print(f"   形状: {outputs['keypoints'].shape}")
    print(f"   说明: 17 个关键点的 (x, y) 坐标，归一化到 [0, 1]")
    print(f"   示例: {outputs['keypoints'][0, :3]}")  # 显示前3个关键点
    
    print("\n📌 置信度 (confidence)")
    print(f"   形状: {outputs['confidence'].shape}")
    print(f"   说明: 每个关键点的置信度，范围 [0, 1]")
    print(f"   示例: {outputs['confidence'][0, :5]}")  # 显示前5个置信度
    
    print("\n📌 倒数第二层特征 (keypoint_features) ⭐ 关键")
    print(f"   形状: {outputs['keypoint_features'].shape}")
    print(f"   说明: 17 个关节节点的特征向量（每个 256 维）")
    print(f"        这是模型的倒数第二层，包含丰富的关节位置信息")
    print(f"   详细解释:")
    print(f"     - 第一维 (17): 17 个 COCO 关键点")
    print(f"     - 第二维 (256): 每个关键点的特征维度")
    kp_feat = outputs['keypoint_features'][0]
    print(f"   关键点 0 (鼻子) 的特征向量: {kp_feat[0, :10]}")  # 显示前10维
    
    print("\n📌 热力图 (heatmap)")
    print(f"   形状: {outputs['heatmap'].shape}")
    print(f"   说明: 人体位置的注意力热力图（16x16）")
    
    # 展示17个关键点的名称
    print("\n" + "=" * 80)
    print("17 个 COCO 关键点定义")
    print("=" * 80)
    
    keypoint_names = [
        'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
        'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
        'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
    ]
    
    for idx, name in enumerate(keypoint_names):
        kp = outputs['keypoints'][0, idx]
        conf = outputs['confidence'][0, idx]
        print(f"{idx:2d}. {name:15s} - 坐标: ({kp[0]:.3f}, {kp[1]:.3f}) - 置信度: {conf:.3f}")


def demo_feature_usage():
    """演示如何使用倒数第二层特征"""
    print("\n" + "=" * 80)
    print("如何使用倒数第二层特征")
    print("=" * 80)
    
    model = SimplePoseModel(num_keypoints=17, feature_dim=256)
    model.eval()
    
    batch_images = torch.randn(2, 3, 256, 256)  # 批大小=2
    
    with torch.no_grad():
        outputs = model(batch_images)
    
    features = outputs['keypoint_features']  # (2, 17, 256)
    
    print("\n示例 1: 提取特定关键点的特征")
    print("-" * 80)
    nose_features = features[:, 0, :]  # 获取鼻子关键点的特征
    print(f"鼻子关键点特征形状: {nose_features.shape}")  # (2, 256)
    print(f"说明: 批中第一张图像的鼻子特征: {nose_features[0, :5]}...")
    
    print("\n示例 2: 特征相似度计算（用于跟踪或匹配）")
    print("-" * 80)
    # 计算两张图像中相同关键点的相似度
    cosine_sim = torch.nn.functional.cosine_similarity(
        features[0, :, :], features[1, :, :]  # (17, 256) 和 (17, 256)
    )  # 输出 (17,)
    print(f"两张图像对应关键点的余弦相似度: {cosine_sim}")
    
    print("\n示例 3: 关键点特征的统计分析")
    print("-" * 80)
    all_features = features.reshape(-1, 256)  # 展平到 (34, 256)
    mean_feat = all_features.mean(dim=0)  # (256,)
    std_feat = all_features.std(dim=0)    # (256,)
    print(f"所有关键点特征的均值: {mean_feat[:5]}...")
    print(f"所有关键点特征的标准差: {std_feat[:5]}...")


def demo_compare_models():
    """对比两个模型"""
    print("\n" + "=" * 80)
    print("模型对比：Transformer vs Simple")
    print("=" * 80)
    
    batch_images = torch.randn(1, 3, 256, 256)
    
    # SimplePoseModel
    print("\n📊 SimplePoseModel")
    simple_model = SimplePoseModel(num_keypoints=17, feature_dim=256)
    simple_params = sum(p.numel() for p in simple_model.parameters())
    print(f"参数数量: {simple_params:,}")
    
    with torch.no_grad():
        simple_outputs = simple_model(batch_images)
    
    print(f"倒数第二层特征形状: {simple_outputs['keypoint_features'].shape}")
    print(f"特征维度: 256")
    
    # PoseTransformerModel
    print("\n📊 PoseTransformerModel")
    transformer_model = PoseTransformerModel(
        image_size=256,
        patch_size=16,
        num_heads=8,
        num_layers=12,
        dim=768,
        num_keypoints=17,
    )
    transformer_params = sum(p.numel() for p in transformer_model.parameters())
    print(f"参数数量: {transformer_params:,}")
    
    with torch.no_grad():
        transformer_outputs = transformer_model(batch_images)
    
    print(f"倒数第二层特征形状: {transformer_outputs['keypoint_features'].shape}")
    print(f"特征维度: 768")
    
    print("\n对比:")
    print(f"参数数量比: Transformer / Simple = {transformer_params / simple_params:.1f}x")
    print(f"特征维度比: Transformer / Simple = {768 / 256:.1f}x")
    print(f"推荐: 快速原型用 SimplePoseModel，精度要求高用 Transformer")


def main():
    """主演示函数"""
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 78 + "║")
    print("║" + "  COCO 关键点姿态估计 - 修改后的模型架构演示".center(78) + "║")
    print("║" + " " * 78 + "║")
    print("╚" + "=" * 78 + "╝")
    
    # 运行演示
    demo_model_architecture()
    demo_feature_usage()
    demo_compare_models()
    
    # 总结
    print("\n" + "=" * 80)
    print("总结")
    print("=" * 80)
    print("""
✅ 模型已修改为倒数第二层输出 17 个关节节点的特征向量

关键特性：
1. 倒数第二层特征 (keypoint_features)
   - SimplePoseModel: (batch_size, 17, 256)
   - PoseTransformerModel: (batch_size, 17, 768)
   
2. 倒数第一层输出：
   - keypoints: 关键点坐标 (batch_size, 17, 2)
   - confidence: 关键点置信度 (batch_size, 17)

3. 使用场景：
   ✓ 关键点坐标预测
   ✓ 人体姿态估计
   ✓ 特征相似度匹配
   ✓ 动作识别的特征提取
   ✓ 跟踪和关联

下一步：
1. 使用 COCO 数据集训练模型
   python train_coco_keypoints.py \\
       --model-type simple \\
       --train-image-dir /path/to/coco/train2017 \\
       --train-ann-file /path/to/person_keypoints_train2017.json

2. 推理和可视化
   python inference.py \\
       --model-path ./checkpoints/best_model.pth \\
       --image-path /path/to/test/image.jpg

3. 详细指南见: COCO_KEYPOINTS_GUIDE.md
    """)
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
