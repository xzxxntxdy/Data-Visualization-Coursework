// src/js/pose_view.js
// 姿态视图 (优化版)

import * as d3 from "d3";
import poseData from "../data/pose_stats.json"; 

// ═══════════════════════════════════════════════════════════════════
// 🔧 Event Bus & Global State
// ═══════════════════════════════════════════════════════════════════

const EventBus = {
    listeners: {},
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        // check the callback exist or not
        if (this.listeners[event].indexOf(callback) >= 0) {
            return;
        }
        this.listeners[event].push(callback);
    },
    emit(event, data) {
        if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data));
    }
};

let focusedKeypointId = null; // 模块级状态，用于跟踪当前聚焦的节点
let activeBodyPart = null; // 当前激活的身体部位
let showSymmetry = false; // 是否显示对称性分析
let showTrajectory = false; // 是否显示轨迹动画

// 身体部位分组配置
const BODY_PARTS = {
    head: { name: '头部', keypoints: [0, 1, 2, 3, 4], color: '#ff0055' },
    torso: { name: '躯干', keypoints: [5, 6, 11, 12], color: '#00ddff' },
    leftArm: { name: '左臂', keypoints: [5, 7, 9], color: '#aaff00' },
    rightArm: { name: '右臂', keypoints: [6, 8, 10], color: '#ff7700' },
    leftLeg: { name: '左腿', keypoints: [11, 13, 15], color: '#00ff66' },
    rightLeg: { name: '右腿', keypoints: [12, 14, 16], color: '#9900ff' }
};

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
// ️ Styles (CSS)
// ═══════════════════════════════════════════════════════════════════

