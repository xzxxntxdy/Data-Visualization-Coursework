/**
 * 姿态 + 模型分析可视化
 * 3张简洁优雅的图表展示模型对人体结构的理解
 */

import * as d3 from "d3";

// 导入分析数据
import poseAnalysisData from "../data/pose_analysis_results.json";
import cocoVsYoloData from "../data/coco_vs_yolo_scatter.json";

const COLORS = {
  primary: "#667eea",
  success: "#48bb78",
  warning: "#ed8936",
  error: "#f56565",
  head: "#667eea",
  upper: "#ed8936",
  torso: "#48bb78",
  lower: "#f56565"
};

const BODY_REGIONS_COLOR = {
  '头部': COLORS.head,
  '上肢': COLORS.upper,
  '躯干': COLORS.torso,
  '下肢': COLORS.lower
};

/**
 * 获取关键点所属的身体部位
 */
function get_body_region(keypoint_name) {
  const head_kps = new Set(['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear']);
  const upper_limbs = new Set(['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist']);
  const torso = new Set(['left_hip', 'right_hip']);
  const lower_limbs = new Set(['left_knee', 'right_knee', 'left_ankle', 'right_ankle']);
  
  if (head_kps.has(keypoint_name)) return '头部';
  if (upper_limbs.has(keypoint_name)) return '上肢';
  if (torso.has(keypoint_name)) return '躯干';
  if (lower_limbs.has(keypoint_name)) return '下肢';
  return '其他';
}

/**
 * 图表1: 关键点识别准确度分析（线条+散点）
 * 用连贯的曲线展示17个关键点的置信度趋势
 */
