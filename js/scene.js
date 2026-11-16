// scene.js — the landscape behind the home page, and the scroll that carries
// the reader from it into Act 1.
//
// Idea (after escape.cafe, where one tall photo runs from sky down to waves):
// the reader looks down a coffee farm in the highlands. Sky and ridges at the
// top, then rows of coffee shrubs with red cherries, then the ground. The
// ground is the page's own --bean colour, so by the time Act 1 starts the
// background is already the plain colour the rest of the story uses. There is
// no seam to hide: the scene simply ends in the solid colour.
//
// Every layer moves up at its own speed while you scroll (parallax): far
// ridges slowly, near shrubs fast. With "reduce motion" switched on, all
// layers move together like an ordinary picture.
//
// Self-contained: index.html only needs
//   <link rel="stylesheet" href="css/hero-scene.css">
//   <script type="module" src="js/scene.js"></script>

import { reducedMotion, cssVar } from "./utils.js";

// The home-page photo. Set PHOTO = null to go back to the drawn sky, ridges
// and coffee shrubs. Credit the photographer in "Data and credits".
const PHOTO = {
  src: "assets/scene/highlands.jpg",          // 1717 px wide
  small: "assets/scene/highlands-900.jpg",    // used on phones
  position: "50% 35%",                        // which part stays in view when cropped
};

// base: where the layer's top edge sits at the start, as a share of the
// screen height. speed: how far it rises per screen-height scrolled.
const LAYERS = {
  sky:  { base: 0.0,  speed: 0.12 },
  far:  { base: 0.56, speed: 0.38 },
  mist: { base: 0.62, speed: 0.5 },
  mid:  { base: 0.7,  speed: 0.72 },
  near: { base: 0.88, speed: 1.32 },
};

// With a photo, the ground rises at the same speed as the page, so it stays
// just below the home-page text and never slides underneath it.
if (PHOTO) Object.assign(LAYERS.near, { base: 0.8, speed: 1 });

const COLORS = {
  skyTop: "#bccbca",
  skyLow: "#dfe0cc",
  far: "#a8b4a6",
  mid: "#8b9b80",
  hill: "#5b7150",
  shrub: "#46603f",
  leaf: "#6c8a5c",
};

const hero = document.querySelector(".hero");
// Lets the CSS switch the home-page text to off-white over the photo.
document.body.classList.toggle("has-hero-photo", Boolean(PHOTO));
const scene = document.createElement("div");
scene.className = "scene";
scene.setAttribute("aria-hidden", "true");
document.body.prepend(scene);

const els = {};
for (const name of Object.keys(LAYERS)) {
  const el = document.createElement("div");
  el.className = `scene__layer scene__layer--${name}`;
  scene.append(el);
  els[name] = el;
}

// ---- Drawing --------------------------------------------------------------

// Same "random" numbers every time, so the landscape never jumps on reload.
function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A ridge line: a few overlapping waves, so it looks like hills, not noise.
function ridge(W, amp, waves, phase) {
  return (x) => waves.reduce((y, [len, a], i) => y + Math.sin((x / len) * Math.PI * 2 + phase * (i + 1)) * a, 0) * amp;
}

function silhouette(W, H, top, fn, fill) {
  const pts = d3.range(0, W + 41, 40).map((x) => [x, top + fn(x)]);
  const area = d3.area().x((p) => p[0]).y0(H).y1((p) => p[1]).curve(d3.curveBasis);
  return `<path d="${area(pts)}" fill="${fill}"/>`;
}

