"""
数据加载和预处理模块
支持 COCO 数据集和本地图像文件夹
"""

import os
import json
import torch
import numpy as np
import cv2
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from typing import Dict, List, Tuple, Optional
import random


class PoseDataset(Dataset):
    """
    姿态估计数据集
    支持加载 COCO 格式或简单的图像文件夹
    """
    
    def __init__(
        self,
        image_dir: str,
        annotations_file: Optional[str] = None,
        image_size: int = 256,
        num_keypoints: int = 17,
        use_augmentation: bool = False,
    ):
        """
        初始化数据集
        
        Args:
            image_dir: 图像文件夹路径
            annotations_file: COCO 格式的标注文件路径（可选）
            image_size: 输入图像大小
            num_keypoints: 关键点数量
            use_augmentation: 是否使用数据增强
        """
        self.image_dir = image_dir
        self.image_size = image_size
        self.num_keypoints = num_keypoints
        self.use_augmentation = use_augmentation
        
        # 图像列表
        self.image_files = []
        self.annotations = {}
        
        # 加载图像
        self._load_images()
        
        # 如果有标注文件，加载标注
        if annotations_file and os.path.exists(annotations_file):
            self._load_annotations(annotations_file)
        
        # 数据变换
        if use_augmentation:
            self.transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.ColorJitter(brightness=0.2, contrast=0.2),
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
    
    def _load_images(self):
        """加载图像文件列表"""
        if not os.path.exists(self.image_dir):
            raise ValueError(f"图像文件夹不存在: {self.image_dir}")
        
        valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp'}
        for filename in os.listdir(self.image_dir):
            if os.path.splitext(filename)[1].lower() in valid_extensions:
                self.image_files.append(filename)
        
        if len(self.image_files) == 0:
            raise ValueError(f"在 {self.image_dir} 中未找到任何图像文件")
        
        # 排序以确保可重现性
        self.image_files.sort()
        print(f"加载了 {len(self.image_files)} 张图像")
    
    def _load_annotations(self, annotations_file: str):
        """加载 COCO 格式的标注"""
        try:
            with open(annotations_file, 'r') as f:
                data = json.load(f)
            
            # 提取关键点标注
            for img_info in data.get('images', []):
                img_id = img_info['id']
                self.annotations[img_id] = {
                    'keypoints': np.zeros((self.num_keypoints, 2)),
                    'visibility': np.ones(self.num_keypoints),
                }
            
            for ann in data.get('annotations', []):
                img_id = ann['image_id']
                keypoints = np.array(ann['keypoints']).reshape(-1, 3)
                if img_id in self.annotations:
                    self.annotations[img_id]['keypoints'] = keypoints[:, :2]
                    self.annotations[img_id]['visibility'] = keypoints[:, 2]
            
            print(f"加载了 {len(self.annotations)} 个标注")
        except Exception as e:
            print(f"加载标注文件失败: {e}")
    
    def __len__(self) -> int:
        """返回数据集大小"""
        return len(self.image_files)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        """
        获取数据项
        
        Returns:
            包含以下键的字典：
            - 'image': 输入图像张量
            - 'keypoints': 关键点坐标
            - 'visibility': 关键点可见性
            - 'heatmap': 生成的热力图（目标）
        """
        # 加载图像
        img_path = os.path.join(self.image_dir, self.image_files[idx])
        image = cv2.imread(img_path)
        
        if image is None:
            raise ValueError(f"无法读取图像: {img_path}")
        
        # BGR -> RGB
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # 调整大小
        h, w = image.shape[:2]
        image = cv2.resize(image, (self.image_size, self.image_size))
        
        # 转换为 PIL 图像以使用 transforms
        from PIL import Image
        image = Image.fromarray(image)
        
        # 应用变换
        image = self.transform(image)  # (3, H, W)
        
        # 获取关键点标注
        img_id = int(self.image_files[idx].split('.')[0])
        
        if img_id in self.annotations:
            keypoints = self.annotations[img_id]['keypoints']
            visibility = self.annotations[img_id]['visibility']
        else:
            # 如果没有标注，生成随机关键点
            keypoints = np.random.rand(self.num_keypoints, 2) * self.image_size
            visibility = np.ones(self.num_keypoints)
        
        # 标准化关键点到 [0, 1]
        keypoints = keypoints / self.image_size
        keypoints = np.clip(keypoints, 0, 1)
        
        # 生成热力图（简单方法）
        heatmap = self._generate_heatmap(keypoints, visibility)
        
        return {
            'image': image,
            'keypoints': torch.tensor(keypoints, dtype=torch.float32),
            'visibility': torch.tensor(visibility, dtype=torch.float32),
            'heatmap': torch.tensor(heatmap, dtype=torch.float32),
        }
    
    def _generate_heatmap(
        self, keypoints: np.ndarray, visibility: np.ndarray,
        heatmap_size: int = 16, sigma: float = 2.0
    ) -> np.ndarray:
        """
        生成关键点热力图
        
        Args:
            keypoints: 关键点坐标 (num_keypoints, 2)，值在 [0, 1]
            visibility: 关键点可见性 (num_keypoints,)
            heatmap_size: 热力图大小
            sigma: 高斯核标准差
            
        Returns:
            热力图 (heatmap_size, heatmap_size)
        """
        heatmap = np.zeros((heatmap_size, heatmap_size), dtype=np.float32)
        
        # 为每个可见的关键点添加高斯
        for kp_idx in range(len(keypoints)):
            if visibility[kp_idx] > 0:
                # 转换到热力图坐标
                x = keypoints[kp_idx, 0] * heatmap_size
                y = keypoints[kp_idx, 1] * heatmap_size
                
                # 创建高斯热力图
                for i in range(heatmap_size):
                    for j in range(heatmap_size):
                        dist_sq = (i - y) ** 2 + (j - x) ** 2
                        gaussian = np.exp(-dist_sq / (2 * sigma ** 2))
                        heatmap[i, j] = max(heatmap[i, j], gaussian)
        
        # 标准化
        if heatmap.max() > 0:
            heatmap = heatmap / heatmap.max()
        
        return heatmap


