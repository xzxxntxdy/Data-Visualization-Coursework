// src/js/simple_pose_view.js
// 姿态视图 

import * as d3 from "d3";
import poseData from "../data/pose_stats.json"; 

// ═══════════════════════════════════════════════════════════════════
// 🌌 Design System (设计系统 - 明亮模式)
// ═══════════════════════════════════════════════════════════════════

const THEME = Object.freeze({
    colors: {
        bg: "#ffffff",
        card: "#f8fafc",
        text: { 
            main: "#1e293b",
            sub: "#64748b",
            accent: "#0ea5e9"
        },
        bone: "#334155", // 深炭灰骨架
        grid: "rgba(0,0,0,0.08)"
    },
    stats: { sigmaInner: 1, sigmaOuter: 3 },
    skeleton: { 
        width: 4,       
        opacity: 0.9 
    },
    legend: { x: 20, y: 20, itemHeight: 25 }
});

// ═══════════════════════════════════════════════════════════════════
// 🔧 Event Bus
// ═══════════════════════════════════════════════════════════════════

const EventBus = {
    listeners: {},
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    },
    emit(event, data) {
        if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data));
    }
};

// ═══════════════════════════════════════════════════════════════════
// 🖌️ Styles (CSS)
// ═══════════════════════════════════════════════════════════════════

function getStylesHTML() {
    return `
        .sv2-root { 
            font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif; 
            /* 👇 [修改点] 调整布局空间：顶部减少到10px，底部增加到200px */
            /* padding顺序: 上 右 下 左 */
            padding: 10px 20px 200px 20px; 
            background: ${THEME.colors.bg}; 
            height: 100%; 
            box-sizing: border-box; 
            display: flex; 
            flex-wrap: wrap; 
            gap: 20px; 
            justify-content: center;
            color: ${THEME.colors.text.main};
            overflow-y: auto;
        }
        
        .sv2-card { 
            flex: 1 1 45%; 
            min-width: 550px; 
            background: ${THEME.colors.card}; 
            border: 1px solid rgba(0,0,0,0.05);
            border-radius: 12px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.05); 
            padding: 24px;
            display: flex; 
            flex-direction: column;
            position: relative;
        }

        .sv2-title { font-size: 1.3rem; font-weight: 700; letter-spacing: 1px; color: ${THEME.colors.text.main}; margin-bottom: 6px; }
        .sv2-subtitle { color:${THEME.colors.text.sub}; font-size:0.9em; margin-bottom:10px; }
        .sv2-chart-area { flex-grow: 1; width: 100%; min-height: 650px; position: relative; }

        /* --- 骨架样式 --- */
        .bone { 
            stroke-linecap: round; 
            stroke: ${THEME.colors.bone}; 
            stroke-width: ${THEME.skeleton.width}px;
            opacity: ${THEME.skeleton.opacity};
            filter: none; 
            pointer-events: none;
        }

        /* --- 误差场样式 --- */
        .uncertainty-blob { transition: opacity 0.3s ease; pointer-events: none; }
        .range-boundary { transition: opacity 0.3s ease; fill: none; pointer-events: none; }
        .dimmed-node { opacity: 0.2; }
        
        /* --- 雷达图样式 --- */
        .radar-slice { transition: all 0.3s ease; cursor: pointer; stroke-width:0; opacity: 0.8; }
        .radar-slice:hover { opacity: 1.0; stroke: ${THEME.colors.text.main}; stroke-width: 1px; }
        .radar-slice.dimmed { opacity: 0.15; }
        .radar-slice.focused { opacity: 1; }
        
        .radar-bead { transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor: pointer; }
        .radar-bead.dimmed { opacity: 0.2; filter: none !important; }
        .radar-bead.focused { r: 8px; stroke-width: 3px; stroke: #fff; }

        .radar-label { font-size: 11px; pointer-events: none; font-weight: 600; }
        .radar-grid-line { stroke: ${THEME.colors.grid}; stroke-dasharray: 4 2; pointer-events: none; }

        @keyframes scan-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .radar-scanner { 
            transform-origin: center; 
            animation: scan-rotate 8s linear infinite; 
            pointer-events: none; 
            mix-blend-mode: darken; 
            opacity: 0.5;
        }

        .sv2-tooltip { 
            position: absolute; background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(255,255,255,0.1);
            color: #f1f5f9; padding: 12px; border-radius: 4px; pointer-events: none; opacity: 0; 
            font-size: 13px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            font-family: 'Microsoft YaHei', sans-serif;
        }
        .sv2-tooltip.visible { opacity: 1; }
        
        .legend-text { font-size: 11px; fill: ${THEME.colors.text.sub}; alignment-baseline: middle; }
        .legend-title { font-size: 12px; fill: ${THEME.colors.text.main}; font-weight: bold; alignment-baseline: middle; }
    `;
}

