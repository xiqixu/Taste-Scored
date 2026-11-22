import { hideTooltip, onResize, showTooltip } from "../utils.js";
import { createVarietyLineage } from "./variety-lineage.js?v=fruit-picks";

const wcr = "https://varieties.worldcoffeeresearch.org/varieties/";
const varieties = {
  Bourbon: {
    lineage: "Bourbon–Typica group",
    detail: "A tall cultivar that spread through Réunion. Caturra arose as a natural mutation of Bourbon.",
    url: `${wcr}bourbon`,
  },
  Caturra: {
    lineage: "A natural mutation of Bourbon",
    detail: "Found in Minas Gerais, Brazil. Its compact growth lets farmers plant trees more closely together.",
    url: `${wcr}Caturra`,
  },
  Typica: {
    lineage: "Bourbon–Typica group",
    detail: "A tall cultivar with bronze leaf tips. Typica and Bourbon are two major lineages of cultivated Arabica.",
    url: `${wcr}typica`,
  },
  Gesha: {
    lineage: "Ethiopian landrace",
    detail: "The Panamanian Gesha line descends from Ethiopian material catalogued as T2722. The cupping chart uses the broader CQI label ‘Gesha’.",
    url: `${wcr}geisha-Panama`,
  },
  Castillo: {
    lineage: "Caturra × Timor Hybrid",
    detail: "Cenicafé developed Castillo in Colombia and selected it for resistance to coffee leaf rust.",
    url: "https://biblioteca.cenicafe.org/jspui/handle/10778/401",
    source: "Cenicafé",
  },
};

const markup = `
  <header class="varieties__head">
    <h2 id="varieties-title">Branches of Arabica</h2>
    <p>Click two cherries to compare their cup scores. Each click highlights the variety’s lineage.</p>
  </header>
  <div class="varieties__layout">
    <div class="varieties__lineage">
      <div class="varieties__tree"></div>
      <div class="varieties__detail" id="varieties-detail" aria-live="polite" aria-atomic="true">
        <h3></h3>
        <p class="varieties__parentage"></p>
        <p class="varieties__description"></p>
        <a class="varieties__source" href=""></a>
      </div>
    </div>
    <div class="varieties__comparison">
      <h3>Compare cups</h3>
      <p class="varieties__intro">Each mark represents one scored CQI lot.</p>
      <div class="varieties__controls" role="group" aria-label="Choose two coffee varieties">
        <label class="varieties__first">First variety<select aria-controls="varieties-chart"></select></label>
        <label class="varieties__second">Second variety<select aria-controls="varieties-chart"></select></label>
      </div>
      <div class="varieties__chart" id="varieties-chart"></div>
      <div class="varieties__summary" aria-live="polite"></div>
      <p class="varieties__note">Counts use the variety labels recorded in the CQI sample. Lots also differ in origin and processing.</p>
    </div>
  </div>`;

