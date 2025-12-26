import * as d3 from "d3";
import poseStats from "../data/pose_stats.json";
import poseModelAttention from "../data/pose_model_attention.json";

const COLORS = {
  bg: "#f8fafc",
  cardBg: "#ffffff",
  textMain: "#1e293b",
  textMuted: "#64748b",
  border: "#e2e8f0",
  primary: "#6366f1",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  skeleton: {
    high: "#ef4444",
    medium: "#3b82f6",
    low: "#10b981",
    bone: "#94a3b8"
  },
  heatmap: ["#ffffffff", "#ffffffff", "#ffffffff", "#ff0000ff", "#ff0000ff"]
};

let poseModelData = null;
let posePositionMap = null; // 从 pose_stats.json 加载的标准骨架位置

// 交互状态管理
const interactionState = {
  hoveredKeypointId: null,
  selectedKeypointId: null
};

// 生成模拟数据
function generateMockData() {
  const keypoints = [
    {id: 0, name: "鼻子", importance_score: 0.95},
    {id: 1, name: "左眼", importance_score: 0.93},
    {id: 2, name: "右眼", importance_score: 0.93},
    {id: 3, name: "左耳", importance_score: 0.88},
    {id: 4, name: "右耳", importance_score: 0.88},
    {id: 5, name: "左肩", importance_score: 0.92},
    {id: 6, name: "右肩", importance_score: 0.92},
    {id: 7, name: "左肘", importance_score: 0.85},
    {id: 8, name: "右肘", importance_score: 0.85},
    {id: 9, name: "左腕", importance_score: 0.78},
    {id: 10, name: "右腕", importance_score: 0.78},
    {id: 11, name: "左髋", importance_score: 0.89},
    {id: 12, name: "右髋", importance_score: 0.89},
    {id: 13, name: "左膝", importance_score: 0.82},
    {id: 14, name: "右膝", importance_score: 0.82},
    {id: 15, name: "左踝", importance_score: 0.75},
    {id: 16, name: "右踝", importance_score: 0.75}
  ];
  
  const attention = [];
  for (let i = 0; i < 16; i++) {
    const row = [];
    for (let j = 0; j < 16; j++) {
      row.push(Math.exp(-Math.abs(i - j) / 4) + Math.random() * 0.1);
    }
    attention.push(row);
  }
  
  return {
    keypoint_importance: keypoints,
    attention_map_16x16: attention
  };
}

// 标准COCO骨架位置备用方案（仅在加载失败时使用）
function getDefaultPositionMap() {
  return {
    0: [0.5, 0.1], 1: [0.38, 0.08], 2: [0.62, 0.08], 
    3: [0.25, 0.05], 4: [0.75, 0.05],
    5: [0.32, 0.28], 6: [0.68, 0.28],
    7: [0.22, 0.48], 8: [0.78, 0.48],
    9: [0.12, 0.68], 10: [0.88, 0.68],
    11: [0.38, 0.58], 12: [0.62, 0.58],
    13: [0.32, 0.78], 14: [0.68, 0.78],
    15: [0.25, 0.95], 16: [0.75, 0.95]
  };
}

let poseResizeObserver = null;

// ═══════════════════════════════════════════════════════════════════
// 🚀 初始化
// ═══════════════════════════════════════════════════════════════════
export async function initPoseModelView(containerId = "pose-model-content") {
  const container = document.getElementById(containerId);
  if (!container) return;

  // 加载骨架位置数据（从 pose_stats.json）
  if (!posePositionMap) {
    try {
      const data = poseStats;
      posePositionMap = {};
      // 使用 mean_pose 构建位置映射，确保与 pose_view 统一
      data.keypoints.forEach((name, idx) => {
        posePositionMap[idx] = data.mean_pose[idx];
      });
      console.log('✅ Loaded skeleton positions from pose_stats.json');
    } catch (err) {
      console.error('❌ Failed to load skeleton positions:', err);
      // 降级到硬编码备用方案
      posePositionMap = getDefaultPositionMap();
    }
  }

  // 加载模型数据（直接使用导入的真实数据）
  if (!poseModelData) {
    try {
      poseModelData = poseModelAttention;
      console.log('✅ Using real pose_model_attention.json data:', poseModelData);
    } catch (err) {
      console.error('❌ Failed to use pose_model_attention.json:', err);
      // 加载失败，使用模拟数据
      poseModelData = generateMockData();
      console.log('📦 Using mock data:', poseModelData);
    }
  }

  // 清理
  if (poseResizeObserver) {
    poseResizeObserver.disconnect();
    poseResizeObserver = null;
  }

  // 设置容器
  d3.select(container)
    .style("position", "relative")
    .style("overflow-y", "auto")
    .style("overflow-x", "hidden")
    .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif")
    .style("background-color", COLORS.bg)
    .style("color", COLORS.textMain);

  container.innerHTML = "";

  // 构建布局
  buildLayout(container);

  // 初始化图表
  setTimeout(() => {
    renderHeader(container);
    renderSkeletonChart(container);
    renderAttentionHeatmap(container);
    renderGradientFlowChart(container);
    setupResize(container);
  }, 50);
}

export function refreshPoseModelView() {
  initPoseModelView();
}

// ═══════════════════════════════════════════════════════════════════
// 📐 布局构建
// ═══════════════════════════════════════════════════════════════════
function buildLayout(container) {
  d3.select(container).html(`
    <div class="pm-root">
      <div id="pm-header"></div>
      <div id="pm-charts" style="
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        padding: 20px;
        min-height: calc(100% - 200px);
      ">
        <div id="skeleton-container" style="
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          background: ${COLORS.cardBg};
          padding: 0;
          overflow: hidden;
        "></div>
        <div id="attention-container" style="
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          background: ${COLORS.cardBg};
          padding: 0;
          overflow: hidden;
        "></div>
      </div>
      <div id="gradient-flow-container" style="
        margin: 0 20px 20px 20px;
        border: 1px solid ${COLORS.border};
        border-radius: 8px;
        background: ${COLORS.cardBg};
        padding: 0;
        overflow: hidden;
        height: 320px;
      "></div>
    </div>
  `);
}