// ═══════════════════════════════════════════════════════════════════
// 🔢 Data Processing (生成高饱和鲜艳色)
// ═══════════════════════════════════════════════════════════════════

function processData() {
    const raw = poseData;
    const nameMapCN = {
        "nose": "鼻子", "left_eye": "左眼", "right_eye": "右眼", "left_ear": "左耳", "right_ear": "右耳",
        "left_shoulder": "左肩", "right_shoulder": "右肩", "left_elbow": "左肘", "right_elbow": "右肘",
        "left_wrist": "左腕", "right_wrist": "右腕", "left_hip": "左髋", "right_hip": "右髋",
        "left_knee": "左膝", "right_knee": "右膝", "left_ankle": "左踝", "right_ankle": "右踝"
    };
    const getBodyPartCN = (name) => {
        const n = name.toLowerCase();
        if (n.includes("nose") || n.includes("eye") || n.includes("ear")) return "头部";
        if (n.includes("shoulder") || n.includes("hip")) return "躯干";
        if (n.includes("left_elbow") || n.includes("left_wrist")) return "左臂";
        if (n.includes("right_elbow") || n.includes("right_wrist")) return "右臂";
        if (n.includes("left_knee") || n.includes("left_ankle")) return "左腿";
        if (n.includes("right_knee") || n.includes("right_ankle")) return "右腿";
        return "躯干";
    };

    const distinctColors = [
        "#ff0055", "#ff7700", "#ffdd00", "#aaff00", "#00ff66", 
        "#00ffcc", "#00ddff", "#0066ff", "#4400ff", "#9900ff", 
        "#ff00ff", "#ff0099", "#ffcccc", "#ccffcc", "#ccccff", 
        "#ffffcc", "#ffcc99"
    ];

    const keypoints = raw.keypoints.map((name, i) => {
        const partCN = getBodyPartCN(name);
        const baseColor = distinctColors[i] || "#ccc";
        
        // 生成 Vivid (高亮鲜艳) 颜色：S=1.0, L=0.45
        const hsl = d3.hsl(baseColor);
        hsl.s = 1.0; 
        hsl.l = 0.45; 
        const vividColor = hsl.formatHex();

        return {
            id: i, nameRaw: name, nameCN: nameMapCN[name] || name, group: partCN,
            color: baseColor,       // 原始色（已不再使用）
            colorVivid: vividColor, // 🌟 全局使用这个高亮鲜艳色
            x: raw.mean_pose[i][0], y: raw.mean_pose[i][1],
            x_std: raw.std_dev_pose[i][0], y_std: raw.std_dev_pose[i][1], vis: raw.visibility_prob[i]
        };
    });

    const skeleton = raw.skeleton.map(link => {
        const s = keypoints[link[0] - 1] || keypoints[link[0]];
        const t = keypoints[link[1] - 1] || keypoints[link[1]];
        if (!s || !t) return null;
        return { source: s, target: t, id: `bone-${s.id}-${t.id}` };
    }).filter(d => d);

    return { keypoints, skeleton };
}

// ═══════════════════════════════════════════════════════════════════
// 🎨 Main Render
// ═══════════════════════════════════════════════════════════════════