function draw() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const tall = H * 2.4; // layers are taller than the screen so they never run out
  const bean = cssVar("--bean");
  const cherry = cssVar("--cherry");

  // Sky
  els.sky.innerHTML = PHOTO
    ? `<img src="${PHOTO.src}" srcset="${PHOTO.small} 900w, ${PHOTO.src} 1717w" sizes="100vw"
         alt="" style="object-position:${PHOTO.position}"><div class="scene__scrim"></div>`
    : `<div class="scene__sky" style="background:linear-gradient(${COLORS.skyTop}, ${COLORS.skyLow} 70%)"></div>`;

  // Far and middle ridges (hidden behind a photo if one is used)
  els.far.innerHTML = PHOTO ? "" : svg(W, tall,
    silhouette(W, tall, 40, ridge(W, 1, [[W * 0.9, 34], [W * 0.31, 14], [W * 0.13, 5]], 1.3), COLORS.far));
  els.mist.innerHTML = PHOTO ? "" : `<div class="scene__mist"></div>`;
  els.mid.innerHTML = PHOTO ? "" : svg(W, tall,
    silhouette(W, tall, 46, ridge(W, 1, [[W * 1.3, 40], [W * 0.42, 16], [W * 0.17, 6]], 2.1), COLORS.mid));

  if (PHOTO) {
    const edge = Math.max(160, H * 0.3); // photo → plain ground
    els.near.innerHTML = svg(W, tall, `
      <defs>
        <linearGradient id="scene-ground" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style="stop-color:${bean};stop-opacity:0"/>
          <stop offset="0.55" style="stop-color:${bean};stop-opacity:0.75"/>
          <stop offset="1" style="stop-color:${bean};stop-opacity:1"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${W}" height="${edge}" fill="url(#scene-ground)"/>
      <rect x="0" y="${edge - 1}" width="${W}" height="${tall}" fill="${bean}"/>`);
    coverAt = edge / H;
    update();
    return;
  }

  // Near hill: shrub rows with cherries, fading into the --bean ground.
  const rand = seeded(7);
  const top = ridge(W, 1, [[W * 1.6, 26], [W * 0.5, 10]], 0.4);
  const band = Math.max(150, H * 0.3);   // depth of the shrub rows
  const fade = Math.max(120, H * 0.18);  // shrubs → plain ground
  const y0 = 60;                         // hill top inside the layer
  let shrubs = "";
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const radius = 9 + r * 4.5;          // nearer rows are bigger
    const offset = 12 + (r * band) / rows;
    for (let x = -radius + rand() * radius; x < W + radius; x += radius * 2.05) {
      const y = y0 + top(x) + offset + (rand() - 0.5) * radius * 0.5;
      shrubs += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${COLORS.shrub}"/>`;
      shrubs += `<circle cx="${(x - radius * 0.25).toFixed(1)}" cy="${(y - radius * 0.3).toFixed(1)}" r="${(radius * 0.55).toFixed(1)}" fill="${COLORS.leaf}" opacity="0.7"/>`;
      if (rand() < 0.4) {
        for (let k = 0; k < 4; k++) {
          const a = rand() * Math.PI * 2;
          shrubs += `<circle cx="${(x + Math.cos(a) * radius * 0.5).toFixed(1)}" cy="${(y + Math.sin(a) * radius * 0.45).toFixed(1)}" r="${Math.max(1.6, radius * 0.16).toFixed(1)}" fill="${cherry}"/>`;
        }
      }
    }
  }
  const gTop = y0 - 30, gEnd = y0 + band + fade;
  els.near.innerHTML = svg(W, tall, `
    <defs>
      <linearGradient id="scene-ground" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${gTop}" y2="${gEnd}">
        <stop offset="0" style="stop-color:${COLORS.hill}"/>
        <stop offset="${((band - 10) / (gEnd - gTop)).toFixed(3)}" style="stop-color:${COLORS.hill}"/>
        <stop offset="1" style="stop-color:${bean}"/>
      </linearGradient>
    </defs>
    ${silhouette(W, tall, y0, top, "url(#scene-ground)")}
    <g>${shrubs}</g>
    <rect x="0" y="${y0 + band - 10}" width="${W}" height="${fade + 12}" fill="url(#scene-ground)" opacity="0.85"/>
    <rect x="0" y="${gEnd - 1}" width="${W}" height="${tall}" fill="${bean}"/>`);

  // Where the near layer is fully plain ground, as a share of screen height.
  coverAt = (y0 + band + fade) / H;
  update();
}

const svg = (W, H, inner) =>
  `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${inner}</svg>`;

// ---- Scrolling ------------------------------------------------------------

let coverAt = 0.6;
let ticking = false;

function update() {
  ticking = false;
  const H = window.innerHeight;
  // p = 0 at the top of the page, 1 when the hero has scrolled away.
  const p = Math.max(0, window.scrollY / Math.max(1, hero.offsetHeight));
  for (const [name, { base, speed }] of Object.entries(LAYERS)) {
    const s = reducedMotion ? 1 : speed;
    els[name].style.transform = `translate3d(0, ${((base - s * p) * H).toFixed(1)}px, 0)`;
  }
  // Once the ground covers the screen, the scene is invisible; stop painting it.
  const nearTop = (LAYERS.near.base - (reducedMotion ? 1 : LAYERS.near.speed) * p) * H;
  scene.style.visibility = nearTop + coverAt * H < 0 ? "hidden" : "visible";
}

window.addEventListener("scroll", () => {
  if (!ticking) { ticking = true; requestAnimationFrame(update); }
}, { passive: true });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(draw, 120);
});

draw();
