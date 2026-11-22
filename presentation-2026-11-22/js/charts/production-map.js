import { dur, hideTooltip, onResize, showTooltip } from "../utils.js";

// OWID names that differ from the names in the Natural Earth basemap.
const LAND_NAMES = {
  CAF: "Central African Rep.",
  CIV: "Côte d'Ivoire",
  COD: "Dem. Rep. Congo",
  DOM: "Dominican Rep.",
  GNQ: "Eq. Guinea",
  OWID_ERE: "Ethiopia",
  TLS: "Timor-Leste",
  USA: "United States of America",
};

// Representative points for islands too small for the 1:110m basemap.
const ISLAND_POINTS = {
  COK: [-159.8, -21.2],
  COM: [43.3, -11.7],
  CPV: [-23.6, 15.1],
  DMA: [-61.4, 15.4],
  GLP: [-61.55, 16.2],
  LCA: [-61.00, 13.9],
  MTQ: [-61.02, 14.65],
  MUS: [57.55, -20.25],
  PYF: [-149.4, -17.6],
  STP: [6.6, 0.3],
  TON: [-175.2, -21.2],
  VCT: [-61.2, 13.2],
  WSM: [-172.1, -13.8],
};
const HAWAII = [-155.5, 19.6];

// Continental extents include offshore coffee producers. Oceania uses a
// Pacific-centered projection to keep the islands on both sides of the date line together.
const CONTINENTS = {
  Africa: [-28, -36, 61, 39],
  Asia: [24, -12, 179.99, 75],
  Europe: [-25, 34, 53, 72],
  "North America": [-164, 6, -11, 81],
  Oceania: [111, -49, 215, 10],
  "South America": [-93, -57, -32, 15],
};
const BASE_SCALE = 180;
const LOCATOR_RADIUS = 2.8;

const SIZE_KEY = [
  { label: "100k t", tonnes: 100_000 },
  { label: "1M t", tonnes: 1_000_000 },
  { label: "3M t", tonnes: 3_000_000 },
];
const formatTonnes = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const PROFILE_SOURCES = {
  Firstbloom: "https://github.com/alexcaza/firstbloom-data",
  CQI: "https://github.com/fatih-boyar/coffee-quality-data-CQI",
};

function continentFrame(region) {
  const [west, south, east, north] = CONTINENTS[region];
  const midLatitude = Math.max(south, Math.min(0, north));
  return {
    type: "MultiPoint",
    coordinates: [west, (west + east) / 2, east].flatMap((longitude) =>
      [south, midLatitude, north].map((latitude) => [(longitude + 180) % 360 - 180, latitude])
    ),
  };
}

function nearbyPolygons(geometry, anchor) {
  if (geometry.type === "Polygon") return [geometry];
  const polygons = geometry.coordinates.map((coordinates) => ({ type: "Polygon", coordinates }));
  const nearby = polygons.filter((polygon) => d3.geoDistance(d3.geoCentroid(polygon), anchor) < 25 * Math.PI / 180);
  return nearby.length ? nearby : polygons;
}