function render() {
    const container = document.getElementById("pose-content"); 
    if (!container) return;
    if (!container.shadowRoot) container.attachShadow({ mode: 'open' });
    
    const shadowRoot = container.shadowRoot;
    const { keypoints, skeleton } = processData();

    shadowRoot.innerHTML = `
        <style>${getStylesHTML()}</style>
        <div class="sv2-root">
            <div class="sv2-card">
                <div class="sv2-title">骨架拓扑分析</div>
                <div class="sv2-subtitle">深色骨架 · 高斯概率场 · 1σ/3σ边界</div>
                <div id="view-skeleton" class="sv2-chart-area"></div>
            </div>
            <div class="sv2-card">
                <div class="sv2-title">可见性环形展示</div>
                <div class="sv2-subtitle">各个关节点对比图</div>
                <div id="view-radar" class="sv2-chart-area"></div>
            </div>
            <div id="tooltip" class="sv2-tooltip"></div>
        </div>
    `;

    requestAnimationFrame(() => {
        const tooltip = d3.select(shadowRoot).select("#tooltip");
        renderSkeletonSystem(shadowRoot, keypoints, skeleton, tooltip);
        renderRadarSystem(shadowRoot, keypoints, tooltip);
    });
}

// ═══════════════════════════════════════════════════════════════════
// 🦴 Visualization 1: Skeleton System (🌟 全面使用高亮色)
// ═══════════════════════════════════════════════════════════════════