export function renderKeypointAccuracyChart(container) {
  let data = poseAnalysisData.chart_data.chart1.data;
  
  // 按从头到脚的解剖学顺序排序（而不是置信度排序）
  const anatomicalOrder = [
    'nose',
    'left_eye', 'right_eye',
    'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder',
    'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist',
    'left_hip', 'right_hip',
    'left_knee', 'right_knee',
    'left_ankle', 'right_ankle'
  ];
  
  // 创建关键点名称到索引的映射
  const keypointToOrder = {};
  anatomicalOrder.forEach((kp, idx) => {
    keypointToOrder[kp] = idx;
  });
  
  // 按解剖学顺序排序数据
  data = data.sort((a, b) => {
    const keyA = a.keypoint || a.name;
    const keyB = b.keypoint || b.name;
    return (keypointToOrder[keyA] || 999) - (keypointToOrder[keyB] || 999);
  });
  
  const margin = { top: 30, right: 30, bottom: 80, left: 60 };
  const width = 1200 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // 清空容器
  d3.select(container).html("");

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // X轴 - 关键点（支持新旧数据格式）
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.keypoint || d.name))
    .range([0, width])
    .padding(0.2);

  const xAxis = d3.axisBottom(xScale);
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .attr("text-anchor", "end")
    .style("font-size", "12px");

  // Y轴 - 置信度
  const yScale = d3.scaleLinear()
    .domain([0, 1])
    .range([height, 0]);

  const yAxis = d3.axisLeft(yScale)
    .ticks(5)
    .tickFormat(d3.format(".1%"));

  svg.append("g")
    .call(yAxis)
    .style("font-size", "11px");

  // Y轴标签
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .style("fill", "#475569")
    .text("置信度");

  // 网格线
  svg.append("g")
    .attr("class", "grid")
    .attr("opacity", 0.1)
    .call(d3.axisLeft(yScale)
      .tickSize(-width)
      .tickFormat("")
    );

  // 连接线 - 展示趋势
  const lineGenerator = d3.line()
    .x((d, i) => xScale(d.keypoint || d.name) + xScale.bandwidth() / 2)
    .y(d => yScale(d.mean || d.value));

  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", COLORS.primary)
    .attr("stroke-width", 2.5)
    .attr("opacity", 0.6)
    .attr("d", lineGenerator);

  // 背景区域填充
  const areaGenerator = d3.area()
    .x((d, i) => xScale(d.keypoint || d.name) + xScale.bandwidth() / 2)
    .y0(height)
    .y1(d => yScale(d.mean || d.value));

  svg.append("path")
    .datum(data)
    .attr("fill", COLORS.primary)
    .attr("opacity", 0.08)
    .attr("d", areaGenerator);

  // 散点 - 每个关键点，加强交互
  svg.selectAll("circle.keypoint-dot")
    .data(data, d => d.keypoint || d.name)
    .join("circle")
    .attr("class", "keypoint-dot")
    .attr("cx", d => xScale(d.keypoint || d.name) + xScale.bandwidth() / 2)
    .attr("cy", d => yScale(d.mean || d.value))
    .attr("r", 5)
    .attr("fill", d => {
      // 颜色编码：高 -> 蓝，中 -> 黄，低 -> 红
      const val = d.mean || d.value;
      if (val > 0.7) return "#667eea";
      if (val > 0.6) return "#ed8936";
      return "#f56565";
    })
    .attr("opacity", 0.85)
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .on("mouseenter", function(event, d) {
      // 高亮当前点
      d3.select(this)
        .transition()
        .duration(100)
        .attr("r", 8)
        .attr("opacity", 1)
        .attr("stroke-width", 3);
      
      // 显示工具提示
      const tooltipText = `${d.keypoint || d.name}\n${((d.mean || d.value) * 100).toFixed(1)}%`;
      svg.append("text")
        .attr("class", "keypoint-tooltip")
        .attr("x", xScale(d.keypoint || d.name) + xScale.bandwidth() / 2)
        .attr("y", yScale(d.mean || d.value) - 20)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .style("font-weight", "700")
        .style("fill", COLORS.primary)
        .style("pointer-events", "none")
        .text(((d.mean || d.value) * 100).toFixed(1) + "%");
      
      // 添加背景框
      svg.insert("rect", ".keypoint-tooltip")
        .attr("class", "tooltip-bg")
        .attr("x", xScale(d.keypoint || d.name) + xScale.bandwidth() / 2 - 35)
        .attr("y", yScale(d.mean || d.value) - 32)
        .attr("width", 70)
        .attr("height", 20)
        .attr("fill", "white")
        .attr("rx", 4)
        .attr("opacity", 0.9)
        .style("pointer-events", "none");
      
      // 突出显示关键点名称
      svg.append("text")
        .attr("class", "keypoint-label")
        .attr("x", xScale(d.keypoint || d.name) + xScale.bandwidth() / 2)
        .attr("y", yScale(d.mean || d.value) + 25)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#1e293b")
        .style("pointer-events", "none")
        .text(d.keypoint || d.name);
    })
    .on("mouseleave", function() {
      // 恢复点的外观
      d3.select(this)
        .transition()
        .duration(100)
        .attr("r", 5)
        .attr("opacity", 0.85)
        .attr("stroke-width", 2);
      
      // 移除工具提示
      svg.selectAll(".keypoint-tooltip").remove();
      svg.selectAll(".tooltip-bg").remove();
      svg.selectAll(".keypoint-label").remove();
    });

  // 标题 - 改进的样式
  d3.select(container).insert("div", ":first-child")
    .style("padding", "12px 16px")
    .style("margin", "-24px -24px 16px -24px")
    .style("background", "linear-gradient(90deg, #667eea15 0%, transparent 100%)")
    .style("border-bottom", "2px solid #667eea30")
    .style("font-size", "16px")
    .style("font-weight", "700")
    .style("color", "#1e293b")
    .html("📊 17个关键点的平均置信度曲线（11万张新图片）");

  // 说明 - 改进的展示
  d3.select(container).append("div")
    .style("padding", "12px 16px")
    .style("margin", "16px -24px -24px -24px")
    .style("background", "#f8fafc")
    .style("border-top", "1px solid #e2e8f0")
    .style("border-radius", "0 0 12px 12px")
    .style("font-size", "12px")
    .style("color", "#64748b")
    .style("line-height", "1.6")
    .html(
      "💡 <strong>数据来源</strong>：基于117,877张新图片上的157,773个人物检测。" +
      "按从头到脚的解剖学顺序排列。曲线呈现下降趋势说明从头部到脚部识别难度逐步增加。" +
      "蓝色点表示高置信度 &gt;70%，这些关键点在大多数图像中清晰可见；" +
      "红色点表示置信度 &lt;60%，通常因为被遮挡、离镜头远或运动模糊。" +
      "<strong>鼠标悬停点查看详细信息</strong>。"
    );
}