function renderHeader(container) {
  const header = d3.select(container).select("#pm-header")
    .style("padding", "24px 32px")
    .style("border-bottom", `1px solid ${COLORS.border}`)
    .style("background", COLORS.cardBg);

  header.append("h2")
    .text("🤖 Transformer姿态理解机制")
    .style("margin", "0 0 12px 0")
    .style("font-size", "22px")
    .style("font-weight", "700");

  header.append("p")
    .html(`
      <strong>可解释性分析：</strong> 三维度揭示Transformer如何理解人体姿态<br/>
      <span style="font-size: 13px; color: ${COLORS.textMuted};">
        <strong>左：</strong>关键点重要性 (交互悬停) | 
        <strong>右：</strong>模型注意力分布 (Cross-Attention) | 
        <strong>下：</strong>梯度流向与贡献度追踪
      </span>
    `)
    .style("margin", "0")
    .style("font-size", "14px")
    .style("line-height", "1.6")
    .style("color", COLORS.textMuted);
}

// ═══════════════════════════════════════════════════════════════════
// 📊 图表1：骨架图（左上）
// ═══════════════════════════════════════════════════════════════════
function renderSkeletonChart(container) {
  const svg_container = d3.select(container).select("#skeleton-container");
  svg_container.selectAll("*").remove();

  const { width, height } = svg_container.node().getBoundingClientRect();
  const actualHeight = Math.max(height, 400);
  
  const margin = { top: 30, right: 20, bottom: 20, left: 20 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = actualHeight - margin.top - margin.bottom;

  const svg = svg_container.append("svg")
    .attr("width", width)
    .attr("height", actualHeight);

  // 添加网格背景
  const defs = svg.append("defs");
  const gridSize = 20;
  const gridPattern = defs.append("pattern")
    .attr("id", "skeleton-grid-pattern")
    .attr("width", gridSize)
    .attr("height", gridSize)
    .attr("patternUnits", "userSpaceOnUse");
  gridPattern.append("path")
    .attr("d", `M ${gridSize} 0 L 0 0 0 ${gridSize}`)
    .attr("fill", "none")
    .attr("stroke", "rgba(0,0,0,0.12)")
    .attr("stroke-width", 0.5);

  svg.append("text")
    .attr("x", 16)
    .attr("y", 20)
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .attr("fill", COLORS.textMain)
    .text("人体骨架结构 (17 COCO关键点)");

  // 节点颜色说明
  svg.append("text")
    .attr("x", 16)
    .attr("y", 40)
    .attr("font-size", "11px")
    .attr("fill", COLORS.textMuted)
    .text("节点颜色：红色 = 高重要性 (>92%)  |  蓝色 = 中等重要性 (85-92%)  |  绿色 = 低重要性 (<85%)");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 添加网格背景矩形
  g.append("rect")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .attr("fill", "url(#skeleton-grid-pattern)")
    .attr("pointer-events", "none");

  const data = poseModelData.keypoint_importance;

  // 使用从 pose_stats.json 加载的骨架位置，确保与 pose_view 一致
  // 等比缩放：保证 x 和 y 的缩放因子相同
  const maxRange = Math.min(chartWidth, chartHeight);
  const xOffset = (chartWidth - maxRange) / 2;
  const yOffset = (chartHeight - maxRange) / 2;
  
  const xScale = d3.scaleLinear().domain([0, 1]).range([xOffset, xOffset + maxRange]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([yOffset, chartHeight - yOffset]);

  const colorScale = (score) => {
    if (score > 0.92) return COLORS.skeleton.high;
    if (score > 0.85) return COLORS.skeleton.medium;
    return COLORS.skeleton.low;
  };

  // 绘制骨架线（使用来自 pose_stats.json 的位置）
  const skeleton = poseStats.skeleton;

  skeleton.forEach(([id1, id2]) => {
    const pos1 = posePositionMap[id1 - 1];
    const pos2 = posePositionMap[id2 - 1];
    if (pos1 && pos2) {
      g.append("line")
        .attr("x1", xScale(pos1[0]))
        .attr("y1", yScale(pos1[1]))
        .attr("x2", xScale(pos2[0]))
        .attr("y2", yScale(pos2[1]))
        .attr("stroke", COLORS.skeleton.bone)
        .attr("stroke-width", 2)
        .attr("opacity", 0.5);
    }
  });

  // 绘制关键点
  g.selectAll("circle.keypoint")
    .data(data)
    .join("circle")
    .attr("class", d => `keypoint-${d.id}`)
    .attr("cx", d => xScale(posePositionMap[d.id][0]))
    .attr("cy", d => yScale(posePositionMap[d.id][1]))
    .attr("r", d => 4 + d.importance_score * 3)
    .attr("fill", d => colorScale(d.importance_score))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .style("opacity", 0.85)
    .style("filter", "drop-shadow(0 0 0px rgba(0,0,0,0))")
    .on("mouseover", function(event, d) {
      // 更新交互状态
      interactionState.hoveredKeypointId = d.id;
      
      // 当前关键点高亮
      d3.select(this)
        .attr("r", 12)
        .style("opacity", 1)
        .attr("stroke-width", 3)
        .attr("stroke", COLORS.primary)
        .style("filter", "drop-shadow(0 2px 8px rgba(99, 102, 241, 0.6))");
      
      // 高亮其他关键点的透明度
      g.selectAll("circle.keypoint").style("opacity", k => k.id === d.id ? 1 : 0.3);
      
      // 显示提示
      const tooltip = d3.select(container).select("#skeleton-container").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", COLORS.textMain)
        .style("color", "#fff")
        .style("padding", "8px 12px")
        .style("border-radius", "6px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("white-space", "nowrap")
        .style("z-index", "1000")
        .text(`${d.name}: 重要性 ${(d.importance_score * 100).toFixed(0)}%`)
        .style("left", (event.pageX - container.getBoundingClientRect().left + 10) + "px")
        .style("top", (event.pageY - container.getBoundingClientRect().top - 30) + "px");
      
      // 触发Attention热力图的更新
      updateAttentionHeatmapHighlight(container, d.id);
    })
    .on("mouseout", function(event, d) {
      interactionState.hoveredKeypointId = null;
      
      // 恢复原始状态
      d3.select(this)
        .attr("r", 4 + d.importance_score * 3)
        .style("opacity", 0.85)
        .attr("stroke-width", 2)
        .attr("stroke", "#fff")
        .style("filter", "drop-shadow(0 0 0px rgba(0,0,0,0))");
      
      g.selectAll("circle.keypoint").style("opacity", 0.85);
      
      d3.select(container).select("#skeleton-container").selectAll(".tooltip").remove();
      
      // 清除Attention热力图的高亮
      clearAttentionHeatmapHighlight(container);
    });
}

// ═══════════════════════════════════════════════════════════════════
// 📊 图表2：Attention热力图（右上）
// ═══════════════════════════════════════════════════════════════════
function renderAttentionHeatmap(container) {
  const svg_container = d3.select(container).select("#attention-container");
  svg_container.selectAll("*").remove();

  const { width, height } = svg_container.node().getBoundingClientRect();
  const actualHeight = Math.max(height, 450);
  
  const margin = { top: 75, right: 15, bottom: 20, left: 20 };  // 减少右边空间，让信息靠近
  const chartWidth = width - margin.left - margin.right - 100;  // 为右侧信息预留 180px
  const chartHeight = actualHeight - margin.top - margin.bottom;

  const svg = svg_container.append("svg")
    .attr("width", width)
    .attr("height", actualHeight);

  svg.append("text")
    .attr("x", 16)
    .attr("y", 20)
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .attr("fill", COLORS.textMain)
    .text("Transformer Cross-Attention (16×16)");

  // 图表说明
  svg.append("text")
    .attr("x", 16)
    .attr("y", 38)
    .attr("font-size", "11px")
    .attr("fill", COLORS.textMuted)
    .attr("font-weight", "400")
    .text("Vision Transformer 模型对 200 张 COCO 图像的注意力分布 · 红色 = 高注意力，蓝色 = 低注意力");
  
  svg.append("text")
    .attr("x", 16)
    .attr("y", 52)
    .attr("font-size", "10px")
    .attr("fill", COLORS.textMuted)
    .attr("font-weight", "400")
    .text("16×16 网格: 图像被分成 14×14 个 patch，插值到 16×16 · 每个格子代表图像的空间区域");
  
  svg.append("text")
    .attr("x", 16)
    .attr("y", 65)
    .attr("font-size", "10px")
    .attr("fill", COLORS.textMuted)
    .attr("font-weight", "400")
    .text("含义: 中心和躯干区域获得更高的注意力，边缘四肢获得较低注意力 · 反映人体姿态的重要性");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const attentionData = poseModelData.attention_map_16x16;
  const cellSize = Math.min(chartWidth / 16, chartHeight / 16);
  
  // 计算实际的最小值和最大值
  const flatValues = attentionData.flat();
  const minValue = Math.min(...flatValues);
  const maxValue = Math.max(...flatValues);
  
  // 从最低的红色过渡到最高的白色（基于实际数据范围）
  const colorScale = d3.scaleLinear()
    .domain([minValue, maxValue])
    .range(["#dc2626", "#ffffff"]);

  const cells = [];
  attentionData.forEach((row, i) => {
    row.forEach((value, j) => {
      cells.push({ x: j, y: i, value });
    });
  });

  g.selectAll("rect.heatmap-cell")
    .data(cells)
    .join("rect")
    .attr("class", "heatmap-cell")
    .attr("x", d => d.x * cellSize)
    .attr("y", d => d.y * cellSize)
    .attr("width", cellSize - 1)
    .attr("height", cellSize - 1)
    .attr("fill", d => colorScale(d.value))
    .attr("stroke", COLORS.bg)
    .attr("stroke-width", 0.5)
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      // 高亮热力图本身：突出该行列
      svg.selectAll("rect.heatmap-cell").style("opacity", cell => {
        if (cell.x === d.x || cell.y === d.y) {
          return 1;
        }
        return 0.2;
      })
      .attr("stroke-width", cell => {
        if (cell.x === d.x || cell.y === d.y) {
          return 2;
        }
        return 0.5;
      })
      .attr("stroke", cell => {
        if (cell.x === d.x || cell.y === d.y) {
          return COLORS.primary;
        }
        return COLORS.bg;
      });
      
      // 联动高亮骨架上对应的关键点（传递格子坐标）
      highlightSkeletonKeypoint(container, d.x, d.y);
    })
    .on("mouseout", function() {
      // 恢复热力图原状
      svg.selectAll("rect.heatmap-cell")
        .style("opacity", 1)
        .attr("stroke-width", 0.5)
        .attr("stroke", COLORS.bg);
      
      // 恢复骨架原状
      clearSkeletonKeypointHighlight(container);
    })
    .append("title")
    .text(d => `Attention: ${(d.value * 100).toFixed(1)}%`);

  // 在热力图上添加关键点标记（使用与骨架图相同的位置和颜色）
  const colorScaleKeypoint = (score) => {
    if (score > 0.92) return COLORS.skeleton.high;    // 红色
    if (score > 0.85) return COLORS.skeleton.medium;  // 蓝色
    return COLORS.skeleton.low;                        // 绿色
  };
  
  const keypointData = poseModelData.keypoint_importance;
  
  g.selectAll("circle.heatmap-keypoint")
    .data(keypointData)
    .join("circle")
    .attr("class", "heatmap-keypoint")
    .attr("cx", d => {
      const pos = posePositionMap[d.id];
      return pos[0] * 16 * cellSize;
    })
    .attr("cy", d => {
      const pos = posePositionMap[d.id];
      return pos[1] * 16 * cellSize;
    })
    .attr("r", 4)
    .attr("fill", d => colorScaleKeypoint(d.importance_score))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.85)
    .style("pointer-events", "auto")
    .append("title")
    .text(d => `${d.name}: ${(d.importance_score * 100).toFixed(0)}%`);

  // ═══════════════════════════════════════════════════════════════════
  // 右边：模型说明和颜色图例（紧凑布局）
  // ═══════════════════════════════════════════════════════════════════
  const heatmapRightEdge = 16 * cellSize;  // 热力图右边界
  const infoX = heatmapRightEdge + 150;     // 与热力图分开（放大50%）
  
  // 模型说明标题
  g.append("text")
    .attr("x", infoX)
    .attr("y", 0)
    .attr("font-size", "15px")
    .attr("font-weight", "700")
    .attr("fill", COLORS.textMain)
    .text("📊 模型信息");
  
  // 模型详情（紧凑版）
  const modelInfo = [
    "模型: ViT-Base",
    "预训练: ImageNet-21k",
    "数据集: COCO Val2017",
    "样本: 200张",
    "特征提取:",
    "  • Patch能量",
    "  • 特征方差",
    "  • 插值: 14→16",
    "聚合: 均值"
  ];
  
  modelInfo.forEach((text, idx) => {
    g.append("text")
      .attr("x", infoX)
      .attr("y", 27 + idx * 22.5)  // 行间距放大50%
      .attr("font-size", text.startsWith("  •") ? "12px" : "14px")
      .attr("fill", text.startsWith("特征提取:") || text.startsWith("聚合:") ? COLORS.primary : COLORS.textMuted)
      .attr("font-weight", text.startsWith("特征提取:") || text.startsWith("聚合:") ? "600" : "400")
      .text(text);
  });
  
  // 颜色图例分隔线
  const legendStartY = 27 + modelInfo.length * 22.5 + 15;  // 放大50%
  g.append("line")
    .attr("x1", infoX)
    .attr("y1", legendStartY)
    .attr("x2", infoX + 210)
    .attr("y2", legendStartY)
    .attr("stroke", COLORS.border)
    .attr("stroke-width", 1.5);
  
  // 颜色图例标题
  g.append("text")
    .attr("x", infoX)
    .attr("y", legendStartY + 30)  // 放大50%
    .attr("font-size", "18px")  // 放大50%
    .attr("font-weight", "700")
    .attr("fill", COLORS.textMain)
    .text("🎨 注意力强度");
  
  // 颜色条（渐变）
  const legendBarY = legendStartY + 52.5;  // 放大50%
  const legendBarHeight = 27;  // 放大50%
  const legendBarWidth = 210;  // 放大50%
  const legendCenterX = infoX + legendBarWidth / 2;  // 图例中心
  
  // 创建渐变（如果还没创建）
  if (svg.select("#attention-gradient-main").empty()) {
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "attention-gradient-main")
      .attr("x1", "0%")
      .attr("x2", "100%");
    
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", COLORS.heatmap[0]);
    
    gradient.append("stop")
      .attr("offset", "50%")
      .attr("stop-color", COLORS.heatmap[2]);
    
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", COLORS.heatmap[4]);
  }
  
  // 颜色条
  g.append("rect")
    .attr("x", infoX)
    .attr("y", legendBarY)
    .attr("width", legendBarWidth)
    .attr("height", legendBarHeight)
    .attr("fill", "url(#attention-gradient-main)")
    .attr("stroke", COLORS.border)
    .attr("stroke-width", 1.5);
  
  // 低-高标签（对齐颜色条两端）
  g.append("text")
    .attr("x", infoX - 8)
    .attr("y", legendBarY + legendBarHeight + 30)
    .attr("font-size", "14px")
    .attr("fill", COLORS.textMuted)
    .attr("font-weight", "600")
    .attr("text-anchor", "end")
    .text("低");
  
  g.append("text")
    .attr("x", infoX + legendBarWidth + 8)
    .attr("y", legendBarY + legendBarHeight + 30)
    .attr("font-size", "14px")
    .attr("fill", COLORS.textMuted)
    .attr("font-weight", "600")
    .attr("text-anchor", "start")
    .text("高");
  
  // 数值范围（居中）
  g.append("text")
    .attr("x", legendCenterX)
    .attr("y", legendBarY + legendBarHeight + 52)
    .attr("font-size", "12px")
    .attr("fill", COLORS.textMuted)
    .attr("text-anchor", "middle")
    .text("注意力强度范围: 最低 ← → 最高");
}




