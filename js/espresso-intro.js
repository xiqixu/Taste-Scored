const intro = document.querySelector(".espresso-intro");
const viewport = intro.querySelector(".espresso-intro__viewport");
const video = intro.querySelector("video");
const flowCanvas = document.createElement("canvas");
flowCanvas.className = "espresso-intro__flow";
flowCanvas.setAttribute("aria-hidden", "true");
intro.querySelector(".espresso-intro__media").after(flowCanvas);
const flow = flowCanvas.getContext("2d");
const widePoster = video.getAttribute("poster");
const portrait = matchMedia("(max-aspect-ratio: 1/1)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const frameSeconds = 1 / 24;
const cutAt = 0.7;

function interval(progress, start, end) {
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}

function ease(progress) {
  return progress * progress * (3 - 2 * progress);
}

function paintFlow(progress, width, height, atCut) {
  flowCanvas.style.visibility = atCut && progress > 0 && progress < 1 ? "visible" : "hidden";
  if (!atCut || !flow || progress <= 0 || progress >= 1) return;

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
  const [frameWidth, frameHeight, tipX, tipY] = portrait.matches
    ? [648, 1152, 362, 767]
    : [1440, 810, 744, 630];
  const cover = Math.max(width / frameWidth, height / frameHeight);
  const x = (width - frameWidth * cover) / 2 + tipX * cover;
  const y = (height - frameHeight * cover) / 2 + tipY * cover;
  const fall = interval(progress, 0, 0.63);
  const length = (height * 0.97 - y) * fall ** 1.48;
  const tipWidth = Math.max(3, (portrait.matches ? 13 : 10) * cover);
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

let frame;
function render() {
  frame = undefined;
  if (reducedMotion.matches) return;

  const stickyDistance = intro.offsetHeight - viewport.clientHeight;
  const travelled = -intro.getBoundingClientRect().top;
  if (stickyDistance <= 0 || travelled > intro.offsetHeight) return;

  const progress = interval(travelled, 0, stickyDistance);
  const bridge = interval(progress, cutAt, 1);
  viewport.style.setProperty("--video-opacity", 1 - ease(interval(bridge, 0.25, 0.9)));
  viewport.style.setProperty("--cue-opacity", 1 - interval(progress, 0.12, 0.32));

  // Finish the latest scroll seek before issuing another one. A seeked event
  // catches up to the latest scroll position if a frame took longer to decode.
  const lastFrame = video.duration - frameSeconds;
  const ready = Number.isFinite(lastFrame) && !video.seeking;
  const atCut = ready && Math.abs(video.currentTime - lastFrame) < 0.001;
  paintFlow(bridge, viewport.clientWidth, viewport.clientHeight, atCut);
  if (!ready) return;
  const target = interval(progress, 0, cutAt) * lastFrame;
  const seekThreshold = progress >= cutAt ? 0.001 : frameSeconds / 2;
  if (Math.abs(video.currentTime - target) >= seekThreshold) video.currentTime = target;
}

function requestRender() {
  if (frame === undefined) frame = requestAnimationFrame(render);
}

let selectedSource;
let download;
let objectUrl;
async function chooseVideo() {
  const source = reducedMotion.matches ? null : (portrait.matches ? video.dataset.tallSrc : video.dataset.wideSrc);
  if (source === selectedSource) return;
  selectedSource = source;
  download?.abort();

  video.poster = portrait.matches ? video.dataset.tallPoster : widePoster;
  if (video.hasAttribute("src")) {
    video.removeAttribute("src");
    video.load();
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  }
  if (!source) return;

  // Download only the chosen edit. Seeking then works on local static servers
  // that return the whole file even when the video element requests a range.
  const controller = new AbortController();
  download = controller;
  try {
    const response = await fetch(source, { signal: controller.signal });
    if (!response.ok) throw new Error(`Video download returned ${response.status}`);
    const clip = await response.blob();
    if (controller.signal.aborted) return;
    objectUrl = URL.createObjectURL(clip);
    video.src = objectUrl;
  } catch (error) {
    if (!controller.signal.aborted) video.src = source;
  }
}

window.addEventListener("scroll", requestRender, { passive: true });
window.addEventListener("resize", requestRender);
video.addEventListener("loadedmetadata", requestRender);
video.addEventListener("seeked", requestRender);
portrait.addEventListener("change", chooseVideo);
reducedMotion.addEventListener("change", chooseVideo);
chooseVideo();