/**
 * 图表2: 关键点可见性 vs 识别准确度关系
 * 用XY坐标展示关键点的可见性特征与模型性能的关系
 */
export function renderBodyRegionComparison(container) {
  // 使用合并后的数据：COCO真实可见度 vs YOLO推测置信度
  let plotData = [];
  
  if (cocoVsYoloData?.data && cocoVsYoloData.data.length > 0) {
    plotData = cocoVsYoloData.data.map(d => ({
      keypoint: d.keypoint,
      coco_visibility_score: d.coco_visibility_score,    // X轴：COCO真实可见度
      yolo_mean_confidence: d.yolo_mean_confidence,      // Y轴：YOLO推测置信度
      region: d.region,
      coco_visible_pct: d.coco_visible_pct,
      yolo_detection_rate: d.yolo_detection_rate
    }));
  }
  
  // 如果没有数据，使用备选方案
  if (plotData.length === 0) {
    console.warn("未加载COCO vs YOLO数据，使用备选数据");
    if (poseAnalysisData.chart_data?.body_region_scatter) {
      plotData = poseAnalysisData.chart_data.body_region_scatter;
    }
  }

  const margin = { top: 40, right: 40, bottom: 60, left: 70 };
  const width = 650 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // 清空容器
  d3.select(container).html("");

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // X轴 - COCO数据集中的关键点可见度
  const xScale = d3.scaleLinear()
    .domain([20, 50])
    .range([0, width]);

  const xAxis = d3.axisBottom(xScale)
    .ticks(6)
    .tickFormat(d => d + "%");

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .style("font-size", "11px");

  // X轴标签
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 45)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .style("fill", "#475569")
    .text("COCO 2017数据集(273K人物)关键点可见度 % - 真实标注值");

  // Y轴 - YOLO模型在117K张新图片上的推测置信度
  const yScale = d3.scaleLinear()
    .domain([0.4, 1])
    .range([height, 0]);

  const yAxis = d3.axisLeft(yScale)
    .ticks(5)
    .tickFormat(d3.format(".1%"));

  svg.append("g")
    .call(yAxis)
    .style("font-size", "11px");

  // Y轴标签
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .style("fill", "#475569")
    .text("YOLO模型在117K张新图片上的推测平均置信度");

  // 参考区域背景 - 高COCO可见度高置信度区
  svg.append("rect")
    .attr("x", width * 0.5)
    .attr("y", 0)
    .attr("width", width * 0.5)
    .attr("height", height * 0.5)
    .attr("fill", "#86efac")
    .attr("opacity", 0.08);

  svg.append("text")
    .attr("x", width - 10)
    .attr("y", 15)
    .attr("text-anchor", "end")
    .style("font-size", "11px")
    .style("fill", "#22c55e")
    .style("opacity", 0.6)
    .text("COCO可见+模型高置信区");

  // 网格线
  svg.append("g")
    .attr("class", "grid")
    .attr("opacity", 0.08)
    .call(d3.axisLeft(yScale)
      .tickSize(-width)
      .tickFormat("")
    );

  // 参考线 - 理想趋势（COCO可见度↑模型置信度↑）
  svg.append("line")
    .attr("x1", xScale(10))
    .attr("y1", yScale(0.4))
    .attr("x2", xScale(48))
    .attr("y2", yScale(0.9))
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "6,4")
    .attr("opacity", 0.5);

  svg.append("text")
    .attr("x", xScale(32))
    .attr("y", yScale(0.62) - 8)
    .style("font-size", "11px")
    .style("fill", "#94a3b8")
    .style("opacity", 0.7)
    .text("理想趋势线（可见度↑置信度↑）");

  // 散点 - 改进的交互设计
  const bubbleGroup = svg.selectAll(".bubble-group")
    .data(plotData)
    .enter()
    .append("g")
    .attr("class", "bubble-group");

  // 添加气泡背景阴影
  bubbleGroup.append("circle")
    .attr("class", "bubble-shadow")
    .attr("cx", d => xScale(d.coco_visibility_score))
    .attr("cy", d => yScale(d.yolo_mean_confidence))
    .attr("r", 5)
    .attr("fill", "#000")
    .attr("opacity", 0)
    .style("pointer-events", "none");

  // 添加主气泡（按身体部位着色）
  bubbleGroup.append("circle")
    .attr("class", "bubble-main")
    .attr("cx", d => xScale(d.coco_visibility_score))
    .attr("cy", d => yScale(d.yolo_mean_confidence))
    .attr("r", 3.5)
    .attr("fill", d => BODY_REGIONS_COLOR[d.region] || COLORS.primary)
    .attr("opacity", 0.75)
    .attr("stroke", "white")
    .attr("stroke-width", 1)
    .style("cursor", "pointer");

  // 交互效果
  bubbleGroup
    .on("mouseenter", function(event, d) {
      const group = d3.select(this);
      
      // 气泡动画
      group.select(".bubble-shadow")
        .transition()
        .duration(200)
        .attr("r", 7)
        .attr("opacity", 0.2);
      
      group.select(".bubble-main")
        .transition()
        .duration(200)
        .attr("r", 6)
        .attr("opacity", 1)
        .attr("stroke-width", 2);

      // 计算工具提示位置（智能避免超出边界）
      let tooltipX = xScale(d.coco_visibility_score) + 15;
      let tooltipY = yScale(d.yolo_mean_confidence) - 70;
      
      // 防止超出右边界
      if (tooltipX + 160 > width) {
        tooltipX = xScale(d.coco_visibility_score) - 175;
      }
      
      // 防止超出上边界
      if (tooltipY < 0) {
        tooltipY = yScale(d.yolo_mean_confidence) + 20;
      }

      // 创建工具提示容器
      const tooltipContainer = svg.append("g")
        .attr("class", "tooltip-container")
        .attr("opacity", 0)
        .attr("pointer-events", "none");

      // 背景框
      tooltipContainer.append("rect")
        .attr("x", tooltipX - 10)
        .attr("y", tooltipY - 10)
        .attr("width", 160)
        .attr("height", 100)
        .attr("fill", "white")
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("stroke", BODY_REGIONS_COLOR[d.region] || COLORS.primary)
        .attr("stroke-width", 2);

      // 关键点名称
      tooltipContainer.append("text")
        .attr("x", tooltipX + 70)
        .attr("y", tooltipY + 8)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "700")
        .style("fill", BODY_REGIONS_COLOR[d.region] || COLORS.primary)
        .text(d.keypoint);

      // COCO可见度标签
      tooltipContainer.append("text")
        .attr("x", tooltipX + 70)
        .attr("y", tooltipY + 28)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#64748b")
        .text("COCO可见度");

      // COCO可见度值
      tooltipContainer.append("text")
        .attr("x", tooltipX + 70)
        .attr("y", tooltipY + 42)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "#1e293b")
        .text(d.coco_visibility_score.toFixed(1) + "%");

      // YOLO置信度标签
      tooltipContainer.append("text")
        .attr("x", tooltipX + 70)
        .attr("y", tooltipY + 58)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#64748b")
        .text("YOLO置信度");

      // YOLO置信度值
      tooltipContainer.append("text")
        .attr("x", tooltipX + 70)
        .attr("y", tooltipY + 72)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "#1e293b")
        .text((d.yolo_mean_confidence * 100).toFixed(1) + "%");

      // 连接线到气泡
      tooltipContainer.insert("line", "rect")
        .attr("x1", tooltipX + (tooltipX > xScale(d.coco_visibility_score) ? -10 : 160))
        .attr("y1", tooltipY + 45)
        .attr("x2", xScale(d.coco_visibility_score))
        .attr("y2", yScale(d.yolo_mean_confidence))
        .attr("stroke", BODY_REGIONS_COLOR[d.region] || COLORS.primary)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,4")
        .attr("opacity", 0.4);

      // 淡入动画
      tooltipContainer.transition()
        .duration(150)
        .attr("opacity", 1);
    })
    .on("mouseleave", function() {
      const group = d3.select(this);
      
      // 恢复气泡
      group.select(".bubble-shadow")
        .transition()
        .duration(200)
        .attr("r", 5)
        .attr("opacity", 0);
      
      group.select(".bubble-main")
        .transition()
        .duration(200)
        .attr("r", 3.5)
        .attr("opacity", 0.75)
        .attr("stroke-width", 1);

      // 移除工具提示
      svg.selectAll(".tooltip-container")
        .transition()
        .duration(150)
        .attr("opacity", 0)
        .remove();
    });

  // 注：标签已移到hover时的工具提示中显示，默认不显示以保持图表简洁

  // 标题 - 改进的样式
  d3.select(container).insert("div", ":first-child")
    .style("padding", "12px 16px")
    .style("margin", "-24px -24px 16px -24px")
    .style("background", "linear-gradient(90deg, #48bb7815 0%, transparent 100%)")
    .style("border-bottom", "2px solid #48bb7830")
    .style("font-size", "16px")
    .style("font-weight", "700")
    .style("color", "#1e293b")
    .html("🔗 COCO数据集可见度 ↔ YOLO模型置信度");

  // 说明 - 改进的展示
  d3.select(container).append("div")
    .style("padding", "12px 16px")
    .style("margin", "16px -24px -24px -24px")
    .style("background", "#f8fafc")
    .style("border-top", "1px solid #e2e8f0")
    .style("border-radius", "0 0 12px 12px")
    .style("font-size", "12px")
    .style("color", "#64748b")
    .style("line-height", "1.6")
    .html(
      "💡 <strong>解读</strong>：" +
      "X轴表示COCO 2017训练+验证数据集中各关键点的标注可见度（真实标注数据），" +
      "Y轴表示YOLO模型对这些关键点的识别置信度。" +
      "右上角区域（高COCO可见度+高模型置信度）代表在COCO中标注充分的关键点，模型学得很好；" +
      "左下角（低COCO可见度+低模型置信度）代表在COCO中标注不足的关键点，模型学得困难。" +
      "这说明 <strong>数据集的标注质量和充分度直接决定模型的学习效果</strong>。" +
      "<strong>鼠标悬停气泡查看详细数据</strong>。"
    );
}

