/**
 * 姿态 + 模型分析可视化
 * 3张简洁优雅的图表展示模型对人体结构的理解
 */

import * as d3 from "d3";

// 导入分析数据
import poseAnalysisData from "../data/pose_analysis_results.json";
import occlusionStatsData from "../data/occlusion_stats.json";

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
 * 图表1: 关键点识别准确度分析（线条+散点）
 * 用连贯的曲线展示17个关键点的置信度趋势
 */
export function renderKeypointAccuracyChart(container) {
  const data = poseAnalysisData.chart_data.chart1.data;
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

  // X轴 - 关键点
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.name))
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
    .x((d, i) => xScale(d.name) + xScale.bandwidth() / 2)
    .y(d => yScale(d.value));

  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", COLORS.primary)
    .attr("stroke-width", 2.5)
    .attr("opacity", 0.6)
    .attr("d", lineGenerator);

  // 背景区域填充
  const areaGenerator = d3.area()
    .x((d, i) => xScale(d.name) + xScale.bandwidth() / 2)
    .y0(height)
    .y1(d => yScale(d.value));

  svg.append("path")
    .datum(data)
    .attr("fill", COLORS.primary)
    .attr("opacity", 0.08)
    .attr("d", areaGenerator);

  // 散点 - 每个关键点
  svg.selectAll(".dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", d => xScale(d.name) + xScale.bandwidth() / 2)
    .attr("cy", d => yScale(d.value))
    .attr("r", 5)
    .attr("fill", d => {
      // 颜色编码：高 -> 蓝，中 -> 黄，低 -> 红
      if (d.value > 0.7) return "#667eea";
      if (d.value > 0.6) return "#ed8936";
      return "#f56565";
    })
    .attr("opacity", 0.9)
    .attr("stroke", "white")
    .attr("stroke-width", 1.5)
    .on("mouseover", function(event, d) {
      d3.select(this)
        .attr("r", 7)
        .attr("opacity", 1);
      
      // 显示数值提示
      svg.append("text")
        .attr("class", "tooltip")
        .attr("x", xScale(d.name) + xScale.bandwidth() / 2)
        .attr("y", yScale(d.value) - 15)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("fill", COLORS.primary)
        .text((d.value * 100).toFixed(1) + "%");
    })
    .on("mouseout", function() {
      d3.select(this).attr("r", 5).attr("opacity", 0.9);
      svg.selectAll(".tooltip").remove();
    });

  // 标题
  d3.select(container).insert("div", ":first-child")
    .style("padding", "16px 0 12px 0")
    .style("font-size", "16px")
    .style("font-weight", "700")
    .style("color", "#1e293b")
    .html("📊 17个关键点的识别能力曲线");

  // 说明
  d3.select(container).append("div")
    .style("padding", "12px 0 0 0")
    .style("font-size", "12px")
    .style("color", "#64748b")
    .html(
      "💡 <strong>解读：</strong> " +
      "蓝色点 = 高准确度（>70%） | 橙色点 = 中等（60-70%） | 红色点 = 低准确度（<60%）。" +
      "曲线呈下降趋势，说明从头部到脚部识别难度逐步增加。" +
      "这反映了COCO数据集中下肢经常被遮挡或裁剪。"
    );
}

/**
 * 图表2: 遮挡率 vs 识别准确度关系（融合图表3）
 * 用XY坐标展示数据集特征与模型性能的关系
 */
