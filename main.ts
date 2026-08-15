import rawData from "./countries.json";
import {
  annualBirths,
  oddsOf,
  pickCountry,
  project,
  statRange,
  survivalProbability,
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

const frameEl = document.querySelector<HTMLElement>('[data-field="frame"]')!;
const worldDotsEl = document.querySelector<HTMLElement>('[data-field="world-dots"]')!;
const skylineEl = document.querySelector<HTMLElement>('[data-testid="skyline"]')!;
const spinBtn = document.querySelector<HTMLButtonElement>('[data-testid="spin"]')!;
const placeholderEl = document.querySelector<HTMLElement>('[data-field="placeholder"]')!;
const contentEl = document.querySelector<HTMLElement>('[data-field="content"]')!;
const capitalEl = document.querySelector<HTMLElement>('[data-field="capital"]')!;
const countryEl = document.querySelector<HTMLElement>('[data-field="country"]')!;
const oddsEl = document.querySelector<HTMLElement>('[data-field="odds"]')!;
const historyEl = document.querySelector<HTMLElement>('[data-field="history"]')!;
const statsPanelEl = document.querySelector<HTMLElement>('[data-field="stats-panel"]')!;
const healthCardsEl = document.querySelector<HTMLElement>('[data-field="health"]')!;
const needsCardsEl = document.querySelector<HTMLElement>('[data-field="needs"]')!;
const economyCardsEl = document.querySelector<HTMLElement>('[data-field="economy"]')!;
const connectivityCardsEl = document.querySelector<HTMLElement>('[data-field="connectivity"]')!;
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

function renderStatCards(container: HTMLElement, defs: StatMeta[], country: Country): void {
  container.replaceChildren();
  for (const def of defs) {
    const stat = def.select(country);

    const card = document.createElement("button");
    card.type = "button";
    card.className = "stat-card";
    card.setAttribute("aria-expanded", "false");

    const labelEl = document.createElement("span");
    labelEl.className = "stat-card-label";
    labelEl.textContent = def.label;

    const valueEl = document.createElement("span");
    valueEl.className = "stat-card-value";

    const barTrack = document.createElement("span");
    barTrack.className = "stat-bar-track";
    const barFill = document.createElement("span");
    barFill.className = "stat-bar-fill";
    barTrack.appendChild(barFill);

    const hasRange = def.range && def.range.max > def.range.min;
    if (hasRange && def.avg !== undefined) {
      const avgPct = ((def.avg - def.range!.min) / (def.range!.max - def.range!.min)) * 100;
      const marker = document.createElement("span");
      marker.className = "stat-bar-avg-marker";
      marker.style.left = `${Math.min(100, Math.max(0, avgPct))}%`;
      marker.title = `World average (population-weighted): ${def.format(def.avg)}`;
      barTrack.appendChild(marker);
    }

    const detail = document.createElement("span");
    detail.className = "stat-card-detail";
    detail.hidden = true;

    if (stat) {
      if (prefersReducedMotion) {
        valueEl.textContent = def.format(stat.value);
      } else {
        animateNumber(valueEl, stat.value, def.format);
      }

      const pct = hasRange ? ((stat.value - def.range!.min) / (def.range!.max - def.range!.min)) * 100 : 100;
      const clampedPct = Math.min(100, Math.max(0, pct));
      requestAnimationFrame(() => {
        barFill.style.transform = `scaleX(${clampedPct / 100})`;
      });

      const parts = [`Source: World Bank ${def.indicatorCode} (reported ${stat.year}).`];
      if (def.avg !== undefined) parts.push(`World average: ${def.format(def.avg)}.`);
      if (def.range) parts.push(`Range seen across the lottery pool: ${def.format(def.range.min)}–${def.format(def.range.max)}.`);
      if (def.note) parts.push(def.note);
      detail.textContent = parts.join(" ");
    } else {
      valueEl.textContent = "not reported";
      barTrack.hidden = true;
      detail.textContent = `${country.name} does not report this indicator (World Bank ${def.indicatorCode}).`;
    }

    card.addEventListener("click", () => {
      const expanded = card.getAttribute("aria-expanded") === "true";
      card.setAttribute("aria-expanded", String(!expanded));
      detail.hidden = expanded;
    });

    card.append(labelEl, valueEl, barTrack, detail);
    container.appendChild(card);
  }
}

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
    chip.addEventListener("click", () => revealCountry(c));
    historyEl.appendChild(chip);
  }
}

