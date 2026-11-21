// tasteprint.js — Act 5. The reader sets six scores with sliders; we draw
// their "taste-print" on a radar chart and list the graded lots whose scores
// are closest (straight-line / Euclidean distance across the six scores).

import { dur } from "../utils.js";

const AXES = ["aroma", "flavor", "aftertaste", "acidity", "body", "balance"];
const LABELS = { aroma: "Aroma", flavor: "Flavor", aftertaste: "Aftertaste", acidity: "Acidity", body: "Body", balance: "Balance" };
const MIN = 6.5, MAX = 8.75, STEP = 0.25;
const TOP_N = 5;
const listFormat = new Intl.ListFormat("en");
const FIRSTBLOOM = "https://github.com/alexcaza/firstbloom-data/tree/a6cb0026d1af9642724793c799bbc48dc189ba35";
const ROASTER_REFERENCES = {
  Taiwan: {
    example: "Alishan Ruili Washed",
    region: "Alishan",
    tastingNotes: ["Peach", "Citrus", "Plum", "Honey"],
    source: "Fujin Coffee",
    url: "https://www.fujincoffee.com.tw/products/f20250701104",
  },
  Vietnam: {
    example: "Đà Lạt Serie 2 – Datanla",
    region: "Đà Lạt",
    tastingNotes: ["Nougat", "Dark chocolate", "Fruit"],
    source: "Là Việt Coffee",
    url: "https://laviet.coffee/san-pham/da-lat-serie-2-datanla/",
  },
};

export function createTastePrint(container, lots, profilesByOrigin) {
  const medians = Object.fromEntries(AXES.map((k) => [k, roundToStep(d3.median(lots, (d) => d[k]))]));
  const you = { ...medians };

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
      <div class="taste__notes" id="taste-notes" aria-live="polite">
        <p class="taste__lot-profile"></p>
        <div class="taste__reference">
          <h4>Tasting notes from another coffee</h4>
          <p class="taste__descriptors"></p>
          <p class="taste__source"><span></span> <a></a></p>
        </div>
      </div>
    </div>`;

  const form = container.querySelector("form");
  const list = container.querySelector("ol");
  const notes = container.querySelector(".taste__notes");
  const lotProfile = notes.querySelector(".taste__lot-profile");
  const reference = notes.querySelector(".taste__reference");
  const descriptors = reference.querySelector(".taste__descriptors");
  const sourceDetails = reference.querySelector(".taste__source span");
  const sourceLink = reference.querySelector("a");

  form.addEventListener("input", (e) => {
    if (e.target.type !== "range") return;
    you[e.target.name] = +e.target.value;
    container.querySelector(`#out-${e.target.name}`).textContent = (+e.target.value).toFixed(2);
    update();
  });
  form.querySelector(".taste__reset").addEventListener("click", () => {
    AXES.forEach((k) => {
      you[k] = medians[k];
      form.elements[k].value = medians[k];
      container.querySelector(`#out-${k}`).textContent = medians[k].toFixed(2);
    });
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
    youPath.transition().duration(dur(250)).attr("d", line(AXES.map((k) => you[k])));

    list.innerHTML = ranked
      .map(({ d, dist }) => `
        <li><button type="button" data-id="${d.id}" aria-pressed="false" aria-controls="taste-notes">
          <span class="m-name">${d.countryLabel}${d.region ? `, ${d.region}` : ""}</span>
          <span class="m-score">${d.total.toFixed(2)}</span>
          <span class="m-meta">${d.variety}, ${d.process.toLowerCase()}. Distance ${dist.toFixed(2)}</span>
        </button></li>`)
      .join("");
    selectLot(list.querySelector("button"), ranked[0].d);
  }

  function selectLot(button, lot) {
    list.querySelector('button[aria-pressed="true"]')?.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-pressed", "true");
    button.after(notes);

    matchPath.transition().duration(dur(250)).attr("d", line(AXES.map((k) => lot[k])));
    svg.attr("aria-label", `Your taste-print compared with a ${lot.countryLabel} ${lot.variety}`);

    const highScore = Math.max(...AXES.map((k) => lot[k]));
    const highestRated = AXES.filter((k) => lot[k] === highScore).map((k) => LABELS[k].toLowerCase());
    lotProfile.textContent = `This lot scored highest for ${listFormat.format(highestRated)} (${highScore.toFixed(2)}/10).`;

    const example = ROASTER_REFERENCES[lot.countryLabel] ?? profilesByOrigin.get(lot.countryLabel);
    reference.hidden = !example?.tastingNotes.length;
    if (reference.hidden) return;

    descriptors.textContent = example.tastingNotes.join(" · ");
    const location = [example.region, lot.countryLabel].filter(Boolean).join(", ");
    sourceDetails.textContent = [`“${example.example}”`, location, example.roaster].filter(Boolean).join(" · ") + " ·";
    sourceLink.textContent = example.releaseId ? `Firstbloom #${example.releaseId}` : example.source;
    sourceLink.href = example.url ?? FIRSTBLOOM;
  }

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn || btn.getAttribute("aria-pressed") === "true") return;
    selectLot(btn, lots.find((lot) => lot.id === Number(btn.dataset.id)));
  });

  update();
}

function roundToStep(v) {
  return Math.min(MAX, Math.max(MIN, Math.round(v / STEP) * STEP));
}
