// src/js/spatial_view.js
// 空间与尺度分析视图 - COCO-Verse Spatial Analysis Module

import * as d3 from "d3";
import spatialData from "../data/spatial_data.json";

// ========== 配色方案 ==========
const COLORS = {
    heatmap: {
        scheme: d3.interpolateYlOrRd,
        empty: "#f8fafc"
    },
    scatter: {
        default: "#6366f1",
        selected: "#f43f5e",
        muted: "#cbd5e1"
    },
    scale: {
        small: "#22c55e",    // 绿色 - 小目标
        medium: "#f59e0b",   // 橙色 - 中等目标
        large: "#ef4444"     // 红色 - 大目标
    },
    category: d3.schemeTableau10
};

// ========== 全局状态 ==========
let currentCategory = "all";
let brushedPoints = null;
let updateHeatmap = () => {};
let updateScatter = () => {};
let updateDistribution = () => {};
let isInitialized = false;

// ========== 初始化入口 ==========
export function initSpatialView() {
    if (isInitialized) return;
    
    try {
        if (!spatialData || !spatialData.annotations) {
            throw new Error("数据格式错误");
        }
        
        console.log("✅ Spatial data loaded:", {
            annotations: spatialData.annotations?.length,
            categories: spatialData.categories?.length
        });
        
        renderSpatialView();
        setupEventListeners();
        isInitialized = true;
        
    } catch (error) {
        console.error("❌ Failed to load spatial data:", error);
        showErrorMessage("数据加载失败，请先运行 python process_spatial.py 生成数据");
    }
}