function renderCountry(country: Country): void {
  capitalEl.textContent = country.capital;
  countryEl.textContent = country.name;
  skylineEl.hidden = false;

  placeholderEl.hidden = true;
  contentEl.hidden = false;
  statsPanelEl.hidden = false;

  const odds = oddsOf(country, allCountries);
  oddsEl.textContent =
    `Chance of landing here: ${odds.percentage.toFixed(3)}% — an estimated ` +
    `${fmtNumber(odds.countryBirths)} of the world's ${fmtNumber(odds.worldBirths)} births this year.`;

  methodologyDetailEl.textContent =
    `For ${country.name}: population ${fmtNumber(country.population.value)} (${country.population.year}) ` +
    `× crude birth rate ${country.birthRatePer1000.value.toFixed(1)} per 1,000 (${country.birthRatePer1000.year}) ÷ 1,000 ` +
    `≈ ${fmtNumber(odds.countryBirths)} births/year, out of ≈${fmtNumber(odds.worldBirths)} births/year worldwide ` +
    `→ ${odds.percentage.toFixed(3)}% chance of landing in ${country.name}.`;

  renderStatCards(healthCardsEl, healthMeta, country);
  renderStatCards(needsCardsEl, needsMeta, country);
  renderStatCards(economyCardsEl, economyMeta, country);
  renderStatCards(connectivityCardsEl, connectivityMeta, country);

  renderHistory(country);
}

function renderWorldDots(): void {
  const frag = document.createDocumentFragment();
  for (const country of allCountries) {
    const { xPct, yPct } = project(country.lon, country.lat);
    const share = annualBirths(country) / worldBirths;
    const size = 2 + Math.sqrt(share) * 55;
    const dot = document.createElement("span");
    dot.className = "world-dots-dot";
    dot.style.left = `${xPct}%`;
    dot.style.top = `${yPct}%`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    frag.appendChild(dot);
  }
  worldDotsEl.replaceChildren(frag);
}

let animating = false;

function revealCountry(country: Country): void {
  if (animating) return;

  const { xPct, yPct } = project(country.lon, country.lat);
  const alreadyZoomed = frameEl.classList.contains("zoomed");

  const land = () => {
    renderCountry(country);
    frameEl.style.setProperty("--origin-x", `${xPct}%`);
    frameEl.style.setProperty("--origin-y", `${yPct}%`);
    frameEl.classList.add("zoomed");
  };

  if (!alreadyZoomed || prefersReducedMotion) {
    land();
    return;
  }

  animating = true;
  spinBtn.disabled = true;
  frameEl.classList.remove("zoomed");

  const onZoomOut = (event: TransitionEvent) => {
    if (event.propertyName !== "transform" || event.target !== worldDotsEl) return;
    worldDotsEl.removeEventListener("transitionend", onZoomOut);
    land();
    animating = false;
    spinBtn.disabled = false;
  };
  worldDotsEl.addEventListener("transitionend", onZoomOut);
}

function spin(): void {
  revealCountry(pickCountry(allCountries));
}

const sourceNames = data.meta.sources.map((s) => s.name).join(" and ");
methodologyIntroEl.textContent =
  `Dataset compiled ${data.meta.compiledAt} from ${sourceNames}. ${allCountries.length} countries have ` +
  `enough data to be in the lottery pool; each is weighted by its own real population and birth-rate figures.`;

renderWorldDots();
spinBtn.addEventListener("click", spin);
window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.code !== "Enter") return;
  if (document.activeElement !== document.body) return;
  event.preventDefault();
  spin();
});
