"""
测试YOLO模型在空白图像上的置信度分布
验证模型是否存在训练数据记忆
"""

import numpy as np
import json
from ultralytics import YOLO

# 加载YOLO模型
model = YOLO('yolov8n-pose.pt')

# 创建不同的测试图像
test_images = {}

# 1. 完全黑色图像（1280x720）
black_image = np.zeros((720, 1280, 3), dtype=np.uint8)
test_images['黑色图像'] = black_image

# 2. 完全白色图像
white_image = np.ones((720, 1280, 3), dtype=np.uint8) * 255
test_images['白色图像'] = white_image

# 3. 灰色图像
gray_image = np.ones((720, 1280, 3), dtype=np.uint8) * 128
test_images['灰色图像'] = gray_image

# 4. 随机噪声图像
noise_image = np.random.randint(0, 256, (720, 1280, 3), dtype=np.uint8)
test_images['随机噪声'] = noise_image

# 5. 梯度图像
gradient = np.linspace(0, 255, 1280, dtype=np.uint8)
gradient_image = np.tile(gradient, (720, 1, 3))
test_images['梯度图像'] = gradient_image

# 标准关键点名称和顺序
keypoint_names = [
    'nose', 
    'left_eye', 'right_eye',
    'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder',
    'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist',
    'left_hip', 'right_hip',
    'left_knee', 'right_knee',
    'left_ankle', 'right_ankle'
]

results_all = {
    'metadata': {
        'description': '在各种空白/无内容图像上测试YOLO pose模型的置信度',
        'model': 'yolov8n-pose',
        'image_size': (1280, 720),
        'test_count': len(test_images)
    },
    'results': {}
}

print("=" * 80)
print("YOLO姿态模型 - 空白图像置信度测试")
print("=" * 80)

for image_type, image in test_images.items():
    print(f"\n【{image_type}】")
    print("-" * 40)
    
    # 推理
    results = model(image, verbose=False)
    result = results[0]
    
    confidences = {kp: 0.0 for kp in keypoint_names}
    person_count = 0
    
    # 提取置信度
    if result.keypoints is not None:
        keypoints = result.keypoints.data.cpu().numpy()  # shape: (n_people, 17, 3)
        
        if len(keypoints) > 0:
            person_count = len(keypoints)
            # 计算平均置信度
            for person_idx in range(len(keypoints)):
                for kp_idx, kp_name in enumerate(keypoint_names):
                    conf = float(keypoints[person_idx, kp_idx, 2])
                    confidences[kp_name] += conf
            
            # 取平均
            for kp_name in confidences:
                confidences[kp_name] /= person_count
    
    # 存储结果
    results_all['results'][image_type] = {
        'person_detected': person_count,
        'confidences': confidences
    }
    
    # 打印结果
    if person_count > 0:
        print(f"检测到 {person_count} 个人物")
        print("\n关键点平均置信度：")
        sorted_kps = sorted(confidences.items(), key=lambda x: x[1], reverse=True)
        for kp_name, conf in sorted_kps:
            bar_length = int(conf * 30)
            bar = '█' * bar_length + '░' * (30 - bar_length)
            print(f"  {kp_name:15} {conf:6.4f} {bar}")
    else:
        print("未检测到人物")

# 保存结果
output_file = 'src/data/blank_image_test_results.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(results_all, f, ensure_ascii=False, indent=2)

print("\n" + "=" * 80)
print(f"✓ 测试结果已保存到: {output_file}")
print("=" * 80)

# 分析
print("\n【分析】")
print("-" * 40)
print("如果在所有空白图像上，模型都显示类似的置信度分布（高-低-高等），")
print("这说明模型存在强烈的'训练数据记忆'，而不是基于图像内容决策。")
