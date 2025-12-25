import * as d3 from "d3";
import blankDataBlack from "../data/blank_probs.json";
import blankDataWhite from "../data/blank_probs_white.json";
import networkImgUrl from "../network_img/resnet18.png";

// Configuration
const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };
// Modern UI Colors
const COLORS = {
  bg: "#f8fafc",
  cardBg: "#ffffff",
  textMain: "#1e293b",
  textMuted: "#64748b",
  border: "#e2e8f0",
  primary: "#6366f1", // Indigo
  danger: "#ef4444",  // Red for 'person'
  line: "#cbd5e1"
};

let biasResizeObserver = null;

function initBiasView() {
  const container = document.getElementById("bias-content");
  if (!container) return;

  // 1. Container Setup & Global Styles
  d3.select(container)
    .style("position", "relative")
    .style("overflow-y", "auto") // Allow scrolling if content is tall
    .style("overflow-x", "hidden")
    .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
    .style("background-color", COLORS.bg)
    .style("color", COLORS.textMain);

  // Cleanup
  if (biasResizeObserver) {
    biasResizeObserver.disconnect();
    biasResizeObserver = null;
  }
  d3.select(window).on("resize.bias-arrows", null);
  d3.select(container).selectAll("*").remove();

  // =================================================================
  // A. Header Section: Experiment Context
  // =================================================================
  const header = d3.select(container).append("div")
    .style("padding", "24px 32px")
    .style("border-bottom", `1px solid ${COLORS.border}`)
    .style("background", COLORS.cardBg);

  header.append("h2")
    .text("实验：神经网络的“固有偏见”可视化")
    .style("margin", "0 0 8px 0")
    .style("font-size", "20px")
    .style("font-weight", "700");

  header.append("p")
    .html(`
      <strong>核心问题：</strong> 当我们给一个在 COCO 数据集上训练好的 ResNet 模型输入<span style="color:${COLORS.textMuted}">完全没有语义信息的图像（纯黑/纯白）</span>时，它会输出均匀的概率分布吗？
      <br>
      <strong>预期：</strong> 应该是随机猜测或均匀分布。
      <strong>实际结果：</strong> 模型表现出了强烈的类别偏好。
    `)
    .style("margin", "0")
    .style("font-size", "14px")
    .style("line-height", "1.6")
    .style("color", COLORS.textMuted);

  // =================================================================
  // B. Main Visualization Section (Flex Row)
  // =================================================================
  const vizContainer = d3.select(container).append("div")
    .style("position", "relative")
    .style("padding", "40px 20px")
    .style("display", "flex")
    .style("justify-content", "center")
    .style("gap", "40px") // Space between columns
    .style("min-height", "500px");

  // --- Column 1: Inputs ---
  const colInput = vizContainer.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "60px") // Vertical gap between black and white inputs
    .style("justify-content", "center")
    .style("z-index", 2);

  const createInputCard = (parent, type, label) => {
    const card = parent.append("div")
      .attr("class", `input-card-${type}`)
      .style("background", COLORS.cardBg)
      .style("padding", "16px")
      .style("border-radius", "12px")
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)")
      .style("border", `1px solid ${COLORS.border}`)
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("align-items", "center")
      .style("width", "120px");

    card.append("div")
      .attr("class", `input-square-${type}`)
      .style("width", "60px")
      .style("height", "60px")
      .style("background-color", type === "black" ? "#000" : "#fff")
      .style("border", "1px solid #e2e8f0")
      .style("border-radius", "6px")
      .style("box-shadow", "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)");

    card.append("div")
      .text(label)
      .style("margin-top", "12px")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("color", COLORS.textMuted);

    return card;
  };

  createInputCard(colInput, "black", "纯黑 Tensor (0)");
  createInputCard(colInput, "white", "纯白 Tensor (1)");

  // --- Column 2: The Model ---
  const colNetwork = vizContainer.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("justify-content", "center")
    .style("align-items", "center")
    .style("z-index", 2);

  const netCard = colNetwork.append("div")
    .style("background", COLORS.cardBg)
    .style("padding", "20px")
    .style("border-radius", "16px")
    .style("border", `1px solid ${COLORS.border}`)
    .style("box-shadow", "0 10px 15px -3px rgba(0, 0, 0, 0.1)")
    .style("text-align", "center");

  netCard.append("div")
    .text("ResNet-18")
    .style("font-size", "14px")
    .style("font-weight", "700")
    .style("color", COLORS.primary)
    .style("margin-bottom", "12px")
    .style("text-transform", "uppercase")
    .style("letter-spacing", "0.05em");

  netCard.append("img")
    .attr("src", networkImgUrl)
    .attr("alt", "Neural Network")
    .style("width", "180px")
    .style("height", "auto")
    .style("display", "block")
    .style("opacity", "0.9");

  // --- Column 3: Outputs ---
  const colOutput = vizContainer.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "20px") // Matches input spacing logic roughly
    .style("justify-content", "center")
    .style("flex", "1") // Allow charts to take remaining space
    .style("max-width", "500px")
    .style("z-index", 2);

  // Chart Rendering Function
  const drawProbChart = (data, title) => {
    const card = colOutput.append("div")
      .attr("class", "chart-card")
      .style("background", COLORS.cardBg)
      .style("padding", "20px")
      .style("border-radius", "12px")
      .style("border", `1px solid ${COLORS.border}`)
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)");

    card.append("h4")
      .text(title)
      .style("margin", "0 0 15px 0")
      .style("font-size", "13px")
      .style("color", COLORS.textMuted)
      .style("font-weight", "600")
      .style("border-bottom", `1px solid ${COLORS.border}`)
      .style("padding-bottom", "8px");

    const containerDiv = card.append("div").style("width", "100%");
    const width = containerDiv.node().clientWidth || 400;
    const height = 180;
    const margin = { left: 90, top: 10, right: 50, bottom: 10 };

    const svg = containerDiv.append("svg")
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("overflow", "visible");

    const top5 = data.slice(0, 5);
    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(top5.map(d => d.name)).range([margin.top, height - margin.bottom]).padding(0.3);

    // Grid lines (vertical)
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(-height + margin.top + margin.bottom).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#f1f5f9"));

    // Bars
    svg.selectAll("rect")
      .data(top5)
      .join("rect")
      .attr("x", x(0))
      .attr("y", d => y(d.name))
      .attr("width", d => x(d.score) - x(0))
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", d => d.name === "person" ? COLORS.danger : COLORS.primary)
      .attr("opacity", d => d.name === "person" ? 1 : 0.6);

    // Y Axis Text
    svg.selectAll(".y-label")
      .data(top5)
      .join("text")
      .attr("x", margin.left - 10)
      .attr("y", d => y(d.name) + y.bandwidth() / 2)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .text(d => d.name)
      .style("font-size", "12px")
      .style("fill", d => d.name === "person" ? COLORS.textMain : COLORS.textMuted)
      .style("font-weight", d => d.name === "person" ? "700" : "400");

    // Value Labels
    svg.selectAll(".val-label")
      .data(top5)
      .join("text")
      .attr("x", d => x(d.score) + 6)
      .attr("y", d => y(d.name) + y.bandwidth() / 2)
      .attr("dy", "0.32em")
      .text(d => (d.score * 100).toFixed(1) + "%")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("fill", d => d.name === "person" ? COLORS.danger : COLORS.textMuted);

    return card;
  };

  const chartBlack = drawProbChart(blankDataBlack, "纯黑输入预测 Top-5");
  const chartWhite = drawProbChart(blankDataWhite, "纯白输入预测 Top-5");

  // =================================================================
  // C. Footer: Insight/Analysis
  // =================================================================
  const footer = d3.select(container).append("div")
    .style("margin", "0 20px 40px 20px")
    .style("padding", "20px")
    .style("background", "#fff1f2") // Light red/pink bg
    .style("border", `1px solid #fecdd3`)
    .style("border-radius", "8px")
    .style("color", "#881337");

  footer.append("div")
    .html(`
      <strong>🔍 结论分析 (Key Insight):</strong> 
      注意看 <span style="color:${COLORS.danger}; font-weight:bold;">Person</span> 类别。
      即使图像中没有任何信息，网络依然给出极高的置信度（纯黑 54%，纯白 80%）。
      <br><br>
      这直观地展示了<strong>数据集的数据分布偏差</strong>：因为 COCO 数据集中包含"人"的图片数量极多，网络学到了"如果不知道是什么，猜是人准没错"的先验概率。
    `)
    .style("font-size", "13px")
    .style("line-height", "1.5");

  // =================================================================
  // C2. 相关实验链接
  // =================================================================
  const relatedSection = d3.select(container).append("div")
    .style("margin", "0 20px 20px 20px")
    .style("padding", "16px 20px")
    .style("background", "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)")
    .style("border", "1px solid #c7d2fe")
    .style("border-radius", "8px")
    .style("display", "flex")
    .style("align-items", "center")
    .style("justify-content", "space-between");

  relatedSection.append("div")
    .html(`
      <strong>🔗 相关实验：</strong> 
      除了类别先验，模型还学习了<span style="color:#6366f1; font-weight:600;">空间位置先验</span>——
      即每个类别在图像中最可能出现的区域。
    `)
    .style("font-size", "13px")
    .style("color", "#3730a3");

  const linkBtn = relatedSection.append("button")
    .text("查看空间先验实验 →")
    .style("padding", "8px 16px")
    .style("background", "#6366f1")
    .style("color", "white")
    .style("border", "none")
    .style("border-radius", "6px")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .style("cursor", "pointer")
    .style("transition", "all 0.2s ease")
    .on("mouseenter", function() {
      d3.select(this).style("background", "#4f46e5").style("transform", "translateY(-1px)");
    })
    .on("mouseleave", function() {
      d3.select(this).style("background", "#6366f1").style("transform", "translateY(0)");
    })
    .on("click", function() {
      window.dispatchEvent(new CustomEvent("switch-view", { detail: "spatial-prior-view" }));
    });

  // =================================================================
  // D. Arrows (SVG Overlay)
  // =================================================================
  const overlaySvg = d3.select(container).append("svg")
    .attr("class", "arrow-overlay")
    .style("position", "absolute")
    .style("top", 0)
    .style("left", 0)
    .style("width", "100%")
    .style("height", "100%")
    .style("pointer-events", "none")
    .style("z-index", 1);

  // Define Arrowhead
  const defs = overlaySvg.append("defs");
  defs.append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 8)
    .attr("refY", 5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", COLORS.line);

  function updateArrows() {
    // We need coordinates relative to the 'container'
    // But 'container' might have scroll, so we use offset positions roughly
    // Or simpler: get bounding rects and subtract container rect
    const cRect = container.getBoundingClientRect();
    
    // Update SVG size to match scrollable area height
    const scrollHeight = container.scrollHeight;
    const clientWidth = container.clientWidth;
    overlaySvg.attr("width", clientWidth).attr("height", scrollHeight);
    overlaySvg.selectAll("path").remove();

    const getRelPos = (selection, side) => {
      const el = selection.node();
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      // Relative to container top/left
      const x = side === 'left' ? r.left : side === 'right' ? r.right : (r.left + r.width/2);
      // Correction for container scroll
      const containerScrollTop = container.scrollTop;
      const y = r.top - cRect.top + r.height / 2 + containerScrollTop; 
      
      // Fix: r.top is viewport relative. cRect.top is viewport relative.
      // The diff is correct, but we must add scrollTop if SVG is absolutely positioned in a scrollable div.
      // However, here SVG is absolute top:0. Let's assume standard positioning.
      
      return { 
        x: x - cRect.left, 
        y: r.top - cRect.top + r.height/2 // Simple view-relative calculation
      };
    };

    // Nodes
    const blackCard = d3.select(".input-card-black");
    const whiteCard = d3.select(".input-card-white");
    const netImg = d3.select(netCard.node()); // Use the card wrapper
    const blackChart = d3.select(chartBlack.node());
    const whiteChart = d3.select(chartWhite.node());

    if(blackCard.empty() || netImg.empty()) return;

    const pBlackIn = getRelPos(blackCard, 'right');
    const pWhiteIn = getRelPos(whiteCard, 'right');
    const pNetLeft = getRelPos(netImg, 'left');
    const pNetRight = getRelPos(netImg, 'right');
    const pChartB = getRelPos(blackChart, 'left');
    const pChartW = getRelPos(whiteChart, 'left');

    const drawBez = (p1, p2) => {
      const mx = (p1.x + p2.x) / 2;
      const d = `M ${p1.x} ${p1.y} C ${mx} ${p1.y}, ${mx} ${p2.y}, ${p2.x - 5} ${p2.y}`;
      overlaySvg.append("path")
        .attr("d", d)
        .attr("stroke", COLORS.line)
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .attr("marker-end", "url(#arrowhead)");
    };

    drawBez(pBlackIn, pNetLeft);
    drawBez(pWhiteIn, pNetLeft);
    drawBez(pNetRight, pChartB);
    drawBez(pNetRight, pChartW);
  }

  // Scheduling
  const scheduleUpdate = () => requestAnimationFrame(updateArrows);
  
  // Image load check
  const imgNode = netCard.select("img").node();
  if (imgNode) {
    if (imgNode.complete) scheduleUpdate();
    else imgNode.onload = scheduleUpdate;
  }
  
  // Observers
  biasResizeObserver = new ResizeObserver(scheduleUpdate);
  biasResizeObserver.observe(vizContainer.node());
  biasResizeObserver.observe(container); // Watch container too
  d3.select(window).on("resize.bias-arrows", scheduleUpdate);

  // Initial call
  setTimeout(scheduleUpdate, 100);
}

export function refreshBiasView() {
  initBiasView();
}

// Auto-init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBiasView);
} else {
  initBiasView();
}