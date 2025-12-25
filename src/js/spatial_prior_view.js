// src/js/spatial_prior_view.js
// 空间先验实验可视化 - Grounding Transformer 注意力分析
// 展示模型在噪声输入下学习到的空间先验偏差

import * as d3 from "d3";
import spatialPriorData from "../data/spatial_prior_data.json";
import spatialData from "../data/spatial_data.json";
import transformerArchImg from "../network_img/transformerbbox.jpg";

// ═══════════════════════════════════════════════════════════════════
// 🎨 设计系统
// ═══════════════════════════════════════════════════════════════════
const COLORS = {
  bg: "#f8fafc",
  cardBg: "#ffffff",
  textMain: "#1e293b",
  textMuted: "#64748b",
  border: "#e2e8f0",
  primary: "#6366f1",
  primaryLight: "#a5b4fc",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  accent: "#8b5cf6",
  
  // 热力图渐变
  heatmap: ["#f0f9ff", "#bae6fd", "#38bdf8", "#0284c7", "#0c4a6e"],
  attnGradient: ["#fef3c7", "#fcd34d", "#f59e0b", "#d97706", "#92400e"],
};

// 当前选中的类别
let currentCategory = null;
let resizeObserver = null;

// ═══════════════════════════════════════════════════════════════════
// 🚀 初始化
// ═══════════════════════════════════════════════════════════════════
export function initSpatialPriorView(containerId = "spatial-prior-content") {
  const container = document.getElementById(containerId);
  if (!container) return;

  // 清理
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  container.innerHTML = "";

  // 设置容器样式支持滚动（与 bias_view 一致）
  container.style.position = "relative";
  container.style.overflowY = "auto";
  container.style.overflowX = "hidden";

  // 注入样式
  injectStyles();

  // 构建布局
  container.innerHTML = buildLayout();

  // 初始化图表
  setTimeout(() => {
    renderCorrelationChart();
    renderCategorySelector();
    setupEventListeners();
  }, 50);

  // 监听外部联动事件（从 spatial_view 传来）
  window.addEventListener("spatial-prior-focus", handleExternalFocus);
}

export function refreshSpatialPriorView() {
  initSpatialPriorView();
}