function getStylesHTML() {
    return `
        .sv2-root { 
            font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif; 
            /* 优化布局：使用内边距和 gap 提供更灵活的间距 */
            padding: 20px;
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
        
        /* --- 新增：控制面板样式 --- */
        .control-panel {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            z-index: 100;
            min-width: 180px;
        }
        .control-group {
            margin-bottom: 12px;
        }
        .control-group:last-child {
            margin-bottom: 0;
        }
        .control-label {
            display: block;
            font-size: 11px;
            font-weight: 600;
            color: ${THEME.colors.text.main};
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .control-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        .part-btn {
            padding: 4px 8px;
            font-size: 10px;
            border: 1px solid ${THEME.colors.text.sub};
            background: white;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            color: ${THEME.colors.text.main};
        }
        .part-btn:hover {
            background: ${THEME.colors.text.accent};
            color: white;
            border-color: ${THEME.colors.text.accent};
        }
        .part-btn.active {
            background: ${THEME.colors.text.accent};
            color: white;
            border-color: ${THEME.colors.text.accent};
            font-weight: bold;
        }
        .toggle-btn {
            width: 100%;
            padding: 6px 10px;
            font-size: 11px;
            border: 1px solid ${THEME.colors.text.sub};
            background: white;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            color: ${THEME.colors.text.main};
        }
        .toggle-btn:hover {
            background: ${THEME.colors.card};
        }
        .toggle-btn.active {
            background: ${THEME.colors.text.accent};
            color: white;
            border-color: ${THEME.colors.text.accent};
        }
        
        /* --- 新增：轨迹动画样式 --- */
        .trajectory-path {
            fill: none;
            stroke-width: 2;
            stroke-dasharray: 5 3;
            opacity: 0.6;
            animation: dash 2s linear infinite;
        }
        @keyframes dash {
            to { stroke-dashoffset: -20; }
        }
        
        /* --- 新增：对称性分析样式 --- */
        .symmetry-line {
            stroke: ${THEME.colors.text.accent};
            stroke-width: 1;
            stroke-dasharray: 4 2;
            opacity: 0.5;
        }
        .symmetry-indicator {
            fill: ${THEME.colors.text.accent};
            opacity: 0.3;
        }
        
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
        .axis-label { font-size: 10px; fill: ${THEME.colors.text.sub}; }
        .x-axis .tick line, .y-axis .tick line { stroke: ${THEME.colors.grid}; }
        .x-axis path, .y-axis path { stroke: ${THEME.colors.text.sub}; }

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
        
        /* --- 统计面板动画 --- */
        .stat-item {
            transition: all 0.3s ease;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .stat-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        /* 辅助功能按钮（置顶居中） */
        .assist-toggle {
            position: absolute;
            top: -10px;          /* 稍微向上漂浮 */
            left: 50%;
            transform: translateX(-50%);
            z-index: 120;

            padding: 6px 16px;
            font-size: 12px;
            border-radius: 999px;

            border: 1px solid #94a3b8;
            background: #ffffff;
            cursor: pointer;

            display: inline-flex;
            align-items: center;
            gap: 6px;

            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.15);
            transition: all 0.2s ease;
            color: #1e293b;
        }

        .assist-toggle:hover {
            background: #f1f5f9;
        }

        .assist-toggle.open .chevron {
            transform: rotate(180deg);
        }

        /* 折叠面板动画 */
        .control-panel {
            position: absolute;
            top: 35px;           /* 放在按钮下方 */
            left: 50%;
            transform: translateX(-50%);
            z-index: 110;

            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 10px;

            padding: 14px 16px;
            min-width: 200px;

            transition: opacity 0.25s ease, transform 0.25s ease;
        }

        .control-panel.is-collapsed {
            opacity: 0;
            transform: translate(-50%, -10px);
            pointer-events: none;
        }

        .control-panel.is-open {
            opacity: 1;
            transform: translate(-50%, 0px);
            pointer-events: auto;
        }
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
        hsl.s = 1.0; // 饱和度最大化，确保鲜艳
        hsl.l = 0.45; // 降低亮度，使颜色更深沉
        const vividColor = hsl.formatHex();

        return {
            id: i, nameRaw: name, nameCN: nameMapCN[name] || name, group: partCN,
            color: baseColor,       // 原始色
            colorVivid: vividColor, // 全局使用这个高亮鲜艳色
            x: raw.mean_pose[i][0], 
            y: 1 - raw.mean_pose[i][1],
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
// 🎛️ Control Panel
// ═══════════════════════════════════════════════════════════════════

function initControlPanel(root, keypoints) {
    const partButtons   = root.getElementById('part-buttons');
    const symmetryBtn   = root.getElementById('toggle-symmetry');
    const trajectoryBtn = root.getElementById('toggle-trajectory');

    const panel     = root.getElementById('control-panel');
    const assistBtn = root.getElementById('assist-toggle');

    /* --- 折叠/展开逻辑 --- */
    if (assistBtn && panel) {
        assistBtn.onclick = () => {
            const collapsed = panel.classList.contains("is-collapsed");

            panel.classList.toggle("is-collapsed", !collapsed);
            panel.classList.toggle("is-open", collapsed);
            assistBtn.classList.toggle("open", collapsed);
        };
    }

    /* --- 部位按钮 --- */
    Object.entries(BODY_PARTS).forEach(([key, part]) => {
        const btn = document.createElement('button');
        btn.className = 'part-btn';
        btn.textContent = part.name;

        btn.onclick = () => {
            if (activeBodyPart === key) {
                activeBodyPart = null;
                btn.classList.remove('active');
            } else {
                partButtons.querySelectorAll('.part-btn')
                    .forEach(b => b.classList.remove('active'));
                activeBodyPart = key;
                btn.classList.add('active');
            }
            EventBus.emit('bodyPartChanged', activeBodyPart);
        };

        partButtons.appendChild(btn);
    });

    /* --- 高级功能 --- */
    symmetryBtn.onclick = () => {
        showSymmetry = !showSymmetry;
        symmetryBtn.classList.toggle('active', showSymmetry);
        EventBus.emit('symmetryChanged', showSymmetry);
    };

    trajectoryBtn.onclick = () => {
        showTrajectory = !showTrajectory;
        trajectoryBtn.classList.toggle('active', showTrajectory);
        EventBus.emit('trajectoryChanged', showTrajectory);
    };
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
                <div class="sv2-title">你的姿态</div>
                <div class="sv2-subtitle">
                    节点颜色：各个不同的鲜艳色彩区分不同身体部位 · 头部(红)、躯干(青)、四肢(黄绿橙蓝紫) · 概率椭圆表示位置不确定性
                </div>
                <div id="view-skeleton" class="sv2-chart-area">

                    <!-- ★ 顶部正中间的辅助功能按钮 -->
                    <button class="assist-toggle" id="assist-toggle">
                        辅助功能 <span class="chevron">▾</span>
                    </button>

                    <!-- ★ 折叠面板 -->
                    <div class="control-panel is-collapsed" id="control-panel">
                        <div class="control-group">
                            <label class="control-label">部位高亮</label>
                            <div class="control-buttons" id="part-buttons"></div>
                        </div>

                        <div class="control-group">
                            <label class="control-label">高级功能</label>
                            <button class="toggle-btn" id="toggle-symmetry">对称性分析</button>
                            <button class="toggle-btn" id="toggle-trajectory" style="margin-top:4px;">
                                运动轨迹
                            </button>
                        </div>
                    </div>

                </div>

            </div>
            <div class="sv2-card">
                <div class="sv2-title">可见性环形展示</div>
                <div class="sv2-subtitle">各个节点对比图</div>
                <div id="view-radar" class="sv2-chart-area"></div>
            </div>
            <div class="sv2-card" style="flex: 1 1 100%; max-height: 200px;">
                <div class="sv2-title">统计概览</div>
                <div class="sv2-subtitle">关键点统计信息</div>
                <div id="stats-panel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; padding: 10px 0;"></div>
            </div>
            <div id="tooltip" class="sv2-tooltip"></div>
        </div>
    `;

    requestAnimationFrame(() => {
        const tooltip = d3.select(shadowRoot).select("#tooltip");
        initControlPanel(shadowRoot, keypoints);
        renderSkeletonSystem(shadowRoot, keypoints, skeleton, tooltip);
        renderRadarSystem(shadowRoot, keypoints, tooltip);
        renderStatsPanel(shadowRoot, keypoints);
    });

    // 统一的交互事件处理
    EventBus.on("focus", (id) => {
        focusedKeypointId = id;
        EventBus.emit("updateFocus");
    });
    EventBus.on("blur", () => { focusedKeypointId = null; EventBus.emit("updateFocus"); });
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

    // 👇 [新增点] 添加一个非常淡的网格背景图案
    const gridSize = 20;
    const gridPattern = defs.append("pattern")
        .attr("id", "grid-pattern")
        .attr("width", gridSize)
        .attr("height", gridSize)
        .attr("patternUnits", "userSpaceOnUse");
    gridPattern.append("path")
        .attr("d", `M ${gridSize} 0 L 0 0 0 ${gridSize}`)
        .attr("fill", "none")
        .attr("stroke", "rgba(0,0,0,0.15)") // 使用极淡的颜色
        .attr("stroke-width", 0.5);

    const margin = 60;
    // 等比缩放：保证 x 和 y 的缩放因子相同
    const maxRange = Math.min(width - 2 * margin, height - 2 * margin);
    const xScale = d3.scaleLinear().domain([0, 1]).range([margin + (width - 2 * margin - maxRange) / 2, margin + (width - 2 * margin - maxRange) / 2 + maxRange]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([height - margin - (height - 2 * margin - maxRange) / 2, margin + (height - 2 * margin - maxRange) / 2]);
    const xRatio = maxRange; const yRatio = maxRange;

    // 👇 [新增点] 定义曲线生成器，让骨骼更平滑
    const lineGenerator = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveCatmullRom.alpha(0.5)); // 使用 Catmull-Rom 曲线，提供适度平滑

    const gMain = svg.append("g");

    // 👇 [新增点] 应用网格背景
    gMain.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "url(#grid-pattern)");

    // --- 坐标轴 ---
    const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d3.format(".1f"));
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".1f"));

    gMain.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height - margin})`)
        .call(xAxis)
        .selectAll("text").style("font-size", "10px");

    gMain.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin}, 0)`)
        .call(yAxis)
        .selectAll("text").style("font-size", "10px");

    gMain.append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", height - 15).attr("text-anchor", "middle").text("x轴");
    gMain.append("text").attr("class", "axis-label").attr("transform", `translate(20, ${height / 2}) rotate(-90)`).attr("text-anchor", "middle").text("y轴");
    // --- 结束：坐标轴 ---

    // --- 图例 ---
    const legendGroup = drawSkeletonLegend(svg, 0, 20); // 先在(0, 20)绘制以测量尺寸
    const legendWidth = legendGroup.node().getBBox().width;
    legendGroup.attr("transform", `translate(${width - legendWidth - 150}, -30)`); // 根据宽度移动到右上角

    // 👇 [修改点] 使用曲线并添加入场动画
    const bones = gMain.append("g").attr("class", "layer-bones").selectAll("path").data(links).join("path")
        .attr("class", "bone")
        .attr("d", d => lineGenerator([d.source, d.target]))
        .attr("fill", "none") // 曲线路径不填充
        .attr("stroke-dasharray", function() { const length = this.getTotalLength(); return `${length} ${length}`; })
        .attr("stroke-dashoffset", function() { return this.getTotalLength(); });
    // 骨骼绘制动画
    bones.transition().duration(1000).delay(200).ease(d3.easeSinOut).attr("stroke-dashoffset", 0);

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
        .attr("r", 0) // 初始半径为0，用于入场动画
        .attr("fill", d => d.colorVivid).attr("stroke", "#fff").attr("stroke-width", 2);
    
    // 👇 [新增点] 节点入场动画
    nodesLayer.transition().duration(600).delay((d, i) => i * 20).ease(d3.easeElasticOut.amplitude(1.5))
        .attr("r", 4.5);

    const delaunay = d3.Delaunay.from(nodes, d => xScale(d.x), d => yScale(d.y));
    const voronoi = delaunay.voronoi([0, 0, width, height]);
    gMain.append("g").attr("class", "layer-voronoi").selectAll("path").data(nodes).join("path")
        .attr("d", (d, i) => voronoi.renderCell(i)).attr("fill", "transparent").style("cursor", "crosshair")
        .on("mousemove", (e, d) => {
            // console.log(e, d);
            showTooltip(e, d, tooltip, root);
        })
        .on("mouseenter", (e, d) => { EventBus.emit("focus", d.id); showTooltip(e, d, tooltip, root); })
        .on("mouseleave", () => { EventBus.emit("blur"); tooltip.classed("visible", false); });

    // 添加对称性分析层
    const symmetryLayer = gMain.append("g").attr("class", "layer-symmetry").style("opacity", 0);
    
    // 对称线（左右对称轴）
    const symmetryLine = symmetryLayer.append("line")
        .attr("class", "symmetry-line")
        .attr("x1", xScale(0.5))
        .attr("y1", margin)
        .attr("x2", xScale(0.5))
        .attr("y2", height - margin);
    
    // 对称性连接线
    const symmetryPairs = [
        [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16]
    ];
    const symmetryLinks = symmetryLayer.selectAll(".symmetry-connector")
        .data(symmetryPairs.map(pair => ({
            left: nodes.find(n => n.id === pair[0]),
            right: nodes.find(n => n.id === pair[1])
        })).filter(d => d.left && d.right))
        .join("line")
        .attr("class", "symmetry-line")
        .attr("x1", d => xScale(d.left.x))
        .attr("y1", d => yScale(d.left.y))
        .attr("x2", d => xScale(d.right.x))
        .attr("y2", d => yScale(d.right.y));
    
    // 添加轨迹动画层
    const trajectoryLayer = gMain.append("g").attr("class", "layer-trajectory").style("opacity", 0);
    
    // 为每个关键点创建模拟轨迹（基于标准差）
    const trajectories = nodes.map(d => {
        const points = [];
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const rx = d.x_std * xRatio * 2;
            const ry = d.y_std * yRatio * 2;
            points.push({
                x: xScale(d.x + Math.cos(angle) * rx / xRatio),
                y: yScale(d.y + Math.sin(angle) * ry / yRatio)
            });
        }
        return { keypoint: d, points };
    });
    
    trajectoryLayer.selectAll(".trajectory-path")
        .data(trajectories)
        .join("path")
        .attr("class", "trajectory-path")
        .attr("d", d => {
            const line = d3.line().x(p => p.x).y(p => p.y).curve(d3.curveBasis);
            return line(d.points);
        })
        .attr("stroke", d => d.keypoint.colorVivid);

    function updateFocusStyle() {
        const isFocused = focusedKeypointId !== null;
        const hasActivePart = activeBodyPart !== null;
        
        nodesLayer
            .classed("dimmed-node", d => {
                if (isFocused) return d.id !== focusedKeypointId;
                if (hasActivePart) return !BODY_PARTS[activeBodyPart].keypoints.includes(d.id);
                return false;
            })
            .filter(d => d.id === focusedKeypointId).raise()
            .transition().duration(100).attr("r", 7).attr("stroke-width", 3);
            
        nodesLayer.filter(d => d.id !== focusedKeypointId).transition().attr("r", 4.5).attr("stroke-width", 2);

        blobs.style("opacity", d => d.id === focusedKeypointId ? 1 : 0);
        boundaryOuter.style("opacity", d => d.id === focusedKeypointId ? 1 : 0);
        boundaryInner.style("opacity", d => d.id === focusedKeypointId ? 1 : 0);
        
        // 部位高亮效果
        if (hasActivePart) {
            const activeKeypoints = BODY_PARTS[activeBodyPart].keypoints;
            bones.style("opacity", d => {
                const sourceActive = activeKeypoints.includes(d.source.id);
                const targetActive = activeKeypoints.includes(d.target.id);
                return (sourceActive && targetActive) ? 1 : 0.2;
            });
        } else {
            bones.style("opacity", THEME.skeleton.opacity);
        }
    }
    
    function updateSymmetryDisplay() {
        symmetryLayer.transition().duration(300).style("opacity", showSymmetry ? 1 : 0);
    }
    
    function updateTrajectoryDisplay() {
        trajectoryLayer.transition().duration(300).style("opacity", showTrajectory ? 1 : 0);
    }
    
    EventBus.on("updateFocus", updateFocusStyle);
    EventBus.on("bodyPartChanged", updateFocusStyle);
    EventBus.on("symmetryChanged", updateSymmetryDisplay);
    EventBus.on("trajectoryChanged", updateTrajectoryDisplay);
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

    return g; // 返回图例的g元素，以便获取其尺寸
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
    const grid = g.append("g").attr("class", "grid-lines").selectAll("circle").data(gridLevels).join("circle")
        .attr("class", "radar-grid-line")
        .attr("r", 0) // 初始半径为0
        .attr("fill", "none");
    
    // 👇 [新增点] 网格线入场动画
    grid.transition().duration(800).ease(d3.easeCubicOut)
        .delay((d, i) => i * 100)
        .attr("r", d => rScale(d));

    // --- 辅助线数值标签 ---
    g.append("g").attr("class", "grid-labels").selectAll("text").data(gridLevels).join("text")
        .attr("x", 4).attr("y", d => -rScale(d) - 4)
        .attr("font-size", "10px").attr("fill", THEME.colors.text.sub)
        .text(d => d > 0.25 ? `${d * 100}%` : "")
        .attr("opacity", 0)
        .transition().duration(500).delay(500).attr("opacity", 1);

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(d => rScale(d.vis))
        .startAngle(d => angleScale(d.nameCN)).endAngle(d => angleScale(d.nameCN) + angleScale.bandwidth())
        .padAngle(0.03).padRadius(innerRadius);

    const slices = g.append("g").selectAll("path").data(sortedData).join("path")
        .attr("class", "radar-slice").attr("d", arc)
        .attr("fill", d => d.colorVivid) 
        .on("mouseenter", (e, d) => { EventBus.emit("focus", d.id); showTooltip(e, d, tooltip, root); })
        .on("mouseleave", () => { EventBus.emit("blur"); tooltip.classed("visible", false); });

    // 👇 [新增点] 扇区入场动画
    const arcTween = d3.arc().innerRadius(innerRadius).padAngle(0.03).padRadius(innerRadius)
        .startAngle(d => angleScale(d.nameCN)).endAngle(d => angleScale(d.nameCN) + angleScale.bandwidth());
    slices.transition().duration(1000).ease(d3.easeCubicOut).delay((d, i) => i * 30)
        .attrTween("d", function(d) {
            const i = d3.interpolate(0, d.vis);
            return t => arcTween.outerRadius(rScale(i(t)))(d);
        });

    const beads = g.append("g").attr("class", "radar-beads").selectAll("circle").data(sortedData).join("circle")
        .attr("class", "radar-bead")
        .attr("cx", d => Math.cos(angleScale(d.nameCN) + angleScale.bandwidth() / 2 - Math.PI / 2) * rScale(d.vis))
        .attr("cy", d => Math.sin(angleScale(d.nameCN) + angleScale.bandwidth() / 2 - Math.PI / 2) * rScale(d.vis))
        .attr("r", 5)
        .attr("fill", d => d.colorVivid) 
        .attr("stroke", "#fff").attr("stroke-width", 2) 
        .on("mouseenter", (e, d) => { EventBus.emit("focus", d.id); showTooltip(e, d, tooltip, root); })
        .on("mouseleave", () => { EventBus.emit("blur"); tooltip.classed("visible", false); });
    
    // 👇 [新增点] 珠子入场动画
    beads.transition().duration(1000).ease(d3.easeCubicOut)
        .delay((d, i) => 500 + i * 30) // 在扇区动画后开始
        .attr("cx", d => Math.cos(angleScale(d.nameCN) + angleScale.bandwidth() / 2 - Math.PI / 2) * rScale(d.vis))
        .attr("cy", d => Math.sin(angleScale(d.nameCN) + angleScale.bandwidth() / 2 - Math.PI / 2) * rScale(d.vis));

    g.append("g").selectAll("text").data(sortedData).join("text").attr("class", "radar-label").attr("text-anchor", "middle")
        .attr("opacity", 0) // 初始透明
        .attr("transform", d => {
            const a = angleScale(d.nameCN) + angleScale.bandwidth() / 2 - Math.PI / 2;
            const r = radius + 12; 
            return `translate(${Math.cos(a)*r}, ${Math.sin(a)*r})`;
        })
        .text(d => d.nameCN)
        .style("fill", d => d.colorVivid)
        .transition().duration(800).delay(800).attr("opacity", 1); // 延迟淡入

    function updateFocusStyle() {
        const isFocused = focusedKeypointId !== null;
        const hasActivePart = activeBodyPart !== null;
        
        slices.classed("dimmed", d => {
            if (isFocused) return d.id !== focusedKeypointId;
            if (hasActivePart) return !BODY_PARTS[activeBodyPart].keypoints.includes(d.id);
            return false;
        });
        
        beads.classed("dimmed", d => {
            if (isFocused) return d.id !== focusedKeypointId;
            if (hasActivePart) return !BODY_PARTS[activeBodyPart].keypoints.includes(d.id);
            return false;
        });
        
        if (isFocused) {
            slices.filter(d => d.id === focusedKeypointId).classed("focused", true);
            beads.filter(d => d.id === focusedKeypointId).classed("focused", true).raise();
        } else {
            slices.classed("focused", false);
            beads.classed("focused", false);
        }
    }
    EventBus.on("updateFocus", updateFocusStyle);
    EventBus.on("bodyPartChanged", updateFocusStyle);
}

