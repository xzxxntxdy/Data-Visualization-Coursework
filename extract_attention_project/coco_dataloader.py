"""
COCO Keypoints 数据集加载器
专用于加载和处理 COCO person_keypoints 数据集
支持 17 个关键点的标注
"""

import os
import json
import torch
import numpy as np
import cv2
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from typing import Dict, List, Tuple, Optional
from PIL import Image


# COCO 17 个关键点定义
COCO_KEYPOINT_NAMES = [
    'nose',           # 0
    'left_eye',       # 1
    'right_eye',      # 2
    'left_ear',       # 3
    'right_ear',      # 4
    'left_shoulder',  # 5
    'right_shoulder', # 6
    'left_elbow',     # 7
    'right_elbow',    # 8
    'left_wrist',     # 9
    'right_wrist',    # 10
    'left_hip',       # 11
    'right_hip',      # 12
    'left_knee',      # 13
    'right_knee',     # 14
    'left_ankle',     # 15
    'right_ankle',    # 16
]


class COCOKeypointsDataset(Dataset):
    """
    COCO Keypoints 数据集加载器
    
    加载 COCO person_keypoints 标注文件
    每张图像中只使用第一个人物的关键点标注
    """
    
    def __init__(
        self,
        image_dir: str,
        annotations_file: str,
        image_size: int = 256,
        num_keypoints: int = 17,
        use_augmentation: bool = False,
        max_samples: Optional[int] = None,
    ):
        """
        初始化 COCO 数据集加载器
        
        Args:
            image_dir: COCO 图像文件夹路径
            annotations_file: person_keypoints_train2017.json 或 person_keypoints_val2017.json
            image_size: 输入图像大小
            num_keypoints: 关键点数量（应为 17）
            use_augmentation: 是否使用数据增强
            max_samples: 最多加载的样本数（用于快速测试）
        """
        self.image_dir = image_dir
        self.image_size = image_size
        self.num_keypoints = num_keypoints
        self.use_augmentation = use_augmentation
        self.max_samples = max_samples
        
        # 加载 COCO 标注
        self.data = self._load_coco_annotations(annotations_file)
        
        # 数据变换
        if use_augmentation:
            self.transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
                transforms.RandomAffine(degrees=10, translate=(0.1, 0.1), scale=(0.9, 1.1)),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225],
                ),
            ])
        else:
            self.transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225],
                ),
            ])
    
    def _load_coco_annotations(self, annotations_file: str) -> List[Dict]:
        """
        加载 COCO keypoints 标注文件
        
        Returns:
            样本列表，每个样本包含图像和关键点信息
        """
        print(f"加载 COCO 标注文件: {annotations_file}")
        
        with open(annotations_file, 'r') as f:
            coco_data = json.load(f)
        
        # 构建图像 ID 到信息的映射
        images_info = {img['id']: img for img in coco_data['images']}
        
        # 组织标注：按图像 ID 分组
        image_annotations = {}
        for ann in coco_data['annotations']:
            img_id = ann['image_id']
            if img_id not in image_annotations:
                image_annotations[img_id] = []
            image_annotations[img_id].append(ann)
        
        # 创建数据样本
        samples = []
        skipped = 0
        
        for img_id, annotations in image_annotations.items():
            if img_id not in images_info:
                continue
            
            # 只使用有有效关键点的标注
            for ann in annotations:
                keypoints = np.array(ann['keypoints']).reshape(-1, 3)
                
                # 检查是否有有效的关键点（至少 5 个关键点）
                valid_keypoints = np.sum(keypoints[:, 2] > 0)
                if valid_keypoints < 5:
                    skipped += 1
                    continue
                
                samples.append({
                    'image_id': img_id,
                    'image_path': os.path.join(self.image_dir, images_info[img_id]['file_name']),
                    'keypoints': keypoints,
                    'bbox': ann['bbox'],  # [x, y, width, height]
                    'area': ann.get('area', 0),
                })
                
                if self.max_samples and len(samples) >= self.max_samples:
                    break
            
            if self.max_samples and len(samples) >= self.max_samples:
                break
        
        print(f"成功加载 {len(samples)} 个样本，跳过 {skipped} 个无效样本")
        return samples
    
    def __len__(self) -> int:
        """返回数据集大小"""
        return len(self.data)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        """
        获取数据项
        
        Returns:
            包含以下键的字典：
            - 'image': 输入图像张量 (3, H, W)
            - 'keypoints': 关键点坐标 (17, 2)，归一化到 [0, 1]
            - 'confidence': 关键点置信度/可见性 (17,)
            - 'heatmap': 关键点热力图 (16, 16)
            - 'image_path': 原始图像路径（用于调试）
        """
        sample = self.data[idx]
        
        # 加载图像
        image_path = sample['image_path']
        image = cv2.imread(image_path)
        
        if image is None:
            raise ValueError(f"无法读取图像: {image_path}")
        
        # BGR -> RGB
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # 获取原始图像尺寸
        original_h, original_w = image.shape[:2]
        
        # 调整大小到模型输入大小
        image = cv2.resize(image, (self.image_size, self.image_size))
        
        # 处理关键点坐标
        keypoints = sample['keypoints'].copy()  # (17, 3) - [x, y, visibility]
        bbox = sample['bbox']  # [x, y, width, height]
        
        # 缩放因子
        scale_x = self.image_size / original_w
        scale_y = self.image_size / original_h
        
        # 转换关键点坐标到调整后的图像空间
        keypoints[:, 0] = keypoints[:, 0] * scale_x
        keypoints[:, 1] = keypoints[:, 1] * scale_y
        
        # 提取坐标和可见性
        kp_coords = keypoints[:, :2].astype(np.float32)  # (17, 2)
        kp_visibility = keypoints[:, 2].astype(np.float32)  # (17,)
        
        # 归一化关键点到 [0, 1]
        kp_coords_normalized = kp_coords / self.image_size
        kp_coords_normalized = np.clip(kp_coords_normalized, 0, 1)
        
        # 将可见性标志转换为二进制（0 或 1）
        kp_visibility = np.clip(kp_visibility, 0, 1)
        
        # 转换为 PIL 图像
        image_pil = Image.fromarray(image)
        
        # 应用变换
        image = self.transform(image_pil)  # (3, H, W)
        
        # 生成热力图
        heatmap = self._generate_keypoint_heatmap(kp_coords_normalized, kp_visibility)
        
        return {
            'image': image,
            'keypoints': torch.tensor(kp_coords_normalized, dtype=torch.float32),
            'confidence': torch.tensor(kp_visibility, dtype=torch.float32),
            'heatmap': torch.tensor(heatmap, dtype=torch.float32),
            'image_path': image_path,
        }
    
    def _generate_keypoint_heatmap(
        self,
        keypoints: np.ndarray,
        visibility: np.ndarray,
        heatmap_size: int = 16,
        sigma: float = 2.0,
    ) -> np.ndarray:
        """
        为关键点生成高斯热力图
        
        Args:
            keypoints: 归一化的关键点坐标 (17, 2)，值在 [0, 1]
            visibility: 关键点可见性标志 (17,)
            heatmap_size: 输出热力图尺寸
            sigma: 高斯核标准差
            
        Returns:
            热力图 (heatmap_size, heatmap_size)
        """
        heatmap = np.zeros((heatmap_size, heatmap_size), dtype=np.float32)
        
        # 创建网格
        y_coords, x_coords = np.mgrid[0:heatmap_size, 0:heatmap_size]
        
        # 为每个可见的关键点生成高斯热力图
        for kp_idx in range(len(keypoints)):
            if visibility[kp_idx] > 0:
                # 转换到热力图坐标
                kp_x = keypoints[kp_idx, 0] * heatmap_size
                kp_y = keypoints[kp_idx, 1] * heatmap_size
                
                # 计算高斯
                gaussian = np.exp(-((x_coords - kp_x) ** 2 + (y_coords - kp_y) ** 2) / (2 * sigma ** 2))
                
                # 取最大值（多个关键点可能重叠）
                heatmap = np.maximum(heatmap, gaussian)
        
        # 标准化到 [0, 1]
        if heatmap.max() > 0:
            heatmap = heatmap / heatmap.max()
        
        return heatmap


