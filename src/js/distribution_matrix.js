// src/js/distribution_matrix.js
import * as d3 from "d3";
import semanticData from "../data/semantic_data.json";

const barHost = document.getElementById("freq-bar");
const matrixHost = document.getElementById("cond-matrix");
const reorderBtn = document.getElementById("matrixReorder");
const tooltip = d3.select("#tooltip");

if (barHost && matrixHost) {
  const nodes = semanticData.nodes;
  const links = semanticData.links;
  const idToName = new Map(nodes.map((n) => [n.id, n.name]));
  const countMap = new Map(nodes.map((n) => [n.id, n.count || 0]));

  // 双向共现计数，便于取 P(A|B)
  const pairCounts = new Map();
  links.forEach((l) => {
    pairCounts.set(`${l.source}-${l.target}`, l.value);
    pairCounts.set(`${l.target}-${l.source}`, l.value);
  });

  const prob = (a, b) => {
    if (a === b) return 0; // 对角不强调，便于颜色范围聚焦到共现
    const co = pairCounts.get(`${a}-${b}`) || 0;
    const denom = countMap.get(b) || 1;
    return co / denom;
  };

  const asymScore = (id) => {
    let sum = 0;
    nodes.forEach((n) => {
      if (n.id === id) return;
      sum += Math.abs(prob(id, n.id) - prob(n.id, id));
    });
    return sum / Math.max(nodes.length - 1, 1);
  };

  let currentOrder = "asym";

  const renderBar = () => {
    barHost.innerHTML = "";
    const margin = { top: 20, right: 20, bottom: 130, left: 60 };
    const width = Math.max(barHost.clientWidth || 680, 520);
    const height = Math.max(barHost.clientHeight || 420, 360);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const sorted = [...nodes].sort((a, b) => d3.descending(a.count, b.count));
    const x = d3
      .scaleBand()
      .domain(sorted.map((d) => d.name))
      .range([0, innerWidth])
      .padding(0.15);

    const y = d3
      .scaleLog()
      .domain([1, d3.max(sorted, (d) => d.count + 1) || 1])
      .range([innerHeight, 0])
      .nice();

    const svg = d3
      .select(barHost)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .selectAll("rect")
      .data(sorted)
      .join("rect")
      .attr("x", (d) => x(d.name))
      .attr("y", (d) => y(Math.max(d.count, 1)))
      .attr("width", x.bandwidth())
      .attr("height", (d) => innerHeight - y(Math.max(d.count, 1)))
      .attr("fill", "#6366f1")
      .attr("rx", 3)
      .on("mouseover", (event, d) => {
        tooltip
          .style("display", "block")
          .html(
            `<div style="font-weight:700; margin-bottom:4px;">${d.name}</div><div>出现频次：${d.count}</div>`
          )
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY - 12}px`);
      })
      .on("mouseout", () => tooltip.style("display", "none"));

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickFormat((d) => d).tickSizeOuter(0))
      .selectAll("text")
      .attr("transform", "rotate(60)")
      .style("text-anchor", "start")
      .attr("dx", "0.6em")
      .attr("dy", "0.4em")
      .style("font-size", "10px");

    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(6, "~s")
          .tickFormat((d) => (d >= 1 ? d3.format("~s")(d) : ""))
      )
      .selectAll("text")
      .style("font-size", "11px");

    g.append("text")
      .attr("x", 0)
      .attr("y", -6)
      .attr("fill", "#64748b")
      .attr("font-size", 12)
      .text("对数尺度，以凸显长尾");
  };

  const renderMatrix = (mode = "asym") => {
    matrixHost.innerHTML = "";
    const margin = { top: 160, right: 30, bottom: 30, left: 160 };
    const hostWidth = Math.max(matrixHost.clientWidth || 860, 720);
    const hostHeight = Math.max(matrixHost.clientHeight || 720, 600);
    const n = nodes.length;

    const order = getOrder(mode);
    const index = new Map(order.map((id, i) => [id, i]));

    const cellSize = Math.max(
      6,
      Math.floor(
        Math.min(
          (hostWidth - margin.left - margin.right) / n,
          (hostHeight - margin.top - margin.bottom) / n
        )
      )
    );
    const innerW = cellSize * n;
    const innerH = cellSize * n;
    const width = margin.left + innerW + margin.right;
    const height = margin.top + innerH + margin.bottom;

    const cells = [];
    order.forEach((rowId) => {
      order.forEach((colId) => {
        cells.push({
          row: rowId,
          col: colId,
          value: prob(rowId, colId),
          co: pairCounts.get(`${rowId}-${colId}`) || 0,
        });
      });
    });

    const maxVal =
      d3.max(cells.filter((c) => c.row !== c.col), (d) => d.value) || 1e-6;

    const color = d3
      .scaleSequential()
      .domain([0, maxVal])
      .interpolator(d3.interpolateYlOrRd);

    const svg = d3
      .select(matrixHost)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .selectAll("rect")
      .data(cells)
      .join("rect")
      .attr("x", (d) => index.get(d.col) * cellSize)
      .attr("y", (d) => index.get(d.row) * cellSize)
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("fill", (d) => (d.value > 0 ? color(d.value) : "var(--heat-start)"))
      .on("mouseover", (event, d) => {
        const p = (d.value * 100).toFixed(2);
        const bCount = countMap.get(d.col) || 1;
        tooltip
          .style("display", "block")
          .html(
            `<div style="font-weight:700; margin-bottom:4px;">P(${idToName.get(
              d.row
            )} | ${idToName.get(d.col)})</div><div>概率：${p}%</div><div>共现次数：${
              d.co
            }</div><div>B出现次数：${bCount}</div>`
          )
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY - 12}px`);
      })
      .on("mouseout", () => tooltip.style("display", "none"));

    // 行标签
    g.append("g")
      .selectAll("text.row-label")
      .data(order)
      .join("text")
      .attr("class", "row-label")
      .attr("x", -8)
      .attr("y", (id) => index.get(id) * cellSize + cellSize / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-size", 10)
      .attr("fill", "#1e293b")
      .text((id) => idToName.get(id));

    // 列标签
    g.append("g")
      .selectAll("text.col-label")
      .data(order)
      .join("text")
      .attr("class", "col-label")
      .attr("transform", (id) => {
        const x = index.get(id) * cellSize + cellSize / 2;
        return `translate(${x}, -6) rotate(-60)`;
      })
      .attr("text-anchor", "end")
      .attr("font-size", 10)
      .attr("fill", "#1e293b")
      .text((id) => idToName.get(id));

    // 颜色图例
    const legendWidth = 120;
    const legendHeight = 10;
    const legend = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top - 40})`);

    const gradId = "matrix-grad";
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", gradId).attr("x1", "0%").attr("x2", "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", color(0));
    grad.append("stop").attr("offset", "100%").attr("stop-color", color(maxVal));

    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", `url(#${gradId})`)
      .attr("rx", 4);

    const legendScale = d3.scaleLinear().domain([0, maxVal]).range([0, legendWidth]);
    const legendAxis = d3.axisBottom(legendScale).ticks(4).tickFormat(d3.format(".0%"));
    legend
      .append("g")
      .attr("transform", `translate(0, ${legendHeight})`)
      .call(legendAxis)
      .selectAll("text")
      .style("font-size", "10px");

    legend
      .append("text")
      .attr("x", 0)
      .attr("y", -6)
      .attr("fill", "#64748b")
      .attr("font-size", 11)
      .text("P(A | B)");
  };

  const getOrder = (mode) => {
    if (mode === "asym") {
      return [...nodes]
        .map((n) => ({ id: n.id, score: asymScore(n.id) }))
        .sort((a, b) => d3.descending(a.score, b.score))
        .map((d) => d.id);
    }
    // 默认按频次
    return [...nodes].sort((a, b) => d3.descending(a.count, b.count)).map((d) => d.id);
  };

  const toggleOrder = () => {
    currentOrder = currentOrder === "asym" ? "count" : "asym";
    if (reorderBtn) {
      reorderBtn.textContent = currentOrder === "asym" ? "按频次排序" : "按不对称性排序";
    }
    renderMatrix(currentOrder);
  };

  const wireModals = () => {
    const modalTriggers = document.querySelectorAll(".icon-badge img");
    const closeBtns = document.querySelectorAll(".info-close");
    modalTriggers.forEach((el) => {
      el.addEventListener("click", () => {
        const target = el.getAttribute("data-modal");
        const modal = document.getElementById(target);
        if (modal) modal.classList.add("active");
      });
    });
    closeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-close");
        const modal = document.getElementById(target);
        if (modal) modal.classList.remove("active");
      });
    });
    document.querySelectorAll(".info-modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("active");
      });
    });
  };

  renderBar();
  renderMatrix(currentOrder);
  wireModals();

  if (reorderBtn) {
    reorderBtn.textContent = "按频次排序";
    reorderBtn.addEventListener("click", toggleOrder);
  }
  window.addEventListener(
    "resize",
    debounce(() => {
      renderBar();
      renderMatrix(currentOrder);
    }, 250)
  );
}

function debounce(fn, wait = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