function renderSkeletonSystem(root, nodes, links, tooltip) {
    const container = root.getElementById("view-skeleton");
    const { w, h } = container.getBoundingClientRect();
    const width = w || 600; const height = 650;
    const svg = d3.select(container).append("svg").attr("viewBox", [0, 0, width, height]).style("overflow", "visible");

    const defs = svg.append("defs");
    nodes.forEach(d => {
        const rg = defs.append("radialGradient").attr("id", `grad-blob-${d.id}`).attr("cx", "50%").attr("cy", "50%").attr("r", "50%"); 
        // 🌟 使用 d.colorVivid
        rg.append("stop").attr("offset", "0%").attr("stop-color", d.colorVivid).attr("stop-opacity", 0.6);
        rg.append("stop").attr("offset", "40%").attr("stop-color", d.colorVivid).attr("stop-opacity", 0.2);
        rg.append("stop").attr("offset", "100%").attr("stop-color", d.colorVivid).attr("stop-opacity", 0);
    });

    drawSkeletonLegend(svg, 20, 20);

    const margin = 60;
    const xScale = d3.scaleLinear().domain([0, 1]).range([margin, width - margin]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([margin, height - margin]);
    const xRatio = width - 2 * margin; const yRatio = height - 2 * margin;

    const gMain = svg.append("g");

    gMain.append("g").attr("class", "layer-bones").selectAll("path").data(links).join("path")
        .attr("class", "bone")
        .attr("d", d => `M${xScale(d.source.x)},${yScale(d.source.y)} L${xScale(d.target.x)},${yScale(d.target.y)}`);

    const rangeGroup = gMain.append("g").attr("class", "layer-ranges");
    
    const blobs = rangeGroup.selectAll(".uncertainty-blob").data(nodes).join("ellipse")
        .attr("class", "uncertainty-blob").attr("cx", d => xScale(d.x)).attr("cy", d => yScale(d.y))
        .attr("rx", d => d.x_std * xRatio * THEME.stats.sigmaOuter).attr("ry", d => d.y_std * yRatio * THEME.stats.sigmaOuter)
        .attr("fill", d => `url(#grad-blob-${d.id})`).style("opacity", 0); 

    const boundaryOuter = rangeGroup.selectAll(".boundary-outer").data(nodes).join("ellipse")
        .attr("class", "range-boundary").attr("cx", d => xScale(d.x)).attr("cy", d => yScale(d.y))
        .attr("rx", d => d.x_std * xRatio * THEME.stats.sigmaOuter).attr("ry", d => d.y_std * yRatio * THEME.stats.sigmaOuter)
        // 🌟 使用 d.colorVivid
        .attr("stroke", d => d.colorVivid).attr("stroke-width", 1).attr("stroke-dasharray", "4 3").attr("opacity", 0.8).style("opacity", 0);

    const boundaryInner = rangeGroup.selectAll(".boundary-inner").data(nodes).join("ellipse")
        .attr("class", "range-boundary").attr("cx", d => xScale(d.x)).attr("cy", d => yScale(d.y))
        .attr("rx", d => d.x_std * xRatio * THEME.stats.sigmaInner).attr("ry", d => d.y_std * yRatio * THEME.stats.sigmaInner)
        // 🌟 使用 d.colorVivid
        .attr("stroke", d => d.colorVivid).attr("stroke-width", 1.5).style("opacity", 0);

    // 🌟 节点使用 d.colorVivid
    const nodesLayer = gMain.append("g").attr("class", "layer-nodes").selectAll("circle").data(nodes).join("circle")
        .attr("class", "keypoint-core").attr("cx", d => xScale(d.x)).attr("cy", d => yScale(d.y))
        .attr("r", 4.5).attr("fill", d => d.colorVivid).attr("stroke", "#fff").attr("stroke-width", 2);

    const delaunay = d3.Delaunay.from(nodes, d => xScale(d.x), d => yScale(d.y));
    const voronoi = delaunay.voronoi([0, 0, width, height]);
    gMain.append("g").attr("class", "layer-voronoi").selectAll("path").data(nodes).join("path")
        .attr("d", (d, i) => voronoi.renderCell(i)).attr("fill", "transparent").style("cursor", "crosshair")
        .on("mouseenter", (e, d) => { handleFocus(d.id); EventBus.emit("active", d.id); showTooltip(e, d, tooltip, root); })
        .on("mouseleave", () => { handleReset(); EventBus.emit("inactive", null); tooltip.classed("visible", false); });

    function handleFocus(id) {
        nodesLayer.classed("dimmed-node", d => d.id !== id);
        nodesLayer.filter(d => d.id === id).transition().duration(100).attr("r", 7).attr("stroke-width", 3);
        blobs.filter(d => d.id === id).style("opacity", 1);
        boundaryOuter.filter(d => d.id === id).style("opacity", 1);
        boundaryInner.filter(d => d.id === id).style("opacity", 1);
    }

    function handleReset() {
        nodesLayer.classed("dimmed-node", false).transition().attr("r", 4.5).attr("stroke-width", 2);
        blobs.style("opacity", 0); boundaryOuter.style("opacity", 0); boundaryInner.style("opacity", 0);
    }
    EventBus.on("active", (id) => handleFocus(id)); EventBus.on("inactive", () => handleReset());
}

function drawSkeletonLegend(svg, x, y) {
    const g = svg.append("g").attr("class", "legend-group").attr("transform", `translate(${x}, ${y})`);
    g.append("text").attr("class", "legend-title").text("图例 / LEGEND").attr("y", 0);
    
    // 生成一个示范用的高亮色
    const vividAccent = d3.hsl(THEME.colors.text.accent);
    vividAccent.s = 1.0; vividAccent.l = 0.45;

    const items = [
        { type: "line", text: "骨架连接 " },
        { type: "circle", text: "关节点" },
        { type: "blob", text: "概率密度场 " },
        { type: "boundary-inner", text: "1σ 核心边界 (68%)" },
        { type: "boundary-outer", text: "3σ 最大边界 (99.7%)" }
    ];

    items.forEach((item, i) => {
        const gy = 25 + i * 25; const row = g.append("g").attr("transform", `translate(0, ${gy})`);
        if (item.type === "line") {
            row.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 20).attr("y2", 0).attr("stroke", THEME.colors.bone).attr("stroke-width", 3);
        } else if (item.type === "circle") {
            // 🌟 图例示范使用高亮色
            row.append("circle").attr("cx", 10).attr("cy", 0).attr("r", 4).attr("stroke", "#fff").attr("stroke-width", 2).attr("fill", vividAccent);
        } else if (item.type === "blob") {
            const gradId = "legend-blob-grad";
            const defs = svg.select("defs");
            if (defs.select(`#${gradId}`).empty()) {
                const lg = defs.append("radialGradient").attr("id", gradId);
                // 🌟 图例渐变使用高亮色
                lg.append("stop").attr("offset", "0%").attr("stop-color", vividAccent).attr("stop-opacity", 0.6);
                lg.append("stop").attr("offset", "100%").attr("stop-color", vividAccent).attr("stop-opacity", 0);
            }
            row.append("circle").attr("cx", 10).attr("cy", 0).attr("r", 8).attr("fill", `url(#${gradId})`);
        } else if (item.type === "boundary-inner") {
            // 🌟 图例边界使用高亮色
            row.append("ellipse").attr("cx", 10).attr("cy", 0).attr("rx", 8).attr("ry", 5).attr("fill", "none").attr("stroke", vividAccent).attr("stroke-width", 1.5);
        } else if (item.type === "boundary-outer") {
            // 🌟 图例边界使用高亮色
            row.append("ellipse").attr("cx", 10).attr("cy", 0).attr("rx", 10).attr("ry", 6).attr("fill", "none").attr("stroke", vividAccent).attr("stroke-width", 1).attr("stroke-dasharray", "4 2");
        }
        row.append("text").attr("class", "legend-text").attr("x", 30).text(item.text);
    });
}

