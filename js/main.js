// main.js — the entry point. Loads the data, builds each chart, and connects
// every chart to the scroll steps in index.html.
//
// Because this file uses ES modules and fetches local data, open it through a server
// (VS Code "Live Server", or `python3 -m http.server`), not by double-clicking.

import { createWheel } from "./charts/wheel.js";
import { createDots } from "./charts/dots.js?v=exact-scores";
import { createCherryScene } from "./charts/cherry-scene.js?v=halves";
import { createProcessDemo } from "./charts/process-demo.js?v=halves";
import { createProductionMap } from "./charts/production-map.js?v=levels";
import { createTradeMap } from "./charts/trade-map.js?v=launch";
import { createVarieties } from "./charts/varieties.js?v=fruit-picks";
import { createTastePrint } from "./charts/tasteprint.js?v=flavor-notes";
import { observeSteps } from "./story.js";
import { FLAVOR_TEXT } from "./content/flavor-text.js";
import { hideTooltip } from "./utils.js";

const [tree, lots, world, summary, production, regions, profiles, trade] = await Promise.all([
  d3.json("data/flavor-wheel.json"),
  d3.json("data/cqi-2023.json"),
  d3.json("data/world-110m.geojson"),
  d3.json("data/summary.json"),
  d3.csv("data/coffee-production.csv", ({ year, code, name, tonnes }) => ({
    year: Number(year), code, name, tonnes: Number(tonnes),
  })),
  d3.json("data/production-regions.json?v=outlines"),
  d3.json("data/producer-profiles.json"),
  d3.json("data/coffee-trade.json"),
]);

// ---- Numbers in the story text come from the data, never typed by hand ----
const noteCount = d3.hierarchy(tree).descendants().filter((d) => d.depth === 3).length;
const cherryLot = d3.greatest(lots.filter((lot) => Number.isFinite(lot.altitude)), (lot) => lot.total);
const stats = {
  ...summary,
  notes: noteCount,
  cherryVariety: cherryLot?.variety,
  cherryOrigin: cherryLot?.countryLabel,
  cherryScore: cherryLot?.total.toFixed(2),
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

// ---- Acts 2–4: cup scores, maps and the coffee cherry ------------------------
const scoreCharts = document.getElementById("cup-score-charts");
const processContainer = document.getElementById("process-panel");
const mapContainer = document.getElementById("production-map");
const tradeContainer = document.getElementById("trade-map");
const chartFigure = mapContainer.parentElement;
const cutaway = document.getElementById("cherry-cutaway-template").content;
const cherryScene = createCherryScene(document.getElementById("cherry-scene"), cutaway);
const processDemo = createProcessDemo(processContainer, cutaway);
const productionMap = createProductionMap(mapContainer, world, production, regions, profiles);
const tradeMap = createTradeMap(tradeContainer, world, trade);
const dots = createDots(document.getElementById("dots"), lots, {
  legend: document.getElementById("dots-legend"),
  mapPoints: productionMap.lotPositions,
  cherryLot,
});
let previousState;
observeSteps("#act-dots", (state) => {
  const showCherry = state === "cherry";
  const showProcessing = state === "processing";
  const showProduction = state === "production";
  const showTrade = state === "trade";
  const departingHalf = showProcessing && previousState === "cherry" ? cherryScene.cutawayOrigin() : null;
  hideTooltip();
  chartFigure.classList.toggle("is-cherry", showCherry);
  chartFigure.classList.toggle("is-processing", showProcessing);
  chartFigure.classList.toggle("is-production", showProduction);
  chartFigure.classList.toggle("is-trade", showTrade);
  for (const [panel, active] of [
    [processContainer, showProcessing],
    [mapContainer, showProduction],
    [tradeContainer, showTrade],
    [scoreCharts, !showCherry && !showProcessing && !showProduction && !showTrade],
  ]) {
    panel.inert = !active;
    panel.setAttribute("aria-hidden", String(!active));
  }
  cherryScene.setActive(showCherry, showCherry && previousState === "scatter:altitude:total" ? dots.cherryPoint() : null);
  processDemo.setActive(showProcessing, departingHalf);
  tradeMap.setActive(showTrade);
  // Keep the cupping dots at their map coordinates until the scatterplot begins.
  if (!showCherry && !showProcessing) dots.setState(showTrade ? "production" : state);
  previousState = state;
});

createVarieties(document.getElementById("act4-varieties"), lots);

// ---- Act 5: taste-print -------------------------------------------------------
const profilesByOrigin = new Map(production.map(({ name, code }) => [name, profiles[code]]));
profilesByOrigin.set("Hawaii (USA)", profiles.USA);
createTastePrint(document.getElementById("taste"), lots, profilesByOrigin);