def create_coco_dataloader(
    image_dir: str,
    annotations_file: str,
    batch_size: int = 16,
    image_size: int = 256,
    use_augmentation: bool = False,
    num_workers: int = 4,
    shuffle: bool = True,
    max_samples: Optional[int] = None,
) -> DataLoader:
    """
    创建 COCO keypoints 数据加载器
    
    Args:
        image_dir: 图像文件夹路径
        annotations_file: 标注文件路径
        batch_size: 批大小
        image_size: 输入图像大小
        use_augmentation: 是否使用数据增强
        num_workers: 数据加载工作线程数
        shuffle: 是否打乱数据
        max_samples: 最多加载的样本数
        
    Returns:
        PyTorch DataLoader
    """
    dataset = COCOKeypointsDataset(
        image_dir=image_dir,
        annotations_file=annotations_file,
        image_size=image_size,
        use_augmentation=use_augmentation,
        max_samples=max_samples,
    )
    
    dataloader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=True,
    )
    
    return dataloader


if __name__ == "__main__":
    # 测试数据加载器
    print("测试 COCO Keypoints 数据加载器...")
    
    # 配置路径（需要根据实际情况修改）
    IMAGE_DIR = "path/to/coco/train2017"
    ANN_FILE = "path/to/person_keypoints_train2017.json"
    
    # 创建数据集
    dataset = COCOKeypointsDataset(
        image_dir=IMAGE_DIR,
        annotations_file=ANN_FILE,
        image_size=256,
        max_samples=10,  # 仅加载 10 个样本进行测试
    )
    
    print(f"数据集大小: {len(dataset)}")
    
    # 获取一个样本
    sample = dataset[0]
    print(f"\n样本形状:")
    print(f"  图像: {sample['image'].shape}")
    print(f"  关键点: {sample['keypoints'].shape}")
    print(f"  置信度: {sample['confidence'].shape}")
    print(f"  热力图: {sample['heatmap'].shape}")
    
    # 创建数据加载器
    dataloader = create_coco_dataloader(
        image_dir=IMAGE_DIR,
        annotations_file=ANN_FILE,
        batch_size=4,
        max_samples=20,
    )
    
    # 获取一个批次
    batch = next(iter(dataloader))
    print(f"\n批次大小: {batch['image'].shape[0]}")
    print(f"批次图像形状: {batch['image'].shape}")
    print(f"批次关键点形状: {batch['keypoints'].shape}")
    print(f"批次置信度形状: {batch['confidence'].shape}")
