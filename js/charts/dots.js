// dots.js — one circle per coffee lot. The SAME circles move between three
// layouts, which is what makes the story feel continuous:
//
//   "swarm:<score>[:line80|:process]"   beeswarm along one score
//   "map[:<Country>]"                   clustered on each origin country
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

// Hawaii is part of the USA polygon; put its dots on the islands instead.
const POINT_OVERRIDES = { "Hawaii (USA)": [-155.5, 19.6] };

export function createDots(container, lots, world, { legend } = {}) {
  const color = processColor();
  const svg = d3.select(container).append("svg").attr("role", "img");
  const gLand = svg.append("g").attr("opacity", 0);
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
    .attr("stroke", "var(--bean)")
    .attr("stroke-width", 0.75)
    .on("pointerenter", (event, d) =>
      showTooltip(event, `<strong>${d.countryLabel}</strong><br>${d.variety}<br>${d.process}<br>Total ${d.total.toFixed(2)}${d.altitude ? `<br>${d.altitude} m` : ""}`))
    .on("pointermove", (event, d) =>
      showTooltip(event, `<strong>${d.countryLabel}</strong><br>${d.variety}<br>${d.process}<br>Total ${d.total.toFixed(2)}${d.altitude ? `<br>${d.altitude} m` : ""}`))
    .on("pointerleave", hideTooltip);

  // ---- Scales & projection (rebuilt on resize) ----------------------------
  const xScale = (key) =>
    d3.scaleLinear(DOMAINS[key] ?? DOMAINS.default, [margin.left + 40, W - margin.right - 70]);
  const yScale = (key) =>
    d3.scaleLinear(DOMAINS[key] ?? DOMAINS.default, [H - margin.bottom, margin.top]);
  let projection, geoPath;

  function buildMap() {
    projection = d3.geoNaturalEarth1().fitExtent(
      [[margin.left / 2, margin.top], [W - margin.right, H - margin.bottom]],
      { type: "MultiPoint", coordinates: [[-160, -30], [132, 33]] } // the coffee belt
    );
    geoPath = d3.geoPath(projection);
    const inData = new Set(lots.map((d) => d.country));
    gLand
      .selectAll("path")
      .data(world.features)
      .join("path")
      .attr("d", geoPath)
      .attr("fill", (f) => (inData.has(f.properties.name) ? "var(--parchment-deep)" : "var(--parchment)"))
      .attr("stroke", "var(--bean)")
      .attr("stroke-width", 0.6);
  }

  // ---- Layouts: return Map(id → {x, y, hidden}) ----------------------------
  // targets(d) → {tx, ty, hidden?}. Strong x-pull + weak y-pull = beeswarm;
  // equal pulls = round clusters (used for the map).
  function simulate(targets, { xPull = 0.8, yPull = 0.08 } = {}) {
    const nodes = lots.map((d) => ({ id: d.id, ...targets(d) }));
    const live = nodes.filter((n) => !n.hidden);
    live.forEach((n, i) => { n.x = n.tx + (i % 7) - 3; n.y = n.ty + (i % 5) - 2; });
    const sim = d3
      .forceSimulation(live)
      .force("x", d3.forceX((n) => n.tx).strength(xPull))
      .force("y", d3.forceY((n) => n.ty).strength(yPull))
      .force("collide", d3.forceCollide(R + 0.7))
      .stop();
    for (let i = 0; i < 240; i++) sim.tick();
    return new Map(nodes.map((n) => [n.id, n.hidden ? { x: n.tx, y: n.ty, hidden: true } : n]));
  }

  function layout(key) {
    if (cache.has(key)) return cache.get(key);
    const [mode, a, b] = key.split(":");
    let result;

    if (mode === "swarm") {
      const x = xScale(a);
      result = simulate((d) => ({ tx: x(d[a]), ty: H / 2 + 10 }));
    }

    if (mode === "map") {
      const centroids = new Map(world.features.map((f) => [f.properties.name, projection(d3.geoCentroid(f))]));
      result = simulate((d) => {
        const p = POINT_OVERRIDES[d.countryLabel] ? projection(POINT_OVERRIDES[d.countryLabel]) : centroids.get(d.country);
        return p ? { tx: p[0], ty: p[1] } : { tx: W / 2, ty: H - 20, hidden: true };
      }, { xPull: 0.25, yPull: 0.25 });
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

  // ---- Drawing -------------------------------------------------------------
  function draw(duration) {
    const [mode, a, b] = state.split(":");
    // Layout key ignores style-only suffixes like ":line80" or ":Taiwan".
    const pos = layout(mode === "map" ? "map" : mode === "scatter" ? `scatter:${a}:${b}` : `swarm:${a}`);
    const t = svg.transition().duration(duration).ease(d3.easeCubicInOut);

    // Dots
    const highlight = mode === "map" && a ? a : null;
    circles
      .attr("r", R)
      .transition(t)
      .delay((d) => (duration ? (d.id % 40) * 6 : 0))
      .attr("cx", (d) => pos.get(d.id).x)
      .attr("cy", (d) => pos.get(d.id).y)
      .attr("opacity", (d) => {
        if (pos.get(d.id).hidden) return 0;
        if (highlight) return d.countryLabel === highlight ? 1 : 0.25;
        return 0.9;
      })
      .attr("fill", (d) => {
        if (b === "process" && mode === "swarm") return color(d.process);
        if (highlight && d.countryLabel === highlight) return "var(--cherry)";
        return "var(--roast)";
      });

    // Land
    gLand.transition(t).attr("opacity", mode === "map" ? 1 : 0);

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
    if (mode === "map" && highlight) {
      const pts = lots.filter((d) => d.countryLabel === highlight).map((d) => pos.get(d.id));
      const cx = d3.mean(pts, (p) => p.x), top = d3.min(pts, (p) => p.y);
      gAnno.append("text").attr("x", cx).attr("y", top - 12).attr("text-anchor", "middle")
        .text(`${highlight}: ${pts.length} lots`);
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
          .map((g) => `<span><i style="background:${color(g)}"></i>${g}</span>`)
          .join("");
      }
    }

    svg.attr("aria-label", describe(mode, a, b));
  }

  function describe(mode, a, b) {
    if (mode === "swarm") return `Beeswarm of ${lots.length} coffee lots by ${SCORE_LABELS[a]}`;
    if (mode === "map") return `Map of ${lots.length} coffee lots by origin country`;
    return `Scatterplot of ${SCORE_LABELS[a]} against ${SCORE_LABELS[b]}`;
  }

  onResize(container, (w, h) => {
    W = w; H = h;
    R = Math.max(2.5, Math.min(6, W / 150));
    svg.attr("viewBox", [0, 0, W, H]);
    cache.clear();
    buildMap();
    draw(0);
  });

  return {
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
