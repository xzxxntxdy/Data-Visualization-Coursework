import * as d3 from "d3";
import blankDataBlack from "../data/blank_probs.json";
import blankDataWhite from "../data/blank_probs_white.json";
import networkImgUrl from "../network_img/resnet18.png";

// Configuration
const MARGIN = { top: 40, right: 30, bottom: 40, left: 30 };

// Keep one observer across refreshes (avoid leaks)
let biasResizeObserver = null;

function initBiasView() {
  const container = document.getElementById("bias-content");
  if (!container) return;

  // Ensure overlay SVG uses this container as absolute positioning context
  d3.select(container)
    .style("position", "relative")
    .style("overflow", "visible");

  // Cleanup previous observer + resize handler to avoid stacking
  if (biasResizeObserver) {
    biasResizeObserver.disconnect();
    biasResizeObserver = null;
  }
  d3.select(window).on("resize.bias-arrows", null);

  // Clear previous content
  d3.select(container).selectAll("*").remove();

  // Create main flex container
  const wrapper = d3
    .select(container)
    .append("div")
    .style("display", "flex")
    .style("width", "100%")
    .style("height", "100%")
    .style("align-items", "center")
    .style("justify-content", "space-between")
    .style("padding", "20px");

  // --- Column 1: Network Architecture ---
  const colNetwork = wrapper
    .append("div")
    .style("flex", "0 0 25%")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "center")
    .style("justify-content", "center");

  colNetwork
    .append("h3")
    .text("ResNet-18")
    .style("margin", "0 0 10px 0")
    .style("color", "var(--text-main)");

  colNetwork
    .append("img")
    .attr("src", networkImgUrl)
    .attr("alt", "Network Architecture")
    .style("max-width", "100%")
    .style("max-height", "60vh")
    .style("border-radius", "8px")
    .style("box-shadow", "0 4px 10px rgba(0,0,0,0.1)");

  // --- Column 2: Inputs (Black/White Squares) ---
  const colInput = wrapper
    .append("div")
    .style("flex", "0 0 15%")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "center")
    .style("justify-content", "space-around")
    .style("height", "60%"); // Spread them out vertically

  // Input Group 1: Black
  const inputGroupBlack = colInput
    .append("div")
    .attr("class", "input-node input-node-black")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "center")
    .style("position", "relative");

  inputGroupBlack
    .append("div")
    .attr("class", "input-square input-square-black")
    .style("width", "60px")
    .style("height", "60px")
    .style("background-color", "#000")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("box-shadow", "0 2px 5px rgba(0,0,0,0.2)");

  inputGroupBlack
    .append("span")
    .text("纯黑输入 (0.0)")
    .style("font-size", "12px")
    .style("margin-top", "8px")
    .style("color", "var(--text-muted)");

  // Input Group 2: White
  const inputGroupWhite = colInput
    .append("div")
    .attr("class", "input-node input-node-white")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "center")
    .style("position", "relative");

  inputGroupWhite
    .append("div")
    .attr("class", "input-square input-square-white")
    .style("width", "60px")
    .style("height", "60px")
    .style("background-color", "#fff")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("box-shadow", "0 2px 5px rgba(0,0,0,0.2)");

  inputGroupWhite
    .append("span")
    .text("纯白输入 (1.0)")
    .style("font-size", "12px")
    .style("margin-top", "8px")
    .style("color", "var(--text-muted)");

  // --- Column 3: Output Distributions ---
  const colOutput = wrapper
    .append("div")
    .style("flex", "0 0 50%")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("justify-content", "space-around")
    .style("height", "100%");

  // Helper to draw charts
  function drawChart(containerDiv, data, title) {
    const width = containerDiv.node().clientWidth || 400; // Fallback
    const height = 220;
    const margin = { top: 20, right: 40, bottom: 20, left: 100 };

    const svg = containerDiv
      .append("svg")
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const topData = data.slice(0, 5);

    const x = d3
      .scaleLinear()
      .domain([0, 1])
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleBand()
      .domain(topData.map((d) => d.name))
      .range([margin.top, height - margin.bottom])
      .padding(0.3);

    svg
      .selectAll("rect")
      .data(topData)
      .join("rect")
      .attr("x", x(0))
      .attr("y", (d) => y(d.name))
      .attr("width", (d) => x(d.score) - x(0))
      .attr("height", y.bandwidth())
      .attr("fill", "#6366f1")
      .attr("rx", 3);

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickSize(0))
      .call((g) => g.select(".domain").remove())
      .style("font-size", "12px");

    svg
      .selectAll(".label-val")
      .data(topData)
      .join("text")
      .attr("x", (d) => x(d.score) + 5)
      .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .text((d) => (d.score * 100).toFixed(1) + "%")
      .style("font-size", "11px")
      .style("fill", "var(--text-main)");

    containerDiv
      .append("div")
      .text(title)
      .style("text-align", "center")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("color", "var(--text-muted)");
  }

  // Output 1: Black
  const outDivBlack = colOutput
    .append("div")
    .attr("class", "output-panel output-panel-black")
    .style("height", "45%")
    .style("border", "1px solid var(--border-color)")
    .style("border-radius", "8px")
    .style("padding", "10px")
    .style("background", "var(--bg-panel)")
    .style("position", "relative");

  drawChart(outDivBlack, blankDataBlack, "Top-5 预测概率 (纯黑输入)");

  // Output 2: White
  const outDivWhite = colOutput
    .append("div")
    .attr("class", "output-panel output-panel-white")
    .style("height", "45%")
    .style("border", "1px solid var(--border-color)")
    .style("border-radius", "8px")
    .style("padding", "10px")
    .style("background", "var(--bg-panel)")
    .style("position", "relative");

  drawChart(outDivWhite, blankDataWhite, "Top-5 预测概率 (纯白输入)");

  // --- Arrows overlay (SVG) ---
  const overlaySvg = d3
    .select(container)
    .append("svg")
    .attr("class", "arrow-overlay")
    .style("position", "absolute")
    .style("top", 0)
    .style("left", 0)
    .style("width", "100%")
    .style("height", "100%")
    .style("pointer-events", "none")
    .style("z-index", 10);

  function updateArrows() {
    const containerRect = container.getBoundingClientRect();
    const W = containerRect.width;
    const H = containerRect.height;
    if (!W || !H) return;

    // CRITICAL: Make SVG internal coordinates match container pixels.
    overlaySvg.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);

    overlaySvg.selectAll("*").remove();

    const defs = overlaySvg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 8)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "#94a3b8");

    const netImg = colNetwork.select("img").node();
    const blkNode = inputGroupBlack.select(".input-square-black").node();
    const whtNode = inputGroupWhite.select(".input-square-white").node();
    const blkChart = outDivBlack.node();
    const whtChart = outDivWhite.node();

    if (!netImg || !blkNode || !whtNode || !blkChart || !whtChart) return;

    const getBox = (el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - containerRect.left,
        right: r.right - containerRect.left,
        top: r.top - containerRect.top,
        bottom: r.bottom - containerRect.top,
        cx: r.left + r.width / 2 - containerRect.left,
        cy: r.top + r.height / 2 - containerRect.top,
      };
    };

    const net = getBox(netImg);
    const blk = getBox(blkNode);
    const wht = getBox(whtNode);
    const chartBlk = getBox(blkChart);
    const chartWht = getBox(whtChart);

    const drawArrow = (start, end) => {
      const startX = start.right;
      const startY = start.cy;
      const endX = end.left - 6;
      const endY = end.cy;
      const midX = (startX + endX) / 2;

      overlaySvg
        .append("path")
        .attr("d", `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`)
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .attr("marker-end", "url(#arrowhead)");
    };

    // Network -> Inputs
    drawArrow(net, blk);
    drawArrow(net, wht);

    // Inputs -> Charts
    drawArrow(blk, chartBlk);
    drawArrow(wht, chartWht);
  }

  // Schedule update after layout settles (more reliable than setTimeout)
  const scheduleUpdate = () => {
    requestAnimationFrame(() => requestAnimationFrame(updateArrows));
  };

  // 1) initial
  scheduleUpdate();

  // 2) ensure image size is finalized
  const netImgEl = colNetwork.select("img").node();
  if (netImgEl) {
    if (typeof netImgEl.decode === "function") {
      netImgEl.decode().then(scheduleUpdate).catch(scheduleUpdate);
    } else {
      netImgEl.addEventListener("load", scheduleUpdate, { once: true });
    }
  }

  // 3) window resize (namespaced; won't stack on refresh)
  d3.select(window).on("resize.bias-arrows", scheduleUpdate);

  // 4) flex/layout changes
  biasResizeObserver = new ResizeObserver(scheduleUpdate);
  biasResizeObserver.observe(container);
}

// Export a refresh function
export function refreshBiasView() {
  initBiasView();
}

// Auto-init if DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBiasView);
} else {
  initBiasView();
}
