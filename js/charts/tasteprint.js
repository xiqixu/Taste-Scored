// tasteprint.js — Act 4. The reader sets six scores with sliders; we draw
// their "taste-print" on a radar chart and list the graded lots whose scores
// are closest (straight-line / Euclidean distance across the six scores).

import { dur } from "../utils.js";

const AXES = ["aroma", "flavor", "aftertaste", "acidity", "body", "balance"];
const LABELS = { aroma: "Aroma", flavor: "Flavor", aftertaste: "Aftertaste", acidity: "Acidity", body: "Body", balance: "Balance" };
const MIN = 6.5, MAX = 8.75, STEP = 0.25;
const TOP_N = 5;

export function createTastePrint(container, lots) {
  const medians = Object.fromEntries(AXES.map((k) => [k, roundToStep(d3.median(lots, (d) => d[k]))]));
  const you = { ...medians };
  let selectedId = null;

  // ---- DOM skeleton ---------------------------------------------------------
  container.innerHTML = `
    <form class="taste__sliders" aria-label="Your taste-print">
      ${AXES.map((k) => `
        <label>${LABELS[k]}
          <output id="out-${k}">${you[k].toFixed(2)}</output>
          <input type="range" name="${k}" min="${MIN}" max="${MAX}" step="${STEP}" value="${you[k]}">
        </label>`).join("")}
      <button type="button" class="taste__reset">Reset to the median coffee</button>
    </form>
    <div class="taste__radar">
      <p class="taste__key"><span class="key-you">Your taste-print</span> <span class="key-match">Selected lot</span></p>
    </div>
    <div class="taste__matches">
      <h3>Closest graded lots</h3>
      <ol></ol>
    </div>`;

  const form = container.querySelector("form");
  const list = container.querySelector("ol");

  form.addEventListener("input", (e) => {
    if (e.target.type !== "range") return;
    you[e.target.name] = +e.target.value;
    container.querySelector(`#out-${e.target.name}`).textContent = (+e.target.value).toFixed(2);
    selectedId = null;
    update();
  });
  form.querySelector(".taste__reset").addEventListener("click", () => {
    AXES.forEach((k) => {
      you[k] = medians[k];
      form.elements[k].value = medians[k];
      container.querySelector(`#out-${k}`).textContent = medians[k].toFixed(2);
    });
    selectedId = null;
    update();
  });

  // ---- Radar --------------------------------------------------------------
  const size = 440, r = 160;
  const svg = d3.select(container.querySelector(".taste__radar"))
    .append("svg")
    .attr("viewBox", [-size / 2, -size / 2, size, size])
    .attr("role", "img");
  const radius = d3.scaleLinear([MIN, MAX], [0, r]);
  const angle = (i) => (i / AXES.length) * 2 * Math.PI;
  const line = d3.lineRadial().angle((d, i) => angle(i)).radius((d) => radius(d)).curve(d3.curveLinearClosed);

  [7, 7.5, 8, 8.5].forEach((v) =>
    svg.append("path").attr("class", "radar-grid").attr("d", line(AXES.map(() => v))));
  AXES.forEach((k, i) => {
    const a = angle(i) - Math.PI / 2;
    svg.append("line").attr("class", "radar-grid")
      .attr("x2", Math.cos(a) * r).attr("y2", Math.sin(a) * r);
    svg.append("text").attr("class", "radar-axis-label")
      .attr("x", Math.cos(a) * (r + 26)).attr("y", Math.sin(a) * (r + 26))
      .attr("text-anchor", Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end")
      .attr("dy", "0.35em")
      .text(LABELS[k]);
  });

  const matchPath = svg.append("path").attr("class", "radar-match");
  const youPath = svg.append("path").attr("class", "radar-you");

  // ---- Update ---------------------------------------------------------------
  function update() {
    const ranked = lots
      .map((d) => ({ d, dist: Math.hypot(...AXES.map((k) => d[k] - you[k])) }))
      .sort((p, q) => p.dist - q.dist)
      .slice(0, TOP_N);
    if (selectedId == null) selectedId = ranked[0].d.id;
    const match = lots.find((d) => d.id === selectedId);

    youPath.transition().duration(dur(250)).attr("d", line(AXES.map((k) => you[k])));
    matchPath.transition().duration(dur(250)).attr("d", line(AXES.map((k) => match[k])));
    svg.attr("aria-label", `Your taste-print compared with a ${match.countryLabel} ${match.variety}`);

    list.innerHTML = ranked
      .map(({ d, dist }) => `
        <li><button type="button" data-id="${d.id}" aria-pressed="${d.id === selectedId}">
          <span class="m-name">${d.countryLabel}${d.region ? `, ${d.region}` : ""}</span>
          <span class="m-score">${d.total.toFixed(2)}</span>
          <span class="m-meta">${d.variety}, ${d.process.toLowerCase()}. Distance ${dist.toFixed(2)}</span>
        </button></li>`)
      .join("");
  }

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    selectedId = +btn.dataset.id;
    update();
  });

  update();
}

function roundToStep(v) {
  return Math.min(MAX, Math.max(MIN, Math.round(v / STEP) * STEP));
}
