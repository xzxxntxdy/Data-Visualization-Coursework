"""
Vision Transformer 基于的姿态估计模型架构
支持注意力权重的提取和可视化
"""

import torch
import torch.nn as nn
import numpy as np
from typing import Dict, List, Tuple, Optional


class AttentionHook:
    """用于捕获注意力权重的 Hook"""
    
    def __init__(self):
        self.attention_maps = []
        
    def __call__(self, module, input, output):
        """捕获注意力权重"""
        if isinstance(output, tuple):
            # 对于多头注意力，output[0] 是注意力权重
            attn_weights = output[0]
        else:
            attn_weights = output
            
        self.attention_maps.append(attn_weights.detach())
        
    def get_attention_maps(self):
        """获取捕获的注意力权重"""
        return self.attention_maps
    
    def clear(self):
        """清除捕获的权重"""
        self.attention_maps = []


class TransformerEncoderBlock(nn.Module):
    """Transformer 编码器块（带注意力捕获）"""
    
    def __init__(self, dim: int, num_heads: int, mlp_ratio: float = 4.0, 
                 dropout: float = 0.1):
        super().__init__()
        self.norm1 = nn.LayerNorm(dim)
        self.attn = nn.MultiheadAttention(
            dim, num_heads, dropout=dropout, batch_first=True
        )
        self.norm2 = nn.LayerNorm(dim)
        
        mlp_dim = int(dim * mlp_ratio)
        self.mlp = nn.Sequential(
            nn.Linear(dim, mlp_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(mlp_dim, dim),
            nn.Dropout(dropout),
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """前向传播"""
        # 自注意力
        x_norm = self.norm1(x)
        attn_out, _ = self.attn(x_norm, x_norm, x_norm)
        x = x + attn_out
        
        # 前馈网络
        x = x + self.mlp(self.norm2(x))
        return x


class PoseTransformerModel(nn.Module):
    """
    Vision Transformer 基于的姿态估计模型
    
    用于从图像中检测人体关键点
    """
    
    def __init__(
        self,
        image_size: int = 256,
        patch_size: int = 16,
        num_heads: int = 8,
        num_layers: int = 12,
        dim: int = 768,
        num_keypoints: int = 17,
        dropout: float = 0.1,
    ):
        super().__init__()
        
        self.image_size = image_size
        self.patch_size = patch_size
        self.dim = dim
        self.num_heads = num_heads
        self.num_layers = num_layers
        self.num_keypoints = num_keypoints
        
        # 计算补丁数量
        self.num_patches = (image_size // patch_size) ** 2
        
        # 图像转补丁嵌入
        self.patch_embed = nn.Conv2d(
            3, dim, kernel_size=patch_size, stride=patch_size
        )
        
        # 位置嵌入
        self.pos_embed = nn.Parameter(
            torch.randn(1, self.num_patches + 1, dim) * 0.02
        )
        
        # 类别令牌
        self.cls_token = nn.Parameter(torch.randn(1, 1, dim) * 0.02)
        
        # Dropout
        self.dropout = nn.Dropout(dropout)
        
        # Transformer 编码器
        self.transformer_blocks = nn.ModuleList([
            TransformerEncoderBlock(dim, num_heads, dropout=dropout)
            for _ in range(num_layers)
        ])
        
        # 输出头（关键点预测）
        self.norm = nn.LayerNorm(dim)
        
        # 倒数第二层：将特征映射到 17 个关节节点的特征向量（每个节点 dim 维）
        # 这是关键点特征的中间表示
        self.keypoint_features = nn.Linear(dim, num_keypoints * dim)
        
        # 倒数第一层：从 17 个关节特征输出关键点坐标和置信度
        self.keypoint_head = nn.Linear(num_keypoints * dim, num_keypoints * 2)
        
        # 关键点置信度头（从关节特征输出）
        self.confidence_head = nn.Linear(num_keypoints * dim, num_keypoints)
        
        # 热力图头（16x16）
        self.heatmap_head = nn.Sequential(
            nn.Linear(dim, 512),
            nn.GELU(),
            nn.Linear(512, 16 * 16),
        )
        
        # 初始化权重
        self._init_weights()
        
    def _init_weights(self):
        """初始化网络权重"""
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.trunc_normal_(m.weight, std=0.02)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.LayerNorm):
                nn.init.constant_(m.bias, 0)
                nn.init.constant_(m.weight, 1.0)
                
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        前向传播
        
        Args:
            x: 输入图像张量 (B, 3, H, W)
            
        Returns:
            包含以下键的字典：
            - 'keypoints': 关键点坐标 (B, num_keypoints, 2)
            - 'confidence': 关键点置信度 (B, num_keypoints)
            - 'heatmap': 注意力热力图 (B, 16, 16)
            - 'keypoint_features': 关键点特征（倒数第二层） (B, num_keypoints, dim)
        """
        B = x.shape[0]
        
        # 图像转补丁嵌入 (B, dim, H//P, W//P) -> (B, num_patches, dim)
        x = self.patch_embed(x)
        x = x.flatten(2).transpose(1, 2)  # (B, num_patches, dim)
        
        # 添加类别令牌
        cls_token = self.cls_token.expand(B, -1, -1)  # (B, 1, dim)
        x = torch.cat([cls_token, x], dim=1)  # (B, num_patches + 1, dim)
        
        # 添加位置嵌入
        x = x + self.pos_embed
        x = self.dropout(x)
        
        # Transformer 编码器
        for block in self.transformer_blocks:
            x = block(x)
            
        # 使用类别令牌的输出
        x = self.norm(x[:, 0])  # (B, dim)
        
        # 倒数第二层：生成 17 个关节节点的特征向量
        keypoint_features = self.keypoint_features(x)  # (B, num_keypoints * dim)
        keypoint_features = keypoint_features.reshape(B, self.num_keypoints, self.dim)  # (B, num_keypoints, dim)
        
        # 倒数第一层：从关键点特征输出坐标和置信度
        keypoint_features_flat = keypoint_features.reshape(B, -1)  # (B, num_keypoints * dim)
        
        # 预测关键点
        keypoints = self.keypoint_head(keypoint_features_flat)  # (B, num_keypoints * 2)
        keypoints = keypoints.reshape(B, self.num_keypoints, 2)
        
        # 预测置信度
        confidence = self.confidence_head(keypoint_features_flat)  # (B, num_keypoints)
        confidence = torch.sigmoid(confidence)  # 限制到 [0, 1]
        
        # 生成热力图（注意力机制的可视化）
        heatmap_logits = self.heatmap_head(x)  # (B, 16*16)
        heatmap = torch.sigmoid(heatmap_logits).reshape(B, 16, 16)
        
        return {
            'keypoints': keypoints,
            'confidence': confidence,
            'heatmap': heatmap,
            'keypoint_features': keypoint_features,  # 倒数第二层特征
        }
        
    def register_attention_hooks(self) -> Dict[int, AttentionHook]:
        """
        为模型的注意力层注册 Hook
        
        Returns:
            Hook 对象的字典
        """
        hooks = {}
        for idx, block in enumerate(self.transformer_blocks):
            hook = AttentionHook()
            block.attn.register_forward_hook(hook)
            hooks[idx] = hook
        return hooks
    
    def get_attention_weights(self, hooks: Dict[int, AttentionHook]) -> List[torch.Tensor]:
        """
        获取所有注意力权重
        
        Args:
            hooks: 注意力 Hook 字典
            
        Returns:
            注意力权重列表
        """
        all_weights = []
        for idx in sorted(hooks.keys()):
            weights = hooks[idx].get_attention_maps()
            all_weights.extend(weights)
        return all_weights


class SimplePoseModel(nn.Module):
    """
    简化的姿态估计模型（用于快速测试）
    使用 CNN + FC 混合架构
    倒数第二层输出 17 个关节节点的特征向量
    """
    
    def __init__(self, num_keypoints: int = 17, feature_dim: int = 256):
        super().__init__()
        
        self.num_keypoints = num_keypoints
        self.feature_dim = feature_dim
        
        # CNN 主干
        self.backbone = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1),
            
            nn.Conv2d(64, 128, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            
            nn.Conv2d(128, 256, kernel_size=3, stride=2, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
        )
        
        # 自适应池化
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        
        # 倒数第二层：生成 17 个关节节点的特征向量（每个 feature_dim 维）
        self.feature_fc = nn.Sequential(
            nn.Linear(256, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.5),
            nn.Linear(512, num_keypoints * feature_dim),
        )
        
        # 倒数第一层：从关节特征输出关键点坐标
        self.keypoint_head = nn.Linear(num_keypoints * feature_dim, num_keypoints * 2)
        
        # 置信度预测头
        self.confidence_head = nn.Linear(num_keypoints * feature_dim, num_keypoints)
        
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """前向传播"""
        # CNN 提取特征
        features = self.backbone(x)  # (B, 256, H//8, W//8)
        
        # 全局平均池化
        pooled = self.avgpool(features)  # (B, 256, 1, 1)
        pooled = pooled.flatten(1)  # (B, 256)
        
        # 倒数第二层：生成关键点特征
        keypoint_features_flat = self.feature_fc(pooled)  # (B, num_keypoints * feature_dim)
        keypoint_features = keypoint_features_flat.reshape(
            -1, self.num_keypoints, self.feature_dim
        )  # (B, num_keypoints, feature_dim)
        
        # 倒数第一层：关键点坐标
        keypoints = self.keypoint_head(keypoint_features_flat)
        keypoints = keypoints.reshape(-1, self.num_keypoints, 2)
        
        # 置信度
        confidence = torch.sigmoid(self.confidence_head(keypoint_features_flat))
        
        # 简单热力图（基于特征图的平均值）
        heatmap = torch.mean(features, dim=1)  # (B, H//8, W//8)
        # 调整大小到 16x16
        heatmap = torch.nn.functional.interpolate(
            heatmap.unsqueeze(1), size=(16, 16), mode='bilinear', align_corners=False
        ).squeeze(1)
        heatmap = torch.sigmoid(heatmap)
        
        return {
            'keypoints': keypoints,
            'confidence': confidence,
            'heatmap': heatmap,
            'keypoint_features': keypoint_features,  # 倒数第二层特征
        }


if __name__ == "__main__":
    # 测试模型
    print("测试 PoseTransformerModel...")
    model = PoseTransformerModel(
        image_size=256,
        patch_size=16,
        num_heads=8,
        num_layers=12,
        dim=768,
        num_keypoints=17,
    )
    
    x = torch.randn(2, 3, 256, 256)
    output = model(x)
    
    print(f"输入形状: {x.shape}")
    print(f"关键点形状: {output['keypoints'].shape}")
    print(f"置信度形状: {output['confidence'].shape}")
    print(f"热力图形状: {output['heatmap'].shape}")
    print(f"关键点特征形状（倒数第二层）: {output['keypoint_features'].shape}")
    print(f"  -> 包含 17 个关节节点，每个 768 维的特征向量")
    
    print("\n模型参数数量:")
    total_params = sum(p.numel() for p in model.parameters())
    print(f"总参数: {total_params:,}")
    
    print("\n\n测试 SimplePoseModel...")
    simple_model = SimplePoseModel(num_keypoints=17, feature_dim=256)
    output = simple_model(x)
    print(f"关键点形状: {output['keypoints'].shape}")
    print(f"置信度形状: {output['confidence'].shape}")
    print(f"热力图形状: {output['heatmap'].shape}")
    print(f"关键点特征形状（倒数第二层）: {output['keypoint_features'].shape}")
    print(f"  -> 包含 17 个关节节点，每个 256 维的特征向量")
