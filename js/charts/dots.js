// dots.js — one circle per coffee lot, reused across the score charts.
//
//   "swarm:<score>[:line80|:process]"   beeswarm along one score
//   "production"                        move to origins and yield to production symbols
//   "scatter:<x>:<y>"                   scatterplot of two numbers
//
// Beeswarm technique: d3.forceSimulation with forceX + forceCollide, run
// synchronously (see https://d3js.org/d3-force). We pre-compute each layout
// once per screen size and cache it, so scrolling back and forth is cheap.

import { dur, onResize, showTooltip, hideTooltip, processColor, SCORE_LABELS, pearson } from "../utils.js";

// Domains are fixed so the reader can compare across steps.
const DOMAINS = {
  total: [77.5, 90],
  altitude: [0, 2600],
  default: [6.5, 10], // every 0–10 sub-score
};

export function createDots(container, lots, { legend, mapPoints, cherryLot } = {}) {
  const color = processColor();
  const countsByProcess = d3.rollup(lots, (group) => group.length, (lot) => lot.process);
  const svg = d3.select(container).append("svg").attr("role", "img");
  const gAxes = svg.append("g").attr("class", "axis");
  const gAnno = svg.append("g").attr("class", "annotation");
  const gDots = svg.append("g");

  let W = 0, H = 0, R = 5;
  let state = "swarm:total";
  const cache = new Map();
  const margin = { top: 64, right: 24, bottom: 56, left: 56 };

  const circles = gDots
    .selectAll("circle")
    .data(lots, (d) => d.id)
    .join("circle")
    .attr("data-cherry-source", (d) => d === cherryLot ? "" : null)
    .attr("stroke", "var(--bean)")
    .attr("stroke-width", 0.75)
    .on("pointerenter", (event, d) =>
      showTooltip(event, `<strong>${d.countryLabel}</strong><br>${d.variety}<br>${d.process}<br>Total ${d.total.toFixed(2)}${d.altitude ? `<br>${d.altitude} m` : ""}`))
    .on("pointermove", (event, d) =>
      showTooltip(event, `<strong>${d.countryLabel}</strong><br>${d.variety}<br>${d.process}<br>Total ${d.total.toFixed(2)}${d.altitude ? `<br>${d.altitude} m` : ""}`))
    .on("pointerleave", hideTooltip);
  const cherryDot = circles.filter((d) => d === cherryLot).node();

  // ---- Scales (rebuilt on resize) ------------------------------------------
  const xScale = (key) =>
    d3.scaleLinear(DOMAINS[key] ?? DOMAINS.default, [margin.left + 40, W - margin.right - 70]);
  const yScale = (key) =>
    d3.scaleLinear(DOMAINS[key] ?? DOMAINS.default, [H - margin.bottom, margin.top]);

  // ---- Layouts: return Map(id → {x, y, hidden}) ----------------------------
  function simulate(x, key) {
    const y = H / 2 + 10;
    const nodes = lots.map((d, i) => ({
      id: d.id,
      tx: x(d[key]),
      x: x(d[key]) + (i % 7) - 3,
      y: y + (i % 5) - 2,
    }));
    const sim = d3
      .forceSimulation(nodes)
      .force("x", d3.forceX((n) => n.tx).strength(0.8))
      .force("y", d3.forceY(y).strength(0.08))
      .force("collide", d3.forceCollide(R + 0.7))
      .stop();
    for (let i = 0; i < 240; i++) sim.tick();
    return new Map(nodes.map((n) => [n.id, n]));
  }

  function layout(key) {
    if (cache.has(key)) return cache.get(key);
    const [mode, a, b] = key.split(":");
    let result;

    if (mode === "swarm") {
      result = simulate(xScale(a), a);
    }

    if (mode === "scatter") {
      const x = xScale(a), y = yScale(b);
      result = new Map(
        lots.map((d) => [d.id, d[a] == null ? { x: margin.left, y: H - margin.bottom, hidden: true } : { x: x(d[a]), y: y(d[b]) }])
      );
    }

    cache.set(key, result);
    return result;
  }

  function productionLayout() {
    const { left, top } = svg.node().getBoundingClientRect();
    const points = mapPoints(lots);
    return new Map(lots.map((d, index) => {
      const point = points[index];
      return [d.id, point
        ? { x: point[0] - left, y: point[1] - top }
        : { x: W / 2, y: H / 2 }];
    }));
  }

  // ---- Drawing -------------------------------------------------------------
  function draw(duration) {
    const [mode, a, b] = state.split(":");
    // Layout key ignores style-only suffixes like ":line80".
    const pos = mode === "production" ? productionLayout() : layout(
      mode === "scatter" ? `scatter:${a}:${b}` : `swarm:${a}`
    );
    const t = svg.transition().duration(duration).ease(d3.easeCubicInOut);

    // Dots
    circles
      .attr("r", R)
      .transition(t)
      .delay((d) => (duration ? (d.id % 40) * 6 : 0))
      .attr("cx", (d) => pos.get(d.id).x)
      .attr("cy", (d) => pos.get(d.id).y)
      .attrTween("opacity", function (d) {
        const visible = mode !== "production" && !pos.get(d.id).hidden;
        const opacity = Number(this.getAttribute("opacity") ?? 0);
        const interpolate = d3.interpolateNumber(opacity, visible ? 0.9 : 0);
        // Let the cupping dots travel before the production bubbles take over.
        return mode === "production" ? (t) => interpolate(Math.max(0, (t - 0.45) / 0.55)) : interpolate;
      })
      .attr("fill", (d) => b === "process" && mode === "swarm" ? color(d.process) : "var(--roast)");

    // Axes
    gAxes.selectAll("*").remove();
    if (mode === "swarm" || mode === "scatter") {
      const x = xScale(a);
      gAxes.append("g")
        .attr("transform", `translate(0,${H - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 110))).tickSizeOuter(0));
      gAxes.append("text")
        .attr("x", W - margin.right).attr("y", H - margin.bottom + 42)
        .attr("text-anchor", "end").text(SCORE_LABELS[a] + " →");
    }
    if (mode === "scatter") {
      const y = yScale(b);
      gAxes.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
      gAxes.append("text")
        .attr("x", margin.left).attr("y", margin.top - 18)
        .text("↑ " + SCORE_LABELS[b]);
    }
    gAxes.attr("opacity", 0).transition(t).attr("opacity", 1);

    // Annotations
    gAnno.selectAll("*").remove();
    if (mode === "swarm" && b === "line80") {
      const x = xScale("total")(80);
      gAnno.append("line").attr("x1", x).attr("x2", x).attr("y1", margin.top).attr("y2", H - margin.bottom);
      gAnno.append("text").attr("x", x + 8).attr("y", margin.top + 4).text("80 points: specialty");
    }
    if (mode === "swarm") {
      const [lo, hi] = d3.extent(lots, (d) => d[a]);
      if (lo === hi) {
        const x = xScale(a)(hi);
        const top = d3.min(lots, (d) => pos.get(d.id).y);
        gAnno.append("text").attr("x", x).attr("y", top - 14).attr("text-anchor", "end")
          .text(`All ${lots.length} lots: ${hi.toFixed(1)}`);
      }
    }
    if (mode === "scatter") {
      const valid = lots.filter((d) => d[a] != null && d[b] != null);
      const r = pearson(valid.map((d) => d[a]), valid.map((d) => d[b]));
      const reg = linearFit(valid.map((d) => [d[a], d[b]]));
      const x = xScale(a), y = yScale(b);
      if (reg) {
        const [x0, x1] = DOMAINS[a] ?? DOMAINS.default;
        gAnno.append("line")
          .attr("x1", x(x0)).attr("y1", y(reg(x0)))
          .attr("x2", x(x1)).attr("y2", y(reg(x1)))
          .attr("stroke-dasharray", "6 4");
      }
      gAnno.append("text").attr("x", W - margin.right).attr("y", margin.top - 18).attr("text-anchor", "end")
        .text(`r = ${r.toFixed(2)}, n = ${valid.length}`);
    }
    gAnno.attr("opacity", 0).transition(t).attr("opacity", 1);

    // Legend
    if (legend) {
      const showLegend = mode === "swarm" && b === "process";
      legend.hidden = !showLegend;
      if (showLegend) {
        legend.innerHTML = color.domain()
          .map((g) => `<span><i style="background:${color(g)}"></i>${g} (${countsByProcess.get(g) ?? 0})</span>`)
          .join("");
      }
    }

    svg.attr("data-view", state).attr("aria-label", describe(mode, a, b));
  }

  function describe(mode, a, b) {
    if (mode === "swarm") return `Beeswarm of ${lots.length} coffee lots by ${SCORE_LABELS[a]}`;
    if (mode === "production") return "Cupping lots moving to their origins";
    return `Scatterplot of ${SCORE_LABELS[a]} against ${SCORE_LABELS[b]}`;
  }

  onResize(container, (w, h) => {
    W = w; H = h;
    R = Math.max(2.5, Math.min(6, W / 150));
    svg.attr("viewBox", [0, 0, W, H]);
    cache.clear();
    draw(0);
  });

  return {
    cherryPoint() {
      if (!cherryDot || !W) return null;
      const { left, top, width, height } = cherryDot.getBoundingClientRect();
      return { x: left + width / 2, y: top + height / 2, diameter: width };
    },
    setState(next) {
      if (next === state && W) return;
      state = next;
      if (W) draw(dur(1100));
    },
  };
}

/** Least-squares line through [x, y] pairs; returns a function x → y. */
function linearFit(points) {
  const n = points.length;
  const mx = d3.mean(points, (p) => p[0]), my = d3.mean(points, (p) => p[1]);
  const slope = d3.sum(points, (p) => (p[0] - mx) * (p[1] - my)) / d3.sum(points, (p) => (p[0] - mx) ** 2);
  const intercept = my - slope * mx;
  return n > 1 ? (x) => intercept + slope * x : null;
}
