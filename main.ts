import rawData from "./countries.json";
import {
  annualBirths,
  oddsOf,
  pickCountry,
  projectGlobe,
  statRange,
  survivalProbability,
  targetRotation,
  weightedAverage,
  type Country,
  type Range,
  type Stat,
} from "./lottery";

interface CountriesFile {
  meta: {
    compiledAt: string;
    sources: Array<{ name: string; url: string; license?: string; fields?: unknown }>;
  };
  countries: Country[];
}

const data = rawData as unknown as CountriesFile;
const allCountries = data.countries;
const worldBirths = allCountries.reduce((sum, c) => sum + annualBirths(c), 0);

const heroEl = document.querySelector<HTMLElement>(".hero")!;
const frameEl = document.querySelector<HTMLElement>('[data-field="frame"]')!;
const globeCanvas = document.querySelector<HTMLCanvasElement>('[data-field="globe"]')!;
const ctx = globeCanvas.getContext("2d")!;
const skylineEl = document.querySelector<HTMLElement>('[data-testid="skyline"]')!;
const statDotsEl = document.querySelector<HTMLElement>('[data-field="stat-dots"]')!;
const spinBtn = document.querySelector<HTMLButtonElement>('[data-testid="spin"]')!;
const placeholderEl = document.querySelector<HTMLElement>('[data-field="placeholder"]')!;
const contentEl = document.querySelector<HTMLElement>('[data-field="content"]')!;
const capitalEl = document.querySelector<HTMLElement>('[data-field="capital"]')!;
const countryEl = document.querySelector<HTMLElement>('[data-field="country"]')!;
const oddsEl = document.querySelector<HTMLElement>('[data-field="odds"]')!;
const historyEl = document.querySelector<HTMLElement>('[data-field="history"]')!;
const popoverEl = document.querySelector<HTMLElement>('[data-field="popover"]')!;
const popoverBodyEl = document.querySelector<HTMLElement>('[data-field="popover-body"]')!;
const popoverCloseEl = document.querySelector<HTMLButtonElement>('[data-field="popover-close"]')!;
const methodologyIntroEl = document.querySelector<HTMLElement>('[data-field="methodology-intro"]')!;
const methodologyDetailEl = document.querySelector<HTMLElement>('[data-field="methodology-detail"]')!;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fmtNumber(value: number): string {
  return new Intl.NumberFormat("en-AU").format(Math.round(value));
}

function averageStat(a?: Stat, b?: Stat): Stat | undefined {
  if (a && b) return { value: (a.value + b.value) / 2, year: Math.max(a.year, b.year) };
  return a ?? b;
}

interface StatDef {
  label: string;
  select: (country: Country) => Stat | undefined;
  format: (value: number) => string;
  indicatorCode: string;
  note?: string;
}

interface StatMeta extends StatDef {
  range?: Range;
  avg?: number;
}

function withMeta(defs: StatDef[]): StatMeta[] {
  return defs.map((def) => ({
    ...def,
    range: statRange(allCountries, def.select),
    avg: weightedAverage(allCountries, def.select),
  }));
}

const healthMeta = withMeta([
  {
    label: "Life expectancy",
    select: (c) => c.lifeExpectancy,
    format: (v) => `${v.toFixed(1)} years`,
    indicatorCode: "SP.DYN.LE00.IN",
  },
  {
    label: "Chance of surviving your first year",
    select: (c) =>
      c.infantMortalityPer1000 && {
        value: survivalProbability(c.infantMortalityPer1000.value) * 100,
        year: c.infantMortalityPer1000.year,
      },
    format: (v) => `${v.toFixed(2)}%`,
    indicatorCode: "SP.DYN.IMRT.IN",
    note: "Derived from the infant mortality rate: 1 − (infant deaths per 1,000 live births ÷ 1,000).",
  },
  {
    label: "Childbirth risk faced by mothers here",
    select: (c) => c.maternalMortalityPer100k,
    format: (v) => `${v.toFixed(0)} per 100,000 births`,
    indicatorCode: "SH.STA.MMRT",
  },
  {
    label: "Health risks adults here face (a proxy for “parents”)",
    select: (c) => averageStat(c.adultMortalityMalePer1000, c.adultMortalityFemalePer1000),
    format: (v) => `${v.toFixed(0)} per 1,000 adults`,
    indicatorCode: "SP.DYN.AMRT.MA / SP.DYN.AMRT.FE",
    note: "Average of the male and female adult mortality rates (probability of dying between ages 15–60) — a proxy for “parents,” not a literal parental statistic.",
  },
]);

