// src/js/spatial_view_v2.js
// 空间与尺度分析视图 - COCO-Verse v2.0 专业重构版
// 解决：视觉层级 / 配色统一 / 响应式 / 交互联动 / 叙事链

import * as d3 from "d3";
import spatialData from "../data/spatial_data.json";

// ═══════════════════════════════════════════════════════════════════
// 🎨 统一设计系统 - Design Tokens
// ═══════════════════════════════════════════════════════════════════
const DESIGN = {
    // 主色调 - 深靛蓝系
    colors: {
        primary: "#3b82f6",      // 主强调色
        primaryDark: "#1d4ed8",
        primaryLight: "#93c5fd",
        
        // 语义色 - 尺度分类（全局统一）
        scale: {
            small: "#10b981",    // 翡翠绿
            medium: "#f59e0b",   // 琥珀橙
            large: "#ef4444",    // 玫瑰红
        },
        
        // 等高线渐变 - 深色系增强冲击力
        contour: ["#f0f9ff", "#bae6fd", "#38bdf8", "#0284c7", "#0c4a6e"],
        
        // 中性色
        text: {
            primary: "#0f172a",
            secondary: "#475569",
            muted: "#94a3b8",
        },
        bg: {
            page: "#f8fafc",
            card: "#ffffff",
            subtle: "#f1f5f9",
        },
        border: "#e2e8f0",
    },
    
    // 字体层级
    font: {
        hero: { size: "28px", weight: 700 },
        title: { size: "15px", weight: 600 },
        subtitle: { size: "12px", weight: 500 },
        body: { size: "13px", weight: 400 },
        caption: { size: "11px", weight: 400 },
        micro: { size: "10px", weight: 400 },
    },
    
    // 间距
    spacing: {
        xs: 4, sm: 8, md: 12, lg: 16, xl: 24,
    },
    
    // 圆角
    radius: {
        sm: 6, md: 10, lg: 14,
    },
    
    // 阴影 - 统一轻量
    shadow: {
        sm: "0 1px 3px rgba(0,0,0,0.05)",
        md: "0 2px 8px rgba(0,0,0,0.06)",
    },
};

// ═══════════════════════════════════════════════════════════════════
// 🔄 全局状态管理
// ═══════════════════════════════════════════════════════════════════
const state = {
    currentCategory: "all",
    selectedRegion: null,      // 空间框选区域
    hoveredCategory: null,     // hover 的类别
    isInitialized: false,
};

// 图表更新函数
const charts = {
    contour: { update: () => {}, resize: () => {} },
    distribution: { update: () => {}, resize: () => {} },
    scatter: { update: () => {}, resize: () => {} },
};

// ResizeObserver 实例
let resizeObserver = null;

// ═══════════════════════════════════════════════════════════════════
// 🚀 初始化入口
// ═══════════════════════════════════════════════════════════════════
export function initSpatialView() {
    if (state.isInitialized) return;
    
    try {
        if (!spatialData?.annotations) {
            throw new Error("数据格式错误");
        }
        
        console.log("✅ Spatial View v2 - Data loaded:", {
            annotations: spatialData.annotations.length,
            categories: spatialData.categories.length,
        });
        
        render();
        setupResizeObserver();
        state.isInitialized = true;
        
    } catch (error) {
        console.error("❌ Spatial View init failed:", error);
        showError("数据加载失败，请先运行 python process_spatial.py");
    }
}