// ═══════════════════════════════════════════════════════════════════
// 🕸️ Visualization 2: Radar System (保持使用高亮色，修复交互)
// ═══════════════════════════════════════════════════════════════════

function renderRadarSystem(root, data, tooltip) {
    const container = root.getElementById("view-radar");
    const { w, h } = container.getBoundingClientRect();
    const width = w || 600; const height = 650;
    const radius = Math.min(width, height) / 2 - 35; const innerRadius = 50;

    const svg = d3.select(container).append("svg").attr("viewBox", [0, 0, width, height]).style("overflow", "visible");

    const defs = svg.append("defs");
    const scanGrad = defs.append("radialGradient").attr("id", "scan-grad");
    scanGrad.append("stop").attr("offset", "0%").attr("stop-color", "transparent");
    scanGrad.append("stop").attr("offset", "100%").attr("stop-color", "rgba(0,0,0,0.1)");

    drawRadarLegend(svg, 20, 20);

    const g = svg.append("g").attr("transform", `translate(${width/2}, ${height/2})`);
    
    const scanner = g.append("g").attr("class", "radar-scanner");
    scanner.append("circle").attr("r", radius).attr("fill", "none").attr("stroke", "rgba(0,0,0,0.1)").attr("stroke-dasharray", "10 10");
    scanner.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", -radius).attr("stroke", "url(#scan-grad)").attr("stroke-width", 2);

    const sortedData = [...data].sort((a, b) => a.id - b.id); 
    const angleScale = d3.scaleBand().range([0, 2 * Math.PI]).domain(sortedData.map(d => d.nameCN)).align(0);
    const rScale = d3.scaleLinear().range([innerRadius, radius]).domain([0, 1]);

    const gridLevels = [0.25, 0.5, 0.75, 1.0];
    g.append("g").attr("class", "grid-lines").selectAll("circle").data(gridLevels).join("circle")
        .attr("class", "radar-grid-line").attr("r", d => rScale(d)).attr("fill", "none");

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(d => rScale(d.vis))
        .startAngle(d => angleScale(d.nameCN)).endAngle(d => angleScale(d.nameCN) + angleScale.bandwidth())
        .padAngle(0.03).padRadius(innerRadius);

    // 👇 [修改点] 修复交互事件传递
    const slices = g.append("g").selectAll("path").data(sortedData).join("path")
        .attr("class", "radar-slice").attr("d", arc)
        .attr("fill", d => d.colorVivid) 
        .on("mouseenter", (e, d) => triggerActive(e, d.id, e.target)) // 传递事件对象 e
        .on("mouseleave", (e, d) => triggerInactive(e.target));

    // 👇 [修改点] 修复交互事件传递
    const beads = g.append("g").attr("class", "radar-beads").selectAll("circle").data(sortedData).join("circle")
        .attr("class", "radar-bead")
        .attr("cx", d => Math.cos(angleScale(d.nameCN) + angleScale.bandwidth() / 2 - Math.PI / 2) * rScale(d.vis))
        .attr("cy", d => Math.sin(angleScale(d.nameCN) + angleScale.bandwidth() / 2 - Math.PI / 2) * rScale(d.vis))
        .attr("r", 5)
        .attr("fill", d => d.colorVivid) 
        .attr("stroke", "#fff").attr("stroke-width", 2) 
        .on("mouseenter", (e, d) => triggerActive(e, d.id, e.target)) // 传递事件对象 e
        .on("mouseleave", (e, d) => triggerInactive(e.target));

    g.append("g").selectAll("text").data(sortedData).join("text").attr("class", "radar-label").attr("text-anchor", "middle")
        .attr("transform", d => {
            const a = angleScale(d.nameCN) + angleScale.bandwidth() / 2 - Math.PI / 2;
            const r = radius + 12; 
            return `translate(${Math.cos(a)*r}, ${Math.sin(a)*r})`;
        })
        .text(d => d.nameCN)
        .style("fill", d => d.colorVivid); 

    // 👇 [修改点] 接收事件对象并正确传递给 showTooltip
    function triggerActive(event, id, target) {
        EventBus.emit("active", id); handleFocus(id);
        const d = sortedData.find(item => item.id === id); 
        // 使用传入的 event 对象，而不是废弃的 d3.event
        showTooltip(event, d, tooltip, root); 
        d3.select(target).classed("focused", true);
    }
    function triggerInactive(target) {
        EventBus.emit("inactive", null); handleReset();
        tooltip.classed("visible", false); d3.select(target).classed("focused", false);
    }
    function handleFocus(id) {
        slices.classed("dimmed", d => d.id !== id).filter(d => d.id === id).classed("focused", true);
        beads.classed("dimmed", d => d.id !== id).filter(d => d.id === id).classed("focused", true);
    }
    function handleReset() {
        slices.classed("dimmed", false).classed("focused", false);
        beads.classed("dimmed", false).classed("focused", false);
    }
    EventBus.on("active", (id) => handleFocus(id)); EventBus.on("inactive", () => handleReset());
}

function drawRadarLegend(svg, x, y) {
    const g = svg.append("g").attr("class", "legend-group").attr("transform", `translate(${x}, ${y})`);
    g.append("text").attr("class", "legend-title").text("图例 / LEGEND").attr("y", 0);
    const items = [{ type: "slice", text: "各关节可见性 (半径长度)" },  { type: "grid", text: "辅助线方便比较" }];
    
    // 生成示范用的高亮色
    const vividAccent = d3.hsl(THEME.colors.text.accent);
    vividAccent.s = 1.0; vividAccent.l = 0.45;

    items.forEach((item, i) => {
        const gy = 25 + i * 25; const row = g.append("g").attr("transform", `translate(0, ${gy})`);
        if (item.type === "slice") row.append("path").attr("d", "M0,0 L20,0 L20,-10 L0,-10 Z").attr("fill", vividAccent).attr("opacity", 0.8);
        else if (item.type === "bead") row.append("circle").attr("cx", 10).attr("cy", -5).attr("r", 4).attr("fill", vividAccent).attr("stroke", "#fff").attr("stroke-width", 2);
        else if (item.type === "grid") row.append("line").attr("x1", 0).attr("y1", -5).attr("x2", 20).attr("y2", -5).attr("stroke", THEME.colors.grid).attr("stroke-dasharray", "4 2");
        row.append("text").attr("class", "legend-text").attr("x", 30).attr("y", -5).text(item.text);
    });
}

function showTooltip(event, d, tooltip, root) {
    const box = root.host.getBoundingClientRect();
    // Tooltip 标题和边框使用高亮色
    tooltip.html(`
        <div style="border-left: 4px solid ${d.colorVivid}; padding-left: 12px;">
            <div style="font-size:1.3em; font-weight:800; color:#f8fafc; margin-bottom:2px;">${d.nameCN}</div>
            <div style="color:${d.colorVivid}; font-size:0.9em; margin-bottom:8px;">所属: ${d.group}</div>
            <div style="display:grid; grid-template-columns: auto auto; gap: 6px 20px; font-size:0.9em; color:#cbd5e1;">
                <span>可见性:</span> <span style="font-family:monospace; color:#f8fafc; font-weight:bold;">${(d.vis * 100).toFixed(0)}%</span>
                <span>X轴偏差(3σ):</span> <span style="font-family:monospace; color:#f8fafc;">${(d.x_std * 3).toFixed(3)}</span>
                <span>Y轴偏差(3σ):</span> <span style="font-family:monospace; color:#f8fafc;">${(d.y_std * 3).toFixed(3)}</span>
            </div>
        </div>
    `).style("left", (event.pageX - box.left + 20) + "px").style("top", (event.pageY - box.top) + "px").classed("visible", true);
}

export function initPoseView() { 
    try { if (!poseData?.keypoints) throw new Error("数据错误"); console.log("🚀 初始化..."); render(); } 
    catch (error) { console.error(error); const el = document.getElementById("pose-content"); if(el) el.innerHTML = `错误: ${error.message}`; }
}
document.addEventListener("DOMContentLoaded", initPoseView);