const needsMeta = withMeta([
  {
    label: "Access to basic drinking water",
    select: (c) => c.basicWaterAccessPct,
    format: (v) => `${v.toFixed(1)}%`,
    indicatorCode: "SH.H2O.BASW.ZS",
  },
  {
    label: "Access to electricity",
    select: (c) => c.electricityAccessPct,
    format: (v) => `${v.toFixed(1)}%`,
    indicatorCode: "EG.ELC.ACCS.ZS",
  },
  {
    label: "Air quality (PM2.5 exposure)",
    select: (c) => c.pm25,
    format: (v) => `${v.toFixed(1)} µg/m³`,
    indicatorCode: "EN.ATM.PM25.MC.M3",
  },
]);

const economyMeta = withMeta([
  {
    label: "GDP per capita (PPP)",
    select: (c) => c.gdpPerCapitaPPP,
    format: (v) => `US$${fmtNumber(v)}`,
    indicatorCode: "NY.GDP.PCAP.PP.CD",
  },
  {
    label: "Unemployment rate",
    select: (c) => c.unemploymentPct,
    format: (v) => `${v.toFixed(1)}%`,
    indicatorCode: "SL.UEM.TOTL.ZS",
  },
  {
    label: "Extreme poverty rate",
    select: (c) => c.extremePovertyPct,
    format: (v) => `${v.toFixed(1)}%`,
    indicatorCode: "SI.POV.DDAY",
  },
]);

const connectivityMeta = withMeta([
  {
    label: "Internet use",
    select: (c) => c.internetUsePct,
    format: (v) => `${v.toFixed(1)}%`,
    indicatorCode: "IT.NET.USER.ZS",
  },
]);

const allStatMeta: StatMeta[] = [...healthMeta, ...needsMeta, ...economyMeta, ...connectivityMeta];

// Fixed points hand-placed on the rooftops of the generative skyline art
// (styles.css .skyline-silhouette's own clip-path) so each dot visibly sits on
// a building rather than floating in empty sky -- same 11 spots for every
// country, since the silhouette itself never changes.
const hotspotPositions: Array<{ xPct: number; yPct: number }> = [
  { xPct: 6.5, yPct: 58 },
  { xPct: 16.5, yPct: 43 },
  { xPct: 21.5, yPct: 61 },
  { xPct: 27, yPct: 33 },
  { xPct: 38.5, yPct: 48 },
  { xPct: 44, yPct: 23 },
  { xPct: 50, yPct: 53 },
  { xPct: 56, yPct: 38 },
  { xPct: 67, yPct: 28 },
  { xPct: 79, yPct: 45 },
  { xPct: 91, yPct: 51 },
];