function showError(msg) {
    const container = document.getElementById("spatial-content");
    if (container) {
        container.innerHTML = `
            <div class="sv2-error">
                <div class="sv2-error-icon">📊</div>
                <div class="sv2-error-msg">${msg}</div>
                <code class="sv2-error-code">python process_spatial.py</code>
            </div>
        `;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 📊 数据洞察计算
// ═══════════════════════════════════════════════════════════════════
function computeInsights() {
    const anns = spatialData.annotations;
    const cats = spatialData.categories;
    const total = anns.length;
    
    // 1. 空间集中度
    const center = anns.filter(a => 
        a.cx >= 0.3 && a.cx <= 0.7 && a.cy >= 0.3 && a.cy <= 0.7
    );
    
    // 2. 尺度分布
    const scales = { small: 0, medium: 0, large: 0 };
    anns.forEach(a => scales[a.scale]++);
    
    // 3. 小目标偏重类别
    const smallBiased = cats
        .filter(c => c.scale_distribution)
        .map(c => {
            const d = c.scale_distribution;
            const t = d.small + d.medium + d.large;
            return { name: c.name, ratio: t > 0 ? d.small / t : 0 };
        })
        .sort((a, b) => b.ratio - a.ratio)[0];
    
    // 4. 边缘分布
    const edge = anns.filter(a => 
        a.cx < 0.1 || a.cx > 0.9 || a.cy < 0.1 || a.cy > 0.9
    );
    
    return {
        centerRatio: Math.round(center.length / total * 100),
        smallRatio: Math.round(scales.small / total * 100),
        mediumRatio: Math.round(scales.medium / total * 100),
        largeRatio: Math.round(scales.large / total * 100),
        smallBiasedCat: smallBiased?.name || "N/A",
        edgeRatio: Math.round(edge.length / total * 100),
        total,
    };
}

// ═══════════════════════════════════════════════════════════════════
// 🎨 主渲染函数
// ═══════════════════════════════════════════════════════════════════
function render() {
    const container = document.getElementById("spatial-content");
    if (!container) return;
    
    const insights = computeInsights();
    
    // 注入样式
    injectStyles();
    
    // 构建布局 - 主图优先，洞察轻量化
    container.innerHTML = `
        <div class="sv2-root">
            <!-- 顶部轻量信息栏 -->
            <div class="sv2-topbar">
                <div class="sv2-title-group">
                    <h2 class="sv2-page-title">空间与尺度分析</h2>
                    <span class="sv2-subtitle">Spatial & Scale Distribution Analysis</span>
                </div>
                <div class="sv2-quick-stats">
                    <div class="sv2-stat" data-type="center">
                        <span class="sv2-stat-value">${insights.centerRatio}%</span>
                        <span class="sv2-stat-label">中央集中</span>
                    </div>
                    <div class="sv2-stat" data-type="small">
                        <span class="sv2-stat-value">${insights.smallRatio}%</span>
                        <span class="sv2-stat-label">小目标</span>
                    </div>
                    <div class="sv2-stat" data-type="medium">
                        <span class="sv2-stat-value">${insights.mediumRatio}%</span>
                        <span class="sv2-stat-label">中目标</span>
                    </div>
                    <div class="sv2-stat" data-type="large">
                        <span class="sv2-stat-value">${insights.largeRatio}%</span>
                        <span class="sv2-stat-label">大目标</span>
                    </div>
                </div>
            </div>
            
            <!-- 主内容区 - 三栏叙事布局 -->
            <div class="sv2-main">
                <!-- 左：空间密度主图 -->
                <div class="sv2-panel sv2-panel-primary">
                    <div class="sv2-panel-header">
                        <div class="sv2-panel-title">
                            <span class="sv2-panel-number">01</span>
                            空间分布热力图
                        </div>
                        <select id="sv2-category-select" class="sv2-select">
                            <option value="all">全部类别</option>
                        </select>
                    </div>
                    <div class="sv2-panel-body">
                        <div id="sv2-contour" class="sv2-chart sv2-chart-main"></div>
                    </div>
                    <div class="sv2-panel-footer">
                        <span class="sv2-hint">🖱️ 拖拽框选区域，联动右侧图表</span>
                    </div>
                </div>
                
                <!-- 中：尺度分布 -->
                <div class="sv2-panel sv2-panel-secondary">
                    <div class="sv2-panel-header">
                        <div class="sv2-panel-title">
                            <span class="sv2-panel-number">02</span>
                            类别尺度分布
                        </div>
                    </div>
                    <div class="sv2-panel-body">
                        <div id="sv2-distribution" class="sv2-chart"></div>
                    </div>
                    <div class="sv2-panel-footer">
                        <div class="sv2-legend">
                            <span class="sv2-legend-item"><i style="background:${DESIGN.colors.scale.small}"></i>小</span>
                            <span class="sv2-legend-item"><i style="background:${DESIGN.colors.scale.medium}"></i>中</span>
                            <span class="sv2-legend-item"><i style="background:${DESIGN.colors.scale.large}"></i>大</span>
                        </div>
                    </div>
                </div>
                
                <!-- 右：位置×尺度 -->
                <div class="sv2-panel sv2-panel-tertiary">
                    <div class="sv2-panel-header">
                        <div class="sv2-panel-title">
                            <span class="sv2-panel-number">03</span>
                            位置 × 尺度
                        </div>
                    </div>
                    <div class="sv2-panel-body">
                        <div id="sv2-scatter" class="sv2-chart"></div>
                    </div>
                    <div class="sv2-panel-footer">
                        <span class="sv2-hint" id="sv2-scatter-info">显示全部 ${insights.total} 个目标</span>
                    </div>
                </div>
            </div>
            
            <!-- Tooltip 容器 -->
            <div id="sv2-tooltip" class="sv2-tooltip"></div>
        </div>
    `;
    
    // 填充类别选择器
    populateCategorySelect();
    
    // 延迟渲染图表
    requestAnimationFrame(() => {
        renderContourChart();
        renderDistributionChart();
        renderScatterChart();
    });
}

// ═══════════════════════════════════════════════════════════════════
// 🎨 样式注入
// ═══════════════════════════════════════════════════════════════════
function injectStyles() {
    if (document.getElementById("sv2-styles")) return;
    
    const C = DESIGN.colors;
    const S = DESIGN.spacing;
    const R = DESIGN.radius;
    
    const css = `
        /* 根容器 */
        .sv2-root {
            display: flex;
            flex-direction: column;
            height: 100%;
            gap: ${S.md}px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        
        /* 错误状态 */
        .sv2-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            gap: ${S.lg}px;
        }
        .sv2-error-icon { font-size: 48px; }
        .sv2-error-msg { color: ${C.text.secondary}; font-size: 14px; }
        .sv2-error-code {
            background: ${C.bg.subtle};
            padding: ${S.sm}px ${S.lg}px;
            border-radius: ${R.sm}px;
            font-size: 12px;
        }
        
        /* 顶部信息栏 - 轻量化 */
        .sv2-topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: ${S.sm}px ${S.md}px;
            background: ${C.bg.card};
            border: 1px solid ${C.border};
            border-radius: ${R.md}px;
            flex-shrink: 0;
        }
        .sv2-title-group {
            display: flex;
            align-items: baseline;
            gap: ${S.md}px;
        }
        .sv2-page-title {
            margin: 0;
            font-size: ${DESIGN.font.title.size};
            font-weight: ${DESIGN.font.title.weight};
            color: ${C.text.primary};
        }
        .sv2-subtitle {
            font-size: ${DESIGN.font.caption.size};
            color: ${C.text.muted};
        }
        
        /* 快速统计 - 极简 */
        .sv2-quick-stats {
            display: flex;
            gap: ${S.lg}px;
        }
        .sv2-stat {
            text-align: center;
            padding: ${S.xs}px ${S.md}px;
            border-radius: ${R.sm}px;
            transition: background 0.2s;
        }
        .sv2-stat:hover {
            background: ${C.bg.subtle};
        }
        .sv2-stat-value {
            display: block;
            font-size: 16px;
            font-weight: 700;
            color: ${C.text.primary};
        }
        .sv2-stat-label {
            font-size: ${DESIGN.font.micro.size};
            color: ${C.text.muted};
        }
        .sv2-stat[data-type="small"] .sv2-stat-value { color: ${C.scale.small}; }
        .sv2-stat[data-type="medium"] .sv2-stat-value { color: ${C.scale.medium}; }
        .sv2-stat[data-type="large"] .sv2-stat-value { color: ${C.scale.large}; }
        .sv2-stat[data-type="center"] .sv2-stat-value { color: ${C.primary}; }
        
        /* 主内容区 - 三栏布局 */
        .sv2-main {
            display: grid;
            grid-template-columns: 1.5fr 1fr 1fr;
            gap: ${S.md}px;
            flex: 1;
            min-height: 0;
        }
        
        /* 面板基础样式 */
        .sv2-panel {
            background: ${C.bg.card};
            border: 1px solid ${C.border};
            border-radius: ${R.lg}px;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
        }
        .sv2-panel-primary {
            box-shadow: ${DESIGN.shadow.md};
            border-color: ${C.primaryLight};
        }
        
        .sv2-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: ${S.md}px ${S.lg}px;
            border-bottom: 1px solid ${C.border};
            flex-shrink: 0;
        }
        .sv2-panel-title {
            font-size: ${DESIGN.font.subtitle.size};
            font-weight: ${DESIGN.font.subtitle.weight};
            color: ${C.text.primary};
            display: flex;
            align-items: center;
            gap: ${S.sm}px;
        }
        .sv2-panel-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            background: ${C.primary};
            color: white;
            font-size: 10px;
            font-weight: 700;
            border-radius: 50%;
        }
        
        .sv2-panel-body {
            flex: 1;
            padding: ${S.sm}px;
            min-height: 0;
            position: relative;
        }
        
        .sv2-panel-footer {
            padding: ${S.sm}px ${S.md}px;
            border-top: 1px solid ${C.border};
            flex-shrink: 0;
        }
        .sv2-hint {
            font-size: ${DESIGN.font.micro.size};
            color: ${C.text.muted};
        }
        
        /* 下拉选择器 */
        .sv2-select {
            padding: 4px 8px;
            font-size: 11px;
            border: 1px solid ${C.border};
            border-radius: ${R.sm}px;
            background: ${C.bg.card};
            color: ${C.text.secondary};
            cursor: pointer;
        }
        .sv2-select:focus {
            outline: none;
            border-color: ${C.primary};
        }
        
        /* 图例 */
        .sv2-legend {
            display: flex;
            justify-content: center;
            gap: ${S.md}px;
        }
        .sv2-legend-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: ${DESIGN.font.micro.size};
            color: ${C.text.muted};
        }
        .sv2-legend-item i {
            width: 8px;
            height: 8px;
            border-radius: 2px;
        }
        
        /* 图表容器 */
        .sv2-chart {
            width: 100%;
            height: 100%;
            min-height: 200px;
        }
        .sv2-chart-main {
            min-height: 300px;
        }
        .sv2-chart svg {
            display: block;
            width: 100%;
            height: 100%;
        }
        
        /* Tooltip */
        .sv2-tooltip {
            position: fixed;
            pointer-events: none;
            background: rgba(15, 23, 42, 0.92);
            color: white;
            padding: 8px 12px;
            border-radius: ${R.sm}px;
            font-size: 11px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.15s;
            max-width: 200px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .sv2-tooltip.visible { opacity: 1; }
        .sv2-tooltip-title {
            font-weight: 600;
            margin-bottom: 4px;
        }
        .sv2-tooltip-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
        }
        .sv2-tooltip-value {
            font-weight: 600;
        }
        
        /* Brush 样式 */
        .sv2-brush .selection {
            fill: ${C.primary};
            fill-opacity: 0.12;
            stroke: ${C.primary};
            stroke-width: 1.5;
            stroke-dasharray: 4,2;
        }
        
        /* 响应式 */
        @media (max-width: 1200px) {
            .sv2-main {
                grid-template-columns: 1fr 1fr;
            }
            .sv2-panel-primary {
                grid-column: 1 / -1;
            }
        }
        @media (max-width: 768px) {
            .sv2-main {
                grid-template-columns: 1fr;
            }
            .sv2-topbar {
                flex-direction: column;
                gap: ${S.sm}px;
            }
            .sv2-quick-stats {
                flex-wrap: wrap;
                justify-content: center;
            }
        }
    `;
    
    const style = document.createElement("style");
    style.id = "sv2-styles";
    style.textContent = css;
    document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════════
// 📊 类别选择器
// ═══════════════════════════════════════════════════════════════════
function populateCategorySelect() {
    const select = document.getElementById("sv2-category-select");
    if (!select) return;
    
    spatialData.categories.slice(0, 20).forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.name;
        opt.textContent = `${cat.name} (${cat.count.toLocaleString()})`;
        select.appendChild(opt);
    });
    
    select.addEventListener("change", e => {
        state.currentCategory = e.target.value;
        charts.contour.update();
        charts.scatter.update();
    });
}

// ═══════════════════════════════════════════════════════════════════
// 📊 等高线密度图
// ═══════════════════════════════════════════════════════════════════
function renderContourChart() {
    const container = document.getElementById("sv2-contour");
    if (!container) return;
    
    const C = DESIGN.colors;
    let svg, g, contourLayer, xScale, yScale, innerW, innerH;
    
    function setup() {
        const rect = container.getBoundingClientRect();
        const margin = { top: 15, right: 15, bottom: 35, left: 40 };
        const width = rect.width || 500;
        const height = rect.height || 350;
        innerW = width - margin.left - margin.right;
        innerH = height - margin.top - margin.bottom;
        
        container.innerHTML = "";
        
        svg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");
        
        g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        // 比例尺
        xScale = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
        yScale = d3.scaleLinear().domain([0, 1]).range([0, innerH]);
        
        // 背景
        g.append("rect")
            .attr("width", innerW)
            .attr("height", innerH)
            .attr("fill", C.bg.subtle)
            .attr("stroke", C.border)
            .attr("stroke-width", 1)
            .attr("rx", 4);
        
        // 参考线
        [0.25, 0.5, 0.75].forEach(v => {
            g.append("line")
                .attr("x1", xScale(v)).attr("x2", xScale(v))
                .attr("y1", 0).attr("y2", innerH)
                .attr("stroke", C.border).attr("stroke-dasharray", "3,3");
            g.append("line")
                .attr("x1", 0).attr("x2", innerW)
                .attr("y1", yScale(v)).attr("y2", yScale(v))
                .attr("stroke", C.border).attr("stroke-dasharray", "3,3");
        });
        
        // 等高线层
        contourLayer = g.append("g").attr("class", "sv2-contours");
        
        // Brush
        const brush = d3.brush()
            .extent([[0, 0], [innerW, innerH]])
            .on("brush end", brushHandler);
        
        g.append("g").attr("class", "sv2-brush").call(brush);
        
        // 坐标轴标签
        g.append("text")
            .attr("x", innerW / 2)
            .attr("y", innerH + 28)
            .attr("text-anchor", "middle")
            .attr("font-size", 10)
            .attr("fill", C.text.muted)
            .text("← 左侧        水平位置        右侧 →");
        
        g.append("text")
            .attr("transform", `translate(-28, ${innerH / 2}) rotate(-90)`)
            .attr("text-anchor", "middle")
            .attr("font-size", 10)
            .attr("fill", C.text.muted)
            .text("↑ 顶部    垂直位置    底部 ↓");
    }
    
    function brushHandler(event) {
        if (!event.selection) {
            state.selectedRegion = null;
        } else {
            const [[x0, y0], [x1, y1]] = event.selection;
            state.selectedRegion = {
                x0: xScale.invert(x0), x1: xScale.invert(x1),
                y0: yScale.invert(y0), y1: yScale.invert(y1),
            };
        }
        charts.scatter.update();
    }
    
    function update() {
        const data = state.currentCategory === "all"
            ? spatialData.annotations
            : spatialData.annotations.filter(d => d.category === state.currentCategory);
        
        const points = data.map(d => [xScale(d.cx), yScale(d.cy)]);
        
        const contourGen = d3.contourDensity()
            .x(d => d[0])
            .y(d => d[1])
            .size([innerW, innerH])
            .bandwidth(20)
            .thresholds(15);
        
        const contours = contourGen(points);
        const maxVal = d3.max(contours, d => d.value) || 1;
        
        // 使用深色系配色增强冲击力
        const colorScale = d3.scaleSequential()
            .domain([0, maxVal])
            .interpolator(t => d3.interpolateBlues(0.2 + t * 0.8));
        
        contourLayer.selectAll("path")
            .data(contours)
            .join("path")
            .attr("d", d3.geoPath())
            .attr("fill", d => colorScale(d.value))
            .attr("stroke", d => d3.color(colorScale(d.value))?.darker(0.3))
            .attr("stroke-width", 0.5)
            .attr("fill-opacity", 0.85);
    }
    
    setup();
    update();
    
    charts.contour = { 
        update, 
        resize: () => { setup(); update(); }
    };
}

// ═══════════════════════════════════════════════════════════════════
// 📊 类别尺度分布图 (水平堆叠条形图)
// ═══════════════════════════════════════════════════════════════════
function renderDistributionChart() {
    const container = document.getElementById("sv2-distribution");
    if (!container) return;
    
    const C = DESIGN.colors;
    const tooltip = document.getElementById("sv2-tooltip");
    
    function render() {
        const rect = container.getBoundingClientRect();
        const margin = { top: 10, right: 10, bottom: 25, left: 65 };
        const width = rect.width || 300;
        const height = rect.height || 280;
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;
        
        container.innerHTML = "";
        
        const topCats = spatialData.categories.slice(0, 10);
        const stackData = topCats.map(cat => {
            const d = cat.scale_distribution;
            const total = d.small + d.medium + d.large;
            return {
                name: cat.name,
                small: d.small / total,
                medium: d.medium / total,
                large: d.large / total,
                counts: d,
                total,
            };
        });
        
        const svg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");
        
        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        const yScale = d3.scaleBand()
            .domain(stackData.map(d => d.name))
            .range([0, innerH])
            .padding(0.2);
        
        const xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, innerW]);
        
        const stack = d3.stack().keys(["small", "medium", "large"]);
        const series = stack(stackData);
        
        const colorMap = {
            small: C.scale.small,
            medium: C.scale.medium,
            large: C.scale.large,
        };
        
        // 绘制堆叠条形
        g.selectAll("g.layer")
            .data(series)
            .join("g")
            .attr("class", "layer")
            .attr("fill", d => colorMap[d.key])
            .selectAll("rect")
            .data(d => d.map(item => ({ ...item, key: d.key })))
            .join("rect")
            .attr("y", d => yScale(d.data.name))
            .attr("x", d => xScale(d[0]))
            .attr("width", d => xScale(d[1]) - xScale(d[0]))
            .attr("height", yScale.bandwidth())
            .attr("rx", 2)
            .on("mouseenter", function(event, d) {
                const count = d.data.counts[d.key];
                const pct = (d[1] - d[0]) * 100;
                tooltip.innerHTML = `
                    <div class="sv2-tooltip-title">${d.data.name}</div>
                    <div class="sv2-tooltip-row">
                        <span>${d.key === 'small' ? '小' : d.key === 'medium' ? '中' : '大'}目标</span>
                        <span class="sv2-tooltip-value">${count} (${pct.toFixed(1)}%)</span>
                    </div>
                `;
                tooltip.style.left = event.pageX + 10 + "px";
                tooltip.style.top = event.pageY - 10 + "px";
                tooltip.classList.add("visible");
            })
            .on("mouseleave", () => {
                tooltip.classList.remove("visible");
            });
        
        // Y轴
        g.append("g")
            .call(d3.axisLeft(yScale).tickSize(0))
            .selectAll("text")
            .attr("font-size", 10);
        
        g.selectAll(".domain").remove();
        
        // X轴
        g.append("g")
            .attr("transform", `translate(0,${innerH})`)
            .call(d3.axisBottom(xScale).ticks(4, "%"))
            .selectAll("text")
            .attr("font-size", 9);
    }
    
    render();
    charts.distribution = { update: render, resize: render };
}

