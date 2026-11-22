// wheel.js — the zoomable flavor wheel (a D3 "sunburst").
//
// Starting point: Mike Bostock's Zoomable Sunburst
//   https://observablehq.com/@d3/zoomable-sunburst
// What we changed: story states (rings appear one at a time), family colours,
// a flavor card on click, keyboard access, an entrance animation for the hero,
// and a hover effect where the sector under the pointer lifts off the wheel:
// it grows evenly (same proportions) from its own centre and casts a soft shadow.
//
// Usage:
//   const wheel = createWheel(element, treeData, { interactive: true, onSelect });
//   wheel.setState("families" | "groups" | "notes" | "focus:<id>:<noteId>" | "explore");

import { dur } from "../utils.js";

const SIZE = 1000; // drawn in a 1000×1000 box; CSS scales it to fit
const LIFT_SCALE = 1.08; // hovered sector grows 8%, the same in every direction
let wheelCount = 0;       // gives each wheel's shadow filters unique ids

export function createWheel(container, data, options = {}) {
  const { interactive = true, labels = true, onSelect = () => {} } = options;

  // ---- 1. Layout -------------------------------------------------------
  const root = d3.hierarchy(data).sum((d) => d.value ?? 0);
  d3.partition().size([2 * Math.PI, root.height + 1])(root);
  root.each((d) => (d.current = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 }));

  const ringWidth = SIZE / 2 / (root.height + 1); // centre circle + 3 rings

  const arc = d3
    .arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.004))
    .padRadius(ringWidth * 1.5)
    .innerRadius((d) => d.y0 * ringWidth)
    .outerRadius((d) => Math.max(d.y0 * ringWidth, d.y1 * ringWidth - 2));

  // Geometry of a node right now (its current zoom position).
  const shape = (d) => arc(d.current);

  // ---- 2. Colour: each family's hue, lighter as you move outwards --------
  const family = (d) => d.ancestors().find((a) => a.depth === 1);
  const fillOf = (d) => {
    const c = d3.hsl(family(d).data.color);
    c.l = Math.min(0.86, c.l + (d.depth - 1) * 0.12);
    c.s = c.s * (1 - (d.depth - 1) * 0.1);
    return c.formatHex();
  };
  const labelColor = (d) => (d3.lab(fillOf(d)).l > 58 ? "var(--roast)" : "var(--bean)");

  // ---- 3. SVG ------------------------------------------------------------
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", [-SIZE / 2, -SIZE / 2, SIZE, SIZE])
    .attr("role", interactive ? "group" : null)
    .attr("aria-label", interactive ? "Coffee flavor wheel" : null);

  const nodes = root.descendants().slice(1); // skip the invisible root

  const path = svg
    .append("g")
    .selectAll("path")
    .data(nodes)
    .join("path")
    .attr("class", "arc")
    .attr("fill", fillOf)
    .attr("d", shape);

  path.append("title").text((d) => d.ancestors().map((a) => a.data.name).reverse().slice(1).join(" › "));

  const label = svg
    .append("g")
    .attr("text-anchor", "middle")
    .style("user-select", "none")
    .selectAll("text")
    .data(labels ? nodes : [])
    .join("text")
    .attr("class", "arc-label")
    .attr("dy", "0.35em")
    .attr("font-size", (d) => (d.depth === 1 ? 19 : 15))
    .attr("font-weight", (d) => (d.depth === 1 ? 700 : 500))
    .attr("fill", labelColor)
    .text((d) => d.data.name);

  // Centre: shows where you are; click it to zoom back out.
  const center = svg.append("g").attr("class", "wheel-center");
  // See-through centre, so the photo (or the page) shows inside the ring.
  // "transparent" still counts as painted, so the centre stays clickable.
  center.append("circle").attr("r", ringWidth - 4).attr("fill", "transparent");
  const centerText = center
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("font-size", 22)
    .attr("font-weight", 700);

  // Hover copies are drawn here, above everything, and ignore the pointer,
  // so the real sector underneath keeps receiving enter/leave events.
  const defs = svg.append("defs");
  // text-anchor "middle" must be repeated here: the labels inherit it from
  // their own group, and a copied label would otherwise start at the centre.
  const liftLayer = svg.append("g").attr("class", "lift-layer")
    .attr("pointer-events", "none").attr("text-anchor", "middle");
  const wheelId = ++wheelCount;

  // ---- 4. State ------------------------------------------------------------
  let maxDepth = 3;       // how many rings the story has revealed so far
  let focus = root;       // the node we are zoomed into
  let clickable = false;  // clicks only work in the "explore" step
  let highlighted = null; // a node outlined in cherry during "focus" steps

  function labelTransform(d) {
    const x = (((d.current.x0 + d.current.x1) / 2) * 180) / Math.PI;
    const y = ((d.current.y0 + d.current.y1) / 2) * ringWidth;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }

  function render(duration = 0) {
    const t = svg.transition().duration(duration);

    path
      .transition(t)
      .tween("data", (d) => {
        const i = d3.interpolate(d.current, d.target ?? d.current);
        return (k) => (d.current = i(k));
      })
      .attr("fill-opacity", (d) => (shownAfter(d) ? 1 : 0))
      .attrTween("d", (d) => () => shape(d));

    const trail = new Set(highlighted ? highlighted.ancestors() : []);
    path
      .attr("stroke", (d) => (trail.has(d) ? "var(--cherry)" : null))
      .attr("stroke-width", (d) => (trail.has(d) ? 3 : null))
      .classed("is-clickable", (d) => clickable && shownAfter(d))
      .attr("tabindex", (d) => (clickable && shownAfter(d) ? 0 : null))
      .attr("pointer-events", (d) => (shownAfter(d) ? "auto" : "none"));

    label
      .transition(t)
      .attr("fill-opacity", (d) => (labelShownAfter(d) ? 1 : 0))
      .attrTween("transform", (d) => () => labelTransform(d));

    centerText.text(focus === root ? "" : focus.data.name);
    center.style("cursor", focus === root || !clickable ? "default" : "pointer");
  }

  // "After" versions look at the target geometry, so fading starts correctly.
  const shownAfter = (d) => {
    const g = d.target ?? d.current;
    return g.y1 <= root.height + 1 && g.y0 >= 1 && g.x1 > g.x0 && d.depth - focus.depth <= maxDepth;
  };
  const labelShownAfter = (d) => {
    const g = d.target ?? d.current;
    return shownAfter(d) && (g.y1 - g.y0) * (g.x1 - g.x0) > 0.055;
  };

  let zoomTimer;
  function zoomTo(p, duration = 750) {
    focus = p;
    // A zoom moves sectors out from under a still pointer, so no "leave"
    // event arrives. Remove any lifted copies first.
    dropAll();
    // Hold hover lifts until the sectors have finished moving, then lift
    // whichever sector ended up under a resting pointer.
    zooming = true;
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => {
      zooming = false;
      const el = pointer && document.elementFromPoint(...pointer);
      if (el && el.classList.contains("arc") && svg.node().contains(el)) lift(el, el.__data__);
    }, dur(duration) + 30);
    root.each((d) => {
      d.target = {
        x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.depth),
        y1: Math.max(0, d.y1 - p.depth),
      };
    });
    render(dur(duration));
  }

  // ---- 5. Interaction ------------------------------------------------------
  let hoverReady = interactive; // the hero turns this on after its intro
  const lifted = new Map();      // node → its hover copy
  let zooming = false;           // no lifting while sectors are moving
  let pointer = null;            // last pointer position over this wheel
  svg.on("pointermove", (event) => (pointer = [event.clientX, event.clientY]))
     .on("pointerleave", () => (pointer = null));

  // Lift a sector: draw a copy of it (and its label) on top, then grow the
  // copy evenly around the sector's own centre while a soft shadow fades in.
  function lift(el, d) {
    if (!hoverReady || zooming || lifted.has(d)) return;
    const [cx, cy] = arc.centroid(d.current);
    const filterId = `wheel-${wheelId}-lift-${lifted.size}-${Date.now()}`;
    const filter = defs.append("filter")
      .attr("id", filterId)
      .attr("filterUnits", "userSpaceOnUse")
      .attr("x", -SIZE).attr("y", -SIZE).attr("width", SIZE * 2).attr("height", SIZE * 2);
    const shadow = filter.append("feDropShadow")
      .attr("dx", 0).attr("dy", 0).attr("stdDeviation", 0)
      .attr("flood-color", "#1d160d").attr("flood-opacity", 0);

    const g = liftLayer.append("g");
    g.append(() => el.cloneNode(false))
      .attr("class", "arc-lift")
      .attr("tabindex", null)
      .attr("pointer-events", "none") // the copy keeps the original's "auto"; turn it off
      .attr("filter", `url(#${filterId})`);
    const text = label.filter((l) => l === d).node();
    if (text && +text.getAttribute("fill-opacity") > 0) g.append(() => text.cloneNode(true));

    const copy = { g, filter, shadow, cx, cy, k: 1 };
    lifted.set(d, copy);
    animate(copy, LIFT_SCALE, 1, 260);
  }

  function drop(d) {
    const copy = lifted.get(d);
    if (!copy) return;
    lifted.delete(d);
    animate(copy, 1, 0, 220).on("end interrupt", () => { copy.g.remove(); copy.filter.remove(); });
  }

  // Scale the copy to k (about its centre) and fade the shadow to strength 0–1.
  function animate(copy, k, strength, ms) {
    const scale = d3.interpolate(copy.k, k);
    copy.shadow.transition().duration(dur(ms)).ease(d3.easeCubicOut)
      .attr("stdDeviation", 10 * strength)
      .attr("dy", 5 * strength)
      .attr("flood-opacity", 0.38 * strength);
    return copy.g.transition().duration(dur(ms)).ease(d3.easeCubicOut)
      .attrTween("transform", () => (t) => {
        copy.k = scale(t);
        return `translate(${copy.cx},${copy.cy}) scale(${copy.k}) translate(${-copy.cx},${-copy.cy})`;
      });
  }

  function dropAll() {
    for (const copy of lifted.values()) { copy.g.interrupt().remove(); copy.filter.remove(); }
    lifted.clear();
  }

  function activate(d) {
    if (!clickable) return;
    onSelect(d);
    if (d.children) zoomTo(d);
  }

  path
    .on("pointerenter", function (event, d) { lift(this, d); })
    .on("pointerleave", (event, d) => drop(d))
    // Stop a mouse or touch press from focusing the sector. Browsers draw
    // their own outline box around a focused SVG shape; this prevents it.
    .on("pointerdown", (event) => event.preventDefault())
    // Keyboard users still get feedback: the same outward growth, no box.
    .on("focus", function (event, d) { lift(this, d); })
    .on("blur", (event, d) => drop(d))
    .on("click", (event, d) => activate(d))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(d);
      }
    });

  center.on("click", () => {
    if (!clickable || focus === root) return;
    const up = focus.parent;
    onSelect(up === root ? null : up);
    zoomTo(up);
  });

  // ---- 6. Public API -------------------------------------------------------
  const byId = (id) => root.descendants().find((d) => d.data.id === id);

  function setState(state) {
    // e.g. "focus:fruity:blackberry" → zoom into Fruity, show the Blackberry card
    const [name, arg, highlight] = state.split(":");
    clickable = name === "explore";
    highlighted = null;
    if (name === "families") { maxDepth = 1; onSelect(null); zoomTo(root, 600); }
    if (name === "groups")   { maxDepth = 2; onSelect(null); zoomTo(root, 600); }
    if (name === "notes")    { maxDepth = 3; onSelect(null); zoomTo(root, 600); }
    if (name === "focus") {
      maxDepth = 3;
      const node = byId(arg);
      if (node) { highlighted = byId(highlight) ?? null; zoomTo(node); onSelect(highlighted ?? node); }
    }
    if (name === "explore") { maxDepth = 3; onSelect(null); zoomTo(root); }
  }

  /** Hero-only: rings sweep in clockwise, one family after another. */
  function intro() {
    hoverReady = false;
    path.attr("d", (d) => arc({ ...d.current, x1: d.current.x0 })).attr("fill-opacity", 1);
    label.attr("fill-opacity", 0).attr("transform", labelTransform);
    path
      .transition()
      .delay((d) => dur(200 + family(d).parent.children.indexOf(family(d)) * 90 + (d.depth - 1) * 260))
      .duration(dur(700))
      .ease(d3.easeCubicOut)
      .attrTween("d", (d) => {
        const i = d3.interpolate(d.current.x0, d.current.x1);
        return (k) => arc({ ...d.current, x1: i(k) });
      })
      .end()
      .then(() => (hoverReady = true), () => (hoverReady = true));
    label
      .filter((d) => d.depth === 1)
      .transition()
      .delay(dur(1500))
      .duration(dur(500))
      .attr("fill-opacity", 1);
  }

  render(0);
  return { setState, intro, root };
}
