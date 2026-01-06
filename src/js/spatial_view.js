// src/js/spatial_view.js
// 空间与尺度分析视图 - COCO-Verse v2.0 专业重构版
// 解决：视觉层级 / 配色统一 / 响应式 / 交互联动 / 叙事链

import * as d3 from "d3";
import spatialData from "../data/spatial_data.json";

// ═══════════════════════════════════════════════════════════════════
// 🎨 统一设计系统 - Design Tokens
// ═══════════════════════════════════════════════════════════════════
const DESIGN = {
    // 主色调 - 深靛蓝系 (Refined Dark Theme)
    colors: {
        primary: "#818cf8",      // Indigo 400
        primaryDark: "#6366f1",  // Indigo 500
        primaryLight: "rgba(129, 140, 248, 0.15)",
        
        // 语义色 - 尺度分类（全局统一 - Pastel/Vibrant mix）
        scale: {
            small: "#34d399",    // Emerald 400
            medium: "#fbbf24",   // Amber 400
            large: "#f472b6",    // Pink 400 (Replacing Red for smoother look)
        },
        
        // 等高线渐变 - Deep Slate to Indigo
        contour: ["#0f172a", "#1e1b4b", "#312e81", "#4f46e5", "#818cf8"],
        
        // 中性色
        text: {
            primary: "#f8fafc",   // Slate 50
            secondary: "#94a3b8", // Slate 400
            muted: "#64748b",     // Slate 500
        },
        bg: {
            page: "transparent",
            card: "rgba(15, 23, 42, 0.6)", // Slate 900 Glass
            subtle: "rgba(255, 255, 255, 0.03)",
        },
        border: "rgba(255, 255, 255, 0.08)",
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
    selectedRegion: null,      // 空间框选区域 {x0, x1, y0, y1}
    selectedScaleRange: null,  // 尺度框选范围 {min, max}
    hoveredCategory: null,     // hover 的类别
    clickedCategory: null,     // 点击选中的类别
    isInitialized: false,
};

// 图表更新函数
const charts = {
    contour: { update: () => {}, resize: () => {} },
    scatter: { update: () => {}, resize: () => {} },
    distribution: { update: () => {}, resize: () => {} },
};

// 空间先验实验数据中的类别列表（用于判断是否有实验数据）
const PRIOR_EXPERIMENT_CATEGORIES = new Set([
    "bed", "elephant", "train", "cat", "airplane", "dog", "giraffe", "dining table",
    "couch", "skateboard", "skis", "cow", "sheep", "sink", "refrigerator", "toothbrush",
    "tie", "surfboard", "toilet", "baseball glove", "sandwich", "pizza", "horse",
    "suitcase", "banana", "oven", "bus", "microwave", "cake", "truck", "stop sign",
    "backpack", "bowl", "hair drier", "handbag", "hot dog", "donut", "bottle", "remote",
    "teddy bear", "boat", "chair", "laptop", "scissors", "bird", "clock", "snowboard",
    "frisbee", "person", "zebra", "mouse", "cup", "parking meter", "carrot", "apple",
    "tv", "motorcycle", "keyboard", "potted plant", "spoon", "vase", "tennis racket",
    "fork", "book", "baseball bat", "knife", "traffic light", "sports ball", "bench",
    "cell phone", "bicycle", "orange", "umbrella", "broccoli", "wine glass", "car", "bear"
]);

// 更新空间先验实验链接按钮
function updatePriorLinkButton() {
    const btn = document.getElementById("sv2-prior-link");
    if (!btn) return;
    
    if (state.clickedCategory && PRIOR_EXPERIMENT_CATEGORIES.has(state.clickedCategory)) {
        btn.style.display = "block";
        btn.textContent = `🔬 查看 "${state.clickedCategory}" 空间先验实验 →`;
        
        // 移除旧的事件监听器
        btn.replaceWith(btn.cloneNode(true));
        const newBtn = document.getElementById("sv2-prior-link");
        
        newBtn.addEventListener("click", () => {
            // 切换到空间先验视图并传递类别
            window.dispatchEvent(new CustomEvent("switch-view", { detail: "spatial-prior-view" }));
            // 延迟触发聚焦事件
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent("spatial-prior-focus", {
                    detail: { category: state.clickedCategory }
                }));
            }, 100);
        });
    } else {
        btn.style.display = "none";
    }
}