// ═══════════════════════════════════════════════════════════════════
// 📊 位置×尺度散点图
// ═══════════════════════════════════════════════════════════════════
function renderScatterChart() {
    const container = document.getElementById("sv2-scatter");
    if (!container) return;
    
    const C = DESIGN.colors;
    const infoEl = document.getElementById("sv2-scatter-info");
    let svg, g, bgLayer, fgLayer, xScale, yScale;
    
    function setup() {
        const rect = container.getBoundingClientRect();
        const margin = { top: 10, right: 10, bottom: 30, left: 40 };
        const width = rect.width || 300;
        const height = rect.height || 200;
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;
        
        container.innerHTML = "";
        
        svg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");
        
        g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        xScale = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
        yScale = d3.scaleLog()
            .domain([1e-6, d3.max(spatialData.annotations, d => d.area) || 0.5])
            .range([innerH, 0]);
        
        bgLayer = g.append("g").attr("class", "bg");
        fgLayer = g.append("g").attr("class", "fg");
        
        // X轴
        g.append("g")
            .attr("transform", `translate(0,${innerH})`)
            .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => `${(d*100).toFixed(0)}%`))
            .selectAll("text").attr("font-size", 8);
        
        g.append("text")
            .attr("x", innerW / 2)
            .attr("y", innerH + 24)
            .attr("text-anchor", "middle")
            .attr("font-size", 9)
            .attr("fill", C.text.muted)
            .text("水平位置");
        
        // Y轴
        g.append("g")
            .call(d3.axisLeft(yScale).ticks(3, ".0e"))
            .selectAll("text").attr("font-size", 8);
    }
    
    function update() {
        const allData = state.currentCategory === "all"
            ? spatialData.annotations
            : spatialData.annotations.filter(d => d.category === state.currentCategory);
        
        // 框选区域内的数据
        let highlightData = [];
        if (state.selectedRegion) {
            const r = state.selectedRegion;
            highlightData = allData.filter(d =>
                d.cx >= r.x0 && d.cx <= r.x1 &&
                d.cy >= r.y0 && d.cy <= r.y1
            );
        }
        
        // 采样背景
        const sampleRate = Math.max(1, Math.floor(allData.length / 600));
        const bgData = allData.filter((_, i) => i % sampleRate === 0);
        
        const scaleColor = d => {
            if (d.scale === "small") return C.scale.small;
            if (d.scale === "medium") return C.scale.medium;
            return C.scale.large;
        };
        
        // 背景点
        bgLayer.selectAll("circle")
            .data(bgData, d => d.id)
            .join("circle")
            .attr("r", 2)
            .attr("cx", d => xScale(d.cx))
            .attr("cy", d => yScale(Math.max(d.area, 1e-7)))
            .attr("fill", "#cbd5e1")
            .attr("opacity", 0.25);
        
        // 前景点
        const fgData = highlightData.length > 0 
            ? highlightData.slice(0, 400)
            : bgData.slice(0, 200);
        
        fgLayer.selectAll("circle")
            .data(fgData, d => d.id)
            .join(
                enter => enter.append("circle")
                    .attr("r", highlightData.length > 0 ? 3.5 : 2.5)
                    .attr("cx", d => xScale(d.cx))
                    .attr("cy", d => yScale(Math.max(d.area, 1e-7)))
                    .attr("fill", scaleColor)
                    .attr("opacity", highlightData.length > 0 ? 0.9 : 0.6)
                    .attr("stroke", highlightData.length > 0 ? "white" : "none")
                    .attr("stroke-width", 0.8),
                update => update
                    .transition().duration(150)
                    .attr("r", highlightData.length > 0 ? 3.5 : 2.5)
                    .attr("cx", d => xScale(d.cx))
                    .attr("cy", d => yScale(Math.max(d.area, 1e-7)))
                    .attr("fill", scaleColor)
                    .attr("opacity", highlightData.length > 0 ? 0.9 : 0.6),
                exit => exit.remove()
            );
        
        // 更新信息
        if (infoEl) {
            infoEl.textContent = highlightData.length > 0
                ? `已选中 ${highlightData.length} 个目标`
                : `显示 ${allData.length} 个目标`;
        }
    }
    
    setup();
    update();
    
    charts.scatter = { update, resize: () => { setup(); update(); } };
}

// ═══════════════════════════════════════════════════════════════════
// 📐 响应式处理
// ═══════════════════════════════════════════════════════════════════
function setupResizeObserver() {
    const container = document.getElementById("spatial-content");
    if (!container) return;
    
    let resizeTimeout;
    resizeObserver = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            charts.contour.resize();
            charts.distribution.resize();
            charts.scatter.resize();
        }, 150);
    });
    
    resizeObserver.observe(container);
}

// ═══════════════════════════════════════════════════════════════════
// 🔄 自动初始化
// ═══════════════════════════════════════════════════════════════════
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndInit);
} else {
    checkAndInit();
}

function checkAndInit() {
    const spatialNav = document.querySelector('[data-target="spatial-view"]');
    if (spatialNav) {
        spatialNav.addEventListener("click", () => {
            setTimeout(initSpatialView, 50);
        });
    }
    
    const spatialView = document.getElementById("spatial-view");
    if (spatialView?.classList.contains("active")) {
        initSpatialView();
    }
}
