// main.js — the entry point. Loads the data, builds each chart, and connects
// every chart to the scroll steps in index.html.
//
// Data files are produced by scripts/prepare_data.py. Because this file uses
// ES modules and fetches JSON, open the site through a local server
// (VS Code "Live Server", or `python3 -m http.server`), not by double-clicking.

import { createWheel } from "./charts/wheel.js";
import { createDots } from "./charts/dots.js";
import { createTastePrint } from "./charts/tasteprint.js";
import { observeSteps } from "./story.js";
import { FLAVOR_TEXT } from "./content/flavor-text.js";

const [tree, lots, world, summary] = await Promise.all([
  d3.json("data/flavor-wheel.json"),
  d3.json("data/cqi-2023.json"),
  d3.json("data/world-110m.geojson"),
  d3.json("data/summary.json"),
]);

// ---- Numbers in the story text come from the data, never typed by hand ----
const noteCount = d3.hierarchy(tree).descendants().filter((d) => d.depth === 3).length;
const stats = {
  ...summary,
  notes: noteCount,
  taiwanPct: `${Math.round(summary.taiwanShare * 100)}%`,
};
document.querySelectorAll("[data-stat]").forEach((el) => {
  const value = stats[el.dataset.stat];
  if (value != null) el.textContent = value;
});

// ---- Hero: decorative wheel that sweeps in once -----------------------------
const hero = createWheel(document.getElementById("hero-wheel"), tree, { interactive: false, labels: true });
hero.intro();

// ---- Act 1: the story wheel + flavor card -----------------------------------
const card = document.getElementById("flavor-card");

function showCard(node) {
  if (!node) { card.hidden = true; return; }
  const path = node.ancestors().reverse().slice(1);
  const family = path[0];
  card.style.setProperty("--card-color", family.data.color);
  const children = node.children ?? [];
  card.innerHTML = `
    <h3>${node.data.name}</h3>
    <p class="path">${path.map((n) => n.data.name).join(" › ")}</p>
    ${FLAVOR_TEXT[node.data.id] ? `<p>${FLAVOR_TEXT[node.data.id]}</p>` : ""}
    ${children.length ? `<p>${children.length} more specific ${children.length === 1 ? "word" : "words"} inside:</p>
      <ul class="chips">${children.map((c) => `<li>${c.data.name}</li>`).join("")}</ul>` : ""}`;
  card.hidden = false;
}

const wheel = createWheel(document.getElementById("wheel"), tree, { onSelect: showCard });
wheel.setState("families");
observeSteps("#act-wheel", (state) => wheel.setState(state));

// ---- Acts 2 + 3: one dot chart, many states ---------------------------------
const dots = createDots(document.getElementById("dots"), lots, world, {
  legend: document.getElementById("dots-legend"),
});
observeSteps("#act-dots", (state) => dots.setState(state));

// ---- Act 4: taste-print -------------------------------------------------------
createTastePrint(document.getElementById("taste"), lots);
