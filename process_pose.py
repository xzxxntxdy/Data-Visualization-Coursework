import json
import numpy as np
from collections import defaultdict
import random # 导入 random 模块

# 假设的输入文件路径（请根据您的项目结构调整）
INPUT_FILE = 'src/data/person_keypoints_train2017.json'
OUTPUT_FILE = 'src/data/pose_stats.json' # 修改输出文件名以区分
MAX_SAMPLES = 5000 # 新增：定义最大样本数量

# COCO 关键点的数量
NUM_KEYPOINTS = 17

def classify_scale(area):
    """
    根据标注的面积 (area) 将目标分类为 small, medium 或 large。
    COCO 尺度定义：
    Small: area < 32^2 (1024)
    Medium: 1024 <= area <= 96^2 (9216)
    Large: area > 9216
    """
    if area < 1024:
        return 'small'
    elif area <= 9216:
        return 'medium'
    else:
        return 'large'

def get_category_name(category_id, categories_map):
    """根据 category_id 获取名称，处理缺失或不匹配的情况"""
    return categories_map.get(category_id, 'unknown')

def normalize_keypoint(kps, bbox):
    """
    将关键点坐标 (x, y) 归一化到边界框 (bbox) 空间。
    """
    if not bbox or bbox[2] == 0 or bbox[3] == 0:
        return None

    # bbox[0] = x_min, bbox[1] = y_min, bbox[2] = w, bbox[3] = h
    normalized_kps = []
    
    for i in range(0, len(kps), 3):
        x, y, v = kps[i:i+3]
        
        # 仅处理可见的关键点 (v > 0)
        if v > 0:
            norm_x = (x - bbox[0]) / bbox[2]
            norm_y = (y - bbox[1]) / bbox[3]
            normalized_kps.extend([norm_x, norm_y, v])
        else:
            # 保持不可见点的格式
            normalized_kps.extend([np.nan, np.nan, v]) # 使用 NaN 来标记不可见的坐标
    
    return normalized_kps