function showErrorMessage(msg) {
    const container = document.getElementById("spatial-content");
    if (container) {
        container.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; gap:16px;">
                <div style="font-size:48px;">📊</div>
                <div style="color:#64748b; font-size:14px; text-align:center; max-width:400px;">${msg}</div>
                <code style="background:#f1f5f9; padding:8px 16px; border-radius:8px; font-size:12px;">python process_spatial.py</code>
            </div>
        `;
    }
}

// ========== 主渲染函数 ==========
function renderSpatialView() {
    const container = document.getElementById("spatial-content");
    console.log("🎨 Rendering spatial view, container:", container);
    
    if (!container) {
        console.error("❌ spatial-content container not found!");
        return;
    }
    if (!spatialData) {
        console.error("❌ spatialData is null!");
        return;
    }
    
    // 清空并重建布局
    container.innerHTML = `
        <div class="spatial-layout">
            <div class="spatial-left">
                <div class="spatial-panel heatmap-panel">
                    <div class="panel-header">
                        <h3>空间密度热力图</h3>
                        <div class="panel-controls">
                            <select id="heatmap-category" class="control-select">
                                <option value="all">全部类别</option>
                            </select>
                        </div>
                    </div>
                    <div id="heatmap-container" class="chart-container"></div>
                </div>
                <div class="spatial-panel scatter-panel">
                    <div class="panel-header">
                        <h3>尺寸-位置散点图</h3>
                        <div class="scale-legend">
                            <span class="legend-item"><span class="dot" style="background:${COLORS.scale.small}"></span>小目标</span>
                            <span class="legend-item"><span class="dot" style="background:${COLORS.scale.medium}"></span>中等</span>
                            <span class="legend-item"><span class="dot" style="background:${COLORS.scale.large}"></span>大目标</span>
                        </div>
                    </div>
                    <div id="scatter-container" class="chart-container"></div>
                </div>
            </div>
            <div class="spatial-right">
                <div class="spatial-panel distribution-panel">
                    <div class="panel-header">
                        <h3>类别尺度分布</h3>
                        <span class="panel-hint">Top 15 类别</span>
                    </div>
                    <div id="distribution-container" class="chart-container"></div>
                </div>
                <div class="spatial-panel stats-panel">
                    <div class="panel-header">
                        <h3>统计摘要</h3>
                    </div>
                    <div id="stats-container" class="stats-content"></div>
                </div>
            </div>
        </div>
    `;
    
    // 添加样式
    injectStyles();
    
    // 填充类别选择器
    populateCategorySelect();
    
    // 延迟渲染图表，确保 DOM 已经渲染完成
    requestAnimationFrame(() => {
        console.log("📊 Starting chart rendering...");
        renderHeatmap();
        renderScatterPlot();
        renderDistributionChart();
        renderStats();
        console.log("✅ All charts rendered");
    });
}

// ========== 注入局部样式 ==========
function injectStyles() {
    if (document.getElementById("spatial-view-styles")) return;
    
    const style = document.createElement("style");
    style.id = "spatial-view-styles";
    style.textContent = `
        .spatial-layout {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 16px;
            height: 100%;
            min-height: 0;
        }
        .spatial-left, .spatial-right {
            display: flex;
            flex-direction: column;
            gap: 16px;
            min-height: 0;
        }
        .spatial-panel {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .heatmap-panel { flex: 1.2; }
        .scatter-panel { flex: 1; }
        .distribution-panel { flex: 1.5; }
        .stats-panel { flex: 0 0 auto; }
        
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            flex-shrink: 0;
        }
        .panel-header h3 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
        }
        .panel-hint {
            font-size: 11px;
            color: #94a3b8;
        }
        .panel-controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .control-select {
            padding: 4px 8px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 12px;
            background: #fff;
            color: #1e293b;
            cursor: pointer;
        }
        .control-select:focus {
            outline: none;
            border-color: #6366f1;
        }
        
        .chart-container {
            flex: 1;
            min-height: 0;
            position: relative;
        }
        .chart-container svg {
            width: 100%;
            height: 100%;
        }
        
        .scale-legend {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: #64748b;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .legend-item .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        
        .stats-content {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        }
        .stat-card {
            background: #f8fafc;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
        }
        .stat-value {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
        }
        .stat-label {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
        }
        
        .brush-info {
            position: absolute;
            bottom: 8px;
            left: 8px;
            background: rgba(255,255,255,0.95);
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 11px;
            color: #64748b;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}

// ========== 类别选择器 ==========
function populateCategorySelect() {
    const select = document.getElementById("heatmap-category");
    if (!select || !spatialData?.categories) return;
    
    const topCats = spatialData.categories.slice(0, 20);
    topCats.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.name;
        option.textContent = `${cat.name} (${cat.count.toLocaleString()})`;
        select.appendChild(option);
    });
    
    select.addEventListener("change", (e) => {
        currentCategory = e.target.value;
        updateHeatmap();
        updateScatter();
    });
}

// ========== 热力图 ==========
function renderHeatmap() {
    const container = document.getElementById("heatmap-container");
    if (!container || !spatialData?.spatial_grid) {
        console.error("❌ Heatmap: container or data missing");
        return;
    }
    
    const rect = container.getBoundingClientRect();
    console.log("📐 Heatmap container rect:", rect);
    
    const margin = { top: 20, right: 20, bottom: 30, left: 30 };
    // 使用 offsetWidth/offsetHeight 作为备选
    const width = Math.max(rect.width || container.offsetWidth || 400, 300);
    const height = Math.max(rect.height || container.offsetHeight || 250, 200);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    
    const gridSize = spatialData.spatial_grid.grid_size;
    const cellW = innerW / gridSize;
    const cellH = innerH / gridSize;
    
    // 创建 SVG
    const svg = d3.select(container)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 添加边框表示画布范围
    g.append("rect")
        .attr("width", innerW)
        .attr("height", innerH)
        .attr("fill", "none")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1);
    
    // 绘制网格单元
    const cells = g.append("g").attr("class", "heatmap-cells");
    
    // 坐标轴标签
    g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH + 25)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", "#64748b")
        .text("← 图像左侧          图像右侧 →");
    
    g.append("text")
        .attr("transform", `translate(-20, ${innerH / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", "#64748b")
        .text("↑ 顶部    底部 ↓");
    
    // 更新函数
    updateHeatmap = () => {
        let gridData;
        if (currentCategory === "all") {
            gridData = spatialData.spatial_grid.global;
        } else {
            gridData = spatialData.spatial_grid.by_category[currentCategory] 
                      || spatialData.spatial_grid.global;
        }
        
        // 展平网格数据
        const flatData = [];
        const maxVal = Math.max(...gridData.flat());
        
        gridData.forEach((row, y) => {
            row.forEach((val, x) => {
                flatData.push({ x, y, value: val });
            });
        });
        
        const colorScale = d3.scaleSequential()
            .domain([0, maxVal || 1])
            .interpolator(COLORS.heatmap.scheme);
        
        // 绑定数据
        cells.selectAll("rect")
            .data(flatData)
            .join("rect")
            .attr("x", d => d.x * cellW)
            .attr("y", d => d.y * cellH)
            .attr("width", cellW - 1)
            .attr("height", cellH - 1)
            .attr("rx", 2)
            .attr("fill", d => d.value > 0 ? colorScale(d.value) : COLORS.heatmap.empty)
            .attr("opacity", 0.9);
    };
    
    updateHeatmap();
    
    // 响应窗口调整
    const resizeObserver = new ResizeObserver(() => {
        const newRect = container.getBoundingClientRect();
        svg.attr("viewBox", `0 0 ${newRect.width || width} ${newRect.height || height}`);
    });
    resizeObserver.observe(container);
}

// ========== 散点图 (面积 vs 宽高比) ==========
function renderScatterPlot() {
    const container = document.getElementById("scatter-container");
    if (!container || !spatialData?.annotations) return;
    
    const rect = container.getBoundingClientRect();
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const width = Math.max(rect.width || 500, 350);
    const height = Math.max(rect.height || 280, 200);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    
    const annotations = spatialData.annotations;
    
    // 使用对数尺度处理面积
    const xScale = d3.scaleLog()
        .domain([1e-6, d3.max(annotations, d => d.area) || 1])
        .range([0, innerW])
        .nice();
    
    const yScale = d3.scaleLog()
        .domain([0.1, d3.max(annotations, d => d.aspect_ratio) || 10])
        .range([innerH, 0])
        .nice();
    
    const colorByScale = d => {
        if (d.scale === "small") return COLORS.scale.small;
        if (d.scale === "medium") return COLORS.scale.medium;
        return COLORS.scale.large;
    };
    
    // 创建 SVG
    const svg = d3.select(container)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 绘制 COCO 尺度阈值参考线
    const thresholds = [
        { area: 32*32 / (640*480), label: "Small" },
        { area: 96*96 / (640*480), label: "Medium" }
    ];
    
    thresholds.forEach(t => {
        if (xScale(t.area) > 0 && xScale(t.area) < innerW) {
            g.append("line")
                .attr("x1", xScale(t.area))
                .attr("x2", xScale(t.area))
                .attr("y1", 0)
                .attr("y2", innerH)
                .attr("stroke", "#e2e8f0")
                .attr("stroke-dasharray", "4,4");
        }
    });
    
    // 散点层
    const dots = g.append("g").attr("class", "scatter-dots");
    
    // X 轴
    g.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(5, ".0e"))
        .selectAll("text")
        .attr("font-size", 9);
    
    g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH + 32)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", "#64748b")
        .text("相对面积 (log)");
    
    // Y 轴
    g.append("g")
        .call(d3.axisLeft(yScale).ticks(5))
        .selectAll("text")
        .attr("font-size", 9);
    
    g.append("text")
        .attr("transform", `translate(-35, ${innerH / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", "#64748b")
        .text("宽高比 (log)");
    
    // Brush 选择器
    const brush = d3.brush()
        .extent([[0, 0], [innerW, innerH]])
        .on("start brush end", brushed);
    
    g.append("g")
        .attr("class", "brush")
        .call(brush);
    
    // Brush 信息提示
    const brushInfo = d3.select(container)
        .append("div")
        .attr("class", "brush-info")
        .style("display", "none");
    
    function brushed(event) {
        const selection = event.selection;
        
        if (!selection) {
            brushedPoints = null;
            brushInfo.style("display", "none");
            updateHeatmapFromBrush(null);
            dots.selectAll("circle").attr("opacity", 0.6);
            return;
        }
        
        const [[x0, y0], [x1, y1]] = selection;
        const areaMin = xScale.invert(x0);
        const areaMax = xScale.invert(x1);
        const ratioMax = yScale.invert(y0);
        const ratioMin = yScale.invert(y1);
        
        brushedPoints = annotations.filter(d => 
            d.area >= areaMin && d.area <= areaMax &&
            d.aspect_ratio >= ratioMin && d.aspect_ratio <= ratioMax &&
            (currentCategory === "all" || d.category === currentCategory)
        );
        
        // 更新点的透明度
        dots.selectAll("circle")
            .attr("opacity", d => {
                const inBrush = d.area >= areaMin && d.area <= areaMax &&
                               d.aspect_ratio >= ratioMin && d.aspect_ratio <= ratioMax;
                return inBrush ? 0.9 : 0.15;
            });
        
        // 更新信息提示
        brushInfo
            .style("display", "block")
            .html(`选中 <strong>${brushedPoints.length}</strong> 个目标`);
        
        // 更新热力图
        updateHeatmapFromBrush(brushedPoints);
    }
    
    // 从刷选更新热力图
    function updateHeatmapFromBrush(points) {
        if (!points || points.length === 0) {
            updateHeatmap();
            return;
        }
        
        // 根据刷选的点重新计算热力图
        const gridSize = spatialData.spatial_grid.grid_size;
        const newGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
        
        points.forEach(p => {
            const gx = Math.min(Math.floor(p.cx * gridSize), gridSize - 1);
            const gy = Math.min(Math.floor(p.cy * gridSize), gridSize - 1);
            newGrid[gy][gx]++;
        });
        
        // 临时替换全局网格并更新
        const originalGrid = spatialData.spatial_grid.global;
        spatialData.spatial_grid.global = newGrid;
        updateHeatmap();
        spatialData.spatial_grid.global = originalGrid;
    }
    
    // 更新散点
    updateScatter = () => {
        const filtered = currentCategory === "all" 
            ? annotations 
            : annotations.filter(d => d.category === currentCategory);
        
        // 限制显示数量以保持性能
        const displayData = filtered.length > 2000 
            ? filtered.filter((_, i) => i % Math.ceil(filtered.length / 2000) === 0)
            : filtered;
        
        dots.selectAll("circle")
            .data(displayData, d => d.id)
            .join(
                enter => enter.append("circle")
                    .attr("r", 3)
                    .attr("opacity", 0.6)
                    .attr("cx", d => xScale(Math.max(d.area, 1e-7)))
                    .attr("cy", d => yScale(Math.max(d.aspect_ratio, 0.1)))
                    .attr("fill", colorByScale),
                update => update
                    .transition().duration(300)
                    .attr("cx", d => xScale(Math.max(d.area, 1e-7)))
                    .attr("cy", d => yScale(Math.max(d.aspect_ratio, 0.1)))
                    .attr("fill", colorByScale),
                exit => exit.remove()
            );
    };
    
    updateScatter();
}

// ========== 类别尺度分布图 (水平堆叠条形图) ==========
function renderDistributionChart() {
    const container = document.getElementById("distribution-container");
    if (!container || !spatialData?.categories) return;
    
    const rect = container.getBoundingClientRect();
    const margin = { top: 10, right: 100, bottom: 30, left: 90 };
    const width = Math.max(rect.width || 400, 300);
    const height = Math.max(rect.height || 400, 300);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    
    // 取 Top 15 类别
    const topCats = spatialData.categories.slice(0, 15);
    
    // 准备堆叠数据
    const stackData = topCats.map(cat => {
        const total = cat.scale_distribution.small + cat.scale_distribution.medium + cat.scale_distribution.large;
        return {
            name: cat.name,
            small: cat.scale_distribution.small / total,
            medium: cat.scale_distribution.medium / total,
            large: cat.scale_distribution.large / total,
            total
        };
    });
    
    const svg = d3.select(container)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Y 轴 (类别)
    const yScale = d3.scaleBand()
        .domain(stackData.map(d => d.name))
        .range([0, innerH])
        .padding(0.25);
    
    // X 轴 (比例)
    const xScale = d3.scaleLinear()
        .domain([0, 1])
        .range([0, innerW]);
    
    // 堆叠生成器
    const stack = d3.stack()
        .keys(["small", "medium", "large"]);
    
    const series = stack(stackData);
    
    const colorMap = {
        small: COLORS.scale.small,
        medium: COLORS.scale.medium,
        large: COLORS.scale.large
    };
    
    // 绘制堆叠条形
    g.selectAll("g.layer")
        .data(series)
        .join("g")
        .attr("class", "layer")
        .attr("fill", d => colorMap[d.key])
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("y", d => yScale(d.data.name))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => xScale(d[1]) - xScale(d[0]))
        .attr("height", yScale.bandwidth())
        .attr("rx", 3);
    
    // Y 轴
    g.append("g")
        .call(d3.axisLeft(yScale).tickSize(0))
        .selectAll("text")
        .attr("font-size", 10);
    
    g.selectAll(".domain").remove();
    
    // X 轴
    g.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(5, "%"))
        .selectAll("text")
        .attr("font-size", 9);
    
    // 图例
    const legendData = [
        { key: "small", label: "小目标", color: COLORS.scale.small },
        { key: "medium", label: "中等", color: COLORS.scale.medium },
        { key: "large", label: "大目标", color: COLORS.scale.large }
    ];
    
    const legend = svg.append("g")
        .attr("transform", `translate(${width - margin.right + 10}, ${margin.top + 10})`);
    
    legendData.forEach((d, i) => {
        const row = legend.append("g")
            .attr("transform", `translate(0, ${i * 22})`);
        
        row.append("rect")
            .attr("width", 14)
            .attr("height", 14)
            .attr("rx", 3)
            .attr("fill", d.color);
        
        row.append("text")
            .attr("x", 20)
            .attr("y", 11)
            .attr("font-size", 10)
            .attr("fill", "#64748b")
            .text(d.label);
    });
}

