
import os
from torchvision.datasets import VOCDetection

def download_voc():
    # 下载到 src/data/voc
    root = os.path.join("src", "data", "voc")
    os.makedirs(root, exist_ok=True)
    
    print(f"📥 Downloading VOC2007 to {root}...")
    try:
        # download=True 会自动下载并解压
        dataset = VOCDetection(root=root, year='2007', image_set='train', download=True)
        print(f"✅ Download complete. Found {len(dataset)} images.")
    except Exception as e:
        print(f"❌ Download failed: {e}")

if __name__ == "__main__":
    download_voc()