export function createProductionMap(container, world, production, { land: landInfo, producers: producerRegions, islandOutlines }, profiles) {
  const mapFeatures = [...world.features, ...islandOutlines];
  const featuresByName = new Map(mapFeatures.map((f) => [f.properties.name, f]));
  const geographicCentres = new Map(world.features.map((f) => [f.properties.name, d3.geoCentroid(f)]));
  const byYear = d3.index(production, (d) => d.year, (d) => d.code);
  const producers = d3.rollup(production, ([first]) => {
    const { code, name } = first;
    const landName = LAND_NAMES[code] ?? name;
    const point = code === "USA" ? HAWAII : ISLAND_POINTS[code] ?? geographicCentres.get(landName);
    if (!point) throw new Error(`Missing map coordinates for ${name} (${code})`);
    return { code, name, point, landName, region: producerRegions[code] };
  }, (d) => d.code);
  const orderedProducers = Array.from(producers.values()).sort((a, b) => a.name.localeCompare(b.name));
  const producersByLand = d3.group(orderedProducers, (d) => d.landName);

  const [firstYear, lastYear] = d3.extent(production, (d) => d.year);
  let year = lastYear;
  let selectedCode = "";
  let selectedLand = "";
  let region = "";
  let country = "";
  let visibleReports = [];
  let width = 0;
  let height = 0;
  let zooming = false;
  let camera = { scale: 1, x: 0, y: 0, rotation: 0 };
  const slider = container.querySelector("#production-year");
  const yearLabel = container.querySelector("#production-year-label");
  slider.min = firstYear;
  slider.max = lastYear;
  slider.value = year;
  yearLabel.textContent = year;
  container.querySelector(".production-map__first-year").textContent = firstYear;
  container.querySelector(".production-map__last-year").textContent = lastYear;

  const picker = d3.select(container.querySelector("select"));
  const output = container.querySelector("output");
  const regionName = container.querySelector("#production-region-name");
  const backButton = container.querySelector("#production-back");
  const locatorKey = container.querySelector(".production-map__locator-key");
  const mapKey = container.querySelector(".production-map__key");
  const details = container.querySelector(".production-map__details");
  const detailFields = details.querySelectorAll("[data-profile]");
  const example = details.querySelector(".production-map__example");
  const exampleName = example.querySelector("span");
  const exampleSource = example.querySelector("a");

  const tooltipContent = document.createElement("div");
  const tooltipName = document.createElement("strong");
  const tooltipYear = document.createElement("div");
  const tooltipValue = document.createElement("div");
  const tooltipVarieties = document.createElement("div");
  const tooltipNotes = document.createElement("div");
  tooltipContent.append(tooltipName, tooltipYear, tooltipValue, tooltipVarieties, tooltipNotes);

  function locationDetails(name, code, report) {
    const profile = profiles[code];
    return {
      origin: profile?.region ? `${name} · ${profile.region}` : name,
      year: `${year} national production`,
      tonnes: report ? `${formatTonnes.format(report.tonnes)} t` : "No published figure",
      varieties: profile?.varieties.join(", ") || "No sample recorded",
      tastingNotes: profile?.tastingNotes.join(", ") || "No notes recorded",
      profile,
    };
  }

  function hoverInfo(event, name, code) {
    if (event.pointerType === "touch" || zooming) return;
    const stats = locationDetails(name, code, byYear.get(year).get(code));
    tooltipName.textContent = country ? stats.origin : name;
    tooltipYear.textContent = stats.year;
    tooltipValue.textContent = stats.tonnes;
    tooltipVarieties.hidden = tooltipNotes.hidden = !country;
    if (country) {
      tooltipVarieties.textContent = `Sample varieties · ${stats.varieties}`;
      tooltipNotes.textContent = `Sample notes · ${stats.tastingNotes}`;
    }
    showTooltip(event, tooltipContent.innerHTML);
  }

  function producerForLand(name) {
    const reports = byYear.get(year);
    const candidates = producersByLand.get(name) ?? [];
    return candidates.find((d) => reports.has(d.code)) ?? candidates[0];
  }

  const graphic = container.querySelector(".production-map__graphic");
  const svg = d3.select(graphic).append("svg")
    .attr("role", "img")
    .attr("aria-labelledby", "production-title");
  const landLayer = svg.append("g");
  const land = landLayer.selectAll("path").data(mapFeatures).join("path")
    .attr("class", "production-map__land")
    .classed("is-mappable", (f) => Object.hasOwn(CONTINENTS, landInfo[f.properties.name][0]))
    .on("click", (_, f) => chooseLand(f.properties.name))
    .on("pointerenter pointermove", (event, f) => {
      const name = f.properties.name;
      const producer = producerForLand(name);
      hoverInfo(event, producer?.name ?? landInfo[name][1], producer?.code);
    })
    .on("pointerleave", hideTooltip);
  const symbols = svg.append("g").attr("class", "production-map__bubbles");
  const circleLayer = symbols.append("g");
  // Draw the indicator above every bubble, including when the selected bubble is smaller than a pixel.
  const marker = symbols.append("circle")
    .attr("class", "production-map__selection")
    .attr("visibility", "hidden");
  const labelLayer = symbols.append("g").attr("aria-hidden", "true");

  const key = d3.select(container.querySelector(".production-map__sizes"))
    .selectAll("span").data(SIZE_KEY).join("span");
  const keySymbols = key.append("svg").append("circle")
    .attr("class", "production-map__symbol");
  key.append("span").text((d) => d.label);

  // A fixed domain keeps each symbol directly comparable across years.
  const maxTonnes = d3.max(production, (d) => d.tonnes);
  const radius = d3.scaleSqrt([0, maxTonnes], [0, 1]);
  const worldProjection = d3.geoNaturalEarth1();
  const baseProjection = d3.geoNaturalEarth1().scale(BASE_SCALE).translate([0, 0]).precision(0.2);
  const path = d3.geoPath(baseProjection).digits(5);
  land.attr("d", path);

  function screenPoint(point) {
    const [x, y] = baseProjection(point);
    return [x * camera.scale + camera.x, y * camera.scale + camera.y];
  }

  function landAnchor(name) {
    const [, , longitude, latitude] = landInfo[name];
    return [longitude, latitude];
  }

  function positionMarker(report) {
    if (country || !report?.tonnes) return;
    const [x, y] = screenPoint(producers.get(report.code).point);
    marker.attr("cx", x).attr("cy", y).attr("r", Math.max(8, radius(report.tonnes) + 4));
  }

  function syncDetails(report) {
    details.hidden = !country;
    mapKey.hidden = output.hidden = !!country;
    if (!country) return;
    const name = producers.get(selectedCode)?.name ?? landInfo[country][1];
    const stats = locationDetails(name, selectedCode, report);
    for (const field of detailFields) field.textContent = stats[field.dataset.profile];
    const profile = stats.profile;
    example.hidden = !profile;
    if (!profile) return;
    exampleName.textContent = profile.example ? `“${profile.example}” sample · ` : "Coffee sample · ";
    exampleSource.textContent = profile.source;
    exampleSource.href = PROFILE_SOURCES[profile.source];
  }

  function syncSelection() {
    symbols.attr("display", country ? "none" : null);
    picker.property("value", selectedCode);
    const report = byYear.get(year).get(selectedCode);
    const highlight = !country && report?.tonnes > 0;
    const inView = (d) => !country && (!region || producerRegions[d.code] === region);
    output.value = report ? `${formatTonnes.format(report.tonnes)} t` :
      selectedCode || selectedLand ? `No data for ${year}` : "";
    circleLayer.selectAll(".production-map__producer")
      .classed("is-selected", (d) => d.code === selectedCode)
      .classed("is-outside-region", (d) => !inView(d));
    locatorKey.hidden = !region || !visibleReports.some((d) => inView(d) && radius(d.tonnes) < LOCATOR_RADIUS);
    land.classed("is-selected", (f) => f.properties.name === selectedLand)
      .classed("is-outside-region", (f) => country ? f.properties.name !== country :
        !!region && landInfo[f.properties.name][0] !== region);
    marker.attr("visibility", highlight ? "visible" : "hidden");
    positionMarker(report);
    syncDetails(report);
  }

  function renderCamera(next) {
    if (next.rotation !== camera.rotation) {
      baseProjection.rotate([next.rotation, 0]);
      land.attr("d", path);
    }
    camera = next;
    landLayer.attr("transform", `translate(${camera.x},${camera.y}) scale(${camera.scale})`);
    circleLayer.selectAll(".production-map__producer").attr("transform", (d) => {
      const [x, y] = screenPoint(producers.get(d.code).point);
      return `translate(${x},${y})`;
    });
    positionMarker(byYear.get(year).get(selectedCode));
  }

  function targetCamera() {
    const rotation = region === "Oceania" ? -160 : 0;
    const padding = Math.min(20, width * 0.06);
    let view = region ? d3.geoNaturalEarth1().rotate([rotation, 0]).fitExtent(
      [[padding, 12], [width - padding, height - 12]], continentFrame(region)
    ) : worldProjection;
    if (country) {
      const anchor = landAnchor(country);
      const parts = nearbyPolygons(featuresByName.get(country).geometry, anchor);
      const focus = { type: "GeometryCollection", geometries: parts };
      const margin = Math.min(36, height * 0.13);
      const closer = d3.geoNaturalEarth1().rotate([rotation, 0]).fitExtent(
        [[margin, margin], [width - margin, height - margin]], focus
      );
      // Large countries can span a continent. Ask for a closer view around the national label.
      if (closer.scale() < view.scale() * 1.18) {
        closer.scale(view.scale() * 1.18).translate([0, 0]);
        const [px, py] = closer(anchor);
        closer.translate([width / 2 - px, height / 2 - py]);
      }
      view = closer;
    }
    const [x, y] = view.translate();
    return { scale: view.scale() / BASE_SCALE, x, y, rotation };
  }

  function drawLabels() {
    if (!region || country || zooming) {
      labelLayer.selectAll("text").remove();
      return;
    }

    const reports = visibleReports.filter((d) => producerRegions[d.code] === region);
    const reportedLand = new Set(reports.map((d) => producers.get(d.code).landName));
    const selected = producers.get(selectedCode);
    const candidates = reports.map((d) => ({
      ...producers.get(d.code),
      size: Math.max(LOCATOR_RADIUS, radius(d.tonnes)),
      key: d.code,
      producer: true,
      selected: d.code === selectedCode,
    }));
    if (selected && !reports.some((d) => d.code === selectedCode)) {
      candidates.unshift({ ...selected, key: selected.code, size: 0, selected: true });
    }
    for (const [name, [area, label, longitude, latitude]] of Object.entries(landInfo)) {
      if (area !== region || reportedLand.has(name) || selected?.landName === name) continue;
      candidates.push({
        name: label, point: [longitude, latitude], key: name, size: 0,
        selected: name === selectedLand,
      });
    }
    candidates.sort((a, b) => Number(!!b.selected) - Number(!!a.selected));

    const occupied = reports.map((d) => {
      const [x, y] = screenPoint(producers.get(d.code).point);
      const r = Math.max(LOCATOR_RADIUS, radius(d.tonnes));
      return [x - r, y - r, x + r, y + r];
    });
    occupied.push([0, 0, region.length * 7 + 20, 25]);
    const labels = [];
    for (const item of candidates) {
      const [x, y] = screenPoint(item.point);
      const halfWidth = item.name.length * 2.8 + 4;
      const gap = item.size + 7;
      const positions = item.size ?
        [[x, y - gap], [x, y + gap], [x + halfWidth + gap, y], [x - halfWidth - gap, y]] :
        [[x, y], [x, y - 12], [x, y + 12]];
      for (const [labelX, labelY] of positions) {
        const box = [labelX - halfWidth, labelY - 7, labelX + halfWidth, labelY + 7];
        if (box[0] < 1 || box[1] < 1 || box[2] > width - 1 || box[3] > height - 1) continue;
        if (occupied.some(([left, top, right, bottom]) =>
          box[0] < right && box[2] > left && box[1] < bottom && box[3] > top
        )) continue;
        occupied.push(box);
        labels.push({ ...item, x: labelX, y: labelY });
        break;
      }
    }
    labelLayer.selectAll("text").data(labels, (d) => d.key).join("text")
      .attr("class", "production-map__country-label")
      .classed("is-producer", (d) => !!d.producer)
      .classed("is-selected", (d) => d.selected)
      .attr("x", (d) => d.x).attr("y", (d) => d.y)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
      .text((d) => d.name);
  }

  function showView(nextRegion, nextCountry = "") {
    hideTooltip();
    regionName.textContent = nextCountry ? producers.get(selectedCode)?.name ?? landInfo[nextCountry][1] : nextRegion;
    if (nextRegion === region && nextCountry === country) {
      syncSelection();
      drawLabels();
      return;
    }
    region = nextRegion;
    country = nextCountry;
    regionName.hidden = backButton.hidden = !region;
    backButton.textContent = country ? `← ${region}` : "World view";
    backButton.setAttribute("aria-label", country ? `Back to ${region}` : "World view");
    container.classList.toggle("is-regional", !!region);
    container.classList.toggle("is-country", !!country);
    svg.interrupt("region");
    syncSelection();
    if (!width) return;
    const target = targetCamera();
    const duration = dur(650);
    zooming = duration > 0;
    if (!zooming) {
      renderCamera(target);
      drawLabels();
      return;
    }
    drawLabels();
    const interpolate = d3.interpolateObject(camera, target);
    svg.transition("region").duration(duration).ease(d3.easeCubicInOut)
      .tween("camera", () => (t) => renderCamera({ ...interpolate(t) }))
      .on("end", () => {
        zooming = false;
        drawLabels();
      });
  }

  function chooseProducer(code) {
    const producer = producers.get(code);
    selectedCode = code;
    selectedLand = producer?.landName ?? "";
    const area = producer?.region ?? "";
    showView(area, area && area === region ? selectedLand : "");
  }

  function chooseLand(name) {
    const [area] = landInfo[name];
    if (!Object.hasOwn(CONTINENTS, area)) return;
    selectedCode = producerForLand(name)?.code ?? "";
    selectedLand = name;
    showView(area, area === region ? name : "");
  }

  function drawYear() {
    const reports = byYear.get(year);
    visibleReports = Array.from(reports.values()).filter((d) => d.tonnes > 0)
      .sort((a, b) => b.tonnes - a.tonnes);
    const points = circleLayer.selectAll(".production-map__producer")
      .data(visibleReports, (d) => d.code)
      .join((enter) => {
        const group = enter.append("g").attr("class", "production-map__producer")
          .on("click", (_, d) => chooseProducer(d.code))
          .on("pointerenter pointermove", (event, d) => hoverInfo(event, d.name, d.code))
          .on("pointerleave", hideTooltip);
        group.append("circle").attr("class", "production-map__hit");
        group.append("circle").attr("class", "production-map__symbol");
        group.append("circle").attr("class", "production-map__locator").attr("r", LOCATOR_RADIUS);
        return group;
      });
    points.select(".production-map__symbol")
      .attr("data-code", (d) => d.code)
      .attr("r", (d) => radius(d.tonnes));
    points.select(".production-map__locator")
      .classed("is-needed", (d) => radius(d.tonnes) < LOCATOR_RADIUS);
    points.select(".production-map__hit").attr("r", (d) => Math.max(7, radius(d.tonnes)));
    picker.selectAll("option.producer")
      .data(orderedProducers.filter((d) => reports.has(d.code) || d.code === selectedCode), (d) => d.code)
      .join("option")
      .attr("class", "producer")
      .attr("value", (d) => d.code)
      .text((d) => d.name);
    syncSelection();
    renderCamera(camera);
    drawLabels();
  }

  picker.on("change", () => chooseProducer(picker.property("value")));
  backButton.addEventListener("click", () => {
    if (country) {
      showView(region);
      return;
    }
    chooseProducer("");
    picker.node().focus({ preventScroll: true });
  });
  slider.addEventListener("input", () => {
    hideTooltip();
    year = slider.valueAsNumber;
    yearLabel.textContent = year;
    drawYear();
  });

  onResize(graphic, (w, h) => {
    width = w;
    height = h;
    const maxRadius = Math.min(32, width * 0.05, height * 0.1);
    radius.range([0, maxRadius]);
    svg.attr("viewBox", [0, 0, width, height]);
    const padding = maxRadius + 3;
    worldProjection.fitExtent([[padding, 4], [width - padding, height - 4]], world);
    svg.interrupt("region");
    zooming = false;

    key.select("svg")
      .attr("width", (d) => 2 * radius(d.tonnes))
      .attr("height", 2 * maxRadius);
    keySymbols
      .attr("cx", (d) => radius(d.tonnes))
      .attr("cy", maxRadius)
      .attr("r", (d) => radius(d.tonnes));
    renderCamera(targetCamera());
    drawYear();
  });

  return {
    lotPositions(lots) {
      const { left, top } = graphic.getBoundingClientRect();
      return lots.map((lot) => {
        const point = lot.countryLabel === "Hawaii (USA)" ? HAWAII : geographicCentres.get(lot.country);
        if (!point) return null;
        const [x, y] = worldProjection(point);
        return [left + x, top + y];
      });
    },
  };
}