export function renderBodyRegionComparison(container) {
  const regions = poseAnalysisData.chart_data.chart2.regions;
  const occlusionStats = occlusionStatsData.region_occlusion_stats;

  // 融合数据
  const scatterData = regions.map(region => {
    const occlusionRate = occlusionStats[region.name]?.mean || 0;
    return {
      name: region.name,
      occlusion: occlusionRate * 100, // 转换为百分比
      accuracy: region.mean * 100,
      color: BODY_REGIONS_COLOR[region.name]
    };
  });

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

  // X轴 - 遮挡率
  const xScale = d3.scaleLinear()
    .domain([0, 15])
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
    .text("数据集遮挡率 (%)");

  // Y轴 - 识别准确度
  const yScale = d3.scaleLinear()
    .domain([50, 90])
    .range([height, 0]);

  const yAxis = d3.axisLeft(yScale)
    .ticks(5)
    .tickFormat(d => d + "%");

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
    .text("模型识别准确度 (%)");

  // 参考区域背景
  svg.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height * 0.5)
    .attr("fill", "#dbeafe")
    .attr("opacity", 0.1);

  svg.append("text")
    .attr("x", width - 10)
    .attr("y", 15)
    .attr("text-anchor", "end")
    .style("font-size", "11px")
    .style("fill", "#0284c7")
    .style("opacity", 0.5)
    .text("高准确度区");

  // 网格线
  svg.append("g")
    .attr("class", "grid")
    .attr("opacity", 0.08)
    .call(d3.axisLeft(yScale)
      .tickSize(-width)
      .tickFormat("")
    );

  // y=x参考线（理想情况：遮挡率和准确度呈反比）
  // 计算参考线的两个端点
  const x1 = 0, y1 = 90;     // 遮挡0% -> 准确90%
  const x2 = 15, y2 = 75;    // 遮挡15% -> 准确75%（相同幅度的下降）
  
  svg.append("line")
    .attr("x1", xScale(x1))
    .attr("y1", yScale(y1))
    .attr("x2", xScale(x2))
    .attr("y2", yScale(y2))
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "6,4")
    .attr("opacity", 0.6);

  svg.append("text")
    .attr("x", xScale(7.5) + 8)
    .attr("y", yScale(82.5) - 8)
    .style("font-size", "11px")
    .style("fill", "#94a3b8")
    .style("opacity", 0.7)
    .text("理想趋势线（遮挡↑准确↓）");

  // 散点
  svg.selectAll(".scatter-dot")
    .data(scatterData)
    .enter()
    .append("circle")
    .attr("class", "scatter-dot")
    .attr("cx", d => xScale(d.occlusion))
    .attr("cy", d => yScale(d.accuracy))
    .attr("r", 10)
    .attr("fill", d => d.color)
    .attr("opacity", 0.85)
    .attr("stroke", "white")
    .attr("stroke-width", 2.5)
    .on("mouseover", function(event, d) {
      d3.select(this)
        .attr("r", 13)
        .attr("opacity", 1)
        .attr("stroke-width", 3);

      // 显示信息框
      svg.append("g")
        .attr("class", "tooltip-group")
        .append("rect")
        .attr("x", xScale(d.occlusion) + 12)
        .attr("y", yScale(d.accuracy) - 55)
        .attr("width", 160)
        .attr("height", 55)
        .attr("fill", "#1e293b")
        .attr("rx", 6)
        .attr("opacity", 0.95);

      svg.select(".tooltip-group")
        .append("text")
        .attr("x", xScale(d.occlusion) + 92)
        .attr("y", yScale(d.accuracy) - 32)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .style("font-weight", "700")
        .style("fill", "white")
        .text(d.name);

      svg.select(".tooltip-group")
        .append("text")
        .attr("x", xScale(d.occlusion) + 92)
        .attr("y", yScale(d.accuracy) - 15)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#cbd5e1")
        .text(`遮挡: ${d.occlusion.toFixed(1)}%`);

      svg.select(".tooltip-group")
        .append("text")
        .attr("x", xScale(d.occlusion) + 92)
        .attr("y", yScale(d.accuracy))
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#cbd5e1")
        .text(`准确: ${d.accuracy.toFixed(1)}%`);
    })
    .on("mouseout", function() {
      d3.select(this)
        .attr("r", 10)
        .attr("opacity", 0.85)
        .attr("stroke-width", 2.5);
      svg.selectAll(".tooltip-group").remove();
    });

  // 部位标签
  svg.selectAll(".region-label")
    .data(scatterData)
    .enter()
    .append("text")
    .attr("class", "region-label")
    .attr("x", d => xScale(d.occlusion) + 15)
    .attr("y", d => yScale(d.accuracy) - 15)
    .style("font-size", "13px")
    .style("font-weight", "700")
    .style("fill", "#1e293b")
    .text(d => d.name);

  // 标题
  d3.select(container).insert("div", ":first-child")
    .style("padding", "16px 0 12px 0")
    .style("font-size", "16px")
    .style("font-weight", "700")
    .style("color", "#1e293b")
    .html("🔗 COCO遮挡特征 ↔ 模型识别性能");

  // 说明
  d3.select(container).append("div")
    .style("padding", "12px 0 0 0")
    .style("font-size", "12px")
    .style("color", "#64748b")
    .html(
      "💡 <strong>解读：</strong> " +
      "X轴（遮挡率）越低，Y轴（识别准确度）越高。<br>" +
      "左上角区域（低遮挡+高准确度）代表模型学得很好的部位；" +
      "右下角代表学得困难的部位。" +
      "这说明<strong>数据集质量直接决定模型能力</strong>。"
    );
}

/**
 * 初始化所有可视化
 */
export function initPoseModelAnalysis(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`容器 #${containerId} 不存在`);
    return;
  }

  // 创建布局：大图表 + 一个关联图表
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr; gap: 32px;">
      <div id="chart1" style="
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      "></div>
      <div id="chart2" style="
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      "></div>
    </div>
  `;

  // 渲染图表
  renderKeypointAccuracyChart("#chart1");
  renderBodyRegionComparison("#chart2");

  console.log("✓ 姿态 + 模型分析可视化初始化完成");
}

export default {
  initPoseModelAnalysis,
  renderKeypointAccuracyChart,
  renderBodyRegionComparison
};
