import { onResize } from "../utils.js";

const ROUTE_LIMIT = 8;
const formatTonnes = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
const routeId = ([exporter, importer]) => `${exporter}-${importer}`;

export function createTradeMap(container, world, { countries, years }) {
  const [firstYear, lastYear] = d3.extent(Object.keys(years), Number);
  const yearInput = container.querySelector("#trade-year");
  const yearLabel = container.querySelector("#trade-year-label");
  const areaInput = d3.select(container.querySelector("#trade-area"));
  const directionInput = container.querySelector("#trade-direction");
  const replayButton = container.querySelector("#trade-replay");
  const routeCount = container.querySelector("#trade-route-count");
  const detail = container.querySelector("output");
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

  yearInput.min = firstYear;
  yearInput.max = lastYear;
  yearInput.value = lastYear;
  container.querySelector("#trade-first-year").textContent = firstYear;
  container.querySelector("#trade-last-year").textContent = lastYear;

  areaInput.selectAll("option.area")
    .data(Object.entries(countries).sort(([, a], [, b]) => a[0].localeCompare(b[0])))
    .join("option")
    .attr("class", "area")
    .attr("value", ([code]) => code)
    .text(([, [name]]) => name);

  const graphic = container.querySelector(".trade-map__graphic");
  const svg = d3.select(graphic).append("svg")
    .attr("role", "group")
    .attr("aria-labelledby", "trade-title");
  const projection = d3.geoNaturalEarth1();
  const land = svg.append("g").attr("aria-hidden", "true").selectAll("path")
    .data(world.features)
    .join("path")
    .attr("class", "coffee-map__land");
  const defs = svg.append("defs");
  for (const [kind, color] of [["normal", "var(--husk)"], ["selected", "var(--cherry)"]]) {
    defs.append("marker")
      .attr("id", `trade-arrow-${kind}`)
      .attr("viewBox", "0 0 8 8")
      .attr("refX", 7.5).attr("refY", 4)
      .attr("markerWidth", 8).attr("markerHeight", 8)
      .attr("markerUnits", "userSpaceOnUse").attr("orient", "auto")
      .append("path").attr("d", "M0 0 L8 4 L0 8 Z").attr("fill", color);
  }
  const layer = svg.append("g");
  const widths = d3.scaleLinear([0, d3.max(Object.values(years), (routes) => routes[0][2])], [0.9, 7]);
  const points = new Map();

  let selected = null;
  let active = false;
  let ready = false;

  function routeLabel([exporter, importer, tonnes]) {
    return `${countries[exporter][0]} → ${countries[importer][0]} · ${formatTonnes.format(tonnes)} t`;
  }

  function routePath([exporter, importer]) {
    const [x1, y1] = points.get(exporter);
    const [x2, y2] = points.get(importer);
    const lift = Math.min(65, Math.hypot(x2 - x1, y2 - y1) * 0.23);
    return `M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2 - lift} ${x2},${y2}`;
  }

  function selectRoute(route) {
    selected = route ? routeId(route) : null;
    layer.selectAll(".trade-map__route").attr("aria-pressed", (d) => String(routeId(d) === selected));
    detail.value = route ? routeLabel(route) : "No mapped routes with reported tonnage.";
  }

  function completeRoutes(routes) {
    routes.classed("is-launching", false);
    routes.select(".trade-map__line").attr("stroke-dashoffset", null);
    routes.select(".trade-map__projectile").attr("visibility", "hidden");
  }

  function stopLaunch() {
    completeRoutes(layer.selectAll(".trade-map__route").interrupt("launch"));
  }

  function launch(startDelay = 0) {
    if (!active || !ready) return;
    const routes = layer.selectAll(".trade-map__route").interrupt("launch").classed("is-launching", true);
    routes.select(".trade-map__line").attr("stroke-dashoffset", 1);
    routes.select(".trade-map__projectile").attr("visibility", "hidden");

    routes.transition("launch")
      .delay((_, i) => startDelay + i * 55)
      .duration(960)
      .ease(d3.easeQuadOut)
      .tween("trajectory", function () {
        const line = this.querySelector(".trade-map__line");
        const projectile = this.querySelector(".trade-map__projectile");
        const length = line.getTotalLength();
        projectile.setAttribute("visibility", "visible");
        return (progress) => {
          const { x, y } = line.getPointAtLength(progress * length);
          projectile.setAttribute("cx", x);
          projectile.setAttribute("cy", y);
          line.setAttribute("stroke-dashoffset", 1 - progress);
        };
      })
      .on("end", function () { completeRoutes(d3.select(this)); });
  }

  function launchIfAllowed(startDelay = 0) {
    if (!motionPreference.matches) launch(startDelay);
  }

  function draw() {
    stopLaunch();
    const year = yearInput.valueAsNumber;
    const area = areaInput.property("value");
    const endpoint = directionInput.value === "imports" ? 1 : 0;
    directionInput.disabled = !area;
    yearLabel.textContent = year;
    const yearRoutes = years[year];
    const routes = (area ? yearRoutes.filter((route) => route[endpoint] === Number(area)) : yearRoutes)
      .slice(0, ROUTE_LIMIT);
    replayButton.disabled = routes.length === 0;
    routeCount.textContent = routes.length ? `${routes.length} largest routes · exporter → importer` : "Exporter → importer";

    const groups = layer.selectAll(".trade-map__route")
      .data(routes, routeId)
      .join((enter) => {
        const group = enter.append("g").attr("class", "trade-map__route")
          .attr("role", "button").attr("tabindex", 0)
          .on("click", (_, route) => selectRoute(route))
          .on("keydown", (event, route) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            selectRoute(route);
          });
        group.append("title");
        group.append("path").attr("class", "trade-map__line").attr("pathLength", 1);
        group.append("circle").attr("class", "trade-map__projectile")
          .attr("r", 3.5).attr("visibility", "hidden").attr("aria-hidden", "true");
        group.append("path").attr("class", "trade-map__hit");
        return group;
      })
      .attr("data-route", routeId)
      .attr("aria-label", routeLabel);
    groups.select("title").text(routeLabel);
    groups.select(".trade-map__line").attr("d", routePath)
      .attr("stroke-width", (d) => widths(d[2]));
    groups.select(".trade-map__hit").attr("d", routePath);
    selectRoute(routes.find((route) => routeId(route) === selected) ?? routes[0]);
  }

  yearInput.addEventListener("input", draw);
  yearInput.addEventListener("change", () => launchIfAllowed());
  function updateFilter() {
    draw();
    launchIfAllowed();
  }
  areaInput.on("change", updateFilter);
  directionInput.addEventListener("change", updateFilter);
  replayButton.addEventListener("click", () => launch());
  motionPreference.addEventListener("change", (event) => {
    if (event.matches) stopLaunch();
  });

  onResize(graphic, (width, height) => {
    const padding = Math.min(32, width * 0.05, height * 0.1) + 3;
    projection.fitExtent([[padding, 4], [width - padding, height - 4]], world);
    svg.attr("viewBox", [0, 0, width, height]);
    land.attr("d", d3.geoPath(projection));
    for (const [code, [, longitude, latitude]] of Object.entries(countries)) {
      points.set(Number(code), projection([longitude, latitude]));
    }
    draw();
    const firstLayout = !ready;
    ready = true;
    if (firstLayout) launchIfAllowed(160);
  });

  return {
    setActive(show) {
      if (active === show) return;
      active = show;
      if (show) launchIfAllowed(160);
      else stopLaunch();
    },
  };
}