class SimpleImageDataset(Dataset):
    """
    简单的图像数据集（不需要标注）
    用于快速测试或当没有标注数据时
    """
    
    def __init__(
        self,
        image_dir: str,
        image_size: int = 256,
    ):
        """
        初始化数据集
        
        Args:
            image_dir: 图像文件夹路径
            image_size: 输入图像大小
        """
        self.image_dir = image_dir
        self.image_size = image_size
        
        # 加载图像
        self.image_files = []
        valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp'}
        for filename in os.listdir(image_dir):
            if os.path.splitext(filename)[1].lower() in valid_extensions:
                self.image_files.append(filename)
        
        self.image_files.sort()
        
        if len(self.image_files) == 0:
            raise ValueError(f"在 {image_dir} 中未找到任何图像文件")
        
        # 标准化变换
        self.transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])
    
    def __len__(self) -> int:
        return len(self.image_files)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        """获取数据项"""
        img_path = os.path.join(self.image_dir, self.image_files[idx])
        image = cv2.imread(img_path)
        
        if image is None:
            raise ValueError(f"无法读取图像: {img_path}")
        
        # BGR -> RGB
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # 调整大小
        image = cv2.resize(image, (self.image_size, self.image_size))
        
        # 转换为 PIL 图像
        from PIL import Image
        image = Image.fromarray(image)
        
        # 应用变换
        image = self.transform(image)
        
        return {
            'image': image,
            'filename': self.image_files[idx],
        }