// ═══════════════════════════════════════════════════════════════════
// � 图表4：模型层级注意力分布（左下）
// ═══════════════════════════════════════════════════════════════════
function renderLayerAttentionChart(container) {
  const svg_container = d3.select(container).select("#layer-attention-container");
  svg_container.selectAll("*").remove();

  const { width, height } = svg_container.node().getBoundingClientRect();
  const actualHeight = height || 300;
  
  const margin = { top: 30, right: 20, bottom: 20, left: 40 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = actualHeight - margin.top - margin.bottom;

  const svg = svg_container.append("svg")
    .attr("width", width)
    .attr("height", actualHeight);

  svg.append("text")
    .attr("x", 16)
    .attr("y", 20)
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .attr("fill", COLORS.textMain)
    .text("Transformer层级注意力");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 生成模拟数据：12个层，每层的平均注意力强度
  const layerData = Array.from({ length: 12 }, (_, i) => ({
    layer: `Layer ${i + 1}`,
    attention: Math.sin(i / 3) * 0.3 + 0.5 + Math.random() * 0.2,
    id: i
  }));

  const yScale = d3.scaleBand()
    .domain(layerData.map(d => d.layer))
    .range([0, chartHeight])
    .padding(0.3);

  const xScale = d3.scaleLinear()
    .domain([0, 1])
    .range([0, chartWidth]);

  // 颜色根据注意力强度变化
  const colorScale = d3.scaleLinear()
    .domain([0, 1])
    .range([COLORS.warning, COLORS.primary]);

  // 绘制柱子
  g.selectAll("rect.layer-bar")
    .data(layerData)
    .join("rect")
    .attr("y", d => yScale(d.layer))
    .attr("x", 0)
    .attr("width", d => xScale(d.attention))
    .attr("height", yScale.bandwidth())
    .attr("fill", d => colorScale(d.attention))
    .attr("opacity", 0.8)
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      d3.select(this).attr("opacity", 1);
    })
    .on("mouseout", function() {
      d3.select(this).attr("opacity", 0.8);
    })
    .append("title")
    .text(d => `${d.layer}: ${(d.attention * 100).toFixed(1)}%`);

  // Y轴标签
  g.selectAll("text.layer-label")
    .data(layerData)
    .join("text")
    .attr("y", d => yScale(d.layer) + yScale.bandwidth() / 2)
    .attr("x", -8)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .attr("font-size", "10px")
    .attr("fill", COLORS.textMuted)
    .text(d => d.layer);

  // 底部轴
  g.append("line")
    .attr("x1", 0)
    .attr("y1", chartHeight)
    .attr("x2", chartWidth)
    .attr("y2", chartHeight)
    .attr("stroke", COLORS.border)
    .attr("stroke-width", 1);
}