// ========== 统计摘要 ==========
function renderStats() {
    const container = document.getElementById("stats-container");
    if (!container || !spatialData) return;
    
    const meta = spatialData.meta || {};
    const categories = spatialData.categories || [];
    
    // 计算总体尺度分布
    let totalSmall = 0, totalMedium = 0, totalLarge = 0;
    categories.forEach(cat => {
        totalSmall += cat.scale_distribution.small;
        totalMedium += cat.scale_distribution.medium;
        totalLarge += cat.scale_distribution.large;
    });
    const totalAll = totalSmall + totalMedium + totalLarge;
    
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${(meta.sampled_count || 0).toLocaleString()}</div>
            <div class="stat-label">采样标注数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${categories.length}</div>
            <div class="stat-label">类别数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${meta.grid_resolution || 20}×${meta.grid_resolution || 20}</div>
            <div class="stat-label">空间网格</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:${COLORS.scale.small}">${((totalSmall / totalAll) * 100).toFixed(1)}%</div>
            <div class="stat-label">小目标占比</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:${COLORS.scale.medium}">${((totalMedium / totalAll) * 100).toFixed(1)}%</div>
            <div class="stat-label">中等目标占比</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:${COLORS.scale.large}">${((totalLarge / totalAll) * 100).toFixed(1)}%</div>
            <div class="stat-label">大目标占比</div>
        </div>
    `;
}

// ========== 事件监听 ==========
function setupEventListeners() {
    // 窗口 resize 时重绘（使用 debounce）
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const container = document.getElementById("spatial-content");
            if (container && container.offsetParent !== null) {
                renderSpatialView();
            }
        }, 250);
    });
}

// ========== 自动初始化 ==========
// 当 DOM 加载完成且视图激活时初始化
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndInit);
} else {
    checkAndInit();
}

function checkAndInit() {
    // 监听 Tab 切换
    const spatialNav = document.querySelector('[data-target="spatial-view"]');
    if (spatialNav) {
        spatialNav.addEventListener("click", () => {
            setTimeout(() => {
                initSpatialView();
            }, 50);
        });
    }
    
    // 如果当前就是空间视图，直接初始化
    const spatialView = document.getElementById("spatial-view");
    if (spatialView?.classList.contains("active")) {
        initSpatialView();
    }
}
