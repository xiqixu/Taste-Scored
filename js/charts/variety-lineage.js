import { onResize } from "../utils.js";

const FRUIT = {
  gesha: "Gesha",
  typica: "Typica",
  bourbon: "Bourbon",
  caturra: "Caturra",
  castillo: "Castillo",
};

const GROUPS = {
  landraces: ["gesha"],
  heritage: ["typica", "bourbon", "caturra", "timor", "cross", "castillo"],
};

// Parents come before their descendants so a reverse walk can trace ancestry.
const LINKS = [
  ["arabica", "landraces", "group"],
  ["arabica", "heritage", "group"],
  ["landraces", "gesha", "group"],
  ["heritage", "typica", "group"],
  ["heritage", "bourbon", "group"],
  ["bourbon", "caturra", "mutation"],
  ["caturra", "cross", "hybrid"],
  ["timor", "cross", "hybrid"],
  ["cross", "castillo", "hybrid"],
];

function fruit(id) {
  return `<div class="variety-lineage__node" data-node="${id}" id="lineage-${id}">
    <button class="variety-lineage__fruit" type="button" data-variety="${FRUIT[id]}"
      aria-pressed="false" aria-controls="varieties-detail varieties-chart">
      <span class="variety-lineage__berry" aria-hidden="true"></span>
      <span class="variety-lineage__label">${FRUIT[id]}</span>
    </button>
  </div>`;
}

function group(id, label) {
  const controlled = GROUPS[id].map(node => `lineage-${node}`).join(" ");
  return `<div class="variety-lineage__node" data-node="${id}">
    <button class="variety-lineage__group" type="button" data-family="${id}"
      aria-expanded="true" aria-controls="${controlled}">
      <span class="variety-lineage__label">${label}</span>
      <span class="variety-lineage__chevron" aria-hidden="true"></span>
    </button>
  </div>`;
}

const markup = `
  <div class="variety-lineage__graph" role="group" aria-label="Arabica variety branches">
    <svg class="variety-lineage__links" aria-hidden="true"></svg>
    <div class="variety-lineage__node" data-node="arabica"><span class="variety-lineage__label">Arabica</span></div>
    ${group("landraces", "Ethiopian landraces")}
    ${group("heritage", "Bourbon–Typica group")}
    ${fruit("gesha")}
    ${fruit("typica")}
    ${fruit("bourbon")}
    ${fruit("caturra")}
    <div class="variety-lineage__node" data-node="timor" id="lineage-timor">
      <span class="variety-lineage__label">Timor Hybrid</span>
    </div>
    <div class="variety-lineage__node" data-node="cross" id="lineage-cross" role="img" aria-label="Hybrid cross">
      <span class="variety-lineage__junction" aria-hidden="true">×</span>
    </div>
    ${fruit("castillo")}
  </div>
  <div class="variety-lineage__key" aria-label="Branch types">
    <span><i data-link="group" aria-hidden="true"></i>Group</span>
    <span><i data-link="mutation" aria-hidden="true"></i>Natural mutation</span>
    <span><i data-link="hybrid" aria-hidden="true"></i>Hybrid parentage</span>
  </div>`;

export function createVarietyLineage(container, { onSelect } = {}) {
  container.classList.add("variety-lineage");
  container.innerHTML = markup;
  const graph = container.querySelector(".variety-lineage__graph");
  const svg = graph.querySelector(".variety-lineage__links");
  const nodes = Object.fromEntries([...graph.querySelectorAll("[data-node]")]
    .map(node => [node.dataset.node, node]));
  const groups = [...graph.querySelectorAll("[data-family]")];
  const fruits = [...graph.querySelectorAll("[data-variety]")];
  const familyByNode = Object.fromEntries(Object.entries(GROUPS).flatMap(([family, members]) =>
    members.map(node => [node, family])));
  const nodeByVariety = Object.fromEntries(Object.entries(FRUIT).map(([node, variety]) => [variety, node]));
  const expanded = { landraces: true, heritage: true };
  const paths = LINKS.map(([parent, child, type]) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", "path");
    element.classList.add("variety-lineage__edge");
    element.dataset.link = type;
    svg.append(element);
    return { parent, child, element };
  });
  let selected = "castillo";
  let comparison = [];

  function drawLinks() {
    const bounds = graph.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    for (const { parent, child, element } of paths) {
      const visible = !nodes[parent].hidden && !nodes[child].hidden;
      element.toggleAttribute("hidden", !visible);
      if (!visible) continue;
      const from = nodes[parent].firstElementChild.getBoundingClientRect();
      const to = nodes[child].firstElementChild.getBoundingClientRect();
      const x1 = from.left + from.width / 2 - bounds.left;
      const y1 = from.bottom - bounds.top;
      const x2 = to.left + to.width / 2 - bounds.left;
      const y2 = to.top - bounds.top;
      const bend = (y1 + y2) / 2;
      element.setAttribute("d", `M${x1},${y1} C${x1},${bend} ${x2},${bend} ${x2},${y2}`);
    }
  }

  function render() {
    for (const button of groups) {
      button.setAttribute("aria-expanded", String(expanded[button.dataset.family]));
    }
    for (const [id, node] of Object.entries(nodes)) {
      const family = familyByNode[id];
      node.hidden = Boolean(family && !expanded[family]);
    }

    const visibleSelection = nodes[selected].hidden ? familyByNode[selected] : selected;
    const ancestry = new Set([visibleSelection]);
    for (const { parent, child } of [...paths].reverse()) {
      if (ancestry.has(child)) ancestry.add(parent);
    }
    for (const { child, element } of paths) {
      element.toggleAttribute("data-active", ancestry.has(child));
    }
    for (const [id, node] of Object.entries(nodes)) {
      node.toggleAttribute("data-active", ancestry.has(id));
    }
    for (const button of fruits) {
      button.setAttribute("aria-pressed", String(FRUIT[selected] === button.dataset.variety));
      const slot = comparison.indexOf(button.dataset.variety);
      if (slot < 0) button.removeAttribute("data-slot");
      else button.dataset.slot = slot === 0 ? "first" : "second";
    }
    drawLinks();
  }

  for (const button of groups) {
    button.addEventListener("click", () => {
      const family = button.dataset.family;
      expanded[family] = !expanded[family];
      render();
    });
  }
  for (const button of fruits) {
    button.addEventListener("click", () => {
      selected = nodeByVariety[button.dataset.variety];
      render();
      onSelect?.(FRUIT[selected], { fromClick: true });
    });
  }

  render();
  onSelect?.(FRUIT[selected]);
  onResize(graph, drawLinks);
  document.fonts?.ready.then(drawLinks);

  return {
    setComparison(names) {
      for (const [slot, name] of names.entries()) {
        if (name === comparison[slot]) continue;
        const family = familyByNode[nodeByVariety[name]];
        if (family) expanded[family] = true;
      }
      comparison = [...names];
      render();
    },
  };
}
