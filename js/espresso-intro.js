const intro = document.querySelector(".espresso-intro");
const hero = document.getElementById("hero");
const viewport = intro.querySelector(".espresso-intro__viewport");
const video = intro.querySelector("video");
const playButton = intro.querySelector(".espresso-intro__play");
const skipButton = intro.querySelector(".espresso-intro__skip");
const flowCanvas = intro.querySelector("canvas");
const flow = flowCanvas.getContext("2d");
const portrait = matchMedia("(max-aspect-ratio: 1/1)").matches;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const transitionMs = 1550;

function interval(progress, start, end) {
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}

function ease(progress) {
  return progress * progress * (3 - 2 * progress);
}

function paintFlow(progress, width, height) {
  if (!flow || progress <= 0 || progress >= 1) return;

  const scale = Math.min(window.devicePixelRatio, 1.5);
  const bitmapWidth = Math.round(width * scale);
  const bitmapHeight = Math.round(height * scale);
  if (flowCanvas.width !== bitmapWidth || flowCanvas.height !== bitmapHeight) {
    flowCanvas.width = bitmapWidth;
    flowCanvas.height = bitmapHeight;
  }
  flow.setTransform(scale, 0, 0, scale, 0, 0);
  flow.clearRect(0, 0, width, height);

  // The tip of the real drip in the final frame of each edit. Project through
  // the centered object-fit: cover crop so the drawn continuation meets it.
  const [frameWidth, frameHeight, tipX, tipY] = portrait
    ? [648, 1152, 362, 767]
    : [1440, 810, 744, 630];
  const cover = Math.max(width / frameWidth, height / frameHeight);
  const x = (width - frameWidth * cover) / 2 + tipX * cover;
  const y = (height - frameHeight * cover) / 2 + tipY * cover;
  const fall = interval(progress, 0, 0.63);
  const length = (height * 0.97 - y) * fall ** 1.48;
  const tipWidth = Math.max(3, (portrait ? 13 : 10) * cover);
  const tailX = x - Math.min(10, width * 0.016) * fall;
  const tailY = y + length;
  const fade = 1 - ease(interval(progress, 0.59, 1));

  const wash = ease(interval(progress, 0.33, 0.8)) * fade;
  if (wash > 0) {
    flow.save();
    flow.translate(tailX, height * 0.96);
    flow.scale(1, 0.32);
    const radius = Math.min(width * 0.72, 560);
    const pool = flow.createRadialGradient(0, 0, 0, 0, 0, radius);
    pool.addColorStop(0, `rgba(102,49,23,${0.48 * wash})`);
    pool.addColorStop(0.4, `rgba(146,81,40,${0.28 * wash})`);
    pool.addColorStop(1, "rgba(173,106,52,0)");
    flow.fillStyle = pool;
    flow.fillRect(-radius, -radius, radius * 2, radius * 2);
    flow.restore();
  }

  if (length < 0.7) return;
  const color = flow.createLinearGradient(x, y, tailX, tailY);
  color.addColorStop(0, "#21130d");
  color.addColorStop(0.45, "#512817");
  color.addColorStop(1, "#763f26");
  const taper = tipWidth * 0.28;
  flow.save();
  flow.globalAlpha = fade * ease(interval(progress, 0, 0.1));
  flow.fillStyle = color;
  flow.beginPath();
  flow.moveTo(x - tipWidth / 2, y);
  flow.bezierCurveTo(x - tipWidth, y + length * 0.18, tailX - taper, y + length * 0.7, tailX - taper, tailY);
  flow.quadraticCurveTo(tailX, tailY + taper * 2, tailX + taper, tailY);
  flow.bezierCurveTo(tailX + tipWidth * 0.48, y + length * 0.6, x + tipWidth * 0.52, y + length * 0.22, x + tipWidth / 2, y);
  flow.closePath();
  flow.fill();
  flow.restore();
}

function startIntro() {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let frame;
  let loadingTimer;
  let transitionStarted;

  function finish() {
    if (intro.hidden) return;
    const moveFocus = intro.contains(document.activeElement);
    listeners.abort();
    if (frame !== undefined) cancelAnimationFrame(frame);
    clearTimeout(loadingTimer);
    intro.hidden = true;
    document.body.classList.remove("has-espresso-intro");
    hero.style.removeProperty("--espresso-arrival");
    video.pause();
    video.removeAttribute("src");
    video.load();
    if (moveFocus) hero.focus({ preventScroll: true });
  }

  async function play() {
    if (document.activeElement === playButton) skipButton.focus({ preventScroll: true });
    playButton.hidden = true;
    loadingTimer = setTimeout(finish, 8000);
    try {
      await video.play();
    } catch (error) {
      if (intro.hidden) return;
      if (error.name === "NotAllowedError") playButton.hidden = false;
      else finish();
    } finally {
      clearTimeout(loadingTimer);
    }
  }

  function descend(now) {
    transitionStarted ??= now;
    const progress = interval(now - transitionStarted, 0, transitionMs);
    if (progress === 1) {
      finish();
      return;
    }

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const camera = ease(interval(progress, 0.1, 1));
    viewport.style.setProperty("--camera-offset", `${-height * 0.8 * camera}px`);
    viewport.style.setProperty("--frame-edge", `${100 - 32 * camera}%`);
    viewport.style.setProperty("--video-opacity", 1 - ease(interval(progress, 0.27, 0.95)));
    hero.style.setProperty("--espresso-arrival", `${height * 0.18 * (1 - camera)}px`);
    paintFlow(progress, width, height);
    frame = requestAnimationFrame(descend);
  }

  playButton.addEventListener("click", play, options);
  skipButton.addEventListener("click", finish, options);
  video.addEventListener("ended", () => { frame = requestAnimationFrame(descend); }, options);
  video.addEventListener("error", finish, options);
  window.addEventListener("scroll", () => {
    if (window.scrollY > 1) finish();
  }, { ...options, passive: true });
  window.addEventListener("hashchange", finish, options);
  window.addEventListener("pagehide", finish, options);
  document.addEventListener("focusin", (event) => {
    if (!intro.contains(event.target)) finish();
  }, options);
  reducedMotion.addEventListener("change", finish, options);

  if (portrait) video.poster = video.dataset.tallPoster;
  video.src = portrait ? video.dataset.tallSrc : video.dataset.wideSrc;
  intro.hidden = false;
  document.body.classList.add("has-espresso-intro");
  play();
}

const navigation = performance.getEntriesByType("navigation")[0];
const opensAtHome = !location.hash || location.hash === "#hero";
if (!reducedMotion.matches && opensAtHome && window.scrollY <= 1 && navigation?.type !== "back_forward") {
  startIntro();
}
