import rawData from "./countries.json";
import {
  annualBirths,
  oddsOf,
  pickCountry,
  project,
  survivalProbability,
  type Country,
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
const skylineCapitalEl = document.querySelector<HTMLElement>('[data-field="capital"]')!;
const skylineCountryEl = document.querySelector<HTMLElement>('[data-field="country"]')!;
const spinBtn = document.querySelector<HTMLButtonElement>('[data-testid="spin"]')!;
const placeholderEl = document.querySelector<HTMLElement>('[data-field="placeholder"]')!;
const contentEl = document.querySelector<HTMLElement>('[data-field="content"]')!;
const oddsEl = document.querySelector<HTMLElement>('[data-field="odds"]')!;
const healthDl = document.querySelector<HTMLElement>('[data-field="health"]')!;
const needsDl = document.querySelector<HTMLElement>('[data-field="needs"]')!;
const economyDl = document.querySelector<HTMLElement>('[data-field="economy"]')!;
const connectivityDl = document.querySelector<HTMLElement>('[data-field="connectivity"]')!;
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

interface StatRow {
  label: string;
  stat?: Stat;
  format: (value: number) => string;
}

function renderStatGroup(dl: HTMLElement, rows: StatRow[]): void {
  dl.replaceChildren();
  for (const row of rows) {
    const dt = document.createElement("dt");
    dt.textContent = row.label;
    const dd = document.createElement("dd");
    dd.textContent = row.stat
      ? `${row.format(row.stat.value)} (${row.stat.year}, World Bank)`
      : "not reported";
    dl.append(dt, dd);
  }
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

function renderCountry(country: Country): void {
  skylineCapitalEl.textContent = country.capital;
  skylineCountryEl.textContent = country.name;
  skylineEl.hidden = false;

  placeholderEl.hidden = true;
  contentEl.hidden = false;

  const odds = oddsOf(country, allCountries);
  oddsEl.textContent =
    `You were born in ${country.name}. Chance of landing here: ${odds.percentage.toFixed(3)}% ` +
    `— an estimated ${fmtNumber(odds.countryBirths)} of the world's ${fmtNumber(odds.worldBirths)} births this year.`;

  methodologyDetailEl.textContent =
    `For ${country.name}: population ${fmtNumber(country.population.value)} (${country.population.year}) ` +
    `× crude birth rate ${country.birthRatePer1000.value.toFixed(1)} per 1,000 (${country.birthRatePer1000.year}) ÷ 1,000 ` +
    `≈ ${fmtNumber(odds.countryBirths)} births/year, out of ≈${fmtNumber(odds.worldBirths)} births/year worldwide ` +
    `→ ${odds.percentage.toFixed(3)}% chance of landing in ${country.name}.`;

  renderStatGroup(healthDl, [
    {
      label: "Life expectancy",
      stat: country.lifeExpectancy,
      format: (v) => `${v.toFixed(1)} years`,
    },
    {
      label: "Chance of surviving your first year",
      stat: country.infantMortalityPer1000,
      format: (v) => `${(survivalProbability(v) * 100).toFixed(2)}%`,
    },
    {
      label: "Childbirth risk faced by mothers here",
      stat: country.maternalMortalityPer100k,
      format: (v) => `${v.toFixed(0)} deaths per 100,000 births`,
    },
    {
      label: "Health risks adults here face (a proxy for “parents”)",
      stat: averageStat(country.adultMortalityMalePer1000, country.adultMortalityFemalePer1000),
      format: (v) => `${v.toFixed(0)} per 1,000 adults`,
    },
  ]);

  renderStatGroup(needsDl, [
    {
      label: "Access to basic drinking water",
      stat: country.basicWaterAccessPct,
      format: (v) => `${v.toFixed(1)}%`,
    },
    {
      label: "Access to electricity",
      stat: country.electricityAccessPct,
      format: (v) => `${v.toFixed(1)}%`,
    },
    {
      label: "Air quality (PM2.5 exposure)",
      stat: country.pm25,
      format: (v) => `${v.toFixed(1)} µg/m³`,
    },
  ]);

  renderStatGroup(economyDl, [
    {
      label: "GDP per capita (PPP)",
      stat: country.gdpPerCapitaPPP,
      format: (v) => `US$${fmtNumber(v)}`,
    },
    {
      label: "Unemployment rate",
      stat: country.unemploymentPct,
      format: (v) => `${v.toFixed(1)}%`,
    },
    {
      label: "Extreme poverty rate",
      stat: country.extremePovertyPct,
      format: (v) => `${v.toFixed(1)}%`,
    },
  ]);

  renderStatGroup(connectivityDl, [
    {
      label: "Internet use",
      stat: country.internetUsePct,
      format: (v) => `${v.toFixed(1)}%`,
    },
  ]);
}

let hasSpunBefore = false;
let animating = false;

function spin(): void {
  if (animating) return;

  const country = pickCountry(allCountries);
  renderCountry(country);

  const { xPct, yPct } = project(country.lon, country.lat);

  if (!hasSpunBefore || prefersReducedMotion) {
    frameEl.style.setProperty("--origin-x", `${xPct}%`);
    frameEl.style.setProperty("--origin-y", `${yPct}%`);
    frameEl.classList.add("zoomed");
    hasSpunBefore = true;
    return;
  }

  animating = true;
  spinBtn.disabled = true;
  frameEl.classList.remove("zoomed");

  const onZoomOut = (event: TransitionEvent) => {
    if (event.propertyName !== "transform" || event.target !== worldDotsEl) return;
    worldDotsEl.removeEventListener("transitionend", onZoomOut);
    frameEl.style.setProperty("--origin-x", `${xPct}%`);
    frameEl.style.setProperty("--origin-y", `${yPct}%`);
    frameEl.classList.add("zoomed");
    animating = false;
    spinBtn.disabled = false;
  };
  worldDotsEl.addEventListener("transitionend", onZoomOut);
}

const sourceNames = data.meta.sources.map((s) => s.name).join(" and ");
methodologyIntroEl.textContent =
  `Dataset compiled ${data.meta.compiledAt} from ${sourceNames}. ${allCountries.length} countries have ` +
  `enough data to be in the lottery pool; each is weighted by its own real population and birth-rate figures.`;

renderWorldDots();
spinBtn.addEventListener("click", spin);