function drawRadarLegend(svg, x, y) {
    const g = svg.append("g").attr("class", "legend-group").attr("transform", `translate(${x+430}, ${y-50})`);
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

// ═══════════════════════════════════════════════════════════════════
// 📊 Stats Panel
// ═══════════════════════════════════════════════════════════════════

function renderStatsPanel(root, keypoints) {
    const panel = d3.select(root).select("#stats-panel");
    
    // 计算统计数据
    const avgVisibility = d3.mean(keypoints, d => d.vis);
    const maxStdDev = d3.max(keypoints, d => Math.sqrt(d.x_std ** 2 + d.y_std ** 2));
    const minStdDev = d3.min(keypoints, d => Math.sqrt(d.x_std ** 2 + d.y_std ** 2));
    const mostStable = keypoints.reduce((a, b) => 
        (Math.sqrt(a.x_std ** 2 + a.y_std ** 2) < Math.sqrt(b.x_std ** 2 + b.y_std ** 2)) ? a : b
    );
    const leastStable = keypoints.reduce((a, b) => 
        (Math.sqrt(a.x_std ** 2 + a.y_std ** 2) > Math.sqrt(b.x_std ** 2 + b.y_std ** 2)) ? a : b
    );
    
    const stats = [
        { label: "平均可见性", value: `${(avgVisibility * 100).toFixed(1)}%`, color: "#00ddff" },
        { label: "最稳定关键点", value: mostStable.nameCN, color: "#00ff66" },
        { label: "最不稳定关键点", value: leastStable.nameCN, color: "#ff0055" },
        { label: "关键点总数", value: `${keypoints.length} 个`, color: "#9900ff" }
    ];
    
    panel.selectAll(".stat-item")
        .data(stats)
        .join("div")
        .attr("class", "stat-item")
        .style("padding", "8px 12px")
        .style("background", "white")
        .style("border-radius", "6px")
        .style("border-left", d => `3px solid ${d.color}`)
        .html(d => `
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">${d.label}</div>
            <div style="font-size: 16px; font-weight: bold; color: #1e293b;">${d.value}</div>
        `);
    
    // 监听焦点变化更新统计
    function updateStats() {
        if (focusedKeypointId !== null) {
            const focused = keypoints.find(k => k.id === focusedKeypointId);
            if (focused) {
                const stability = Math.sqrt(focused.x_std ** 2 + focused.y_std ** 2);
                const updatedStats = [
                    { label: "选中关键点", value: focused.nameCN, color: focused.colorVivid },
                    { label: "可见性", value: `${(focused.vis * 100).toFixed(1)}%`, color: focused.colorVivid },
                    { label: "稳定性指标", value: stability.toFixed(4), color: focused.colorVivid },
                    { label: "所属部位", value: focused.group, color: focused.colorVivid }
                ];
                
                panel.selectAll(".stat-item")
                    .data(updatedStats)
                    .join("div")
                    .attr("class", "stat-item")
                    .style("padding", "8px 12px")
                    .style("background", "white")
                    .style("border-radius", "6px")
                    .style("border-left", d => `3px solid ${d.color}`)
                    .html(d => `
                        <div style="font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">${d.label}</div>
                        <div style="font-size: 16px; font-weight: bold; color: #1e293b;">${d.value}</div>
                    `);
            }
        } else {
            // 恢复默认统计
            panel.selectAll(".stat-item")
                .data(stats)
                .join("div")
                .attr("class", "stat-item")
                .style("padding", "8px 12px")
                .style("background", "white")
                .style("border-radius", "6px")
                .style("border-left", d => `3px solid ${d.color}`)
                .html(d => `
                    <div style="font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">${d.label}</div>
                    <div style="font-size: 16px; font-weight: bold; color: #1e293b;">${d.value}</div>
                `);
        }
    }
    
    EventBus.on("updateFocus", updateStats);
}

function showTooltip(event, d, tooltip, root) {
    const box = root.host.getBoundingClientRect();
    const stability = Math.sqrt(d.x_std ** 2 + d.y_std ** 2);
    // Tooltip 标题和边框使用高亮色
    tooltip.html(`
        <div style="border-left: 4px solid ${d.colorVivid}; padding-left: 12px;">
            <div style="font-size:1.3em; font-weight:800; color:#f8fafc; margin-bottom:2px;">${d.nameCN}</div>
            <div style="color:${d.colorVivid}; font-size:0.9em; margin-bottom:8px;">所属: ${d.group}</div>
            <div style="display:grid; grid-template-columns: auto auto; gap: 6px 20px; font-size:0.9em; color:#cbd5e1;">
                <span>可见性:</span> <span style="font-family:monospace; color:#f8fafc; font-weight:bold;">${(d.vis * 100).toFixed(0)}%</span>
                <span>平均坐标:</span> <span style="font-family:monospace; color:#f8fafc;">(${(d.x).toFixed(2)}, ${(d.y).toFixed(2)})</span>
                <span>X轴偏差(3σ):</span> <span style="font-family:monospace; color:#f8fafc;">${(d.x_std * 3).toFixed(3)}</span>
                <span>Y轴偏差(3σ):</span> <span style="font-family:monospace; color:#f8fafc;">${(d.y_std * 3).toFixed(3)}</span>
                <span>稳定性:</span> <span style="font-family:monospace; color:#f8fafc;">${stability.toFixed(4)}</span>
            </div>
        </div>
    `).style("left", (event.pageX - box.left + 20) + "px").style("top", (event.pageY - box.top) + "px").classed("visible", true);
}

export function initPoseView() { 
    try { if (!poseData?.keypoints) throw new Error("数据错误"); console.log("🚀 初始化..."); render(); } 
    catch (error) { console.error(error); const el = document.getElementById("pose-content"); if(el) el.innerHTML = `错误: ${error.message}`; }
}
document.addEventListener("DOMContentLoaded", initPoseView);
