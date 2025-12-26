"""
示例：生成样本数据进行测试
这个脚本不需要实际的模型和图像，直接生成规范的输出数据
"""

import json
import numpy as np
from pathlib import Path
from config import KEYPOINT_NAMES, OUTPUT_CONFIG


def generate_sample_data():
    """
    生成符合规范的样本数据
    """
    
    # 生成关键点重要性分数
    # 模拟真实的注意力分布：头部关键点更重要
    importance_scores = np.array([
        0.95,  # 0: 鼻子
        0.93,  # 1: 左眼
        0.93,  # 2: 右眼
        0.88,  # 3: 左耳
        0.88,  # 4: 右耳
        0.91,  # 5: 左肩
        0.91,  # 6: 右肩
        0.85,  # 7: 左肘
        0.85,  # 8: 右肘
        0.78,  # 9: 左腕
        0.78,  # 10: 右腕
        0.89,  # 11: 左髋
        0.89,  # 12: 右髋
        0.82,  # 13: 左膝
        0.82,  # 14: 右膝
        0.75,  # 15: 左踝
        0.75,  # 16: 右踝
    ])
    
    # 生成 16x16 的注意力热力图
    # 模拟高斯分布，中心更亮
    x = np.linspace(-3, 3, 16)
    y = np.linspace(-3, 3, 16)
    X, Y = np.meshgrid(x, y)
    attention_map = np.exp(-(X**2 + Y**2) / 2) / (2 * np.pi)
    
    # 归一化到 [0, 1]
    attention_map = (attention_map - attention_map.min()) / (attention_map.max() - attention_map.min())
    
    # 构建输出数据
    output_data = {
        'keypoint_importance': [],
        'attention_map_16x16': []
    }
    
    # 添加关键点重要性
    for idx, name in enumerate(KEYPOINT_NAMES):
        score = round(float(importance_scores[idx]), 4)
        output_data['keypoint_importance'].append({
            'id': idx,
            'name': name,
            'importance_score': score
        })
    
    # 添加注意力热力图
    for row in attention_map:
        output_data['attention_map_16x16'].append([
            round(float(val), 4) for val in row
        ])
    
    # 添加元数据
    output_data['metadata'] = {
        'data_type': 'sample',
        'model_type': 'vitpose',
        'input_size': [224, 224],
        'num_keypoints': 17,
        'attention_map_size': 16,
        'description': '示例数据 - 用于测试可视化系统'
    }
    
    return output_data


def save_sample_data(output_data, output_path):
    """
    保存样本数据为 JSON
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 样本数据已生成: {output_path}")


def verify_sample_data(output_data):
    """
    验证样本数据是否符合规范
    """
    print("\n📋 验证样本数据...")
    
    # 检查关键点数量
    num_keypoints = len(output_data['keypoint_importance'])
    assert num_keypoints == 17, f"关键点数量应为 17，实际为 {num_keypoints}"
    print(f"✅ 关键点数量: {num_keypoints}")
    
    # 检查注意力热力图大小
    attention_map = output_data['attention_map_16x16']
    rows = len(attention_map)
    cols = len(attention_map[0]) if rows > 0 else 0
    assert rows == 16 and cols == 16, f"注意力热力图应为 16x16，实际为 {rows}x{cols}"
    print(f"✅ 注意力热力图: {rows}x{cols}")
    
    # 检查分数范围
    for kp in output_data['keypoint_importance']:
        score = kp['importance_score']
        assert 0 <= score <= 1, f"关键点 {kp['name']} 的分数应在 [0, 1]，实际为 {score}"
    print(f"✅ 关键点分数范围: [0, 1]")
    
    # 检查热力图值范围
    for row in attention_map:
        for val in row:
            assert 0 <= val <= 1, f"热力图值应在 [0, 1]，实际为 {val}"
    print(f"✅ 热力图值范围: [0, 1]")
    
    print("\n✅ 所有验证通过！")


if __name__ == '__main__':
    print("🚀 生成示例数据...\n")
    
    # 生成样本数据
    sample_data = generate_sample_data()
    
    # 验证数据
    verify_sample_data(sample_data)
    
    # 保存数据
    output_path = OUTPUT_CONFIG['output_path']
    save_sample_data(sample_data, output_path)
    
    # 显示样本
    print("\n📊 样本数据预览:")
    print("\n关键点重要性 (前 5 个):")
    for kp in sample_data['keypoint_importance'][:5]:
        print(f"  {kp['id']}: {kp['name']} = {kp['importance_score']}")
    
    print("\n注意力热力图 (前 3 行):")
    for i, row in enumerate(sample_data['attention_map_16x16'][:3]):
        print(f"  行 {i}: {row[:5]}... (共 16 列)")