/**
 * 初始化所有可视化 - 改进的交互设计
 */
export function initPoseModelAnalysis(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`容器 #${containerId} 不存在`);
    return;
  }

  // 创建增强的布局
  container.innerHTML = `

    <!-- 快速导航 -->
    <div style="
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
    ">
      <button id="btn-chart1" class="nav-btn active" data-chart="chart1" style="
        padding: 8px 16px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 200ms ease;
      ">
        📈 关键点排序
      </button>
      <button id="btn-chart2" class="nav-btn" data-chart="chart2" style="
        padding: 8px 16px;
        background: #e2e8f0;
        color: #475569;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 200ms ease;
      ">
        🔗 遮挡 vs 性能
      </button>
      <div style="flex: 1;"></div>
      <button id="btn-fullscreen" style="
        padding: 8px 12px;
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: all 200ms ease;
      ">
        ⛶ 全屏
      </button>
    </div>

    <!-- 图表容器 -->
    <div style="display: grid; grid-template-columns: 1fr; gap: 24px;">
      <!-- 图表1 -->
      <div id="chart1" style="
        background: #ffffff;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.05);
        transition: all 300ms ease;
      "></div>

      <!-- 图表2 -->
      <div id="chart2" style="
        background: #ffffff;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.05);
        transition: all 300ms ease;
      "></div>

      <!-- 图例说明 -->
      <div style="
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
      ">
        <div style="
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 16px;
          color: #1e293b;
        ">
          📖 使用指南
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 8px;">
              🎯 关键点识别能力曲线
            </div>
            <div style="font-size: 12px; color: #64748b; line-height: 1.5;">
              <div style="margin-bottom: 6px;">
                <span style="display: inline-block; width: 12px; height: 12px; background: #667eea; border-radius: 50%; vertical-align: middle; margin-right: 6px;"></span>
                蓝色 = 高准确度 (&gt;70%)
              </div>
              <div style="margin-bottom: 6px;">
                <span style="display: inline-block; width: 12px; height: 12px; background: #ed8936; border-radius: 50%; vertical-align: middle; margin-right: 6px;"></span>
                橙色 = 中等 (60-70%)
              </div>
              <div>
                <span style="display: inline-block; width: 12px; height: 12px; background: #f56565; border-radius: 50%; vertical-align: middle; margin-right: 6px;"></span>
                红色 = 低准确度 (&lt;60%)
              </div>
            </div>
          </div>

          <div>
            <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 8px;">
              💡 关键发现
            </div>
            <div style="font-size: 12px; color: #64748b; line-height: 1.5;">
              <div style="margin-bottom: 6px;">✓ 躯干最强 (0.759)</div>
              <div style="margin-bottom: 6px;">✓ 下肢最弱 (0.553)</div>
              <div style="margin-bottom: 6px;">✓ 完美对称性差异</div>
              <div>✓ 遮挡决定性能</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 渲染图表
  renderKeypointAccuracyChart("#chart1");
  renderBodyRegionComparison("#chart2");

  // 导航按钮交互
  const navButtons = document.querySelectorAll(".nav-btn");
  navButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      navButtons.forEach(b => {
        b.style.background = "#e2e8f0";
        b.style.color = "#475569";
      });
      btn.style.background = "#667eea";
      btn.style.color = "white";
      
      const targetChart = btn.dataset.chart;
      const chart1 = document.getElementById("chart1");
      const chart2 = document.getElementById("chart2");
      
      if (targetChart === "chart1") {
        chart1.style.display = "block";
        chart2.style.display = "none";
      } else {
        chart1.style.display = "none";
        chart2.style.display = "block";
      }
    });
  });

  // 全屏按钮
  const fullscreenBtn = document.getElementById("btn-fullscreen");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", () => {
      const elem = container;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
    });
  }

  // 添加鼠标悬停效果到卡片
  const cards = document.querySelectorAll("#chart1, #chart2");
  cards.forEach(card => {
    card.addEventListener("mouseenter", () => {
      card.style.boxShadow = "0 8px 20px rgba(102, 126, 234, 0.2)";
      card.style.borderColor = "#667eea";
    });
    card.addEventListener("mouseleave", () => {
      card.style.boxShadow = "0 2px 12px rgba(0,0,0,0.05)";
      card.style.borderColor = "#e2e8f0";
    });
  });

  console.log("✓ 姿态 + 模型分析可视化初始化完成");
}

export default {
  initPoseModelAnalysis,
  renderKeypointAccuracyChart,
  renderBodyRegionComparison
};