def process_pose_data():
    print(f"开始加载数据: {INPUT_FILE}...")
    try:
        with open(INPUT_FILE, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"错误: 找不到文件 {INPUT_FILE}。请检查路径。")
        return
    except json.JSONDecodeError:
        print(f"错误: 文件 {INPUT_FILE} 不是有效的 JSON 格式。")
        return

    # --- 准备 COCO 映射数据 ---
    # 1. 构建 Category ID 到名称的映射
    categories_map = {cat['id']: cat['name'] for cat in data.get('categories', [])}
    
    # 2. 提取关键点元数据 (假设人是第一个类别)
    person_category = next((c for c in data.get('categories', []) if c['name'] == 'person'), None)
    if not person_category:
        print("错误: COCO JSON 中未找到 'person' 类别元数据。无法继续。")
        return
        
    KEYPOINT_NAMES = person_category['keypoints']
    SKELETON_CONNECTIONS = person_category['skeleton']

    # ⭐ 新增：处理标注以获取随机子集
    all_annotations = data.get('annotations', [])
    if not all_annotations:
        print("错误: JSON 文件中未找到 'annotations' 列表。")
        return
        
    original_annotation_count = len(all_annotations)
    
    # 随机洗牌
    random.shuffle(all_annotations)
    
    # 截取前 MAX_SAMPLES 个标注
    sampled_annotations = all_annotations[:MAX_SAMPLES]
    sampled_count = len(sampled_annotations)
    
    print(f"原始标注数量: {original_annotation_count}。将随机处理 {sampled_count} 个标注。")

    # --- 初始化用于存储前端所需数据的结构 ---
    all_normalized_coords = []
    keypoint_visibility_counts = np.zeros(NUM_KEYPOINTS)
    total_annotations = 0
    
    # 收集用于前端图表的原始标注数据
    frontend_annotations = [] 
    
    # 用于构建 categories 列表的统计结构
    category_stats = defaultdict(lambda: {
        'count': 0,
        'scale_distribution': {'small': 0, 'medium': 0, 'large': 0}
    })

    print("开始处理采样的标注...")
    # 遍历随机抽取的标注
    for annotation in sampled_annotations:
        # 确保是关键点标注，并且关键点数量正确
        if 'keypoints' in annotation and len(annotation['keypoints']) == NUM_KEYPOINTS * 3:
            
            # 关键点和边界框
            kps = annotation['keypoints']
            bbox = annotation['bbox']
            
            # 归一化（注意：这里的归一化是针对边界框的）
            normalized_kps = normalize_keypoint(kps, bbox)
            
            if normalized_kps is not None:
                total_annotations += 1
                
                # 获取类别信息
                category_id = annotation.get('category_id')
                category_name = get_category_name(category_id, categories_map)
                
                # 计算尺度
                area = bbox[2] * bbox[3] # 边界框面积
                scale = classify_scale(area)

                # --- 1. 提取坐标和更新统计量 (与之前逻辑相同) ---
                coords = []
                for i in range(NUM_KEYPOINTS):
                    x, y, v = normalized_kps[i*3 : i*3 + 3]
                    
                    if v > 0:
                        coords.append([x, y])
                        keypoint_visibility_counts[i] += 1
                    else:
                        coords.append([np.nan, np.nan]) # 保持 NaN 标记
                        
                all_normalized_coords.append(coords)
                
                # --- 2. 收集用于前端的 Annotation 数据 ---
                # 计算中心点 (使用归一化后的中心，即 0.5, 0.5)
                # 注: 这里假设图片尺寸未知，使用一个占位值，但计算相对位置需要原始图片信息
                # 为简化，保持原逻辑，并假设边界框坐标是相对于整个图片的。
                img_w = 1 # 假设图片归一化到 1
                img_h = 1 # 假设图片归一化到 1
                
                # 警告：这里 cx/cy/area 的归一化依赖于一个假设的图片尺寸，如果 COCO 文件没有图片尺寸，
                # 这些值可能不准确。在您的原始代码中，这一点也存在。
                cx_img_normalized = (bbox[0] + bbox[2] / 2) / img_w 
                cy_img_normalized = (bbox[1] + bbox[3] / 2) / img_h
                area_img_normalized = (bbox[2] * bbox[3]) / (img_w * img_h)

                frontend_annotations.append({
                    "id": annotation['id'],
                    "category": category_name,
                    "cx": cx_img_normalized,        # 目标中心点 X (0-1)
                    "cy": cy_img_normalized,        # 目标中心点 Y (0-1)
                    "area": area_img_normalized,    # 目标相对面积 (0-1)
                    "scale": scale,
                    # 'kps': normalized_kps # 可以选择不保存，以减小文件大小
                })
                
                # --- 3. 更新类别统计 ---
                category_stats[category_name]['count'] += 1
                category_stats[category_name]['scale_distribution'][scale] += 1


    if not all_normalized_coords:
        print("未找到有效关键点标注。")
        return

    # --- 最终统计计算 ---
    all_coords_np = np.array(all_normalized_coords)
    # 使用 np.nanmean 和 np.nanstd 来计算平均姿态和标准差（忽略 NaN 值）
    mean_pose = np.nanmean(all_coords_np, axis=0)
    std_dev_pose = np.nanstd(all_coords_np, axis=0)
    visibility_prob = keypoint_visibility_counts / total_annotations

    # --- 格式化 Categories 列表 ---
    sorted_categories = sorted(
        category_stats.items(), 
        key=lambda item: item[1]['count'], 
        reverse=True
    )
    
    frontend_categories = []
    for name, stats in sorted_categories:
        frontend_categories.append({
            'name': name,
            'count': stats['count'],
            'scale_distribution': stats['scale_distribution']
        })

    # --- 构造最终 JSON 对象 ---
    pose_stats = {
        'keypoints': KEYPOINT_NAMES,
        'skeleton': SKELETON_CONNECTIONS,
        'total_annotations': total_annotations,
        'mean_pose': mean_pose.tolist(),
        'std_dev_pose': std_dev_pose.tolist(),
        'visibility_prob': visibility_prob.tolist(),
        
        # 包含前端所需的核心数据
        'categories': frontend_categories,
        'annotations': frontend_annotations 
    }

    # 保存到 JSON 文件
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(pose_stats, f, indent=4)
        
    print(f"\n✅ 姿态统计数据处理完成。已保存至 {OUTPUT_FILE}")
    print(f"总计处理了 {total_annotations} 条有效标注 (基于 {MAX_SAMPLES} 个随机样本)。")
    print(f"总类别数：{len(frontend_categories)}")


if __name__ == '__main__':
    # 这是一个示例调用
    process_pose_data()