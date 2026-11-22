import { processColor } from "../utils.js";

const METHODS = {
  washed: {
    group: "Washed",
    explanation: "Remove the skin and pulp, then wash away the mucilage. The seeds dry in their parchment.",
  },
  natural: {
    group: "Natural",
    explanation: "Dry the whole cherry with its skin, pulp and mucilage intact. Remove the dried fruit layers later.",
  },
  honey: {
    group: "Honey / pulped natural",
    explanation: "Remove the skin and pulp. Dry the parchment-covered seeds with some of the sticky mucilage still attached.",
  },
};

export function createProcessDemo(panel, cutaway) {
  const color = processColor();
  const buttons = [...panel.querySelectorAll("[data-method]")];
  const drying = panel.querySelector('[data-cutaway="drying"]');
  const explanation = panel.querySelector(".process-panel__explanation");
  const fresh = panel.querySelector('[data-cutaway="fresh"]');
  fresh.replaceChildren(cutaway.cloneNode(true));
  const freshHalf = fresh.firstElementChild;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  let selected = "washed";
  let active = false;
  let arrival;

  function replay(delay = 0) {
    drying.style.setProperty("--layer-delay", `${delay}ms`);
    drying.replaceChildren(cutaway.cloneNode(true));
  }

  function choose(method) {
    selected = method;
    drying.dataset.method = selected;
    explanation.textContent = METHODS[selected].explanation;
    panel.style.setProperty("--method-color", color(METHODS[selected].group));
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset.method === selected));
    }
    replay();
  }

  for (const button of buttons) {
    button.style.setProperty("--button-method-color", color(METHODS[button.dataset.method].group));
    button.addEventListener("click", () => choose(button.dataset.method));
  }
  panel.querySelector(".process-panel__replay").addEventListener("click", () => replay());
  choose(selected);

  return {
    setActive(next, origin) {
      if (next === active) return;
      active = next;
      arrival?.cancel();
      if (!active) return;
      const withArrival = origin && origin.bottom > 0 && origin.top < innerHeight && !reducedMotion.matches;
      replay(withArrival ? 370 : 0);
      if (!withArrival) return;

      const target = freshHalf.getBoundingClientRect();
      const x = origin.left + origin.width / 2 - target.left - target.width / 2;
      const y = origin.top + origin.height / 2 - target.top - target.height / 2;
      const scale = Math.max(0.12, Math.min(1, origin.width / target.width));
      arrival = freshHalf.animate([
        { transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(-10deg)` },
        { transform: "none" },
      ], { duration: 620, easing: "cubic-bezier(.25, .68, .30, 1)" });
    },
  };
}
