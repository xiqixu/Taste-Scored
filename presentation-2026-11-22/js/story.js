// story.js — the scrollytelling engine.
//
// It watches every `.step` inside a section. When a step crosses the middle of
// the screen it gets the class `is-active` and we call onStep(step.dataset.state).
// That's all Scrollama does too; doing it ourselves keeps the project
// dependency-free. (Swap in Scrollama later if you want its extra options.)

export function observeSteps(sectionSelector, onStep) {
  const steps = [...document.querySelectorAll(`${sectionSelector} .step`)];
  let current = null;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.target === current) continue;
        current?.classList.remove("is-active");
        current = entry.target;
        current.classList.add("is-active");
        onStep(current.dataset.state, steps.indexOf(current));
      }
    },
    // A 0px-tall "trigger line" across the middle of the viewport.
    { rootMargin: "-50% 0px -50% 0px", threshold: 0 }
  );

  steps.forEach((s) => observer.observe(s));
}