export function createVarieties(container, lots) {
  container.innerHTML = markup;
  const detail = container.querySelector(".varieties__detail");
  const title = detail.querySelector("h3");
  const parentage = detail.querySelector(".varieties__parentage");
  const description = detail.querySelector(".varieties__description");
  const source = detail.querySelector("a");
  const selects = Array.from(container.querySelectorAll("select"));
  const chart = container.querySelector(".varieties__chart");
  const summary = container.querySelector(".varieties__summary");
  const names = Object.keys(varieties);
  const scored = lots.filter(({ variety, total }) => names.includes(variety) && Number.isFinite(total));
  const scores = d3.group(scored, lot => lot.variety);
  const scoreDomain = [
    Math.min(80, Math.floor(d3.min(scored, lot => lot.total) ?? 80)),
    Math.max(90, Math.ceil(d3.max(scored, lot => lot.total) ?? 90)),
  ];
  const svg = d3.select(chart).append("svg").attr("role", "img").attr("aria-labelledby", "varieties-chart-title");
  const chartTitle = svg.append("title").attr("id", "varieties-chart-title");
  const grid = svg.append("g").attr("class", "varieties__grid");
  const rows = svg.append("g").attr("aria-hidden", "true");
  const axis = svg.append("g").attr("class", "varieties__axis");
  const axisLabel = svg.append("text").attr("class", "varieties__axis-label")
    .attr("text-anchor", "middle").text("Total cup points");
  let width = 0;

  function reveal(name) {
    const variety = varieties[name];
    title.textContent = name;
    parentage.textContent = variety.lineage;
    description.textContent = variety.detail;
    source.textContent = variety.source ?? "World Coffee Research";
    source.href = variety.url;
  }

  const defaults = ["Bourbon", "Caturra"];
  let mostRecentSlot = 1;
  const lineage = createVarietyLineage(container.querySelector(".varieties__tree"), {
    onSelect(name, { fromClick } = {}) {
      reveal(name);
      if (!fromClick) return;

      // Keep the last pick in its current slot so its color stays the same.
      const currentSlot = selects.findIndex(select => select.value === name);
      if (currentSlot < 0) {
        mostRecentSlot = 1 - mostRecentSlot;
        selects[mostRecentSlot].value = name;
        compare();
      } else {
        mostRecentSlot = currentSlot;
      }
    },
  });

  selects.forEach((select, index) => {
    for (const name of names) select.add(new Option(name, name));
    select.value = defaults[index];
    select.addEventListener("change", () => {
      mostRecentSlot = index;
      compare();
    });
  });

  function compare() {
    hideTooltip();
    const names = selects.map(select => select.value);
    lineage.setComparison(names);
    selects.forEach((select, index) => {
      for (const option of select.options) option.disabled = option.value === names[1 - index];
    });
    const labels = names.map(name => {
      const lots = scores.get(name) ?? [];
      const [min, max] = d3.extent(lots, lot => lot.total);
      return lots.length
        ? `${name}, ${lots.length} ${lots.length === 1 ? "lot" : "lots"}, ${min === max ? min.toFixed(2) : `${min.toFixed(2)} to ${max.toFixed(2)}`} points.`
        : `${name}, no scored lots.`;
    });
    summary.textContent = labels.join(" ");
    chartTitle.text(`Cup score distributions for ${names.join(" and ")}, sharing a ${scoreDomain.join(" to ")} point axis.`);
    render();
  }

  function render() {
    if (!width) return;
    const widthInset = 15;
    const x = d3.scaleLinear(scoreDomain, [widthInset, width - widthInset]);
    const dotRadius = width < 390 ? 4 : 5;
    const dotGap = dotRadius * 2 + 2;
    const tickCount = width < 340 ? 5 : 6;

    // Stack nearby observations vertically, keeping the measured score on x.
    const groups = selects.map((select, index) => {
      const name = select.value;
      const lots = scores.get(name) ?? [];
      const levels = [];
      const dots = lots.slice().sort((a, b) => a.total - b.total).map(lot => {
        const left = x(lot.total);
        let level = levels.findIndex(previous => left - previous >= dotGap);
        if (level < 0) level = levels.length;
        levels[level] = left;
        return { lot, left, level };
      });
      const height = Math.max(75, 36 + levels.length * dotGap);
      return { name, count: lots.length, dots, height, slot: index ? "second" : "first" };
    });
    groups[1].offset = groups[0].height + 4;
    const chartBottom = groups[1].offset + groups[1].height;
    const height = chartBottom + 53;
    const ticks = x.ticks(tickCount);

    svg.attr("viewBox", [0, 0, width, height]);
    grid.selectAll("line").data(ticks).join("line")
      .attr("x1", x).attr("x2", x).attr("y1", 21).attr("y2", chartBottom);

    rows.selectAll("g").data(groups, group => group.slot).join(
      enter => {
        const row = enter.append("g");
        row.append("line").attr("class", "varieties__row-rule");
        row.append("text").attr("class", "varieties__row-name");
        row.append("text").attr("class", "varieties__row-count").attr("text-anchor", "end");
        return row;
      },
    ).attr("class", group => `varieties__${group.slot}`).attr("transform", group => `translate(0,${group.offset ?? 0})`)
      .each(function (group) {
        const row = d3.select(this);
        row.select(".varieties__row-name").attr("x", widthInset).attr("y", 16).text(group.name);
        row.select(".varieties__row-count").attr("x", width - widthInset).attr("y", 16)
          .text(`${group.count} ${group.count === 1 ? "lot" : "lots"}`);
        row.select(".varieties__row-rule").attr("x1", widthInset).attr("x2", width - widthInset)
          .attr("y1", group.height - 8).attr("y2", group.height - 8);
        const dots = row.selectAll("circle").data(group.dots, point => point.lot.id).join("circle")
          .attr("class", "varieties__lot")
          .attr("cx", point => point.left)
          .attr("cy", point => group.height - 16 - point.level * dotGap)
          .attr("r", dotRadius);
        const tip = (event, { lot }) => showTooltip(event, `<strong>${lot.total.toFixed(2)} points</strong><br>${lot.variety} · ${lot.countryLabel}`);
        dots.on("pointerenter pointermove", tip).on("pointerleave", hideTooltip);
      });

    axis.attr("transform", `translate(0,${chartBottom})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickSizeOuter(0).tickFormat(d3.format("d")));
    axisLabel.attr("x", width / 2).attr("y", height - 11);
  }

  compare();
  onResize(chart, nextWidth => {
    if (width === Math.floor(nextWidth)) return;
    width = Math.floor(nextWidth);
    render();
  });
}