// ═══════════════════════════════════════════════════════════════════
// 📊 图表5：关键点相关性热力图（中下）
// ═══════════════════════════════════════════════════════════════════
function renderKeypointCorrelationChart(container) {
  const svg_container = d3.select(container).select("#keypoint-correlation-container");
  svg_container.selectAll("*").remove();

  const { width, height } = svg_container.node().getBoundingClientRect();
  const actualHeight = height || 300;
  
  const margin = { top: 30, right: 10, bottom: 10, left: 10 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = actualHeight - margin.top - margin.bottom;

  const svg = svg_container.append("svg")
    .attr("width", width)
    .attr("height", actualHeight);

  svg.append("text")
    .attr("x", 16)
    .attr("y", 20)
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .attr("fill", COLORS.textMain)
    .text("关键点相关性矩阵");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 生成6x6相关性矩阵（简化版）
  const correlationSize = 6;
  const cellSize = Math.min(chartWidth / correlationSize, chartHeight / correlationSize);
  
  const keypoints = ["头", "躯干", "肩", "肘", "腕", "髋"];
  const correlationData = [];
  
  for (let i = 0; i < correlationSize; i++) {
    for (let j = 0; j < correlationSize; j++) {
      // 对角线为1，其他根据距离衰减
      const corr = Math.exp(-Math.abs(i - j) / 2);
      correlationData.push({ x: j, y: i, value: corr });
    }
  }

  const colorScale = d3.scaleLinear()
    .domain([0, 1])
    .range([COLORS.heatmap[0], COLORS.heatmap[4]]);

  g.selectAll("rect.correlation-cell")
    .data(correlationData)
    .join("rect")
    .attr("x", d => d.x * cellSize)
    .attr("y", d => d.y * cellSize)
    .attr("width", cellSize - 1)
    .attr("height", cellSize - 1)
    .attr("fill", d => colorScale(d.value))
    .attr("stroke", COLORS.bg)
    .attr("stroke-width", 1)
    .append("title")
    .text(d => `相关性: ${(d.value * 100).toFixed(0)}%`);

  // 添加坐标轴标签（简化）
  g.selectAll("text.corr-label-x")
    .data(keypoints)
    .join("text")
    .attr("x", (d, i) => (i + 0.5) * cellSize)
    .attr("y", correlationSize * cellSize + 12)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", COLORS.textMuted)
    .text(d => d);

  g.selectAll("text.corr-label-y")
    .data(keypoints)
    .join("text")
    .attr("x", -4)
    .attr("y", (d, i) => (i + 0.5) * cellSize + 3)
    .attr("text-anchor", "end")
    .attr("font-size", "10px")
    .attr("fill", COLORS.textMuted)
    .text(d => d);
}

// ═══════════════════════════════════════════════════════════════════
// 📊 图表6：时序注意力演化（右下）
// ═══════════════════════════════════════════════════════════════════
function renderTemporalEvolutionChart(container) {
  const svg_container = d3.select(container).select("#temporal-evolution-container");
  svg_container.selectAll("*").remove();

  const { width, height } = svg_container.node().getBoundingClientRect();
  const actualHeight = height || 300;
  
  const margin = { top: 30, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = actualHeight - margin.top - margin.bottom;

  const svg = svg_container.append("svg")
    .attr("width", width)
    .attr("height", actualHeight);

  svg.append("text")
    .attr("x", 16)
    .attr("y", 20)
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .attr("fill", COLORS.textMain)
    .text("模型推理时的注意力演化");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 生成时序数据：10个时间步，3条线（头部、躯干、下肢）
  const timepoints = Array.from({ length: 10 }, (_, i) => i);
  const series = [
    {
      name: "头部关键点",
      color: COLORS.primary,
      data: timepoints.map(t => ({
        t,
        value: Math.sin(t / 3) * 0.2 + 0.6 + Math.random() * 0.1
      }))
    },
    {
      name: "躯干关键点",
      color: COLORS.success,
      data: timepoints.map(t => ({
        t,
        value: Math.sin(t / 3 + Math.PI / 3) * 0.2 + 0.5 + Math.random() * 0.1
      }))
    },
    {
      name: "下肢关键点",
      color: COLORS.warning,
      data: timepoints.map(t => ({
        t,
        value: Math.sin(t / 3 + 2 * Math.PI / 3) * 0.2 + 0.4 + Math.random() * 0.1
      }))
    }
  ];

  const xScale = d3.scaleLinear()
    .domain([0, 9])
    .range([0, chartWidth]);

  const yScale = d3.scaleLinear()
    .domain([0, 1])
    .range([chartHeight, 0]);

  const line = d3.line()
    .x(d => xScale(d.t))
    .y(d => yScale(d.value));

  // 绘制线条
  series.forEach((s, idx) => {
    g.append("path")
      .attr("d", line(s.data))
      .attr("fill", "none")
      .attr("stroke", s.color)
      .attr("stroke-width", 2)
      .attr("opacity", 0.8)
      .style("pointer-events", "none");

    // 绘制点
    g.selectAll(`circle.temporal-${idx}`)
      .data(s.data)
      .join("circle")
      .attr("cx", d => xScale(d.t))
      .attr("cy", d => yScale(d.value))
      .attr("r", 3)
      .attr("fill", s.color)
      .attr("opacity", 0.7)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this).attr("r", 5).attr("opacity", 1);
      })
      .on("mouseout", function() {
        d3.select(this).attr("r", 3).attr("opacity", 0.7);
      })
      .append("title")
      .text(d => `${s.name} @ 步${d.t}: ${(d.value * 100).toFixed(0)}%`);
  });

  // X轴
  g.append("line")
    .attr("x1", 0)
    .attr("y1", chartHeight)
    .attr("x2", chartWidth)
    .attr("y2", chartHeight)
    .attr("stroke", COLORS.border)
    .attr("stroke-width", 1);

  // Y轴
  g.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", chartHeight)
    .attr("stroke", COLORS.border)
    .attr("stroke-width", 1);

  // X轴刻度标签
  g.selectAll("text.x-tick")
    .data(timepoints)
    .join("text")
    .attr("x", d => xScale(d))
    .attr("y", chartHeight + 15)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", COLORS.textMuted)
    .text(d => `T${d}`);

  // Y轴标签
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -32)
    .attr("x", -chartHeight / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", COLORS.textMuted)
    .text("注意力强度");

  // 图例
  const legendY = chartHeight + 35;
  series.forEach((s, i) => {
    const legendX = i * (chartWidth / 3);
    g.append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", 12)
      .attr("height", 2)
      .attr("fill", s.color);
    g.append("text")
      .attr("x", legendX + 16)
      .attr("y", legendY + 2)
      .attr("font-size", "10px")
      .attr("fill", COLORS.textMuted)
      .attr("dy", "0.32em")
      .text(s.name);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 📊 图表7：梯度流向图（可解释性指标）
// ═══════════════════════════════════════════════════════════════════
function renderGradientFlowChart(container) {
  const svg_container = d3.select(container).select("#gradient-flow-container");
  svg_container.selectAll("*").remove();

  const { width, height } = svg_container.node().getBoundingClientRect();
  const actualHeight = height || 300;
  
  const margin = { top: 30, right: 20, bottom: 50, left: 50 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = actualHeight - margin.top - margin.bottom;

  const svg = svg_container.append("svg")
    .attr("width", width)
    .attr("height", actualHeight);

  svg.append("text")
    .attr("x", 16)
    .attr("y", 20)
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .attr("fill", COLORS.textMain)
    .text("梯度流向 & 关键点贡献度");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 使用真实的梯度贡献度数据
  let gradientData;
  
  if (poseModelData.keypoint_gradient_contributions) {
    // 使用真实计算的梯度数据
    gradientData = poseModelData.keypoint_gradient_contributions.slice(0, 8).map(d => ({
      name: d.name,
      gradient_contribution: d.gradient_contribution,
      flow_magnitude: d.flow_magnitude
    }));
    console.log('✅ 使用真实梯度数据');
  } else {
    // 回退到基于 importance_score 的模拟数据
    gradientData = poseModelData.keypoint_importance.slice(0, 8).map((d, i) => ({
      name: d.name,
      gradient_contribution: d.importance_score * (1 - i * 0.08),
      flow_magnitude: Math.sin(i / 4) * 0.3 + 0.6
    }));
    console.log('⚠️  梯度数据不可用，使用模拟数据');
  }

  const xScale = d3.scaleBand()
    .domain(gradientData.map(d => d.name))
    .range([0, chartWidth])
    .padding(0.3);

  const yScale = d3.scaleLinear()
    .domain([0, 1])
    .range([chartHeight, 0]);

  // 绘制梯度流柱子
  g.selectAll("rect.gradient-bar")
    .data(gradientData)
    .join("rect")
    .attr("x", d => xScale(d.name))
    .attr("y", d => yScale(d.gradient_contribution))
    .attr("width", xScale.bandwidth() * 0.7)
    .attr("height", d => chartHeight - yScale(d.gradient_contribution))
    .attr("fill", (d, i) => {
      const colors = [COLORS.primary, "#a78bfa", "#f472b6", "#ec4899"];
      return colors[i % colors.length];
    })
    .attr("opacity", 0.8)
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      d3.select(this).attr("opacity", 1);
    })
    .on("mouseout", function() {
      d3.select(this).attr("opacity", 0.8);
    })
    .append("title")
    .text(d => `${d.name}: 梯度贡献 ${(d.gradient_contribution * 100).toFixed(0)}% | 流强度 ${(d.flow_magnitude * 100).toFixed(0)}%`);

  // 绘制流向箭头（表示信息流）
  g.selectAll("path.flow-arrow")
    .data(gradientData.slice(0, -1))
    .join("path")
    .attr("d", (d, i) => {
      const x1 = xScale(d.name) + xScale.bandwidth() / 2;
      const x2 = xScale(gradientData[i + 1].name) + xScale.bandwidth() / 2;
      const y1 = yScale(d.gradient_contribution);
      const y2 = yScale(gradientData[i + 1].gradient_contribution);
      return `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 20} ${x2} ${y2}`;
    })
    .attr("fill", "none")
    .attr("stroke", COLORS.primary)
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.5)
    .attr("marker-end", "url(#arrowhead)");

  // 定义箭头标记
  svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("markerWidth", 10)
    .attr("markerHeight", 10)
    .attr("refX", 9)
    .attr("refY", 3)
    .attr("orient", "auto")
    .append("polygon")
    .attr("points", "0 0, 10 3, 0 6")
    .attr("fill", COLORS.primary);

  // X轴
  g.append("line")
    .attr("x1", 0)
    .attr("y1", chartHeight)
    .attr("x2", chartWidth)
    .attr("y2", chartHeight)
    .attr("stroke", COLORS.border)
    .attr("stroke-width", 1);

  // X轴标签
  g.selectAll("text.x-axis-label")
    .data(gradientData)
    .join("text")
    .attr("x", d => xScale(d.name) + xScale.bandwidth() / 2)
    .attr("y", chartHeight + 15)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", COLORS.textMuted)
    .text(d => d.name.substring(0, 3));

  // Y轴标签
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -40)
    .attr("x", -chartHeight / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", COLORS.textMuted)
    .text("梯度贡献度");

  // ═══════ 图例说明 ═══════
  const legendGroup = svg.append("g")
    .attr("transform", `translate(${width - 280}, ${10})`);

  legendGroup.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 270)
    .attr("height", 155)
    .attr("fill", "#f8fafc")
    .attr("stroke", "#e2e8f0")
    .attr("stroke-width", 1)
    .attr("rx", 6);

  legendGroup.append("text")
    .attr("x", 12)
    .attr("y", 20)
    .attr("font-size", "12px")
    .attr("font-weight", "700")
    .attr("fill", COLORS.textMain)
    .text("图表说明");

  const legendItems = [
    { 
      symbol: "rect", 
      color: COLORS.primary, 
      label: "梯度贡献度",
      desc: "关键点的梯度幅值，表示信息通过该点流向的强度"
    },
    { 
      symbol: "arrow", 
      color: COLORS.primary, 
      label: "信息流向",
      desc: "Transformer各层间梯度的传播路径与强度"
    }
  ];

  legendItems.forEach((item, idx) => {
    const y = 50 + idx * 50;
    
    // 符号
    if (item.symbol === "rect") {
      legendGroup.append("rect")
        .attr("x", 12)
        .attr("y", y - 4)
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", item.color)
        .attr("opacity", 0.8);
    } else if (item.symbol === "arrow") {
      legendGroup.append("line")
        .attr("x1", 12)
        .attr("y1", y)
        .attr("x2", 22)
        .attr("y2", y)
        .attr("stroke", item.color)
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.5);
    }

    // 标签
    legendGroup.append("text")
      .attr("x", 30)
      .attr("y", y + 2)
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", COLORS.textMain)
      .text(item.label);

    // 描述
    legendGroup.append("text")
      .attr("x", 30)
      .attr("y", y + 14)
      .attr("font-size", "9px")
      .attr("fill", COLORS.textMuted)
      .text(item.desc);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 📊 图表8：注意力流向网络（模型机制分析）
// ═══════════════════════════════════════════════════════════════════
function renderAttentionFlowChart(container) {
  const svg_container = d3.select(container).select("#attention-flow-container");
  svg_container.selectAll("*").remove();

  const { width, height } = svg_container.node().getBoundingClientRect();
  const actualHeight = height || 300;
  
  const margin = { top: 30, right: 20, bottom: 20, left: 20 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = actualHeight - margin.top - margin.bottom;

  const svg = svg_container.append("svg")
    .attr("width", width)
    .attr("height", actualHeight);

  svg.append("text")
    .attr("x", 16)
    .attr("y", 20)
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .attr("fill", COLORS.textMain)
    .text("Attention流向 - 模型决策路径");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 定义3层Transformer的关键点处理流
  const layers = [
    { layer: "Input", nodes: ["姿态", "骨架", "关键点"] },
    { layer: "中层", nodes: ["融合", "交互", "编码"] },
    { layer: "Output", nodes: ["分类", "标签", "预测"] }
  ];

  const layerWidth = chartWidth / 3;
  const nodeRadius = 20;

  // 绘制层级和节点
  layers.forEach((layerData, layerIdx) => {
    const layerX = layerWidth / 2 + layerIdx * layerWidth;

    // 层级标签
    g.append("text")
      .attr("x", layerX)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", COLORS.textMain)
      .text(layerData.layer);

    // 节点
    g.selectAll(`circle.node-${layerIdx}`)
      .data(layerData.nodes)
      .join("circle")
      .attr("cx", layerX)
      .attr("cy", (d, i) => (chartHeight / (layerData.nodes.length + 1)) * (i + 1))
      .attr("r", nodeRadius)
      .attr("fill", d => {
        const colors = [COLORS.primary, COLORS.success, COLORS.warning];
        return colors[layerData.nodes.indexOf(d) % colors.length];
      })
      .attr("opacity", 0.7)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // 节点标签
    g.selectAll(`text.label-${layerIdx}`)
      .data(layerData.nodes)
      .join("text")
      .attr("x", layerX)
      .attr("y", (d, i) => (chartHeight / (layerData.nodes.length + 1)) * (i + 1) + 4)
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("fill", "#fff")
      .attr("font-weight", "600")
      .text(d => d.substring(0, 2));
  });

  // 绘制层级之间的连接（注意力流）
  for (let i = 0; i < layers.length - 1; i++) {
    const srcLayer = layers[i];
    const tgtLayer = layers[i + 1];
    const srcX = layerWidth / 2 + i * layerWidth;
    const tgtX = layerWidth / 2 + (i + 1) * layerWidth;

    srcLayer.nodes.forEach((srcNode, srcIdx) => {
      tgtLayer.nodes.forEach((tgtNode, tgtIdx) => {
        const srcY = (chartHeight / (srcLayer.nodes.length + 1)) * (srcIdx + 1);
        const tgtY = (chartHeight / (tgtLayer.nodes.length + 1)) * (tgtIdx + 1);
        const opacity = 0.2 + Math.random() * 0.3;

        g.append("path")
          .attr("d", `M ${srcX + nodeRadius} ${srcY} Q ${(srcX + tgtX) / 2} ${(srcY + tgtY) / 2} ${tgtX - nodeRadius} ${tgtY}`)
          .attr("fill", "none")
          .attr("stroke", COLORS.primary)
          .attr("stroke-width", 1)
          .attr("opacity", opacity);
      });
    });
  }

  // 添加说明文本
  g.append("text")
    .attr("x", chartWidth / 2)
    .attr("y", chartHeight + 30)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", COLORS.textMuted)
    .text("→ 展示信息在各Transformer层中的流向 (线宽/透明度 = 关注度)");
}

// ═══════════════════════════════════════════════════════════════════
// 🎯 交互辅助函数
// ═══════════════════════════════════════════════════════════════════
// 骨架→热力图：根据关键点的实际位置高亮热力图的对应格子
function updateAttentionHeatmapHighlight(container, keypointId) {
  const attentionContainer = d3.select(container).select("#attention-container");
  const pos = posePositionMap[keypointId];
  
  if (!pos) return;
  
  // 关键点在16×16网格中的位置
  const gridX = Math.floor(pos[0] * 16);
  const gridY = Math.floor(pos[1] * 16);
  
  attentionContainer.selectAll("rect.heatmap-cell").style("opacity", d => {
    // 高亮该格子及周围的格子（5×5窗口）
    const distance = Math.abs(d.x - gridX) + Math.abs(d.y - gridY);
    return distance <= 2 ? 1 : 0.2;
  })
  .style("stroke", d => {
    const distance = Math.abs(d.x - gridX) + Math.abs(d.y - gridY);
    return distance <= 2 ? COLORS.primary : COLORS.bg;
  })
  .style("stroke-width", d => {
    const distance = Math.abs(d.x - gridX) + Math.abs(d.y - gridY);
    return distance <= 2 ? 2 : 0.5;
  });
}

function clearAttentionHeatmapHighlight(container) {
  const attentionContainer = d3.select(container).select("#attention-container");
  
  attentionContainer.selectAll("rect.heatmap-cell")
    .style("opacity", 1)
    .style("stroke", COLORS.bg)
    .style("stroke-width", 0.5);
}

// 反向联动：热力图→骨架，找到格子周围的关键点
function highlightSkeletonKeypoint(container, cellX, cellY) {
  const skeletonContainer = d3.select(container).select("#skeleton-container");
  const data = poseModelData.keypoint_importance;
  
  // 找到距离该格子最近的关键点
  let nearestKeypoint = null;
  let minDistance = Infinity;
  
  data.forEach(d => {
    const pos = posePositionMap[d.id];
    if (pos) {
      const gridX = pos[0] * 16;
      const gridY = pos[1] * 16;
      const distance = Math.sqrt((gridX - cellX) ** 2 + (gridY - cellY) ** 2);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestKeypoint = d.id;
      }
    }
  });
  
  if (nearestKeypoint !== null) {
    skeletonContainer.selectAll("circle.keypoint")
      .style("opacity", k => k.id === nearestKeypoint ? 1 : 0.3)
      .attr("stroke", k => k.id === nearestKeypoint ? COLORS.primary : "#fff")
      .attr("stroke-width", k => k.id === nearestKeypoint ? 3 : 2);
  }
}

function clearSkeletonKeypointHighlight(container) {
  const skeletonContainer = d3.select(container).select("#skeleton-container");
  const data = poseModelData.keypoint_importance;
  
  skeletonContainer.selectAll("circle.keypoint")
    .style("opacity", 0.85)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);
}

// ═══════════════════════════════════════════════════════════════════// �🔄 响应式布局
// ═══════════════════════════════════════════════════════════════════
function setupResize(container) {
  if (poseResizeObserver) poseResizeObserver.disconnect();

  poseResizeObserver = new ResizeObserver(() => {
    renderSkeletonChart(container);
    renderAttentionHeatmap(container);
    renderGradientFlowChart(container);
  });

  poseResizeObserver.observe(container);
}

// 页面加载时尝试初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => initPoseModelView().catch(err => console.error('Init error:', err)), 100);
  });
} else {
  // 如果已经加载了，直接初始化
  setTimeout(() => initPoseModelView().catch(err => console.error('Init error:', err)), 100);
}

// 同时支持从Portal的handoff事件初始化
document.addEventListener("portal:handoff", (e) => {
  if (e.detail?.targetId === "pose-model-view") {
    console.log('🎯 portal:handoff received for pose-model-view');
    setTimeout(() => initPoseModelView().catch(err => console.error('Handoff init error:', err)), 100);
  }
});