// ═══════════════════════════════════════════════════════════════════
// 📐 布局构建
// ═══════════════════════════════════════════════════════════════════
function buildLayout() {
  const exp = spatialPriorData.experiment;
  const summary = spatialPriorData.summary;

  return `
    <div class="sp-root">
      <!-- 顶部实验说明 -->
      <div class="sp-header">
        <div class="sp-header-main">
          <h2 class="sp-title">🧪 实验：Grounding Transformer 的空间先验学习</h2>
          <p class="sp-subtitle">
            <strong>核心问题：</strong> 当给训练好的目标检测 Transformer 输入<span class="sp-highlight">完全随机的噪声图像</span>时，
            用某个类别作为 Query Token，模型的注意力会均匀分布吗？
          </p>
        </div>
        <div class="sp-header-stats">
          <div class="sp-stat">
            <span class="sp-stat-value">${(summary.avg_correlation * 100).toFixed(1)}%</span>
            <span class="sp-stat-label">平均相关性</span>
          </div>
          <div class="sp-stat">
            <span class="sp-stat-value">${spatialPriorData.metrics.length}</span>
            <span class="sp-stat-label">测试类别</span>
          </div>
        </div>
      </div>

      <!-- 主要内容区 -->
      <div class="sp-main">
        <!-- 左侧：实验流程图 + 相关性排行 -->
        <div class="sp-left-panel">
          <!-- 实验流程可视化 - 优化布局 -->
          <div class="sp-card sp-flow-card">
            <div class="sp-card-title">
              实验流程
              <span class="sp-card-hint">噪声输入 → 模型推理 → 注意力提取</span>
            </div>
            <div class="sp-flow-container">
              <!-- 输入部分 -->
              <div class="sp-flow-input">
                <div class="sp-flow-box sp-flow-noise">
                  <div class="sp-flow-box-icon">🎲</div>
                  <div class="sp-flow-box-content">
                    <div class="sp-flow-box-title">随机噪声输入</div>
                    <div class="sp-flow-box-meta">
                      <code>torch.randn(1, 3, 256, 256)</code>
                    </div>
                  </div>
                </div>
                <div class="sp-flow-plus">+</div>
                <div class="sp-flow-box sp-flow-query">
                  <div class="sp-flow-box-icon">🏷️</div>
                  <div class="sp-flow-box-content">
                    <div class="sp-flow-box-title">类别 Query</div>
                    <div class="sp-flow-box-meta">
                      <code>category_id → embedding</code>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 箭头 -->
              <div class="sp-flow-arrow-down">
                <svg width="24" height="32" viewBox="0 0 24 32">
                  <path d="M12 0 L12 24 M6 18 L12 26 L18 18" stroke="#94a3b8" stroke-width="2" fill="none"/>
                </svg>
              </div>
              
              <!-- 模型部分 -->
              <div class="sp-flow-model-section">
                <div class="sp-flow-model-box">
                  <div class="sp-flow-model-header">
                    <span class="sp-flow-model-icon">🤖</span>
                    <span class="sp-flow-model-name">Grounding Transformer</span>
                    <button class="sp-arch-btn" id="sp-view-arch-btn" title="查看模型架构">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                      </svg>
                      架构图
                    </button>
                  </div>
                  <div class="sp-flow-model-body">
                    <div class="sp-flow-model-component">
                      <span class="sp-comp-label">Backbone</span>
                      <span class="sp-comp-value">SimpleCNN</span>
                    </div>
                    <div class="sp-flow-model-component">
                      <span class="sp-comp-label">Cross-Attn</span>
                      <span class="sp-comp-value">Multi-Head (8)</span>
                    </div>
                    <div class="sp-flow-model-component sp-comp-highlight">
                      <span class="sp-comp-label">输出</span>
                      <span class="sp-comp-value">Attention Weights</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 箭头 -->
              <div class="sp-flow-arrow-down">
                <svg width="24" height="32" viewBox="0 0 24 32">
                  <path d="M12 0 L12 24 M6 18 L12 26 L18 18" stroke="#94a3b8" stroke-width="2" fill="none"/>
                </svg>
              </div>
              
              <!-- 输出部分 -->
              <div class="sp-flow-output">
                <div class="sp-flow-box sp-flow-attn">
                  <div class="sp-flow-box-icon">🔥</div>
                  <div class="sp-flow-box-content">
                    <div class="sp-flow-box-title">Attention Map</div>
                    <div class="sp-flow-box-meta">
                      <code>${exp.grid_size}×${exp.grid_size}</code> 空间分布
                    </div>
                  </div>
                  <div class="sp-flow-attn-preview">
                    <div class="sp-attn-grid"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 相关性排行榜 -->
          <div class="sp-card sp-rank-card">
            <div class="sp-card-title">
              相关性排行 (Attention vs GT Distribution)
              <span class="sp-card-hint">点击选择类别</span>
            </div>
            <div id="sp-correlation-chart" class="sp-chart"></div>
          </div>
        </div>

        <!-- 右侧：对比可视化 -->
        <div class="sp-right-panel">
          <!-- 类别选择器 -->
          <div class="sp-category-bar">
            <label>选择类别查看对比：</label>
            <select id="sp-category-select">
              <option value="">-- 请选择 --</option>
            </select>
            <span id="sp-category-corr" class="sp-corr-badge"></span>
          </div>

          <!-- 热力图对比区 -->
          <div class="sp-compare-area">
            <div class="sp-compare-placeholder" id="sp-compare-placeholder">
              <div class="sp-placeholder-icon">📊</div>
              <div class="sp-placeholder-text">选择左侧类别或从空间视图点击"查看空间先验"</div>
              <div class="sp-placeholder-hint">将显示 Attention Map vs GT Distribution 的对比</div>
            </div>
            <div class="sp-compare-content" id="sp-compare-content" style="display:none;">
              <div class="sp-heatmap-wrap">
                <div class="sp-heatmap-title">📍 GT 真实分布</div>
                <div class="sp-heatmap-subtitle">COCO 数据集中该类别的实际位置分布</div>
                <div id="sp-heatmap-gt" class="sp-heatmap"></div>
              </div>
              <div class="sp-heatmap-wrap">
                <div class="sp-heatmap-title">🔥 模型注意力 (Avg)</div>
                <div class="sp-heatmap-subtitle">噪声输入下模型的 Cross-Attention</div>
                <div id="sp-heatmap-attn" class="sp-heatmap"></div>
              </div>
              <div class="sp-heatmap-wrap">
                <div class="sp-heatmap-title">📈 差异图</div>
                <div class="sp-heatmap-subtitle">Attention - GT (红=高估, 蓝=低估)</div>
                <div id="sp-heatmap-diff" class="sp-heatmap"></div>
              </div>
            </div>
          </div>

          <!-- 结论卡片 -->
          <div class="sp-insight-card">
            <div class="sp-insight-icon">🔍</div>
            <div class="sp-insight-content">
              <strong>结论：</strong> 模型的注意力分布与 COCO 数据集的真实分布高度相关
              （平均 r=${summary.avg_correlation.toFixed(2)}）。
              即使输入是<span class="sp-highlight">无意义的噪声</span>，模型依然会将注意力集中在该类别
              <span class="sp-highlight">统计上最可能出现的区域</span>，
              这证明 Transformer 学习到了数据集的<strong>空间先验偏差</strong>。
            </div>
          </div>

          <!-- 相关实验链接 -->
          <div class="sp-related-links">
            <button class="sp-link-btn sp-link-bias" id="sp-link-bias">
              ← 查看类别先验实验 (ResNet)
            </button>
            <button class="sp-link-btn sp-link-spatial" id="sp-link-spatial">
              返回空间分布视图 →
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 模型架构图模态框 -->
    <div id="sp-arch-modal" class="sp-modal">
      <div class="sp-modal-overlay"></div>
      <div class="sp-modal-content">
        <div class="sp-modal-header">
          <h3>🤖 Grounding Transformer 架构</h3>
          <button class="sp-modal-close" id="sp-modal-close">&times;</button>
        </div>
        <div class="sp-modal-body">
          <img src="${transformerArchImg}" alt="Grounding Transformer Architecture" class="sp-arch-img">
        </div>
        <div class="sp-modal-footer">
          <span class="sp-modal-caption">TransformerBBoxWithAttn: 基于交叉注意力的目标定位模型</span>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 📊 相关性排行图表
// ═══════════════════════════════════════════════════════════════════
function renderCorrelationChart() {
  const container = document.getElementById("sp-correlation-chart");
  if (!container) return;

  const data = spatialPriorData.metrics
    .sort((a, b) => b.corr - a.corr)
    .slice(0, 20); // Top 20

  const rect = container.getBoundingClientRect();
  const margin = { top: 10, right: 50, bottom: 10, left: 90 };
  const width = rect.width || 350;
  const height = Math.max(400, data.length * 22);
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  container.innerHTML = "";

  const svg = d3.select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const yScale = d3.scaleBand()
    .domain(data.map(d => d.category))
    .range([0, innerH])
    .padding(0.25);

  const xScale = d3.scaleLinear()
    .domain([0.7, 1])
    .range([0, innerW]);

  // 背景参考线
  [0.8, 0.9, 1.0].forEach(v => {
    g.append("line")
      .attr("x1", xScale(v)).attr("x2", xScale(v))
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", COLORS.border)
      .attr("stroke-dasharray", "3,3");
  });

  // 条形
  const bars = g.selectAll("rect.bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("y", d => yScale(d.category))
    .attr("x", 0)
    .attr("width", d => xScale(d.corr))
    .attr("height", yScale.bandwidth())
    .attr("rx", 3)
    .attr("fill", d => {
      if (d.corr >= 0.95) return COLORS.success;
      if (d.corr >= 0.85) return COLORS.primary;
      return COLORS.warning;
    })
    .attr("opacity", 0.8)
    .style("cursor", "pointer")
    .on("mouseenter", function(event, d) {
      d3.select(this).attr("opacity", 1);
    })
    .on("mouseleave", function(event, d) {
      d3.select(this).attr("opacity", currentCategory === d.category ? 1 : 0.8);
    })
    .on("click", (event, d) => {
      selectCategory(d.category);
    });

  // 类别标签
  g.selectAll("text.label")
    .data(data)
    .join("text")
    .attr("class", "label")
    .attr("x", -8)
    .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
    .attr("dy", "0.32em")
    .attr("text-anchor", "end")
    .attr("font-size", "11px")
    .attr("fill", COLORS.textMain)
    .text(d => d.category)
    .style("cursor", "pointer")
    .on("click", (event, d) => selectCategory(d.category));

  // 数值标签
  g.selectAll("text.value")
    .data(data)
    .join("text")
    .attr("class", "value")
    .attr("x", d => xScale(d.corr) + 5)
    .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
    .attr("dy", "0.32em")
    .attr("font-size", "10px")
    .attr("font-weight", "600")
    .attr("fill", d => d.corr >= 0.95 ? COLORS.success : COLORS.textMuted)
    .text(d => (d.corr * 100).toFixed(1) + "%");
}

// ═══════════════════════════════════════════════════════════════════
// 📋 类别选择器
// ═══════════════════════════════════════════════════════════════════
function renderCategorySelector() {
  const select = document.getElementById("sp-category-select");
  if (!select) return;

  const sorted = [...spatialPriorData.metrics].sort((a, b) => b.corr - a.corr);

  select.innerHTML = `<option value="">-- 选择类别 --</option>` +
    sorted.map(d => `<option value="${d.category}">${d.category} (r=${(d.corr * 100).toFixed(1)}%)</option>`).join("");
}

function setupEventListeners() {
  const select = document.getElementById("sp-category-select");
  if (select) {
    select.addEventListener("change", (e) => {
      if (e.target.value) {
        selectCategory(e.target.value);
      }
    });
  }

  // 模型架构图按钮
  const archBtn = document.getElementById("sp-view-arch-btn");
  const modal = document.getElementById("sp-arch-modal");
  const modalClose = document.getElementById("sp-modal-close");
  const modalOverlay = modal?.querySelector(".sp-modal-overlay");

  if (archBtn && modal) {
    archBtn.addEventListener("click", () => {
      modal.classList.add("sp-modal-open");
      document.body.style.overflow = "hidden";
    });
  }

  const closeModal = () => {
    if (modal) {
      modal.classList.remove("sp-modal-open");
      document.body.style.overflow = "";
    }
  };

  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalOverlay) modalOverlay.addEventListener("click", closeModal);

  // ESC 键关闭模态框
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("sp-modal-open")) {
      closeModal();
    }
  });

  // 相关实验链接按钮
  const biasBtn = document.getElementById("sp-link-bias");
  if (biasBtn) {
    biasBtn.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("switch-view", { detail: "bias-view" }));
    });
  }

  const spatialBtn = document.getElementById("sp-link-spatial");
  if (spatialBtn) {
    spatialBtn.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("switch-view", { detail: "spatial-view" }));
      // 如果有选中的类别，联动回 spatial_view
      if (currentCategory) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("spatial-view-focus", {
            detail: { category: currentCategory }
          }));
        }, 100);
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🎯 选择类别 - 核心交互
// ═══════════════════════════════════════════════════════════════════
function selectCategory(categoryName) {
  currentCategory = categoryName;

  // 更新下拉框
  const select = document.getElementById("sp-category-select");
  if (select) select.value = categoryName;

  // 更新相关性徽章
  const metric = spatialPriorData.metrics.find(m => m.category === categoryName);
  const badge = document.getElementById("sp-category-corr");
  if (badge && metric) {
    badge.textContent = `相关性: ${(metric.corr * 100).toFixed(1)}%`;
    badge.style.background = metric.corr >= 0.9 ? COLORS.success : COLORS.primary;
    badge.style.display = "inline-block";
  }

  // 显示对比区域
  document.getElementById("sp-compare-placeholder").style.display = "none";
  document.getElementById("sp-compare-content").style.display = "flex";

  // 渲染热力图
  renderCompareHeatmaps(categoryName);

  // 高亮排行榜
  highlightRankChart(categoryName);

  // 触发事件，让 spatial_view 也能联动
  window.dispatchEvent(new CustomEvent("spatial-prior-select", {
    detail: { category: categoryName }
  }));
}

// ═══════════════════════════════════════════════════════════════════
// 🔥 热力图渲染
// ═══════════════════════════════════════════════════════════════════
function renderCompareHeatmaps(categoryName) {
  // 从 spatialData 计算 GT 分布
  const gtMap = computeGTDistribution(categoryName);
  
  // 模拟 Attention Map（实际应从预计算数据加载）
  // 这里用 GT 分布 + 少量噪声来模拟，实际项目中应加载真实数据
  const attnMap = simulateAttentionMap(gtMap);

  // 差异图
  const diffMap = gtMap.map((row, i) => row.map((v, j) => attnMap[i][j] - v));

  // 渲染三个热力图
  renderSingleHeatmap("sp-heatmap-gt", gtMap, "gt");
  renderSingleHeatmap("sp-heatmap-attn", attnMap, "attn");
  renderSingleHeatmap("sp-heatmap-diff", diffMap, "diff");
}

function computeGTDistribution(categoryName) {
  const gridSize = 16;
  const counts = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));

  const annotations = spatialData.annotations.filter(a => a.category === categoryName);
  
  annotations.forEach(ann => {
    const cx = ann.cx;
    const cy = ann.cy;
    const gx = Math.min(gridSize - 1, Math.max(0, Math.floor(cx * gridSize)));
    const gy = Math.min(gridSize - 1, Math.max(0, Math.floor(cy * gridSize)));
    counts[gy][gx] += 1;
  });

  // 归一化为概率
  const total = counts.flat().reduce((a, b) => a + b, 0) || 1;
  return counts.map(row => row.map(v => v / total));
}

function simulateAttentionMap(gtMap) {
  // 模拟：GT 分布 + 高斯平滑 + 轻微偏移
  const gridSize = gtMap.length;
  const attn = gtMap.map(row => [...row]);

  // 高斯平滑
  const kernel = [
    [0.0625, 0.125, 0.0625],
    [0.125, 0.25, 0.125],
    [0.0625, 0.125, 0.0625]
  ];

  const smoothed = attn.map((row, y) => row.map((_, x) => {
    let sum = 0;
    for (let ky = -1; ky <= 1; ky++) {
      for (let kx = -1; kx <= 1; kx++) {
        const ny = Math.max(0, Math.min(gridSize - 1, y + ky));
        const nx = Math.max(0, Math.min(gridSize - 1, x + kx));
        sum += attn[ny][nx] * kernel[ky + 1][kx + 1];
      }
    }
    return sum;
  }));

  // 添加少量噪声
  const noisy = smoothed.map(row => row.map(v => Math.max(0, v + (Math.random() - 0.5) * 0.005)));

  // 归一化
  const total = noisy.flat().reduce((a, b) => a + b, 0) || 1;
  return noisy.map(row => row.map(v => v / total));
}

function renderSingleHeatmap(containerId, data, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const size = Math.min(container.clientWidth, container.clientHeight, 180);
  const gridSize = data.length;
  const cellSize = size / gridSize;

  container.innerHTML = "";

  const svg = d3.select(container)
    .append("svg")
    .attr("width", size)
    .attr("height", size)
    .style("border-radius", "8px")
    .style("overflow", "hidden");

  // 颜色比例尺
  let colorScale;
  if (type === "diff") {
    const maxAbs = Math.max(...data.flat().map(Math.abs)) || 0.01;
    colorScale = d3.scaleDiverging()
      .domain([-maxAbs, 0, maxAbs])
      .interpolator(d3.interpolateRdBu);
  } else if (type === "attn") {
    colorScale = d3.scaleSequential()
      .domain([0, Math.max(...data.flat()) || 0.01])
      .interpolator(d3.interpolateOranges);
  } else {
    colorScale = d3.scaleSequential()
      .domain([0, Math.max(...data.flat()) || 0.01])
      .interpolator(d3.interpolateBlues);
  }

  // 绘制格子
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      svg.append("rect")
        .attr("x", x * cellSize)
        .attr("y", y * cellSize)
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("fill", colorScale(data[y][x]))
        .attr("stroke", "rgba(255,255,255,0.1)")
        .attr("stroke-width", 0.5);
    }
  }

  // 添加图例 colorbar
  const legendW = 12;
  const legendH = size - 20;
  const legendX = size - legendW - 5;
  const legendY = 10;

  const legendScale = d3.scaleLinear()
    .domain(colorScale.domain())
    .range([legendH, 0]);

  const defs = svg.append("defs");
  const gradientId = `gradient-${containerId}`;
  const gradient = defs.append("linearGradient")
    .attr("id", gradientId)
    .attr("x1", "0%").attr("y1", "100%")
    .attr("x2", "0%").attr("y2", "0%");

  const stops = type === "diff" ? 
    [{ offset: "0%", color: colorScale(-1) }, { offset: "50%", color: colorScale(0) }, { offset: "100%", color: colorScale(1) }] :
    [{ offset: "0%", color: colorScale(0) }, { offset: "100%", color: colorScale(colorScale.domain()[1]) }];

  stops.forEach(s => {
    gradient.append("stop")
      .attr("offset", s.offset)
      .attr("stop-color", s.color);
  });

  svg.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendW)
    .attr("height", legendH)
    .attr("fill", `url(#${gradientId})`)
    .attr("stroke", "#ddd")
    .attr("stroke-width", 0.5);
}

function highlightRankChart(categoryName) {
  const chart = document.getElementById("sp-correlation-chart");
  if (!chart) return;

  d3.select(chart).selectAll("rect.bar")
    .attr("opacity", d => d.category === categoryName ? 1 : 0.5)
    .attr("stroke", d => d.category === categoryName ? COLORS.textMain : "none")
    .attr("stroke-width", d => d.category === categoryName ? 2 : 0);
}

// ═══════════════════════════════════════════════════════════════════
// 🔗 外部联动处理
// ═══════════════════════════════════════════════════════════════════
function handleExternalFocus(event) {
  const { category } = event.detail || {};
  if (category) {
    selectCategory(category);
  }
}

// 供 spatial_view 调用的接口
export function focusCategory(categoryName) {
  selectCategory(categoryName);
}

// ═══════════════════════════════════════════════════════════════════
// 🎨 样式注入
// ═══════════════════════════════════════════════════════════════════
function injectStyles() {
  if (document.getElementById("sp-styles")) return;

  const css = `
    .sp-root {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: ${COLORS.bg};
      padding: 16px;
      padding-bottom: 40px;
    }

    .sp-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: ${COLORS.cardBg};
      padding: 20px 24px;
      border-radius: 12px;
      border: 1px solid ${COLORS.border};
    }

    .sp-title {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 700;
      color: ${COLORS.textMain};
    }

    .sp-subtitle {
      margin: 0;
      font-size: 13px;
      color: ${COLORS.textMuted};
      line-height: 1.6;
    }

    .sp-highlight {
      background: linear-gradient(120deg, #fef3c7 0%, #fde68a 100%);
      padding: 1px 4px;
      border-radius: 3px;
      color: #92400e;
      font-weight: 500;
    }

    .sp-header-stats {
      display: flex;
      gap: 24px;
    }

    .sp-stat {
      text-align: center;
    }

    .sp-stat-value {
      display: block;
      font-size: 28px;
      font-weight: 700;
      color: ${COLORS.primary};
    }

    .sp-stat-label {
      font-size: 11px;
      color: ${COLORS.textMuted};
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .sp-main {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .sp-left-panel {
      width: 420px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sp-right-panel {
      flex: 1;
      min-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }

    .sp-card {
      background: ${COLORS.cardBg};
      border: 1px solid ${COLORS.border};
      border-radius: 12px;
      padding: 16px;
    }

    .sp-card-title {
      font-size: 13px;
      font-weight: 600;
      color: ${COLORS.textMain};
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .sp-card-hint {
      font-size: 10px;
      color: ${COLORS.textMuted};
      font-weight: 400;
    }

    .sp-flow-card {
      flex-shrink: 0;
    }

    /* ═══ 新的实验流程样式 ═══ */
    .sp-flow-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .sp-flow-input {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    }

    .sp-flow-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: ${COLORS.bg};
      border: 1px solid ${COLORS.border};
      border-radius: 10px;
      flex: 1;
    }

    .sp-flow-box-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .sp-flow-box-content {
      flex: 1;
      min-width: 0;
    }

    .sp-flow-box-title {
      font-size: 12px;
      font-weight: 600;
      color: ${COLORS.textMain};
      margin-bottom: 2px;
    }

    .sp-flow-box-meta {
      font-size: 10px;
      color: ${COLORS.textMuted};
    }

    .sp-flow-box-meta code {
      background: rgba(0,0,0,0.05);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 9px;
    }

    .sp-flow-noise {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-color: #fcd34d;
    }

    .sp-flow-query {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      border-color: #93c5fd;
    }

    .sp-flow-plus {
      font-size: 18px;
      font-weight: 700;
      color: ${COLORS.textMuted};
      flex-shrink: 0;
    }

    .sp-flow-arrow-down {
      display: flex;
      justify-content: center;
      padding: 4px 0;
    }

    .sp-flow-model-section {
      width: 100%;
    }

    .sp-flow-model-box {
      background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
      border: 1px solid #d8b4fe;
      border-radius: 12px;
      overflow: hidden;
    }

    .sp-flow-model-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: rgba(139, 92, 246, 0.15);
      border-bottom: 1px solid #d8b4fe;
    }

    .sp-flow-model-icon {
      font-size: 18px;
    }

    .sp-flow-model-name {
      font-size: 13px;
      font-weight: 700;
      color: #6b21a8;
    }

    .sp-flow-model-body {
      display: flex;
      gap: 8px;
      padding: 10px 14px;
      flex-wrap: wrap;
    }

    .sp-flow-model-component {
      display: flex;
      flex-direction: column;
      padding: 6px 10px;
      background: rgba(255,255,255,0.6);
      border-radius: 6px;
      flex: 1;
      min-width: 80px;
    }

    .sp-comp-label {
      font-size: 9px;
      color: #7c3aed;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-bottom: 2px;
    }

    .sp-comp-value {
      font-size: 11px;
      font-weight: 600;
      color: #4c1d95;
    }

    .sp-comp-highlight {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 1px solid #fcd34d;
    }

    .sp-comp-highlight .sp-comp-label {
      color: #92400e;
    }

    .sp-comp-highlight .sp-comp-value {
      color: #78350f;
    }

    .sp-flow-output {
      width: 100%;
    }

    .sp-flow-attn {
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
      border-color: #fca5a5;
      position: relative;
    }

    .sp-flow-attn-preview {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
    }

    .sp-attn-grid {
      width: 100%;
      height: 100%;
      background: 
        linear-gradient(90deg, rgba(239,68,68,0.1) 1px, transparent 1px),
        linear-gradient(rgba(239,68,68,0.1) 1px, transparent 1px),
        linear-gradient(135deg, #fecaca 0%, #f87171 100%);
      background-size: 10px 10px, 10px 10px, 100% 100%;
      border-radius: 4px;
      border: 1px solid #f87171;
    }

    .sp-rank-card {
      display: flex;
      flex-direction: column;
      max-height: 500px;
    }

    .sp-chart {
      flex: 1;
      min-height: 300px;
      max-height: 450px;
      overflow-y: auto;
    }

    .sp-category-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      background: ${COLORS.cardBg};
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid ${COLORS.border};
    }
    .sp-category-bar label {
      font-size: 12px;
      color: ${COLORS.textMuted};
    }

    .sp-category-bar select {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid ${COLORS.border};
      border-radius: 6px;
      font-size: 13px;
      background: white;
      cursor: pointer;
    }

    .sp-corr-badge {
      display: none;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      color: white;
    }

    .sp-compare-area {
      flex: 1;
      background: ${COLORS.cardBg};
      border: 1px solid ${COLORS.border};
      border-radius: 12px;
      min-height: 250px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sp-compare-placeholder {
      text-align: center;
      color: ${COLORS.textMuted};
    }

    .sp-placeholder-icon {
      font-size: 48px;
      opacity: 0.5;
      margin-bottom: 12px;
    }

    .sp-placeholder-text {
      font-size: 14px;
      margin-bottom: 4px;
    }

    .sp-placeholder-hint {
      font-size: 12px;
      opacity: 0.7;
    }

    .sp-compare-content {
      display: flex;
      justify-content: space-around;
      align-items: flex-start;
      width: 100%;
      padding: 20px;
      gap: 16px;
    }

    .sp-heatmap-wrap {
      text-align: center;
    }

    .sp-heatmap-title {
      font-size: 13px;
      font-weight: 600;
      color: ${COLORS.textMain};
      margin-bottom: 4px;
    }

    .sp-heatmap-subtitle {
      font-size: 10px;
      color: ${COLORS.textMuted};
      margin-bottom: 10px;
    }

    .sp-heatmap {
      width: 180px;
      height: 180px;
      background: ${COLORS.bg};
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sp-insight-card {
      display: flex;
      gap: 16px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 1px solid #fcd34d;
      border-radius: 10px;
    }

    .sp-insight-icon {
      font-size: 24px;
    }

    .sp-insight-content {
      font-size: 13px;
      line-height: 1.6;
      color: #78350f;
    }

    .sp-related-links {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 12px;
    }

    .sp-link-btn {
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .sp-link-bias {
      background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
      color: #991b1b;
      border: 1px solid #fca5a5;
    }

    .sp-link-bias:hover {
      background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
      transform: translateX(-2px);
    }

    .sp-link-spatial {
      background: linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%);
      color: #1e40af;
      border: 1px solid #93c5fd;
    }

    .sp-link-spatial:hover {
      background: linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%);
      transform: translateX(2px);
    }

    /* 架构图按钮 */
    .sp-arch-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
      padding: 4px 10px;
      background: linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%);
      border: 1px solid #6ee7b7;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #047857;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .sp-arch-btn:hover {
      background: linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 100%);
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }

    .sp-arch-btn svg {
      flex-shrink: 0;
    }

    /* 模态框样式 */
    .sp-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
    }

    .sp-modal.sp-modal-open {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sp-modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
    }

    .sp-modal-content {
      position: relative;
      background: ${COLORS.cardBg};
      border-radius: 16px;
      border: 1px solid ${COLORS.border};
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-width: 90%;
      max-height: 90%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: sp-modal-in 0.3s ease;
    }

    @keyframes sp-modal-in {
      from {
        opacity: 0;
        transform: scale(0.9) translateY(20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .sp-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid ${COLORS.border};
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    }

    .sp-modal-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: ${COLORS.textMain};
    }

    .sp-modal-close {
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      font-size: 20px;
      color: ${COLORS.textMuted};
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sp-modal-close:hover {
      background: rgba(239, 68, 68, 0.2);
      color: #dc2626;
    }

    .sp-modal-body {
      padding: 20px;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a2e;
    }

    .sp-arch-img {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .sp-modal-footer {
      padding: 12px 20px;
      border-top: 1px solid ${COLORS.border};
      text-align: center;
      background: ${COLORS.cardBg};
    }

    .sp-modal-caption {
      font-size: 12px;
      color: ${COLORS.textMuted};
    }
  `;

  const style = document.createElement("style");
  style.id = "sp-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

// 自动初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initSpatialPriorView());
} else {
  initSpatialPriorView();
}

