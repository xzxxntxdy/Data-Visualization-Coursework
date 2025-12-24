// src/js/semantic_graph.js
import * as d3 from "d3";
import semanticData from "../data/semantic_data.json";

// --- 🎨 核心配色配置 ---
const CHART_COLORS = {
    palette: [
        "#a78bfa", "#34d399", "#f472b6", "#fbbf24", 
        "#60a5fa", "#22d3ee", "#fb7185", "#94a3b8"
    ],
    node: {
        locked: "#f43f5e",
        lockedStroke: "#881337",
        neighbor: "#2dd4bf",
        excluded: "#f1f5f9",
        text: "#000000"
    },
    link: {
        active: "#6366f1",
        passive: "#cbd5e1"
    }
};

const container = document.getElementById("semantic-graph");
const tooltip = d3.select("#tooltip");
const focusInput = document.getElementById("focusInput");
const clearFocusBtn = document.getElementById("clearFocus");
const thresholdSlider = document.getElementById("linkThreshold");
const thresholdValue = document.getElementById("thresholdValue");
const resetFiltersBtn = document.getElementById("resetFilters");
const excludedListEl = d3.select("#excludedList");
const hoverInfo = d3.select("#hoverInfo");
const selectionContent = d3.select("#selectionContent");
const categoryOptions = d3.select("#categoryOptions");

const LABEL_FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

let width = Math.max(container?.clientWidth || 0, 520);
let height = Math.max(container?.clientHeight || 0, 520);
let currentThreshold = Number(thresholdSlider?.value || 0);
let defaultThreshold = currentThreshold;

let lockedNode = null;
const excludedNodes = new Set();
let neighborMap = new Map();
let nodeById = new Map();
let refreshGraphStyles = () => {};
let focusNodeByName = () => {};

// 🆕 新增：全局占位符，用于在外部触发“恢复引导”
let restoreGuideState = () => {}; 

const svgRoot = d3
  .select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .style("background-color", "#ffffff");

// --- 关键层级结构 ---
const g = svgRoot.append("g");
// 顺序很重要：Halo(光环) -> Link(线) -> Node(点) -> Label(字) -> Guide(气泡)
// 我们将在 renderGraph 中动态插入 Halo 和 Guide 组
const linkGroup = g.append("g").attr("class", "links");
const nodeGroup = g.append("g").attr("class", "nodes");
const labelGroup = g.append("g").attr("class", "labels"); 

svgRoot.call(
  d3.zoom().scaleExtent([0.2, 4]).on("zoom", (event) => {
    g.attr("transform", event.transform);
  })
);

tooltip.style("display", "none");

initWithData(semanticData);

function initWithData(data) {
  nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  neighborMap = buildNeighborMap(data.links);
  renderGraph(data);
  initControls(data);
}

function initControls(data) {
  categoryOptions
    .selectAll("option")
    .data([...data.nodes].sort((a, b) => d3.descending(a.count, b.count)))
    .join("option")
    .attr("value", (d) => d.name);

  const linkValues = data.links.map((d) => d.value);
  const [minLink, maxLink] = d3.extent(linkValues);
  const sliderStep = Math.max(1, Math.round(((maxLink || 1) - (minLink || 0)) / 50));
  defaultThreshold = Math.min(Math.max(minLink || 0, 500), maxLink || 500);
  currentThreshold = defaultThreshold;

  if (thresholdSlider) {
      thresholdSlider.min = minLink || 0;
      thresholdSlider.max = maxLink || 1;
      thresholdSlider.step = sliderStep;
      thresholdSlider.value = defaultThreshold;
      thresholdSlider.addEventListener("input", () => {
        currentThreshold = Number(thresholdSlider.value);
        if(thresholdValue) thresholdValue.textContent = currentThreshold;
        refreshGraphStyles(true);
        updateInfoPanel(lockedNode);
      });
  }
  if (thresholdValue) thresholdValue.textContent = defaultThreshold;

  focusInput?.addEventListener("change", () => focusNodeByName(focusInput.value));
  
  clearFocusBtn?.addEventListener("click", () => {
    focusInput.value = "";
    lockedNode = null;
    refreshGraphStyles();
    updateInfoPanel(null);
    restoreGuideState(); // 🆕 点击清除时，恢复引导
  });

  resetFiltersBtn?.addEventListener("click", () => {
    excludedNodes.clear();
    lockedNode = null;
    currentThreshold = defaultThreshold;
    thresholdSlider.value = defaultThreshold;
    thresholdValue.textContent = defaultThreshold;
    refreshGraphStyles(true);
    updateInfoPanel(null);
    updateExcludedList();
    restoreGuideState(); // 🆕 点击重置时，恢复引导
  });

  refreshGraphStyles(true);
}

