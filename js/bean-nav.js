// Acts 2–4 share a sticky chart, so their chapter anchors sit in its story column.
const chapterIds = [
  "hero",
  "act-wheel",
  "act-dots",
  "act3-production",
  "act4-cherry",
  "act-yours",
];
const roastByDistance = ["dark", "medium"];

const nav = document.createElement("nav");
nav.className = "bean-nav";
nav.setAttribute("aria-label", "Story chapters");

const chapterList = document.createElement("ol");
chapterList.setAttribute("role", "list");
nav.append(chapterList);

const chapters = chapterIds.map((id) => {
  const anchor = document.getElementById(id);
  const heading = id === "act3-production"
    ? document.getElementById("act3-title")
    : anchor.querySelector("h1, h2");
  const act = heading.parentElement.querySelector(".act__num");
  const name = act ? `${act.textContent} · ${heading.textContent.trim()}` : "Introduction";
  const link = document.createElement("a");
  link.className = "bean-nav__link";
  link.href = `#${id}`;
  link.setAttribute("aria-label", name);

  const bean = document.createElement("span");
  bean.className = "bean-nav__bean";
  bean.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "bean-nav__label";
  label.textContent = name;
  label.setAttribute("aria-hidden", "true");

  const item = document.createElement("li");
  link.append(bean, label);
  item.append(link);
  chapterList.append(item);

  return { start: id === "act3-production" ? heading : anchor, link };
});

document.querySelector("main").before(nav);

let current = -1;
let frame;

function updateActiveChapter() {
  frame = undefined;
  const readingLine = window.innerHeight / 2;
  let active = 0;
  for (const [index, { start }] of chapters.entries()) {
    if (start.getBoundingClientRect().top > readingLine) break;
    active = index;
  }
  if (active === current) return;
  current = active;

  chapters.forEach(({ link }, index) => {
    if (index === active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
    link.dataset.roast = roastByDistance[Math.abs(index - active)] ?? "green";
  });
}

function scheduleUpdate() {
  if (frame === undefined) frame = requestAnimationFrame(updateActiveChapter);
}

window.addEventListener("scroll", scheduleUpdate, { passive: true });
window.addEventListener("resize", scheduleUpdate);
window.addEventListener("pageshow", scheduleUpdate);
new ResizeObserver(scheduleUpdate).observe(document.body);
updateActiveChapter();
