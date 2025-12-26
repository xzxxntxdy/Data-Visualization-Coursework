#!/bin/bash

# 快速启动脚本：从零到模型的自动化流程

set -e  # 任何错误都停止执行

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Pose Model 快速启动脚本${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# 1. 检查 Python 环境
echo -e "${YELLOW}[1/6] 检查 Python 环境...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}错误: 未找到 Python 3${NC}"
    exit 1
fi
python3 --version
echo -e "${GREEN}✓ Python 检查通过${NC}"
echo ""

# 2. 检查并安装依赖
echo -e "${YELLOW}[2/6] 安装依赖...${NC}"
cd "$PROJECT_DIR"
python3 -m pip install --upgrade pip > /dev/null 2>&1 || true
python3 -m pip install -r requirements.txt
echo -e "${GREEN}✓ 依赖安装完成${NC}"
echo ""

# 3. 创建必要的目录
echo -e "${YELLOW}[3/6] 创建项目目录...${NC}"
mkdir -p "$PROJECT_DIR/dataset"
mkdir -p "$PROJECT_DIR/models"
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/test_images"
mkdir -p "$PROJECT_DIR/output"
echo -e "${GREEN}✓ 目录创建完成${NC}"
echo ""

# 4. 选择模型类型
echo -e "${YELLOW}[4/6] 选择模型类型...${NC}"
echo "可选项:"
echo "  1) simple    - 快速 CNN 模型（推荐，训练快）"
echo "  2) transformer - Vision Transformer（精度更高）"
echo ""
read -p "请选择 [1-2，默认 1]: " model_choice
model_choice=${model_choice:-1}

if [ "$model_choice" = "1" ]; then
    MODEL_TYPE="simple"
    NUM_EPOCHS=20
    BATCH_SIZE=32
    echo "使用 Simple 模型，训练 $NUM_EPOCHS epoch"
elif [ "$model_choice" = "2" ]; then
    MODEL_TYPE="transformer"
    NUM_EPOCHS=30
    BATCH_SIZE=16
    echo "使用 Transformer 模型，训练 $NUM_EPOCHS epoch"
else
    echo -e "${RED}无效选择${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 模型选择完成${NC}"
echo ""

# 5. 训练模型
echo -e "${YELLOW}[5/6] 开始训练模型...${NC}"
echo "配置:"
echo "  模型类型: $MODEL_TYPE"
echo "  训练轮数: $NUM_EPOCHS"
echo "  批大小: $BATCH_SIZE"
echo "  虚拟数据集: 500 张图像"
echo ""
echo "开始训练（这可能需要 10-60 分钟）..."
python3 "$PROJECT_DIR/train.py" \
    --model_type "$MODEL_TYPE" \
    --dataset_dir "$PROJECT_DIR/dataset" \
    --dummy_num_images 500 \
    --num_epochs "$NUM_EPOCHS" \
    --batch_size "$BATCH_SIZE" \
    --learning_rate 1e-4 \
    --checkpoint_dir "$PROJECT_DIR/models" \
    --log_dir "$PROJECT_DIR/logs"

echo -e "${GREEN}✓ 模型训练完成${NC}"
echo ""

# 6. 提取注意力权重
echo -e "${YELLOW}[6/6] 提取注意力权重...${NC}"
if [ -f "$PROJECT_DIR/models/best_model.pth" ]; then
    python3 "$PROJECT_DIR/extract_attention_weights.py" \
        --model_path "$PROJECT_DIR/models/best_model.pth" \
        --model_type "$MODEL_TYPE" \
        --test_images_dir "$PROJECT_DIR/test_images" \
        --output_path "$PROJECT_DIR/output/pose_model_attention.json"
    
    echo -e "${GREEN}✓ 注意力权重提取完成${NC}"
else
    echo -e "${RED}警告: 未找到最佳模型${NC}"
fi
echo ""

# 完成
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}✅ 全部步骤完成！${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo "生成的文件:"
echo "  模型: $PROJECT_DIR/models/best_model.pth"
echo "  注意力权重: $PROJECT_DIR/output/pose_model_attention.json"
echo "  日志: $PROJECT_DIR/logs/training.log"
echo ""
echo "下一步:"
echo "  1. 查看训练日志: tail -f $PROJECT_DIR/logs/training.log"
echo "  2. 查看输出文件: cat $PROJECT_DIR/output/pose_model_attention.json"
echo "  3. 复制到主项目: cp $PROJECT_DIR/output/pose_model_attention.json ~/桌面/Data-Visualization-Coursework/src/data/"
echo ""