def create_dataloader(
    image_dir: str,
    annotations_file: Optional[str] = None,
    batch_size: int = 32,
    num_workers: int = 4,
    shuffle: bool = True,
    image_size: int = 256,
    use_augmentation: bool = False,
) -> DataLoader:
    """
    创建数据加载器
    
    Args:
        image_dir: 图像文件夹路径
        annotations_file: 标注文件路径（可选）
        batch_size: 批大小
        num_workers: 数据加载工作进程数
        shuffle: 是否打乱数据
        image_size: 输入图像大小
        use_augmentation: 是否使用数据增强
        
    Returns:
        DataLoader 对象
    """
    if annotations_file:
        dataset = PoseDataset(
            image_dir=image_dir,
            annotations_file=annotations_file,
            image_size=image_size,
            use_augmentation=use_augmentation,
        )
    else:
        dataset = SimpleImageDataset(
            image_dir=image_dir,
            image_size=image_size,
        )
    
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=True,
    )


def create_dummy_dataset(
    output_dir: str,
    num_images: int = 100,
    image_size: int = 256,
    num_keypoints: int = 17,
) -> str:
    """
    创建虚拟数据集用于测试
    
    Args:
        output_dir: 输出目录
        num_images: 图像数量
        image_size: 图像大小
        num_keypoints: 关键点数量
        
    Returns:
        数据集文件夹路径
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # COCO 关键点名称
    keypoint_names = [
        'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
        'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
        'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
    ]
    
    # 创建图像和标注
    images = []
    annotations = []
    
    for img_id in range(num_images):
        # 生成随机图像
        image_array = np.random.randint(0, 256, (image_size, image_size, 3), dtype=np.uint8)
        img_path = os.path.join(output_dir, f'{img_id:06d}.jpg')
        cv2.imwrite(img_path, image_array)
        
        # 创建图像信息
        images.append({
            'id': img_id,
            'file_name': f'{img_id:06d}.jpg',
            'height': image_size,
            'width': image_size,
        })
        
        # 随机生成关键点
        keypoints = []
        for kp_idx in range(num_keypoints):
            x = random.randint(0, image_size - 1)
            y = random.randint(0, image_size - 1)
            visibility = random.choice([0, 1, 2])  # 0: 不可见, 1: 遮挡, 2: 可见
            keypoints.extend([x, y, visibility])
        
        annotations.append({
            'id': img_id,
            'image_id': img_id,
            'category_id': 1,
            'keypoints': keypoints,
            'num_keypoints': num_keypoints,
            'area': 0,
            'iscrowd': 0,
            'bbox': [0, 0, image_size, image_size],
        })
    
    # 创建 COCO 格式的标注文件
    coco_data = {
        'info': {
            'description': 'Dummy Pose Dataset',
            'version': '1.0',
            'year': 2024,
        },
        'licenses': [],
        'images': images,
        'annotations': annotations,
        'categories': [
            {
                'id': 1,
                'name': 'person',
                'supercategory': 'person',
                'keypoints': keypoint_names,
                'skeleton': [],
            }
        ],
    }
    
    annotations_path = os.path.join(output_dir, 'annotations.json')
    with open(annotations_path, 'w') as f:
        json.dump(coco_data, f, indent=2)
    
    print(f"创建了虚拟数据集:")
    print(f"  图像: {output_dir}")
    print(f"  标注: {annotations_path}")
    print(f"  图像数量: {num_images}")
    
    return output_dir


if __name__ == "__main__":
    # 创建虚拟数据集
    dataset_dir = create_dummy_dataset(
        output_dir='/tmp/dummy_pose_dataset',
        num_images=10,
    )
    
    # 创建数据加载器
    dataloader = create_dataloader(
        image_dir=dataset_dir,
        annotations_file=os.path.join(dataset_dir, 'annotations.json'),
        batch_size=4,
        num_workers=0,
    )
    
    # 测试数据加载
    for batch in dataloader:
        print("批数据:")
        print(f"  图像形状: {batch['image'].shape}")
        print(f"  关键点形状: {batch['keypoints'].shape}")
        print(f"  热力图形状: {batch['heatmap'].shape}")
        break