function renderGraph(data) {
  // 1. 比例尺
  const radiusScale = d3.scaleSqrt()
    .domain(d3.extent(data.nodes, (d) => d.count || 1))
    .range([20, 65]);

  const strokeScale = d3.scaleLinear()
    .domain(d3.extent(data.links, (d) => d.value))
    .range([1, 4]);
  
  const colorScale = d3.scaleOrdinal(CHART_COLORS.palette);
  const nodeRadius = (d) => radiusScale(d.count || 1);

  // 2. 准备特殊节点数据
  const personNode = data.nodes.find(n => n.name === 'person');

  // 3. 补充层级组 (Halo 在最底层，Guides 在最顶层)
  // insert("g", ".links") 意味着把 halos 插在 links 前面（即下方）
  const haloGroup = g.insert("g", ".links").attr("class", "halos");
  const guideGroup = g.append("g").attr("class", "guides");

  // 定义引用
  let personHalo = null;
  let personGuide = null;

  // 🆕 封装：创建引导 (光环 + 气泡)
  const createGuide = () => {
      // 避免重复创建 或 节点不存在
      if (personHalo || personGuide || !personNode) return;

      // 创建光环
      personHalo = haloGroup.append("circle")
          .datum(personNode)
          .attr("class", "pulsing-node-halo")
          .attr("r", nodeRadius(personNode))
          .attr("fill", "none")
          .attr("stroke", "#ef4444") // 警示红
          .attr("stroke-width", 4)
          .attr("cx", personNode.x || width/2) // 初始防抖
          .attr("cy", personNode.y || height/2);

      // 创建气泡组
      personGuide = guideGroup.append("g")
          .attr("class", "guide-label-group")
          .style("opacity", 0) // 初始透明，淡入
          .attr("transform", `translate(${personNode.x || width/2}, ${personNode.y || height/2})`);

      // 气泡背景
      personGuide.append("rect")
          .attr("class", "guide-label-bg")
          .attr("rx", 6)
          .attr("ry", 6)
          .attr("width", 86)
          .attr("height", 24)
          .attr("x", 12)
          .attr("y", -32);

      // 气泡文字
      personGuide.append("text")
          .attr("class", "guide-label-text")
          .attr("x", 55)
          .attr("y", -20)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .text("🔥 关键节点");
          
      // 气泡箭头
      personGuide.append("path")
          .attr("d", "M 20 -8 L 26 -2 L 32 -8 Z")
          .attr("fill", "#0f172a");

      // 执行淡入动画
      personGuide.transition().duration(400).style("opacity", 1);
  };

  // 🆕 封装：移除引导
  const removeGuide = () => {
      if (personHalo) {
          personHalo.remove();
          personHalo = null;
      }
      if (personGuide) {
          personGuide.remove();
          personGuide = null;
      }
  };

  // 🆕 暴露给全局：恢复引导状态
  restoreGuideState = () => {
      if (!lockedNode) { // 只有在没有选中节点时才恢复
          createGuide();
          simulation.restart(); // 触发 tick 更新位置
      }
  };

  const getFontSize = (d) => {
    const r = nodeRadius(d);
    const textLength = d.name.length;
    let size = (r * 1.8) / (textLength * 0.75 || 1);
    return Math.min(20, Math.max(9, size));
  };

  const simulation = d3
    .forceSimulation(data.nodes)
    .force("link", d3.forceLink(data.links).id((d) => d.id).distance(160))
    .force("charge", d3.forceManyBody().strength(-450))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius((d) => nodeRadius(d) + 5).iterations(2));

  // --- 初始化渲染 ---
  const link = linkGroup
    .selectAll("line")
    .data(data.links)
    .join("line")
    .attr("stroke", CHART_COLORS.link.passive)
    .attr("stroke-opacity", 0.6)
    .attr("stroke-linecap", "round")
    .attr("stroke-width", (d) => strokeScale(d.value));

  const node = nodeGroup
    .selectAll("circle")
    .data(data.nodes)
    .join("circle")
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 2)
    .attr("r", (d) => nodeRadius(d))
    .attr("fill", (d) => colorScale(d.group || (d.id % CHART_COLORS.palette.length)))
    .call(drag(simulation));

  const label = labelGroup
    .selectAll("text")
    .data(data.nodes)
    .join("text")
    .attr("pointer-events", "none")
    .attr("font-size", (d) => getFontSize(d))
    .attr("font-weight", 500)
    .attr("font-family", LABEL_FONT_FAMILY)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("fill", "#000000")
    .text((d) => d.name);

  // 初始调用：创建引导
  createGuide();

  // --- 交互 ---
  node
    .on("mouseover", (event, d) => {
      tooltip
        .style("display", "block")
        .html(`<div style="font-weight:600; margin-bottom:4px;">${d.name}</div><div>出现次数: <span style="font-weight:600">${d.count}</span></div>`)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 12}px`);

      hoverInfo.text(`${d.name} · 出现 ${d.count} 次`);
      d3.select(event.currentTarget).style("cursor", "pointer");
      if (!lockedNode) highlightHover(d, link, node, label);
    })
    .on("mouseout", (event) => {
      tooltip.style("display", "none");
      hoverInfo.text("悬停节点查看详情");
      d3.select(event.currentTarget).style("cursor", "default");
      if (!lockedNode) refreshVisibility();
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      removeGuide(); // 交互时移除引导
      lockNode(d);
    })
    .on("dblclick", (event, d) => {
      event.stopPropagation();
      excludeNode(d);
    });

  svgRoot.on("click", () => {
    // 点击空白处
    removeGuide(); // 先移除旧的（避免动画冲突）
    lockedNode = null;
    focusInput.value = "";
    refreshVisibility();
    updateInfoPanel(null);
    restoreGuideState(); // 恢复引导（回到初始状态）
  });

  simulation.on("tick", () => {
      link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      label.attr("x", (d) => d.x).attr("y", (d) => d.y);

      // 更新 Halo 位置
      if (personHalo) {
          personHalo.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      }

      // 更新 Guide 位置
      if (personGuide && personNode) {
          personGuide.attr("transform", `translate(${personNode.x}, ${personNode.y})`);
      }
  });

  refreshVisibility();
  updateExcludedList();

  window.addEventListener(
    "resize",
    debounce(() => {
      const rect = container.getBoundingClientRect();
      width = Math.max(rect.width, 520);
      height = Math.max(rect.height, 520);
      svgRoot.attr("width", width).attr("height", height);
      simulation.force("center", d3.forceCenter(width / 2, height / 2));
      simulation.alpha(0.3).restart();
    }, 200)
  );

  refreshGraphStyles = refreshVisibility;
  focusNodeByName = handleFocus;

  function refreshVisibility(reheat = false) {
    let visibleLinks = 0;
    let visibleNodes = 0;

    const activeLinks = data.links.filter((l) => linkVisible(l));
    simulation.force("link").links(activeLinks);
    if (reheat) {
      simulation.alpha(0.35).restart();
    }

    labelGroup.raise();
    if(guideGroup) guideGroup.raise(); // 确保 Guide 在最上层

    link
      .style("display", (l) => {
        const show = linkVisible(l);
        if (show) visibleLinks += 1;
        return show ? null : "none";
      })
      .style("stroke", (l) => (isConnectedToLocked(l) ? CHART_COLORS.link.active : CHART_COLORS.link.passive))
      .style("stroke-opacity", (l) => {
        if (!linkVisible(l)) return 0;
        if (!lockedNode) return 0.6;
        return isConnectedToLocked(l) ? 1 : 0.1; 
      });

    node
      .style("display", (n) => {
        const show = nodeVisible(n);
        if (show) visibleNodes += 1;
        return show ? null : "none";
      })
      .attr("fill", (n) => {
        if (excludedNodes.has(n.id)) return CHART_COLORS.node.excluded;
        if (lockedNode && lockedNode.id === n.id) return CHART_COLORS.node.locked;
        if (lockedNode && isNeighbor(lockedNode.id, n.id)) return CHART_COLORS.node.neighbor;
        return colorScale(n.group || (n.id % CHART_COLORS.palette.length));
      })
      .attr("stroke", (n) => {
          if (lockedNode && lockedNode.id === n.id) return CHART_COLORS.node.lockedStroke;
          return "#ffffff";
      })
      .attr("stroke-width", (n) => (lockedNode && lockedNode.id === n.id ? 3 : 2))
      .attr("opacity", (n) => {
        if (excludedNodes.has(n.id)) return 0.3;
        return nodeHasVisibleLink(n) ? 1 : 0.45;
      })
      .transition().duration(200).ease(d3.easeQuadOut);

    label
      .style("display", (d) => (nodeVisible(d) ? null : "none"))
      .attr("font-weight", (d) => (lockedNode && lockedNode.id === d.id ? 700 : 500))
      .attr("fill", "#000000")
      .style("opacity", (d) => {
        if (excludedNodes.has(d.id)) return 0.4;
        return nodeHasVisibleLink(d) ? 1 : 0.65;
      });

    if (hoverInfo) hoverInfo.text(`可见节点 ${visibleNodes} · 边 ${visibleLinks} · 阈值 ≥ ${currentThreshold}`);
  }

  function lockNode(d) {
    lockedNode = d;
    focusInput.value = d.name;
    refreshVisibility();
    updateInfoPanel(d);
  }

  function excludeNode(d) {
    excludedNodes.add(d.id);
    if (lockedNode && lockedNode.id === d.id) lockedNode = null;
    updateExcludedList();
    refreshVisibility(true);
    updateInfoPanel(lockedNode);
  }

  function highlightHover(target, linkSel, nodeSel, labelSel) {
    linkSel
      .style("stroke-opacity", (l) => {
        const connected = isSame(target.id, l.source) || isSame(target.id, l.target);
        return linkVisible(l) ? (connected ? 0.8 : 0.1) : 0;
      })
      .style("stroke", (l) => {
        const connected = isSame(target.id, l.source) || isSame(target.id, l.target);
        return connected ? CHART_COLORS.link.active : CHART_COLORS.link.passive;
      });

    nodeSel.attr("opacity", (n) => (n.id === target.id || isNeighbor(target.id, n.id) ? 1 : 0.2));
    labelSel.style("opacity", (n) => (n.id === target.id || isNeighbor(target.id, n.id) ? 1 : 0.2));
  }

  function linkVisible(l) {
    const s = nodeId(l.source);
    const t = nodeId(l.target);
    if (excludedNodes.has(s) || excludedNodes.has(t)) return false;
    return l.value >= currentThreshold;
  }

  function nodeVisible(n) {
    if (excludedNodes.has(n.id)) return false;
    return true;
  }

  function nodeHasVisibleLink(n) {
    return data.links.some((l) => linkVisible(l) && (isSame(n.id, l.source) || isSame(n.id, l.target)));
  }

  function isConnectedToLocked(l) {
    if (!lockedNode) return false;
    return isSame(lockedNode.id, l.source) || isSame(lockedNode.id, l.target);
  }

  function handleFocus(value) {
    const target = data.nodes.find((n) => n.name.toLowerCase() === value.trim().toLowerCase());
    if (target) {
      removeGuide(); // 搜索聚焦时也移除引导
      lockNode(target);
    } else {
      lockedNode = null;
      refreshVisibility();
      updateInfoPanel(null);
      restoreGuideState(); // 搜索为空时恢复引导
    }
  }
}

function buildNeighborMap(links) {
  const map = new Map();
  links.forEach((l) => {
    const s = nodeId(l.source);
    const t = nodeId(l.target);
    if (!map.has(s)) map.set(s, []);
    if (!map.has(t)) map.set(t, []);
    map.get(s).push({ id: t, value: l.value });
    map.get(t).push({ id: s, value: l.value });
  });
  map.forEach((list) => list.sort((a, b) => d3.descending(a.value, b.value)));
  return map;
}

function updateInfoPanel(node) {
  if (!selectionContent.node()) return;

  if (!node) {
    selectionContent.html(`<div style="color:var(--text-muted);">点击节点查看共现关系与条件概率</div>`);
    return;
  }

  const neighbors = getVisibleNeighbors(node.id).slice(0, 8);

  const listHTML = neighbors
    .map((n) => {
      const neighbor = nodeById.get(n.id);
      const name = neighbor?.name || n.id;
      const conditional = node.count ? ((n.value / node.count) * 100).toFixed(1) : 0;
      return `<li style="margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid #f1f5f9;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:600; color:#0f172a">${name}</span>
            <span style="font-size:12px; color:#64748b; background:#f1f5f9; padding:2px 6px; border-radius:4px;">P | ${conditional}%</span>
        </div>
        <div style="font-size:11px; color:#94a3b8; margin-top:2px;">共现 ${n.value} 次</div>
      </li>`;
    })
    .join("");

  // --- 🆕 引导按钮逻辑 ---
  let biasActionHTML = "";
  if (node.name === "person") {
    biasActionHTML = `
      <div style="margin-top:16px; padding-top:12px; border-top:1px dashed #cbd5e1;">
        <div style="font-size:11px; font-weight:700; color:#be123c; margin-bottom:6px; display:flex; align-items:center; gap:4px;">
          <span>⚠️</span> 异常数据分布检测
        </div>
        <div style="font-size:12px; color:#64748b; margin-bottom:8px; line-height:1.4;">
          Person 类别的中心度极高。这种数据分布是否会导致模型产生某种“偏见”？
        </div>
        <button id="btn-link-bias" style="
          width:100%;
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fda4af;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        ">
          查看模型偏差实验 →
        </button>
      </div>
    `;
  }

  selectionContent.html(`
        <div style="padding-bottom:12px; margin-bottom:12px; border-bottom:2px solid ${CHART_COLORS.node.locked};">
            <div style="font-size:16px; font-weight:700; color:#0f172a;">${node.name}</div>
            <div style="font-size:13px; color:#64748b; margin-top:4px;">总出现次数: <strong>${node.count}</strong></div>
        </div>
        <div style="font-size:12px; font-weight:600; color:#64748b; margin-bottom:8px;">Top 共现类别 (条件概率):</div>
        <ul class="info-list" style="padding-left:0; list-style:none; max-height:220px; overflow-y:auto;">
            ${listHTML || "<li style='color:#94a3b8;'>无高频共现</li>"}
        </ul>
        ${biasActionHTML} 
    `);

  if (node.name === "person") {
    const btn = document.getElementById("btn-link-bias");
    if (btn) {
      btn.addEventListener("click", () => {
        window.dispatchEvent(
          new CustomEvent("switch-view", { detail: "bias-view" })
        );
      });
      btn.onmouseenter = () => (btn.style.background = "#ffe4e6");
      btn.onmouseleave = () => (btn.style.background = "#fff1f2");
    }
  }
}

function updateExcludedList() {
  if (!excludedListEl.node()) return;

  const items = Array.from(excludedNodes).map((id) => ({
    id,
    name: nodeById.get(id)?.name || id,
  }));

  if (!items.length) {
    excludedListEl.selectAll("span.excluded-chip").remove();
    excludedListEl.text("无 (双击节点排除)");
    return;
  }

  excludedListEl.text("");

  const chips = excludedListEl.selectAll("span.excluded-chip").data(items, (d) => d.id);

  chips.exit().remove();

  chips
    .enter()
    .append("span")
    .attr("class", "excluded-chip")
    .merge(chips)
    .html((d) => `<span>${d.name}</span><span style="opacity:0.6; font-size:10px; margin-left:4px;">✕</span>`)
    .on("click", (event, d) => {
      excludedNodes.delete(d.id);
      refreshGraphStyles(true);
      updateInfoPanel(lockedNode);
      updateExcludedList();
      restoreGuideState(); // 排除节点时，尝试恢复引导
    });
}

function drag(simulation) {
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
    d3.select(event.currentTarget).style("cursor", "grabbing");
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
    d3.select(event.currentTarget).style("cursor", "pointer");
  }

  return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
}

function nodeId(ref) {
  return typeof ref === "object" ? ref.id : ref;
}

function isSame(id, ref) {
  return id === nodeId(ref);
}

function getVisibleNeighbors(sourceId) {
  return (neighborMap.get(sourceId) || []).filter(
    (n) => !excludedNodes.has(n.id) && n.value >= currentThreshold
  );
}

function isNeighbor(sourceId, targetId) {
  return getVisibleNeighbors(sourceId).some((n) => n.id === targetId);
}

function debounce(fn, wait = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}