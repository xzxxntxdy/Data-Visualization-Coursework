// src/js/semantic_graph.js
import * as d3 from "d3";
import semanticData from "../data/semantic_data.json";

// --- 🎨 核心配色配置 ---
const CHART_COLORS = {
  palette: [
    "#a78bfa",
    "#34d399",
    "#f472b6",
    "#fbbf24",
    "#60a5fa",
    "#22d3ee",
    "#fb7185",
    "#94a3b8",
  ],
  node: {
    locked: "#f43f5e",
    lockedStroke: "#881337",
    neighbor: "#2dd4bf",
    excluded: "#f1f5f9",
    text: "#000000",
  },
  link: {
    active: "#6366f1",
    passive: "#cbd5e1",
  },
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

const LABEL_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

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

let currentZoomK = 1;

const svgRoot = d3
  .select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .style("background-color", "#ffffff");

// --- 关键层级结构 ---
const g = svgRoot.append("g");
// 顺序很重要：Halo(光环) -> Link(线) -> Node(点) -> Label(字) -> Guide(气泡)
const linkGroup = g.append("g").attr("class", "links");
const nodeGroup = g.append("g").attr("class", "nodes");
const labelGroup = g.append("g").attr("class", "labels");

svgRoot.call(
  d3.zoom().scaleExtent([0.2, 4]).on("zoom", (event) => {
    currentZoomK = event.transform.k;
    g.attr("transform", event.transform);
    // 缩放时只更新“轻量样式”，避免全量 refresh 的开销
    refreshGraphStyles(false, true);
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

  const sliderStep = Math.max(
    1,
    Math.round(((maxLink || 1) - (minLink || 0)) / 50)
  );
  defaultThreshold = Math.min(Math.max(minLink || 0, 500), maxLink || 500);
  currentThreshold = defaultThreshold;

  if (thresholdSlider) {
    thresholdSlider.min = minLink || 0;
    thresholdSlider.max = maxLink || 1;
    thresholdSlider.step = sliderStep;
    thresholdSlider.value = defaultThreshold;
    thresholdSlider.addEventListener("input", () => {
      currentThreshold = Number(thresholdSlider.value);
      if (thresholdValue) thresholdValue.textContent = currentThreshold;
      refreshGraphStyles(true);
      updateInfoPanel(lockedNode);
    });
  }
  if (thresholdValue) thresholdValue.textContent = defaultThreshold;

  focusInput?.addEventListener("change", () => focusNodeByName(focusInput.value));

  clearFocusBtn?.addEventListener("click", () => {
    focusInput.value = "";
    lockedNode = null;
    refreshGraphStyles(true);
    updateInfoPanel(null);
    restoreGuideState(); // 🆕 点击清除时，恢复引导
  });

  resetFiltersBtn?.addEventListener("click", () => {
    excludedNodes.clear();
    lockedNode = null;
    currentThreshold = defaultThreshold;
    if (thresholdSlider) thresholdSlider.value = defaultThreshold;
    if (thresholdValue) thresholdValue.textContent = defaultThreshold;
    refreshGraphStyles(true);
    updateInfoPanel(null);
    updateExcludedList();
    restoreGuideState(); // 🆕 点击重置时，恢复引导
  });

  refreshGraphStyles(true);
}

function renderGraph(data) {
  // 1) 比例尺
  const radiusScale = d3
    .scaleSqrt()
    .domain(d3.extent(data.nodes, (d) => d.count || 1))
    .range([20, 65]);

  const strokeScale = d3
    .scaleLinear()
    .domain(d3.extent(data.links, (d) => d.value))
    .range([1, 4]);

  const linkValues = data.links.map((d) => d.value);
  const [minLink, maxLink] = d3.extent(linkValues);

  // 强链接：距离更短；弱链接：距离更长（可读性 + 收敛稳定性）
  const linkDistanceScale = d3
    .scaleLinear()
    .domain([minLink || 0, maxLink || 1])
    .range([240, 110])
    .clamp(true);

  const linkStrengthScale = d3
    .scaleLinear()
    .domain([minLink || 0, maxLink || 1])
    .range([0.05, 0.22])
    .clamp(true);

  const colorScale = d3.scaleOrdinal(CHART_COLORS.palette);
  const nodeRadius = (d) => radiusScale(d.count || 1);

  // Top 节点用于“缩放较小”时保留少量文字，减少视觉拥挤
  const topLabelSet = new Set(
    [...data.nodes]
      .sort((a, b) => d3.descending(a.count || 0, b.count || 0))
      .slice(0, 12)
      .map((d) => d.id)
  );

  // 2) 特殊节点（你原本的 person 引导逻辑保留）
  const personNode = data.nodes.find((n) => n.name === "person");

  // 3) 组层级（Halo 最底层，Guides 最顶层）
  const haloGroup = g.insert("g", ".links").attr("class", "halos");
  const guideGroup = g.append("g").attr("class", "guides");

  let personHalo = null;
  let personGuide = null;

  // 🆕 封装：创建引导 (光环 + 气泡)
  const createGuide = () => {
    if (personHalo || personGuide || !personNode) return;

    personHalo = haloGroup
      .append("circle")
      .datum(personNode)
      .attr("class", "pulsing-node-halo")
      .attr("r", nodeRadius(personNode))
      .attr("fill", "none")
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 4)
      .attr("cx", personNode.x || width / 2)
      .attr("cy", personNode.y || height / 2);

    personGuide = guideGroup
      .append("g")
      .attr("class", "guide-label-group")
      .style("opacity", 0)
      .attr(
        "transform",
        `translate(${personNode.x || width / 2}, ${personNode.y || height / 2})`
      );

    personGuide
      .append("rect")
      .attr("class", "guide-label-bg")
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("width", 86)
      .attr("height", 24)
      .attr("x", 12)
      .attr("y", -32);

    personGuide
      .append("text")
      .attr("class", "guide-label-text")
      .attr("x", 55)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("🔥 关键节点");

    personGuide
      .append("path")
      .attr("d", "M 20 -8 L 26 -2 L 32 -8 Z")
      .attr("fill", "#0f172a");

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

  const getFontSize = (d) => {
    const r = nodeRadius(d);
    const textLength = d.name.length;
    let size = (r * 1.8) / (textLength * 0.75 || 1);
    return Math.min(20, Math.max(9, size));
  };

  // --- Force / Simulation ---
  // focus 模式下的“环形半径”
  const FOCUS_RINGS = {
    r1: Math.min(width, height) * 0.30, // 1-hop
    r2: Math.min(width, height) * 0.46, // 2-hop
    r3: Math.min(width, height) * 0.62, // others
  };

  // hopMapRef 用于在 force strength 回调中读取最新的 hop 信息
  let hopMapRef = new Map();

  const simulation = d3
    .forceSimulation(data.nodes)
    .force(
      "link",
      d3
        .forceLink(data.links)
        .id((d) => d.id)
        .distance((d) => linkDistanceScale(d.value))
        .strength((d) => linkStrengthScale(d.value))
    )
    .force(
      "charge",
      d3.forceManyBody().strength((n) => {
        // overview：统一排斥
        if (!lockedNode) return -520;
        // focus：分层排斥，中心更强，邻居次之
        const h = hopMapRef.get(n.id);
        if (h === 0) return -1100;
        if (h === 1) return -820;
        if (h === 2) return -520;
        return -260;
      })
    )
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force(
      "collide",
      d3
        .forceCollide()
        .radius((d) => nodeRadius(d) + 5)
        .iterations(2)
    )
    // 轻量回拉，避免节点被挤出视野（强度很低，主要起“收束”作用）
    .force("softX", d3.forceX(width / 2).strength(0.02))
    .force("softY", d3.forceY(height / 2).strength(0.02));

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
    .attr(
      "fill",
      (d) => colorScale(d.group || (d.id % CHART_COLORS.palette.length))
    )
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

  // 🆕 暴露给全局：恢复引导状态
  restoreGuideState = () => {
    if (!lockedNode) {
      createGuide();
      simulation.alpha(0.12).restart();
    }
  };

  // --- 交互 ---
  node
    .on("mouseover", (event, d) => {
      tooltip
        .style("display", "block")
        .html(
          `<div style="font-weight:600; margin-bottom:4px;">${d.name}</div><div>出现次数: <span style="font-weight:600">${d.count}</span></div>`
        )
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
      if (!lockedNode) refreshVisibility(false);
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      removeGuide();
      lockNode(d);
    })
    .on("dblclick", (event, d) => {
      event.stopPropagation();
      excludeNode(d);
    });

  svgRoot.on("click", () => {
    removeGuide();
    lockedNode = null;
    focusInput.value = "";
    refreshVisibility(true);
    updateInfoPanel(null);
    restoreGuideState();
  });

  simulation.on("tick", () => {
    // 简单边界钳制（避免节点跑出画布）
    const pad = 24;
    for (const n of data.nodes) {
      if (n.x == null || n.y == null) continue;
      n.x = Math.max(pad, Math.min(width - pad, n.x));
      n.y = Math.max(pad, Math.min(height - pad, n.y));
    }

    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    label.attr("x", (d) => d.x).attr("y", (d) => d.y);

    if (personHalo) {
      personHalo.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    }
    if (personGuide && personNode) {
      personGuide.attr(
        "transform",
        `translate(${personNode.x}, ${personNode.y})`
      );
    }
  });

  refreshVisibility(true);
  updateExcludedList();

  window.addEventListener(
    "resize",
    debounce(() => {
      const rect = container.getBoundingClientRect();
      width = Math.max(rect.width, 520);
      height = Math.max(rect.height, 520);
      svgRoot.attr("width", width).attr("height", height);

      simulation.force("center", d3.forceCenter(width / 2, height / 2));
      simulation.force("softX", d3.forceX(width / 2).strength(0.02));
      simulation.force("softY", d3.forceY(height / 2).strength(0.02));

      // ring 半径随画布变化更新（不重建常量，直接覆盖）
      FOCUS_RINGS.r1 = Math.min(width, height) * 0.30;
      FOCUS_RINGS.r2 = Math.min(width, height) * 0.46;
      FOCUS_RINGS.r3 = Math.min(width, height) * 0.62;

      refreshVisibility(true);
    }, 200)
  );

  // refreshGraphStyles(reheat, zoomOnly)
  refreshGraphStyles = (reheat = false, zoomOnly = false) =>
    refreshVisibility(reheat, zoomOnly);
  focusNodeByName = handleFocus;

  /**
   * refreshVisibility 的职责：
   * - 根据阈值/排除集计算 activeLinks
   * - 更新 simulation.link links（使布局“跟随过滤”）
   * - 更新显示样式（link/node/label）
   * - focus 模式下启用 radial 约束（更符合 star/中心结构的阅读）
   */
  function refreshVisibility(reheat = false, zoomOnly = false) {
    // zoomOnly：缩放触发时只改 label/opacity，不重算 activeLinks（避免频繁 O(E)）
    let activeLinks = null;
    let activeDegree = null;

    if (!zoomOnly) {
      activeLinks = data.links.filter((l) => linkVisible(l));

      // ✅ 性能优化：一遍扫 activeLinks 得到每个节点的 active degree
      activeDegree = new Map();
      for (const l of activeLinks) {
        const s = nodeId(l.source);
        const t = nodeId(l.target);
        activeDegree.set(s, (activeDegree.get(s) || 0) + 1);
        activeDegree.set(t, (activeDegree.get(t) || 0) + 1);
      }

      // 更新 link force 仅保留 activeLinks（降低布局干扰与运算量）
      simulation.force("link").links(activeLinks);

      // focus 布局（环形约束）
      applyFocusLayoutIfNeeded(activeDegree);

      if (reheat) simulation.alpha(0.35).restart();
    }

    // 确保 label / guide 层级在最上
    labelGroup.raise();
    guideGroup.raise();

    // 统计可见（用于 hoverInfo）
    let visibleLinks = 0;
    let visibleNodes = 0;

    link
      .style("display", (l) => {
        const show = linkVisible(l);
        if (show) visibleLinks += 1;
        return show ? null : "none";
      })
      .style("stroke", (l) =>
        isConnectedToLocked(l) ? CHART_COLORS.link.active : CHART_COLORS.link.passive
      )
      .style("stroke-opacity", (l) => {
        if (!linkVisible(l)) return 0;
        if (!lockedNode) return 0.6;
        return isConnectedToLocked(l) ? 1 : 0.08;
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
        if (excludedNodes.has(n.id)) return 0.28;

        // zoom out：降低非重点节点透明度，减少拥挤感
        const zoomFade = currentZoomK < 0.75 ? 0.75 : 1;

        // focus：只强调锁定 + 1-hop
        if (lockedNode) {
          if (n.id === lockedNode.id) return 1;
          if (isNeighbor(lockedNode.id, n.id)) return 1 * zoomFade;
          return 0.16;
        }

        // overview：没有可见边的节点弱化
        const hasEdge =
          zoomOnly
            ? nodeHasVisibleLink(n) // zoomOnly 时不重算 activeDegree
            : (activeDegree?.get(n.id) || 0) > 0;

        return hasEdge ? 1 * zoomFade : 0.42 * zoomFade;
      });

    // Label：缩放小的时候只保留少量 label（Top 节点 + focus 相关）
    label
      .style("display", (d) => (nodeVisible(d) ? null : "none"))
      .attr("font-weight", (d) => (lockedNode && lockedNode.id === d.id ? 700 : 500))
      .attr("fill", "#000000")
      .style("opacity", (d) => {
        if (excludedNodes.has(d.id)) return 0.35;

        if (lockedNode) {
          if (d.id === lockedNode.id) return 1;
          if (isNeighbor(lockedNode.id, d.id)) return currentZoomK < 0.8 ? 0.9 : 1;
          return currentZoomK < 1.0 ? 0 : 0.25;
        }

        // overview：缩放很小只显示 topLabelSet 的文字
        if (currentZoomK < 0.75) return topLabelSet.has(d.id) ? 0.9 : 0;

        return nodeHasVisibleLink(d) ? 1 : 0.6;
      });

    if (hoverInfo)
      hoverInfo.text(
        `可见节点 ${visibleNodes} · 边 ${visibleLinks} · 阈值 ≥ ${currentThreshold}`
      );
  }

  function applyFocusLayoutIfNeeded(activeDegree) {
    // 清掉之前的 focus force（避免堆叠）
    if (!lockedNode) {
      hopMapRef = new Map();
      simulation.force("focusRadial", null);
      // 释放锁定点（若之前锁定过）
      for (const n of data.nodes) {
        if (n.fx != null && n.fy != null && (!lockedNode || n.id !== lockedNode.id)) {
          // drag 结束会置空，这里不强行改动
        }
      }
      return;
    }

    const cx = width / 2;
    const cy = height / 2;

    // 固定中心
    lockedNode.fx = cx;
    lockedNode.fy = cy;

    // BFS 计算 0/1/2 hop（只沿“可见边”）
    const hop = new Map();
    hop.set(lockedNode.id, 0);
    const q = [lockedNode.id];

    while (q.length) {
      const cur = q.shift();
      const h = hop.get(cur);
      if (h >= 2) continue;

      const nbrs = getVisibleNeighbors(cur);
      for (const nb of nbrs) {
        if (excludedNodes.has(nb.id)) continue;
        if (!hop.has(nb.id)) {
          hop.set(nb.id, h + 1);
          q.push(nb.id);
        }
      }
    }

    hopMapRef = hop;

    // “星型/中心结构”聚焦：把不同 hop 的节点放在不同环上
    const radial = d3
      .forceRadial((n) => {
        const h = hop.get(n.id);
        if (h === 0) return 0;
        if (h === 1) return FOCUS_RINGS.r1;
        if (h === 2) return FOCUS_RINGS.r2;

        // 其它节点如果仍有可见边，给一个更外的环；否则更外更淡
        const deg = activeDegree?.get(n.id) || 0;
        return deg > 0 ? FOCUS_RINGS.r3 : FOCUS_RINGS.r3 * 1.15;
      }, cx, cy)
      .strength(0.34);

    simulation.force("focusRadial", radial);
  }
  function releaseFixed(n) {
    if (!n) return;
    n.fx = null;
    n.fy = null;
  }

  function lockNode(d) {
    // ✅ 关键：切换锁定对象时，先释放旧的（否则旧的还在中心）
    if (lockedNode && lockedNode.id !== d.id) {
      releaseFixed(lockedNode);
    }

    lockedNode = d;
    focusInput.value = d.name;
    refreshVisibility(true);
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
        return linkVisible(l) ? (connected ? 0.85 : 0.08) : 0;
      })
      .style("stroke", (l) => {
        const connected = isSame(target.id, l.source) || isSame(target.id, l.target);
        return connected ? CHART_COLORS.link.active : CHART_COLORS.link.passive;
      });

    nodeSel.attr("opacity", (n) =>
      n.id === target.id || isNeighbor(target.id, n.id) ? 1 : 0.2
    );
    labelSel.style("opacity", (n) =>
      n.id === target.id || isNeighbor(target.id, n.id) ? 1 : 0.2
    );
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

  // ✅ 优化：nodeHasVisibleLink 仅使用 neighborMap 做“阈值过滤”检查，
  // 不在 refresh 里对每个节点做全量 data.links.some
  function nodeHasVisibleLink(n) {
    // 若节点没有邻接表，直接 false
    const nbrs = neighborMap.get(n.id);
    if (!nbrs || nbrs.length === 0) return false;

    // neighborMap 已按 value 降序排序：一旦遇到 < threshold，可以提前结束
    for (const e of nbrs) {
      if (excludedNodes.has(e.id)) continue;
      if (e.value >= currentThreshold) return true;
      break;
    }
    return false;
  }

  function isConnectedToLocked(l) {
    if (!lockedNode) return false;
    return isSame(lockedNode.id, l.source) || isSame(lockedNode.id, l.target);
  }

  function handleFocus(value) {
    const target = data.nodes.find(
      (n) => n.name.toLowerCase() === value.trim().toLowerCase()
    );
    if (target) {
      removeGuide();
      lockNode(target);
    } else {
      lockedNode = null;
      refreshVisibility(true);
      updateInfoPanel(null);
      restoreGuideState();
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
    selectionContent.html(
      `<div style="color:var(--text-muted);">点击节点查看共现关系与条件概率</div>`
    );
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
        window.dispatchEvent(new CustomEvent("switch-view", { detail: "bias-view" }));
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
    .html(
      (d) =>
        `<span>${d.name}</span><span style="opacity:0.6; font-size:10px; margin-left:4px;">✕</span>`
    )
    .on("click", (event, d) => {
      excludedNodes.delete(d.id);
      refreshGraphStyles(true);
      updateInfoPanel(lockedNode);
      updateExcludedList();
      restoreGuideState();
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