// 获取当前过滤后的数据（用于联动）
function getFilteredData() {
    let data = spatialData.annotations;
    
    // 1. 类别过滤
    if (state.currentCategory !== "all") {
        data = data.filter(d => d.category === state.currentCategory);
    }
    
    // 2. 空间区域过滤
    if (state.selectedRegion) {
        const r = state.selectedRegion;
        data = data.filter(d =>
            d.cx >= r.x0 && d.cx <= r.x1 &&
            d.cy >= r.y0 && d.cy <= r.y1
        );
    }
    
    // 3. 点击类别过滤
    if (state.clickedCategory) {
        data = data.filter(d => d.category === state.clickedCategory);
    }
    
    return data;
}

// 计算过滤后数据的尺度分布
function computeFilteredScaleDistribution(data) {
    const scales = { small: 0, medium: 0, large: 0 };
    data.forEach(d => scales[d.scale]++);
    const total = data.length;
    return {
        small: total > 0 ? scales.small / total : 0,
        medium: total > 0 ? scales.medium / total : 0,
        large: total > 0 ? scales.large / total : 0,
        counts: scales,
        total
    };
}

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
    // 布局顺序：空间热力图 → 位置×尺度 → 类别分布（叙事逻辑：空间→尺度→类别）
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
            
            <!-- 主内容区 - 三栏叙事布局：空间→尺度→类别 -->
            <div class="sv2-main">
                <!-- 左：空间密度主图 -->
                <div class="sv2-panel sv2-panel-primary">
                    <div class="sv2-panel-header">
                        <div class="sv2-panel-title">
                            <span class="sv2-panel-number">01</span>
                            空间分布热力图
                        </div>
                        <div class="sv2-category-picker" id="sv2-category-picker">
                            <button class="sv2-picker-btn" id="sv2-picker-btn">
                                <span id="sv2-picker-label">全部类别 (80)</span>
                                <span class="sv2-picker-arrow">▼</span>
                            </button>
                            <div class="sv2-picker-dropdown" id="sv2-picker-dropdown">
                                <div class="sv2-picker-search">
                                    <input type="text" id="sv2-category-search" placeholder="搜索类别..." />
                                </div>
                                <div class="sv2-picker-section">
                                    <div class="sv2-picker-section-title">📌 常用类别</div>
                                    <div class="sv2-picker-chips" id="sv2-quick-cats"></div>
                                </div>
                                <div class="sv2-picker-section">
                                    <div class="sv2-picker-section-title">📁 全部类别 (${spatialData.categories.length})</div>
                                    <div class="sv2-picker-list" id="sv2-all-cats"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="sv2-panel-body">
                        <div id="sv2-contour" class="sv2-chart sv2-chart-main"></div>
                    </div>
                    <div class="sv2-panel-footer">
                        <span class="sv2-hint">🖱️ 拖拽框选区域，联动右侧图表</span>
                        <span class="sv2-hint sv2-region-info" id="sv2-region-info"></span>
                    </div>
                </div>
                
                <!-- 中：位置×尺度散点图（空间→尺度的自然过渡） -->
                <div class="sv2-panel sv2-panel-secondary">
                    <div class="sv2-panel-header">
                        <div class="sv2-panel-title">
                            <span class="sv2-panel-number">02</span>
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
                
                <!-- 右：类别尺度分布（衍生统计） -->
                <div class="sv2-panel sv2-panel-tertiary">
                    <div class="sv2-panel-header">
                        <div class="sv2-panel-title">
                            <span class="sv2-panel-number">03</span>
                            类别尺度分布
                        </div>
                        <span class="sv2-filter-badge" id="sv2-filter-badge" style="display:none">已筛选</span>
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
                        <button id="sv2-prior-link" class="sv2-prior-link-btn" style="display:none;">
                            🔬 查看空间先验实验 →
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Tooltip 容器 -->
            <div id="sv2-tooltip" class="sv2-tooltip"></div>
        </div>
    `;
    
    // 填充类别选择器
    setupCategoryPicker();
    
    // 延迟渲染图表
    requestAnimationFrame(() => {
        renderContourChart();
        renderScatterChart();
        renderDistributionChart();
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
        
        /* 下拉选择器 - 改为高级Picker */
        .sv2-category-picker {
            position: relative;
        }
        .sv2-picker-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 10px;
            font-size: 11px;
            border: 1px solid ${C.border};
            border-radius: ${R.sm}px;
            background: ${C.bg.card};
            color: ${C.text.secondary};
            cursor: pointer;
            transition: all 0.2s;
        }
        .sv2-picker-btn:hover {
            border-color: ${C.primary};
            background: ${C.bg.subtle};
        }
        .sv2-picker-arrow {
            font-size: 8px;
            opacity: 0.6;
        }
        .sv2-picker-dropdown {
            position: absolute;
            top: calc(100% + 4px);
            right: 0;
            width: 280px;
            max-height: 380px;
            background: ${C.bg.card};
            border: 1px solid ${C.border};
            border-radius: ${R.md}px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            z-index: 100;
            display: none;
            overflow: hidden;
        }
        .sv2-picker-dropdown.open {
            display: block;
        }
        .sv2-picker-search {
            padding: ${S.sm}px;
            border-bottom: 1px solid ${C.border};
        }
        .sv2-picker-search input {
            width: 100%;
            padding: 6px 10px;
            font-size: 12px;
            border: 1px solid ${C.border};
            border-radius: ${R.sm}px;
            outline: none;
        }
        .sv2-picker-search input:focus {
            border-color: ${C.primary};
        }
        .sv2-picker-section {
            padding: ${S.sm}px;
        }
        .sv2-picker-section-title {
            font-size: 10px;
            font-weight: 600;
            color: ${C.text.muted};
            margin-bottom: ${S.sm}px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .sv2-picker-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .sv2-picker-chip {
            padding: 4px 10px;
            font-size: 11px;
            background: ${C.bg.subtle};
            border: 1px solid ${C.border};
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.15s;
        }
        .sv2-picker-chip:hover {
            background: ${C.primaryLight};
            border-color: ${C.primary};
            color: ${C.primaryDark};
        }
        .sv2-picker-chip.active {
            background: ${C.primary};
            border-color: ${C.primary};
            color: white;
        }
        .sv2-picker-list {
            max-height: 200px;
            overflow-y: auto;
        }
        .sv2-picker-item {
            display: flex;
            justify-content: space-between;
            padding: 6px 8px;
            font-size: 11px;
            cursor: pointer;
            border-radius: ${R.sm}px;
            transition: background 0.1s;
        }
        .sv2-picker-item:hover {
            background: ${C.bg.subtle};
        }
        .sv2-picker-item.active {
            background: ${C.primaryLight};
            color: ${C.primaryDark};
            font-weight: 500;
        }
        .sv2-picker-item.hidden {
            display: none;
        }
        .sv2-picker-item-count {
            color: ${C.text.muted};
            font-size: 10px;
        }
        
        /* 筛选标记 */
        .sv2-filter-badge {
            padding: 2px 8px;
            font-size: 9px;
            background: ${C.primary};
            color: white;
            border-radius: 10px;
            font-weight: 500;
        }
        .sv2-region-info {
            margin-left: auto;
            color: ${C.primary};
            font-weight: 500;
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
        
        /* 空间先验实验链接按钮 */
        .sv2-prior-link-btn {
            margin-top: 8px;
            padding: 6px 12px;
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 1px solid #fcd34d;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            color: #92400e;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .sv2-prior-link-btn:hover {
            background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
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
// 📊 类别选择器 - 完整80类支持
// ═══════════════════════════════════════════════════════════════════
function setupCategoryPicker() {
    const btn = document.getElementById("sv2-picker-btn");
    const dropdown = document.getElementById("sv2-picker-dropdown");
    const label = document.getElementById("sv2-picker-label");
    const searchInput = document.getElementById("sv2-category-search");
    const quickCats = document.getElementById("sv2-quick-cats");
    const allCats = document.getElementById("sv2-all-cats");
    
    if (!btn || !dropdown) return;
    
    const categories = spatialData.categories;
    const topCategories = categories.slice(0, 6); // 前6个作为常用
    
    // 填充常用类别 Chips
    quickCats.innerHTML = `
        <span class="sv2-picker-chip ${state.currentCategory === 'all' ? 'active' : ''}" data-value="all">全部</span>
        ${topCategories.map(cat => `
            <span class="sv2-picker-chip ${state.currentCategory === cat.name ? 'active' : ''}" 
                  data-value="${cat.name}">${cat.name}</span>
        `).join('')}
    `;
    
    // 填充全部类别列表
    allCats.innerHTML = categories.map(cat => `
        <div class="sv2-picker-item ${state.currentCategory === cat.name ? 'active' : ''}" 
             data-value="${cat.name}" data-search="${cat.name.toLowerCase()}">
            <span>${cat.name}</span>
            <span class="sv2-picker-item-count">${cat.count.toLocaleString()}</span>
        </div>
    `).join('');
    
    // 切换下拉菜单
    btn.addEventListener("click", e => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
        if (dropdown.classList.contains("open")) {
            searchInput.focus();
        }
    });
    
    // 点击外部关闭
    document.addEventListener("click", e => {
        if (!dropdown.contains(e.target) && e.target !== btn) {
            dropdown.classList.remove("open");
        }
    });
    
    // 搜索过滤
    searchInput.addEventListener("input", e => {
        const query = e.target.value.toLowerCase().trim();
        allCats.querySelectorAll(".sv2-picker-item").forEach(item => {
            const match = item.dataset.search.includes(query);
            item.classList.toggle("hidden", !match);
        });
    });
    
    // 选择类别 - Chips
    quickCats.addEventListener("click", e => {
        if (e.target.classList.contains("sv2-picker-chip")) {
            selectCategory(e.target.dataset.value);
            dropdown.classList.remove("open");
        }
    });
    
    // 选择类别 - 列表
    allCats.addEventListener("click", e => {
        const item = e.target.closest(".sv2-picker-item");
        if (item) {
            selectCategory(item.dataset.value);
            dropdown.classList.remove("open");
        }
    });
    
    function selectCategory(value) {
        state.currentCategory = value;
        
        // 更新按钮文本
        if (value === "all") {
            label.textContent = `全部类别 (${categories.length})`;
        } else {
            const cat = categories.find(c => c.name === value);
            label.textContent = `${value} (${cat?.count.toLocaleString() || 0})`;
        }
        
        // 更新激活状态
        quickCats.querySelectorAll(".sv2-picker-chip").forEach(chip => {
            chip.classList.toggle("active", chip.dataset.value === value);
        });
        allCats.querySelectorAll(".sv2-picker-item").forEach(item => {
            item.classList.toggle("active", item.dataset.value === value);
        });
        
        // 触发图表更新
        charts.contour.update();
        charts.scatter.update();
        charts.distribution.update();
    }
}

// ═══════════════════════════════════════════════════════════════════
// 📊 等高线密度图 - 支持类别高亮
// ═══════════════════════════════════════════════════════════════════
function renderContourChart() {
    const container = document.getElementById("sv2-contour");
    if (!container) return;
    
    const C = DESIGN.colors;
    let svg, g, contourLayer, pointsLayer, xScale, yScale, innerW, innerH, brushG;
    
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
        
        // 点层（用于高亮特定类别）
        pointsLayer = g.append("g").attr("class", "sv2-highlight-points");
        
        // Brush
        const brush = d3.brush()
            .extent([[0, 0], [innerW, innerH]])
            .on("brush end", brushHandler);
        
        brushG = g.append("g").attr("class", "sv2-brush").call(brush);
        
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
        const regionInfo = document.getElementById("sv2-region-info");
        const filterBadge = document.getElementById("sv2-filter-badge");
        
        if (!event.selection) {
            state.selectedRegion = null;
            if (regionInfo) regionInfo.textContent = "";
            if (filterBadge) filterBadge.style.display = "none";
        } else {
            const [[x0, y0], [x1, y1]] = event.selection;
            state.selectedRegion = {
                x0: xScale.invert(x0), x1: xScale.invert(x1),
                y0: yScale.invert(y0), y1: yScale.invert(y1),
            };
            
            // 计算选中区域的数据量
            const filtered = getFilteredData();
            if (regionInfo) {
                regionInfo.textContent = `已选中 ${filtered.length} 个目标`;
            }
            if (filterBadge) filterBadge.style.display = "inline";
        }
        
        // 联动更新：散点图 + 类别分布图
        charts.scatter.update();
        charts.distribution.update();
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
        
        // 如果有点击的类别，等高线变淡
        const contourOpacity = state.clickedCategory ? 0.4 : 0.85;
        
        contourLayer.selectAll("path")
            .data(contours)
            .join("path")
            .attr("d", d3.geoPath())
            .attr("fill", d => colorScale(d.value))
            .attr("stroke", d => d3.color(colorScale(d.value))?.darker(0.3))
            .attr("stroke-width", 0.5)
            .transition().duration(200)
            .attr("fill-opacity", contourOpacity);
        
        // 如果有点击的类别，在等高线上叠加该类别的点
        if (state.clickedCategory) {
            const catData = data.filter(d => d.category === state.clickedCategory);
            const sampleRate = Math.max(1, Math.floor(catData.length / 300));
            const sampledCat = catData.filter((_, i) => i % sampleRate === 0);
            
            const scaleColor = d => {
                if (d.scale === "small") return C.scale.small;
                if (d.scale === "medium") return C.scale.medium;
                return C.scale.large;
            };
            
            pointsLayer.selectAll("circle")
                .data(sampledCat, d => d.id)
                .join(
                    enter => enter.append("circle")
                        .attr("r", 0)
                        .attr("cx", d => xScale(d.cx))
                        .attr("cy", d => yScale(d.cy))
                        .attr("fill", scaleColor)
                        .attr("stroke", "white")
                        .attr("stroke-width", 0.8)
                        .call(enter => enter.transition().duration(200)
                            .attr("r", 4)
                            .attr("opacity", 0.85)),
                    update => update,
                    exit => exit.transition().duration(100).attr("r", 0).remove()
                );
        } else {
            pointsLayer.selectAll("circle")
                .transition().duration(100)
                .attr("r", 0)
                .remove();
        }
    }
    
    setup();
    update();
    
    charts.contour = { 
        update, 
        resize: () => { setup(); update(); }
    };
}

// ═══════════════════════════════════════════════════════════════════
// 📊 类别尺度分布图 (水平堆叠条形图) - 支持联动
// ═══════════════════════════════════════════════════════════════════
function renderDistributionChart() {
    const container = document.getElementById("sv2-distribution");
    if (!container) return;
    
    const C = DESIGN.colors;
    const tooltip = document.getElementById("sv2-tooltip");
    
    function render() {
        const rect = container.getBoundingClientRect();
        const margin = { top: 10, right: 10, bottom: 25, left: 70 };
        const width = rect.width || 300;
        const height = rect.height || 280;
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;
        
        container.innerHTML = "";
        
        // 根据是否有空间筛选，计算不同的数据
        const hasFilter = !!state.selectedRegion;
        const filteredData = getFilteredData();
        
        // 按类别聚合筛选后的数据
        const catStats = {};
        filteredData.forEach(d => {
            if (!catStats[d.category]) {
                catStats[d.category] = { small: 0, medium: 0, large: 0 };
            }
            catStats[d.category][d.scale]++;
        });
        
        // 如果有筛选，按筛选后的数量排序；否则用原始Top10
        let displayCats;
        if (hasFilter) {
            displayCats = Object.entries(catStats)
                .map(([name, counts]) => ({
                    name,
                    ...counts,
                    total: counts.small + counts.medium + counts.large
                }))
                .filter(d => d.total > 0)
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);
        } else {
            displayCats = spatialData.categories.slice(0, 10).map(cat => {
                const d = cat.scale_distribution;
                return {
                    name: cat.name,
                    small: d.small,
                    medium: d.medium,
                    large: d.large,
                    total: d.small + d.medium + d.large
                };
            });
        }
        
        // 转换为比例
        const stackData = displayCats.map(cat => {
            const total = cat.total;
            return {
                name: cat.name,
                small: total > 0 ? cat.small / total : 0,
                medium: total > 0 ? cat.medium / total : 0,
                large: total > 0 ? cat.large / total : 0,
                counts: { small: cat.small, medium: cat.medium, large: cat.large },
                total,
            };
        });
        
        const svg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");
        
        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        // 如果没有数据，显示提示
        if (stackData.length === 0) {
            g.append("text")
                .attr("x", innerW / 2)
                .attr("y", innerH / 2)
                .attr("text-anchor", "middle")
                .attr("font-size", 12)
                .attr("fill", C.text.muted)
                .text("选中区域无数据");
            return;
        }
        
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
        const bars = g.selectAll("g.layer")
            .data(series)
            .join("g")
            .attr("class", "layer")
            .attr("fill", d => colorMap[d.key])
            .selectAll("rect")
            .data(d => d.map(item => ({ ...item, key: d.key })))
            .join("rect")
            .attr("y", d => yScale(d.data.name))
            .attr("x", d => xScale(d[0]))
            .attr("width", d => Math.max(0, xScale(d[1]) - xScale(d[0])))
            .attr("height", yScale.bandwidth())
            .attr("rx", 2)
            .attr("opacity", d => {
                // 如果有点击的类别，非选中的变淡
                if (state.clickedCategory && d.data.name !== state.clickedCategory) {
                    return 0.3;
                }
                return 1;
            })
            .style("cursor", "pointer")
            .on("mouseenter", function(event, d) {
                const count = d.data.counts[d.key];
                const pct = (d[1] - d[0]) * 100;
                tooltip.innerHTML = `
                    <div class="sv2-tooltip-title">${d.data.name}</div>
                    <div class="sv2-tooltip-row">
                        <span>${d.key === 'small' ? '小' : d.key === 'medium' ? '中' : '大'}目标</span>
                        <span class="sv2-tooltip-value">${count} (${pct.toFixed(1)}%)</span>
                    </div>
                    <div class="sv2-tooltip-row">
                        <span>总计</span>
                        <span class="sv2-tooltip-value">${d.data.total}</span>
                    </div>
                    ${hasFilter ? '<div style="margin-top:4px;font-size:9px;opacity:0.7">* 仅统计选中区域</div>' : ''}
                `;
                tooltip.style.left = event.pageX + 10 + "px";
                tooltip.style.top = event.pageY - 10 + "px";
                tooltip.classList.add("visible");
            })
            .on("mouseleave", () => {
                tooltip.classList.remove("visible");
            })
            .on("click", function(event, d) {
                event.stopPropagation();
                // 点击类别 → 联动高亮
                if (state.clickedCategory === d.data.name) {
                    state.clickedCategory = null; // 取消选中
                } else {
                    state.clickedCategory = d.data.name;
                }
                // 联动更新
                charts.contour.update();
                charts.scatter.update();
                charts.distribution.update();
                // 更新空间先验实验链接按钮
                updatePriorLinkButton();
            });
        
        // Y轴 - 类别名称可点击
        const yAxis = g.append("g")
            .call(d3.axisLeft(yScale).tickSize(0));
        
        yAxis.selectAll("text")
            .attr("font-size", 10)
            .style("cursor", "pointer")
            .attr("fill", d => state.clickedCategory === d ? C.primary : C.text.primary)
            .attr("font-weight", d => state.clickedCategory === d ? 600 : 400)
            .on("click", function(event, catName) {
                if (state.clickedCategory === catName) {
                    state.clickedCategory = null;
                } else {
                    state.clickedCategory = catName;
                }
                charts.contour.update();
                charts.scatter.update();
                charts.distribution.update();
                // 更新空间先验实验链接按钮
                updatePriorLinkButton();
            });
        
        g.selectAll(".domain").remove();
        
        // X轴
        g.append("g")
            .attr("transform", `translate(0,${innerH})`)
            .call(d3.axisBottom(xScale).ticks(4, "%"))
            .selectAll("text")
            .attr("font-size", 9);
        
        // 显示筛选状态提示
        if (hasFilter) {
            g.append("text")
                .attr("x", innerW)
                .attr("y", -2)
                .attr("text-anchor", "end")
                .attr("font-size", 9)
                .attr("fill", C.primary)
                .text("📍 仅显示选中区域");
        }
    }
    
    render();
    charts.distribution = { update: render, resize: render };
}

// ═══════════════════════════════════════════════════════════════════
// 📊 位置×尺度散点图 - 支持完整联动
// ═══════════════════════════════════════════════════════════════════
function renderScatterChart() {
    const container = document.getElementById("sv2-scatter");
    if (!container) return;
    
    const C = DESIGN.colors;
    const infoEl = document.getElementById("sv2-scatter-info");
    let svg, g, bgLayer, fgLayer, xScale, yScale, innerW, innerH;
    
    function setup() {
        const rect = container.getBoundingClientRect();
        const margin = { top: 10, right: 10, bottom: 30, left: 45 };
        const width = rect.width || 300;
        const height = rect.height || 200;
        innerW = width - margin.left - margin.right;
        innerH = height - margin.top - margin.bottom;
        
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
            .call(d3.axisLeft(yScale).ticks(4, ".0e"))
            .selectAll("text").attr("font-size", 8);
        
        g.append("text")
            .attr("transform", `translate(-35, ${innerH / 2}) rotate(-90)`)
            .attr("text-anchor", "middle")
            .attr("font-size", 9)
            .attr("fill", C.text.muted)
            .text("相对面积");
    }
    
    function update() {
        // 基础数据（类别过滤）
        let baseData = state.currentCategory === "all"
            ? spatialData.annotations
            : spatialData.annotations.filter(d => d.category === state.currentCategory);
        
        // 空间区域过滤
        let highlightData = [];
        if (state.selectedRegion) {
            const r = state.selectedRegion;
            highlightData = baseData.filter(d =>
                d.cx >= r.x0 && d.cx <= r.x1 &&
                d.cy >= r.y0 && d.cy <= r.y1
            );
        }
        
        // 类别点击过滤
        if (state.clickedCategory) {
            if (highlightData.length > 0) {
                highlightData = highlightData.filter(d => d.category === state.clickedCategory);
            } else {
                highlightData = baseData.filter(d => d.category === state.clickedCategory);
            }
        }
        
        // 采样背景
        const sampleRate = Math.max(1, Math.floor(baseData.length / 600));
        const bgData = baseData.filter((_, i) => i % sampleRate === 0);
        
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
            .attr("opacity", 0.2);
        
        // 前景点
        const hasSelection = state.selectedRegion || state.clickedCategory;
        const fgData = hasSelection
            ? highlightData.slice(0, 500)
            : bgData.slice(0, 300);
        
        fgLayer.selectAll("circle")
            .data(fgData, d => d.id)
            .join(
                enter => enter.append("circle")
                    .attr("r", hasSelection ? 3.5 : 2.5)
                    .attr("cx", d => xScale(d.cx))
                    .attr("cy", d => yScale(Math.max(d.area, 1e-7)))
                    .attr("fill", scaleColor)
                    .attr("opacity", hasSelection ? 0.9 : 0.6)
                    .attr("stroke", hasSelection ? "white" : "none")
                    .attr("stroke-width", 0.8),
                update => update
                    .transition().duration(200)
                    .attr("r", hasSelection ? 3.5 : 2.5)
                    .attr("cx", d => xScale(d.cx))
                    .attr("cy", d => yScale(Math.max(d.area, 1e-7)))
                    .attr("fill", scaleColor)
                    .attr("opacity", hasSelection ? 0.9 : 0.6)
                    .attr("stroke", hasSelection ? "white" : "none"),
                exit => exit.transition().duration(100).attr("opacity", 0).remove()
            );
        
        // 更新信息
        if (infoEl) {
            if (hasSelection) {
                const source = [];
                if (state.selectedRegion) source.push("区域选择");
                if (state.clickedCategory) source.push(state.clickedCategory);
                infoEl.textContent = `已选中 ${highlightData.length} 个 (${source.join(" + ")})`;
            } else {
                infoEl.textContent = `显示 ${baseData.length} 个目标`;
            }
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
    
    // 监听 portal:handoff 事件，处理从 Portal 跳转过来的情况
    document.addEventListener("portal:handoff", (e) => {
        if (e.detail?.targetId === "spatial-view") {
            setTimeout(initSpatialView, 100);
        }
    });
    
    const spatialView = document.getElementById("spatial-view");
    if (spatialView?.classList.contains("active")) {
        initSpatialView();
    }
}
