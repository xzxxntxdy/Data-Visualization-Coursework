
import json
import os
import torch
from torch.utils.data import Dataset
from PIL import Image
from torchvision import transforms

class SpatialDataset(Dataset):
    def __init__(self, data_file, img_dir, transform=None):
        """
        Args:
            data_file (str): Path to spatial_data.json
            img_dir (str): Path to Extracted Images directory
            transform (callable, optional): Optional transform to be applied on a sample.
        """
        self.img_dir = img_dir
        self.transform = transform
        
        # Load data
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Load all annotations
        self.annotations = data['annotations']
        
        print(f"Loaded {len(self.annotations)} annotations from spatial_data.json.")

    def __len__(self):
        return len(self.annotations)

    def __getitem__(self, idx):
        ann = self.annotations[idx]
        image_id = ann['image_id']
        category_id = ann['category_id'] # COCO category id
        
        # COCO filename format
        img_filename = f"{str(image_id).zfill(12)}.jpg"
        img_path = os.path.join(self.img_dir, img_filename)
        
        try:
            image = Image.open(img_path).convert("RGB")
        except FileNotFoundError:
            # Create a black image if missing to avoid crashing training, 
            # though preprocessing should handle this.
            # print(f"Warning: Image not found {img_path}")
            image = Image.new('RGB', (256, 256))

        # Get bbox (cx, cy, w, h)
        # Assuming spatial_data.json has these fields normalized?
        # User example: 'cx': 0.8417, 'cy': 0.4908, 'width': 0.0356, 'height': 0.0466
        target = torch.tensor([ann['cx'], ann['cy'], ann['width'], ann['height']], dtype=torch.float32)
        
        if self.transform:
            image = self.transform(image)
            
        return image, target, category_id
