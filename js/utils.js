// utils.js — small helpers shared by every chart.
// `d3` is a global, loaded by the <script> tag in index.html.

/** True when the reader has asked their system for less motion. */
export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Use for every transition: dur(800) → 800ms, or 0ms with reduced motion. */
export const dur = (ms) => (reducedMotion ? 0 : ms);

/** Read a CSS custom property from tokens.css, e.g. cssVar("--cherry"). */
export const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Human-readable names for the CQI score columns (camelCase keys from prepare_data.py). */
export const SCORE_LABELS = {
  total: "Total cup points",
  aroma: "Aroma",
  flavor: "Flavor",
  aftertaste: "Aftertaste",
  acidity: "Acidity",
  body: "Body",
  balance: "Balance",
  uniformity: "Uniformity",
  cleanCup: "Clean cup",
  sweetness: "Sweetness",
  overall: "Overall",
  altitude: "Altitude (m)",
};

/** Processing method → colour. Order here is also the legend order. */
export function processColor() {
  const groups = ["Washed", "Natural", "Honey / pulped natural", "Experimental", "Not recorded"];
  const colors = ["--p-washed", "--p-natural", "--p-honey", "--p-experimental", "--p-unknown"].map(cssVar);
  return d3.scaleOrdinal(groups, colors);
}

/** Pearson correlation for two numeric arrays of equal length. */
export function pearson(xs, ys) {
  const mx = d3.mean(xs), my = d3.mean(ys);
  let num = 0, dx = 0, dy = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    dx += (x - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  });
  return num / Math.sqrt(dx * dy);
}

// ---------- Tooltip ----------------------------------------------------------
const tip = () => document.getElementById("tooltip");

export function showTooltip(event, html) {
  const el = tip();
  el.innerHTML = html;
  el.hidden = false;
  const pad = 14;
  const { innerWidth: w, innerHeight: h } = window;
  const box = el.getBoundingClientRect();
  let x = event.clientX + pad, y = event.clientY + pad;
  if (x + box.width > w) x = event.clientX - box.width - pad;
  if (y + box.height > h) y = event.clientY - box.height - pad;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

export function hideTooltip() {
  tip().hidden = true;
}

/** Calls fn(width, height) now and whenever the element is resized. */
export function onResize(el, fn) {
  let last = "";
  const ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const key = `${Math.round(width)}x${Math.round(height)}`;
    if (key !== last && width > 0 && height > 0) {
      last = key;
      fn(width, height);
    }
  });
  ro.observe(el);
}
