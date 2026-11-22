export function createCherryScene(scene, cutaway) {
  const fruit = scene.querySelector(".cherry-scene__fruit");
  const stem = scene.querySelector(".cherry-scene__stem");
  const halves = [...scene.querySelectorAll(".cherry-scene__half")];
  for (const half of halves) half.replaceChildren(cutaway.cloneNode(true));
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let animations = [];
  let active = false;

  return {
    cutawayOrigin() {
      const visibleHalf = Number(getComputedStyle(halves[0]).opacity) > 0.25;
      return (visibleHalf ? halves[0] : fruit).getBoundingClientRect();
    },
    setActive(next, source) {
      if (next === active) return;
      active = next;
      for (const animation of animations) animation.cancel();
      animations = [];
      if (!active || reducedMotion.matches) return;

      const resting = fruit.getBoundingClientRect();
      const centerX = resting.left + resting.width / 2;
      const centerY = resting.top + resting.height / 2;
      const branch = stem.getBoundingClientRect();
      const hangX = branch.left - centerX;
      const hangY = branch.top - centerY;
      const ripe = getComputedStyle(fruit).backgroundColor;
      const duration = source ? 2370 : 1470;
      scene.style.setProperty("--fall-duration", `${duration}ms`);

      function pose(x, y, angle, scaleX = 1, scaleY = scaleX) {
        return `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${angle}deg) scale(${scaleX}, ${scaleY})`;
      }

      const approach = source ? [
        { offset: 0, transform: pose(source.x - centerX, source.y - centerY, 0,
          source.diameter / resting.width, source.diameter / resting.height), backgroundColor: "var(--roast)", easing: "ease-in" },
        { offset: 0.30, transform: pose(hangX - 12, hangY - 20, -17, 0.84), backgroundColor: ripe, easing: "ease-out" },
        { offset: 0.46, transform: pose(hangX, hangY, -6), backgroundColor: ripe, easing: "ease-in-out" },
      ] : [{ offset: 0, transform: pose(hangX, hangY, -6), backgroundColor: ripe, easing: "ease-in-out" }];

      animations.push(fruit.animate([
        ...approach.map((keyframe) => ({ ...keyframe, opacity: 1 })),
        { offset: source ? 0.58 : 0.28, transform: pose(hangX, hangY + 1, 4), opacity: 1, backgroundColor: ripe, easing: "cubic-bezier(.55, .02, 1, .55)" },
        { offset: 0.75, transform: pose(0, 0, 17, 1.12, 0.83), opacity: 1, backgroundColor: ripe },
        { offset: 0.78, transform: pose(0, 1, 17, 1.13, 0.77), opacity: 0, backgroundColor: ripe },
        { offset: 1, opacity: 0 },
      ], { duration }));

      for (const [index, half] of halves.entries()) {
        const side = index === 0 ? -1 : 1;
        const restingTransform = getComputedStyle(half).transform;
        const closed = `rotate(${side * 55}deg) scale(.28,.73)`;
        animations.push(half.animate([
          { offset: 0, opacity: 0, transform: closed },
          { offset: 0.74, opacity: 0, transform: closed },
          { offset: 0.79, opacity: 1, transform: closed, easing: "ease-out" },
          { offset: 0.91, opacity: 1, transform: `translate(${side * 47}%, -20%) rotate(${side * 16}deg)`, easing: "ease-in-out" },
          { offset: 1, opacity: 1, transform: restingTransform },
        ], { duration }));
      }
    },
  };
}