function animateNumber(el: HTMLElement, target: number, format: (value: number) => string): void {
  const duration = 900;
  const start = performance.now();
  function tick(now: number) {
    const elapsed = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - elapsed) ** 3;
    el.textContent = format(target * eased);
    if (elapsed < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// --- Stat hotspot dots + popover ------------------------------------------

let openPopover: { dot: HTMLButtonElement; meta: StatMeta } | null = null;

function closePopover(): void {
  popoverEl.hidden = true;
  if (openPopover) {
    openPopover.dot.setAttribute("aria-expanded", "false");
    openPopover = null;
  }
}

function positionPopover(dot: HTMLButtonElement): void {
  const heroRect = heroEl.getBoundingClientRect();
  const dotRect = dot.getBoundingClientRect();
  const popRect = popoverEl.getBoundingClientRect();
  const margin = 12;

  let left = dotRect.left - heroRect.left + dotRect.width / 2 - popRect.width / 2;
  left = Math.min(Math.max(left, margin), heroRect.width - popRect.width - margin);

  let top = dotRect.top - heroRect.top - popRect.height - 14;
  if (top < margin) {
    top = dotRect.bottom - heroRect.top + 14;
  }
  top = Math.min(Math.max(top, margin), heroRect.height - popRect.height - margin);

  popoverEl.style.left = `${left}px`;
  popoverEl.style.top = `${top}px`;
}

function openPopoverFor(dot: HTMLButtonElement, meta: StatMeta, country: Country): void {
  const stat = meta.select(country);

  const labelEl = document.createElement("p");
  labelEl.className = "stat-popover-label";
  labelEl.textContent = meta.label;

  const valueEl = document.createElement("p");
  valueEl.className = "stat-popover-value";

  const barTrack = document.createElement("span");
  barTrack.className = "stat-bar-track";
  const barFill = document.createElement("span");
  barFill.className = "stat-bar-fill";
  barTrack.appendChild(barFill);

  const hasRange = meta.range && meta.range.max > meta.range.min;
  if (hasRange && meta.avg !== undefined) {
    const avgPct = ((meta.avg - meta.range!.min) / (meta.range!.max - meta.range!.min)) * 100;
    const marker = document.createElement("span");
    marker.className = "stat-bar-avg-marker";
    marker.style.left = `${Math.min(100, Math.max(0, avgPct))}%`;
    marker.title = `World average (population-weighted): ${meta.format(meta.avg)}`;
    barTrack.appendChild(marker);
  }

  const detail = document.createElement("p");
  detail.className = "stat-popover-detail";

  if (stat) {
    if (prefersReducedMotion) {
      valueEl.textContent = meta.format(stat.value);
    } else {
      animateNumber(valueEl, stat.value, meta.format);
    }

    const pct = hasRange ? ((stat.value - meta.range!.min) / (meta.range!.max - meta.range!.min)) * 100 : 100;
    const clampedPct = Math.min(100, Math.max(0, pct));
    requestAnimationFrame(() => {
      barFill.style.transform = `scaleX(${clampedPct / 100})`;
    });

    const parts = [`Source: World Bank ${meta.indicatorCode} (reported ${stat.year}).`];
    if (meta.avg !== undefined) parts.push(`World average: ${meta.format(meta.avg)}.`);
    if (meta.range) {
      parts.push(`Range seen across the lottery pool: ${meta.format(meta.range.min)}–${meta.format(meta.range.max)}.`);
    }
    if (meta.note) parts.push(meta.note);
    detail.textContent = parts.join(" ");
  } else {
    valueEl.textContent = "not reported";
    barTrack.hidden = true;
    detail.textContent = `${country.name} does not report this indicator (World Bank ${meta.indicatorCode}).`;
  }

  popoverBodyEl.replaceChildren(labelEl, valueEl, barTrack, detail);
  popoverEl.hidden = false;
  dot.setAttribute("aria-expanded", "true");
  openPopover = { dot, meta };
  positionPopover(dot);
}

function renderHotspots(country: Country): void {
  closePopover();
  statDotsEl.replaceChildren();
  const count = Math.min(allStatMeta.length, hotspotPositions.length);
  for (let i = 0; i < count; i++) {
    const meta = allStatMeta[i];
    const pos = hotspotPositions[i];

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "stat-dot";
    dot.style.left = `${pos.xPct}%`;
    dot.style.top = `${pos.yPct}%`;
    dot.setAttribute("aria-expanded", "false");
    dot.setAttribute("aria-label", `${meta.label}: tap for the figure`);
    dot.addEventListener("click", (event) => {
      event.stopPropagation();
      const alreadyOpen = openPopover?.dot === dot;
      closePopover();
      if (!alreadyOpen) openPopoverFor(dot, meta, country);
    });
    statDotsEl.appendChild(dot);
  }
}

popoverCloseEl.addEventListener("click", closePopover);
document.addEventListener("click", (event) => {
  if (!openPopover) return;
  const target = event.target as Node;
  if (popoverEl.contains(target) || openPopover.dot.contains(target)) return;
  closePopover();
});

// --- History ----------------------------------------------------------------

const history: Country[] = [];

function renderHistory(current: Country): void {
  if (!history.includes(current)) history.push(current);
  historyEl.hidden = history.length === 0;
  historyEl.replaceChildren();
  for (const c of history) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "history-chip";
    if (c === current) chip.classList.add("history-chip-current");
    chip.textContent = c.code;
    chip.setAttribute("aria-label", `Revisit ${c.name}`);
    chip.addEventListener("click", () => beginSpin(c));
    historyEl.appendChild(chip);
  }
}

function renderCountry(country: Country): void {
  capitalEl.textContent = country.capital;
  countryEl.textContent = country.name;
  skylineEl.hidden = false;

  placeholderEl.hidden = true;
  contentEl.hidden = false;

  const odds = oddsOf(country, allCountries);
  oddsEl.textContent =
    `Chance of landing here: ${odds.percentage.toFixed(3)}% — an estimated ` +
    `${fmtNumber(odds.countryBirths)} of the world's ${fmtNumber(odds.worldBirths)} births this year.`;

  methodologyDetailEl.textContent =
    `For ${country.name}: population ${fmtNumber(country.population.value)} (${country.population.year}) ` +
    `× crude birth rate ${country.birthRatePer1000.value.toFixed(1)} per 1,000 (${country.birthRatePer1000.year}) ÷ 1,000 ` +
    `≈ ${fmtNumber(odds.countryBirths)} births/year, out of ≈${fmtNumber(odds.worldBirths)} births/year worldwide ` +
    `→ ${odds.percentage.toFixed(3)}% chance of landing in ${country.name}.`;

  renderHotspots(country);
  renderHistory(country);
}

// --- The globe: canvas rendering + spin/zoom state machine ------------------

let rotation = 0;
let stageState: "idle" | "spinning" | "zoomed" = "idle";
let spinAnim: { startRotation: number; targetRotation: number; startTime: number; country: Country } | null = null;
let lastFrameTime: number | null = null;
let animating = false;
let rafId = 0;

const IDLE_DEG_PER_SEC = 6;
const SPIN_DURATION_MS = 2200;
const SPIN_EXTRA_TURNS = 3;

function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = frameEl.getBoundingClientRect();
  globeCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  globeCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  globeCanvas.style.width = `${rect.width}px`;
  globeCanvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawGlobe(atRotation: number): void {
  const rect = frameEl.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w === 0 || h === 0) return;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.34;

  const body = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.08, cx, cy, radius);
  body.addColorStop(0, "#33517a");
  body.addColorStop(0.7, "#182b40");
  body.addColorStop(1, "#0a1420");
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.stroke();

  const projected = allCountries
    .map((country) => ({ country, point: projectGlobe(country.lon, country.lat, atRotation) }))
    .sort((a, b) => a.point.depth - b.point.depth);

  for (const { country, point } of projected) {
    const share = annualBirths(country) / worldBirths;
    const baseSize = 1.4 + Math.sqrt(share) * 26;
    const depthT = (point.depth + 1) / 2; // 0 (far side) .. 1 (facing viewer)
    const size = baseSize * (0.35 + 0.65 * depthT);
    const x = cx + ((point.xPct - 50) / 50) * radius;
    const y = cy + ((point.yPct - 50) / 50) * radius;
    const alpha = 0.22 + 0.78 * depthT;

    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.6, size / 2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(242, 201, 76, ${alpha.toFixed(3)})`;
    ctx.fill();
  }
}

function scheduleFrame(): void {
  rafId = requestAnimationFrame(frame);
}

function frame(now: number): void {
  const dt = lastFrameTime === null ? 0 : (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  if (stageState === "idle") {
    rotation += IDLE_DEG_PER_SEC * dt;
    drawGlobe(rotation);
    scheduleFrame();
    return;
  }

  if (stageState === "spinning" && spinAnim) {
    const t = Math.min(1, (now - spinAnim.startTime) / SPIN_DURATION_MS);
    rotation = spinAnim.startRotation + (spinAnim.targetRotation - spinAnim.startRotation) * easeOutQuint(t);
    drawGlobe(rotation);
    if (t >= 1) {
      const country = spinAnim.country;
      spinAnim = null;
      finishSpin(country);
      return;
    }
    scheduleFrame();
  }
}

function finishSpin(country: Country): void {
  const point = projectGlobe(country.lon, country.lat, rotation);
  renderCountry(country);
  frameEl.style.setProperty("--origin-x", `${point.xPct}%`);
  frameEl.style.setProperty("--origin-y", `${point.yPct}%`);
  frameEl.classList.add("zoomed");
  stageState = "zoomed";
  animating = false;
  spinBtn.disabled = false;
}

function beginSpin(country: Country): void {
  if (animating) return;
  animating = true;
  spinBtn.disabled = true;
  closePopover();

  if (prefersReducedMotion) {
    cancelAnimationFrame(rafId);
    frameEl.classList.remove("zoomed");
    rotation = targetRotation(rotation, country.lon, 0);
    drawGlobe(rotation);
    finishSpin(country);
    return;
  }

  const launch = () => {
    cancelAnimationFrame(rafId);
    stageState = "spinning";
    lastFrameTime = null;
    spinAnim = {
      startRotation: rotation,
      targetRotation: targetRotation(rotation, country.lon, SPIN_EXTRA_TURNS),
      startTime: performance.now(),
      country,
    };
    scheduleFrame();
  };

  if (frameEl.classList.contains("zoomed")) {
    frameEl.classList.remove("zoomed");
    const onZoomOut = (event: TransitionEvent) => {
      if (event.propertyName !== "transform" || event.target !== globeCanvas) return;
      globeCanvas.removeEventListener("transitionend", onZoomOut);
      launch();
    };
    globeCanvas.addEventListener("transitionend", onZoomOut);
  } else {
    launch();
  }
}

function spin(): void {
  beginSpin(pickCountry(allCountries));
}

const sourceNames = data.meta.sources.map((s) => s.name).join(" and ");
methodologyIntroEl.textContent =
  `Dataset compiled ${data.meta.compiledAt} from ${sourceNames}. ${allCountries.length} countries have ` +
  `enough data to be in the lottery pool; each is weighted by its own real population and birth-rate figures.`;

resizeCanvas();
if (prefersReducedMotion) {
  drawGlobe(rotation);
} else {
  scheduleFrame();
}

window.addEventListener("resize", () => {
  resizeCanvas();
  drawGlobe(rotation);
  if (openPopover) positionPopover(openPopover.dot);
});

spinBtn.addEventListener("click", spin);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (openPopover) closePopover();
    return;
  }
  if (event.code !== "Space" && event.code !== "Enter") return;
  if (document.activeElement !== document.body) return;
  event.preventDefault();
  spin();
});
