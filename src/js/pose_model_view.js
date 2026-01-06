import * as d3 from "d3";
import poseStats from "../data/pose_stats.json";
import { initImageExplorer } from "./image_explorer.js";
import { initPoseModelAnalysis } from "./pose_model_analysis.js";

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
    high: "#ef4444",      // 红色 - 高敏感性
    medium: "#f59e0b",    // 橙色 - 中等敏感性
    low: "#10b981",       // 绿色 - 低敏感性
    bone: "#94a3b8"
  },
  sensitivity: {
    high: "#ef4444",      // 红色 - >0.85
    medium: "#f59e0b",    // 橙色 - 0.65-0.85
    low: "#10b981"        // 绿色 - <0.65
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

// 根据重要性分数获取敏感性等级和颜色
function getSensitivityLevel(score) {
  if (score > 0.85) {
    return { level: "high", color: COLORS.sensitivity.high, label: "高敏感" };
  } else if (score > 0.65) {
    return { level: "medium", color: COLORS.sensitivity.medium, label: "中敏感" };
  } else {
    return { level: "low", color: COLORS.sensitivity.low, label: "低敏感" };
  }
}

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

  // 加载pose_stats.json到全局变量
  try {
    const response = await fetch('./data/pose_stats.json');
    if (response.ok) {
      window.poseStatsData = await response.json();
    }
  } catch (error) {
    console.warn('Failed to load pose_stats.json:', error);
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

  // 构建新的图表布局
  buildNewLayout(container);

  // 初始化图表
  setTimeout(() => {
    renderNewHeader(container);
    renderComprehensiveAnalysis(container);
    setupNewResize(container);
  }, 50);
}

export function refreshPoseModelView() {
  initPoseModelView();
}

// ═══════════════════════════════════════════════════════════════════
// 📐 新布局构建 (使用高质量综合图表)
// ═══════════════════════════════════════════════════════════════════
function buildNewLayout(container) {
  d3.select(container).html(`
    <div class="pm-root-new">
      <div id="pm-header-new"></div>
      <div id="pm-charts-new" style="
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 24px 32px;
        overflow-y: auto;
      ">
        <div id="image-explorer-section" style="
          padding: 0;
        "></div>
        <div id="comprehensive-chart"></div>
      </div>
    </div>
  `);
}

function renderNewHeader(container) {
  const header = d3.select(container).select("#pm-header-new")
    .style("padding", "24px 32px")
    .style("border-bottom", `1px solid ${COLORS.border}`)
    .style("background", COLORS.cardBg);

  header.append("h2")
    .text("📊 综合姿态 + 模型分析")
    .style("margin", "0 0 12px 0")
    .style("font-size", "24px")
    .style("font-weight", "700")
    .style("color", COLORS.textMain);

  header.append("p")
    .html(`
      <strong style="color: ${COLORS.textMain};">目标：</strong>
      从11万张COCO数据集图像的YOLOv8重新推理的结果中，深度理解模型学到了什么<br/>
      <span style="font-size: 13px; color: ${COLORS.textMuted}; display: block; margin-top: 8px;">
        <strong>核心问题：</strong> 
        模型的置信度是否可靠？ → 推理结果展示判断的合理性 | 
        COCO数据集是否有偏差？ → 上体置信度高于下体（因为下体被遮挡的多，符合遮挡度数据）
      </span>
    `)
    .style("margin", "0")
    .style("font-size", "14px")
    .style("line-height", "1.6")
    .style("color", COLORS.textMuted);
}

function renderComprehensiveAnalysis(container) {
  const imageExplorerSection = d3.select(container).select("#image-explorer-section");
  
  // 图像浏览器 - 第一个显示
  renderImageExplorerInPlace(imageExplorerSection);

  // 使用新的分析可视化
  const analysisDiv = d3.select(container).select("#comprehensive-chart");
  analysisDiv.attr("id", "pose-model-analysis");
  
  setTimeout(() => {
    initPoseModelAnalysis("pose-model-analysis");
  }, 100);
}

// D3绘制主综合分析图表 - 高级版本
function renderMainChart(chartDiv) {
  chartDiv.append("h3")
    .text("② 高级可视化分析：径向柱状图 + 力导向网络图")
    .style("margin", "0 0 16px 0")
    .style("font-size", "15px")
    .style("font-weight", "600")
    .style("color", COLORS.textMain);

  // 关键点数据
  const keypoints = [
    { id: 0, name: "鼻子", conf: 0.6403, part: "头部" },
    { id: 1, name: "左眼", conf: 0.6139, part: "头部" },
    { id: 2, name: "右眼", conf: 0.6177, part: "头部" },
    { id: 3, name: "左耳", conf: 0.5368, part: "头部" },
    { id: 4, name: "右耳", conf: 0.5272, part: "头部" },
    { id: 5, name: "左肩", conf: 0.8447, part: "躯干" },
    { id: 6, name: "右肩", conf: 0.8578, part: "躯干" },
    { id: 7, name: "左肘", conf: 0.7481, part: "上肢" },
    { id: 8, name: "右肘", conf: 0.7561, part: "上肢" },
    { id: 9, name: "左腕", conf: 0.5907, part: "上肢" },
    { id: 10, name: "右腕", conf: 0.6045, part: "上肢" },
    { id: 11, name: "左髋", conf: 0.7600, part: "躯干" },
    { id: 12, name: "右髋", conf: 0.7672, part: "躯干" },
    { id: 13, name: "左膝", conf: 0.6479, part: "下肢" },
    { id: 14, name: "右膝", conf: 0.6583, part: "下肢" },
    { id: 15, name: "左踝", conf: 0.5208, part: "下肢" },
    { id: 16, name: "右踝", conf: 0.5191, part: "下肢" }
  ];

  // COCO骨架连接关系
  const edges = [
    [0,1], [0,2], [1,3], [2,4],  // 面部
    [5,6], [5,7], [6,8], [7,9], [8,10],  // 上肢
    [11,12], [5,11], [6,12],  // 躯干
    [11,13], [12,14], [13,15], [14,16]  // 下肢
  ];

  // 创建网格布局：径向图 + 力导向图
  const gridDiv = chartDiv.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1fr")
    .style("gap", "24px")
    .style("margin-bottom", "24px");

  // 左侧：径向柱状图
  const leftDiv = gridDiv.append("div");
  renderRadialBarChart(leftDiv, keypoints);

  // 右侧：力导向网络图
  const rightDiv = gridDiv.append("div");
  renderForceDirectedGraph(rightDiv, keypoints, edges);

  // 底部：统计摘要
  const summaryDiv = chartDiv.append("div")
    .style("background", "#f8fafc")
    .style("border-radius", "6px")
    .style("padding", "16px")
    .style("margin-top", "16px");

  renderSummary(summaryDiv);
}

// 高级D3: 径向柱状图 (Radial Bar Chart)
function renderRadialBarChart(container, keypoints) {
  const titleDiv = container.append("div")
    .style("margin-bottom", "12px");

  titleDiv.append("h4")
    .text("🔄 径向柱状图：17个关键点置信度")
    .style("margin", "0 0 4px 0")
    .style("font-size", "14px")
    .style("color", COLORS.textMain)
    .style("font-weight", "600");

  titleDiv.append("p")
    .text("圆周排列 + 柱子长度=置信度 + 颜色=身体部位")
    .style("margin", "0")
    .style("font-size", "12px")
    .style("color", COLORS.textMuted);

  const width = 320;
  const height = 320;
  const radius = Math.min(width, height) / 2 - 40;

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${width/2},${height/2})`);

  const colorMap = {
    "躯干": COLORS.danger,
    "头部": COLORS.warning,
    "上肢": COLORS.success,
    "下肢": "#3b82f6"
  };

  // 计算角度
  const angleSlice = (Math.PI * 2) / keypoints.length;
  const maxConf = 1;

  // 背景圆圈
  for (let i = 0.2; i <= 1; i += 0.2) {
    g.append("circle")
      .attr("r", radius * i)
      .attr("fill", "none")
      .attr("stroke", COLORS.border)
      .attr("stroke-width", 1)
      .attr("opacity", 0.3);
  }

  // 柱子
  g.selectAll(".radial-bar")
    .data(keypoints)
    .join("g")
    .attr("class", "radial-bar")
    .attr("transform", (d, i) => `rotate(${(i * angleSlice * 180) / Math.PI})`)
    .append("rect")
    .attr("y", 0)
    .attr("x", -8)
    .attr("width", 16)
    .attr("height", d => (radius * d.conf) / maxConf)
    .attr("fill", d => colorMap[d.part])
    .attr("opacity", 0.85)
    .attr("rx", 2)
    .on("mouseenter", function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("opacity", 1)
        .attr("width", 20);
      
      // 显示提示
      container.append("div")
        .attr("class", "radial-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0,0,0,0.9)")
        .style("color", "white")
        .style("padding", "8px 12px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("z-index", "1000")
        .text(`${d.name}: ${(d.conf * 100).toFixed(1)}%`);
    })
    .on("mouseleave", function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("opacity", 0.85)
        .attr("width", 16);
      container.selectAll(".radial-tooltip").remove();
    });

  // 标签
  g.selectAll(".radial-label")
    .data(keypoints)
    .join("text")
    .attr("class", "radial-label")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("transform", (d, i) => {
      const angle = i * angleSlice;
      const x = Math.cos(angle - Math.PI / 2) * (radius + 50);
      const y = Math.sin(angle - Math.PI / 2) * (radius + 50);
      return `translate(${x},${y})`;
    })
    .attr("font-size", "10px")
    .attr("fill", COLORS.textMain)
    .attr("font-weight", "500")
    .text(d => d.name);

  // 图例
  const legendData = [
    { color: colorMap["躯干"], label: "躯干" },
    { color: colorMap["头部"], label: "头部" },
    { color: colorMap["上肢"], label: "上肢" },
    { color: colorMap["下肢"], label: "下肢" }
  ];

  const legend = container.append("div")
    .style("display", "flex")
    .style("gap", "12px")
    .style("margin-top", "12px")
    .style("font-size", "11px")
    .style("justify-content", "center")
    .style("flex-wrap", "wrap");

  legend.selectAll(".legend-item")
    .data(legendData)
    .join("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "4px")
    .html(d => `<span style="width:10px; height:10px; background:${d.color}; border-radius:2px;"></span>${d.label}`);
}

// 高级D3: 力导向图 (Force-Directed Graph)
function renderForceDirectedGraph(container, nodes, edges) {
  const titleDiv = container.append("div")
    .style("margin-bottom", "12px");

  titleDiv.append("h4")
    .text("🔗 关键点网络关系图")
    .style("margin", "0 0 4px 0")
    .style("font-size", "14px")
    .style("color", COLORS.textMain)
    .style("font-weight", "600");

  titleDiv.append("p")
    .text("节点大小=置信度 | 颜色=身体部位 | 拖拽交互")
    .style("margin", "0")
    .style("font-size", "12px")
    .style("color", COLORS.textMuted);

  const width = 320;
  const height = 320;

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("border", `1px solid ${COLORS.border}`)
    .style("border-radius", "4px")
    .style("background", "white");

  // 转换边数据格式
  const linkData = edges.map(([source, target]) => ({ source, target }));

  const colorMap = {
    "躯干": COLORS.danger,
    "头部": COLORS.warning,
    "上肢": COLORS.success,
    "下肢": "#3b82f6"
  };

  // 力模拟
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(linkData)
      .id(d => d.id)
      .distance(40)
      .strength(0.5))
    .force("charge", d3.forceManyBody().strength(-120))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(20));

  // 绘制边
  const link = svg.selectAll(".link")
    .data(linkData)
    .join("line")
    .attr("class", "link")
    .attr("stroke", COLORS.border)
    .attr("stroke-width", 1)
    .attr("opacity", 0.4);

  // 绘制节点
  const node = svg.selectAll(".node")
    .data(nodes)
    .join("g")
    .attr("class", "node")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  node.append("circle")
    .attr("r", d => 4 + d.conf * 8)  // 大小按置信度
    .attr("fill", d => colorMap[d.part])
    .attr("opacity", 0.85)
    .attr("stroke", "white")
    .attr("stroke-width", 1.5);

  node.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "-12px")
    .attr("font-size", "9px")
    .attr("font-weight", "500")
    .attr("fill", COLORS.textMain)
    .text(d => d.name.substring(0, 3));

  // 模拟更新
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  // 拖拽函数
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // 提示信息
  node.on("mouseenter", function(event, d) {
    d3.select(this).select("circle")
      .transition()
      .duration(200)
      .attr("stroke-width", 3)
      .attr("opacity", 1);
  })
  .on("mouseleave", function() {
    d3.select(this).select("circle")
      .transition()
      .duration(200)
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.85);
  });
}

// D3绘制置信度分布详细分析
function renderDistributionChart(chartDiv) {
  chartDiv.append("h3")
    .text("③ 置信度分布详解：难易关键点对比")
    .style("margin", "0 0 16px 0")
    .style("font-size", "15px")
    .style("font-weight", "600")
    .style("color", COLORS.textMain);

  // 最难和最容易的关键点
  const hardest = [
    { name: "右踝", conf: 0.5191 },
    { name: "左踝", conf: 0.5208 },
    { name: "右耳", conf: 0.5272 },
    { name: "左耳", conf: 0.5368 },
    { name: "左眼", conf: 0.6139 }
  ];

  const easiest = [
    { name: "右肩", conf: 0.8578 },
    { name: "左肩", conf: 0.8447 },
    { name: "右髋", conf: 0.7672 },
    { name: "左髋", conf: 0.7600 },
    { name: "右肘", conf: 0.7561 }
  ];

  const gridDiv = chartDiv.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1fr")
    .style("gap", "24px");

  // 左：最难
  renderDifficultyChart(gridDiv.append("div"), "最难检测的5个关键点", hardest, COLORS.danger);

  // 右：最容易
  renderDifficultyChart(gridDiv.append("div"), "最容易检测的5个关键点", easiest, COLORS.success);

  // 底部：统计指标
  const statsDiv = chartDiv.append("div")
    .style("background", "#fffbeb")
    .style("border-radius", "6px")
    .style("padding", "16px")
    .style("margin-top", "16px")
    .style("border-left", `4px solid ${COLORS.warning}`);

  statsDiv.append("h4")
    .text("🎯 置信度统计指标")
    .style("margin", "0 0 12px 0")
    .style("font-size", "14px")
    .style("color", COLORS.textMain);

  const stats = [
    { label: "全体均值", value: "0.6743", desc: "所有17个关键点×175张图 = 2,975个数据点" },
    { label: "标准差", value: "0.2430", desc: "相对较大的波动，反映了不同部位的差异" },
    { label: "上下肢差", value: "23.5%", desc: "躯干(80.7%) vs 下肢(57.3%) - 显著的COCO数据偏差" }
  ];

  const statsContainer = statsDiv.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(3, 1fr)")
    .style("gap", "16px");

  statsContainer.selectAll(".stat-item")
    .data(stats)
    .join("div")
    .style("text-align", "center")
    .style("padding", "12px")
    .style("background", "white")
    .style("border-radius", "4px")
    .html(d => `
      <div style="font-size:16px; font-weight:700; color:${COLORS.primary};">${d.value}</div>
      <div style="font-size:12px; font-weight:600; color:${COLORS.textMain}; margin-top:4px;">${d.label}</div>
      <div style="font-size:11px; color:${COLORS.textMuted}; margin-top:4px;">${d.desc}</div>
    `);
}

// 难度对比图
function renderDifficultyChart(container, title, data, color) {
  container.append("h4")
    .text(title)
    .style("margin", "0 0 12px 0")
    .style("font-size", "14px")
    .style("color", COLORS.textMain);

  const width = 280;
  const height = 180;
  const margin = { top: 10, right: 20, bottom: 25, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const yScale = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([0, chartHeight])
    .padding(0.25);

  const xScale = d3.scaleLinear()
    .domain([0, 1])
    .range([0, chartWidth]);

  // 条形
  g.selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("y", d => yScale(d.name))
    .attr("height", yScale.bandwidth())
    .attr("x", 0)
    .attr("width", d => xScale(d.conf))
    .attr("fill", color)
    .attr("opacity", 0.85)
    .attr("rx", 2);

  // 标签
  g.selectAll(".label")
    .data(data)
    .join("text")
    .attr("y", d => yScale(d.name) + yScale.bandwidth() / 2)
    .attr("x", d => xScale(d.conf) + 4)
    .attr("dy", "0.35em")
    .attr("font-size", "11px")
    .attr("font-weight", "600")
    .attr("fill", COLORS.textMain)
    .text(d => `${(d.conf * 100).toFixed(1)}%`);

  // 轴
  g.append("g")
    .call(d3.axisLeft(yScale))
    .style("font-size", "11px")
    .select(".domain").remove();

  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale).ticks(4).tickFormat(d3.format(".0%")))
    .style("font-size", "10px")
    .select(".domain").remove();
}

// 统计摘要
function renderSummary(container) {
  container.append("h4")
    .text("📊 关键统计指标概览")
    .style("margin", "0 0 12px 0")
    .style("font-size", "14px")
    .style("color", COLORS.textMain);

  const stats = [
    { label: "样本", value: "175张图像", icon: "🖼️" },
    { label: "关键点", value: "17 × 175 = 2,975个", icon: "🔴" },
    { label: "上下肢差", value: "23.5%", icon: "📉" },
    { label: "左右对称", value: "< 2.1%偏差", icon: "↔️" }
  ];

  const grid = container.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(4, 1fr)")
    .style("gap", "12px");

  grid.selectAll(".stat")
    .data(stats)
    .join("div")
    .style("padding", "12px")
    .style("background", "white")
    .style("border-radius", "4px")
    .style("text-align", "center")
    .style("border", `1px solid ${COLORS.border}`)
    .html(d => `
      <div style="font-size:18px; margin-bottom:4px;">${d.icon}</div>
      <div style="font-size:11px; color:${COLORS.textMuted}; margin-bottom:4px;">${d.label}</div>
      <div style="font-size:12px; font-weight:600; color:${COLORS.textMain};">${d.value}</div>
    `);
}

// ═══════════════════════════════════════════════════════════════════
// 🎯 交互式图片浏览器 (在顶部显示 - 由 image_explorer.js 处理)
// ═══════════════════════════════════════════════════════════════════
function renderImageExplorerInPlace(container) {
  // 清空容器
  container.html('');

  // 直接创建按钮容器，无额外框架和空白
  const explorerContent = container.append("div")
    .attr("id", "image-explorer-wrapper");

  // 延迟初始化确保DOM完全准备好
  setTimeout(() => {
    console.log('[Pose Model View] Calling initImageExplorer for image-explorer-wrapper');
    initImageExplorer('image-explorer-wrapper');
  }, 200);
}

function renderInteractiveImageExplorer(container) {
  // 清空容器
  container.html('');
  
  // 创建一个容器给image_explorer.js使用
  const explorerId = 'image-explorer-container';
  container.append('div').attr('id', explorerId);
  
  // 初始化图片浏览器（由image_explorer.js提供）
  if (window.initImageExplorer) {
    window.initImageExplorer(explorerId);
  } else {
    container.append('p')
      .style('color', 'red')
      .text('Image explorer library not loaded. Please refresh the page.');
  }
}

// 旧的辅助函数已移至 image_explorer.js
// (renderThumbnailList, loadAndDisplayImage, loadCocoImage, loadInferenceResultAndDrawHeatmap, renderConfidenceHeatmap)

function renderInsightsPanel(container) {
  // 核心发现与应用建议（图像浏览器已在顶部显示）
  const findingsSection = container.append("div")
    .style("background", "#f8fafc")
    .style("padding", "20px")
    .style("border-radius", "8px")
    .style("border", "1px solid #e2e8f0");

  findingsSection.append("h3")
    .text("④ 💡 核心发现与应用建议")
    .style("margin", "0 0 20px 0")
    .style("font-size", "18px")
    .style("font-weight", "700")
    .style("color", COLORS.textMain);

  const findings = [
    {
      title: "🎯 发现 1: COCO数据集的上下肢偏差",
      desc: "上半身置信度 80.7% (躯干) vs 下半身 57.3% (下肢) → 23.5%差异",
      impact: "原因：COCO中下肢常被遮挡或截断，模型学到了这一特点"
    },
    {
      title: "✓ 发现 2: 完美的身体对称特征",
      desc: "所有8对左右肢体的置信度差异 < 2.1% (眼睛0.38%, 肩膀1.30%)",
      impact: "说明模型学到了身体的对称性结构，这是好信号"
    },
    {
      title: "⚠️ 发现 3: 头部细节精度较低",
      desc: "眼睛(61.39%) 和 耳朵(52-54%) 置信度最低，低于预期",
      impact: "这些关键点易受角度、遮挡、光照影响"
    },
    {
      title: "💼 应用建议",
      desc: "1️⃣ 高精度需求 → 使用躯干关键点(0.7+)\n2️⃣ 全身应用 → 分层阈值(躯干0.7, 头0.6, 肢体0.5)\n3️⃣ 实时应用 → 较低阈值(0.45)增加覆盖",
      impact: "根据应用场景灵活选择阈值，不要一刀切"
    }
  ];

  findings.forEach((finding, idx) => {
    const item = findingsSection.append("div")
      .style("margin-bottom", "16px")
      .style("padding", "16px")
      .style("background", idx % 2 === 0 ? "#ffffff" : "#fffbeb")
      .style("border-left", `4px solid ${[COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger][idx % 4]}`)
      .style("border-radius", "6px")
      .style("box-shadow", "0 1px 3px rgba(0, 0, 0, 0.1)");

    item.append("div")
      .text(finding.title)
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("margin-bottom", "8px")
      .style("color", COLORS.textMain);

    item.append("div")
      .text(finding.desc)
      .style("font-size", "13px")
      .style("color", COLORS.textMuted)
      .style("margin-bottom", "8px")
      .style("line-height", "1.5")
      .style("white-space", "pre-line");

    item.append("div")
      .text(finding.impact)
      .style("font-size", "12px")
      .style("color", COLORS.textMuted)
      .style("font-style", "italic")
      .style("border-top", `1px solid rgba(0,0,0,0.1)`)
      .style("padding-top", "8px")
      .style("margin-top", "8px");
  });

  // 底部链接到详细报告
  findingsSection.append("div")
    .style("margin-top", "20px")
    .style("padding", "12px")
    .style("background", "#e0e7ff")
    .style("border-radius", "4px")
    .style("text-align", "center")
    .append("p")
    .html(`
      📄 <strong>完整分析报告</strong> 请查看：
      <code style="background: white; padding: 2px 6px; border-radius: 2px; font-size: 12px;">
      extract_attention_project/yolo_pose_results/ANALYSIS_GUIDE.md
      </code><br/>
      <span style="font-size: 12px; color: ${COLORS.textMuted};">
        包含详细的统计数据、应用场景、技术细节和改进方向
      </span>
    `)
    .style("margin", "0");
}

function setupNewResize(container) {
  // 简化的resize处理
  if (poseResizeObserver) {
    poseResizeObserver.disconnect();
  }
  
  poseResizeObserver = new ResizeObserver(() => {
    // 图表会自动响应父容器大小，因为使用了width:100%
  });

  const chartsDiv = container.querySelector("#pm-charts-new");
  if (chartsDiv) {
    poseResizeObserver.observe(chartsDiv);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 📐 旧布局构建 (保留兼容性，但不使用)
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
    .text("节点敏感性：红色 = 高敏感性 (>85%)  |  橙色 = 中敏感性 (65-85%)  |  绿色 = 低敏感性 (<65%)");

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
    const sensitivity = getSensitivityLevel(score);
    return sensitivity.color;
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
      id: d.id,
      name: d.name,
      gradient_contribution: d.gradient_contribution,
      flow_magnitude: d.flow_magnitude
    }));
    console.log('✅ 使用真实梯度数据');
  } else {
    // 回退到基于 importance_score 的模拟数据
    gradientData = poseModelData.keypoint_importance.slice(0, 8).map((d, i) => ({
      id: d.id,
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

  // 绘制梯度流柱子 - 使用统一的敏感性颜色
  g.selectAll("rect.gradient-bar")
    .data(gradientData)
    .join("rect")
    .attr("x", d => xScale(d.name))
    .attr("y", d => yScale(d.gradient_contribution))
    .attr("width", xScale.bandwidth() * 0.7)
    .attr("height", d => chartHeight - yScale(d.gradient_contribution))
    .attr("fill", d => {
      const sensitivity = getSensitivityLevel(d.gradient_contribution);
      return sensitivity.color;
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
    .text(d => {
      const sensitivity = getSensitivityLevel(d.gradient_contribution);
      return `${d.name}: 梯度贡献 ${(d.gradient_contribution * 100).toFixed(0)}% [${sensitivity.label}] | 流强度 ${(d.flow_magnitude * 100).toFixed(0)}%`;
    });

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
    .attr("transform", `translate(${width - 320}, ${10})`);

  legendGroup.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 310)
    .attr("height", 195)
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
    .text("节点敏感性等级");

  // 敏感性颜色说明
  const sensitivityItems = [
    { color: COLORS.sensitivity.high, label: "高敏感性 (>85%)", desc: "对预测影响大" },
    { color: COLORS.sensitivity.medium, label: "中敏感性 (65-85%)", desc: "对预测有中等影响" },
    { color: COLORS.sensitivity.low, label: "低敏感性 (<65%)", desc: "对预测影响较小" }
  ];

  sensitivityItems.forEach((item, idx) => {
    const y = 50 + idx * 40;
    
    legendGroup.append("rect")
      .attr("x", 12)
      .attr("y", y - 8)
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", item.color)
      .attr("opacity", 0.8);
    
    legendGroup.append("text")
      .attr("x", 28)
      .attr("y", y - 2)
      .attr("font-size", "11px")
      .attr("fill", COLORS.textMain)
      .text(item.label);
    
    legendGroup.append("text")
      .attr("x", 28)
      .attr("y", y + 10)
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
