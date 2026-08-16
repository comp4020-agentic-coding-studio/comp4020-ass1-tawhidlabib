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
const landingEl = document.querySelector<HTMLElement>('[data-field="landing"]')!;
const landingCanvas = document.querySelector<HTMLCanvasElement>('[data-field="landing-globe"]')!;
const startBtn = document.querySelector<HTMLButtonElement>('[data-testid="start"]')!;
const frameEl = document.querySelector<HTMLElement>('[data-field="frame"]')!;
const globeCanvas = document.querySelector<HTMLCanvasElement>('[data-field="globe"]')!;
const skylineEl = document.querySelector<HTMLElement>('[data-testid="skyline"]')!;
const skylinePhotoEl = document.querySelector<HTMLElement>('[data-field="skyline-photo"]')!;
const photoCreditEl = document.querySelector<HTMLElement>('[data-field="photo-credit"]')!;
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
const helpToggleEl = document.querySelector<HTMLButtonElement>('[data-field="help-toggle"]')!;
const helpBackdropEl = document.querySelector<HTMLElement>('[data-field="help-backdrop"]')!;
const helpDialogEl = document.querySelector<HTMLElement>('[data-field="help-dialog"]')!;
const helpCloseEl = document.querySelector<HTMLButtonElement>('[data-field="help-close"]')!;

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

// Fixed points spread across the frame, same 11 spots for every country. Laid
// out in five rows so each dot's always-visible label has clear air above it,
// and so the lower rows sit right of centre -- the hero copy is bottom-left, and
// a label landing on the title is the one collision the layout can't tolerate.
// .stat-dots is inset in CSS (per viewport) to keep the whole field clear of
// that copy on phones, where it runs the full width.
const hotspotPositions: Array<{ xPct: number; yPct: number }> = [
  { xPct: 14, yPct: 6 },
  { xPct: 52, yPct: 6 },
  { xPct: 8, yPct: 29 },
  { xPct: 44, yPct: 29 },
  { xPct: 80, yPct: 29 },
  { xPct: 24, yPct: 52 },
  { xPct: 58, yPct: 52 },
  { xPct: 92, yPct: 52 },
  { xPct: 60, yPct: 75 },
  { xPct: 92, yPct: 75 },
  { xPct: 78, yPct: 96 },
];

// --- Capital-city photo (Wikipedia, keyless + CORS-open) --------------------
//
// No API key involved anywhere here -- action=query with origin=* is Wikimedia's
// own keyless, CORS-enabled path, so nothing needs hiding behind a backend this
// static site doesn't have. If no good match is found (or the request fails
// for any reason -- offline, blocked, disambiguation), the generative skyline
// underneath simply stays visible; this is purely additive.

interface PhotoCredit {
  name: string;
  license: string;
  sourceUrl: string;
}

interface CapitalPhoto {
  url: string;
  credit?: PhotoCredit;
}

interface WikiPageImagesResponse {
  query?: {
    pages?: Record<
      string,
      { pageimage?: string; thumbnail?: { source: string } }
    >;
  };
}

interface WikiImageInfoResponse {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: Array<{
          url?: string;
          descriptionurl?: string;
          extmetadata?: {
            Artist?: { value: string };
            LicenseShortName?: { value: string };
          };
        }>;
      }
    >;
  };
}

function wikipediaApiUrl(params: Record<string, string>): string {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ format: "json", origin: "*", ...params }).toString();
  return url.toString();
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

async function queryPageImage(title: string): Promise<{ thumbnailUrl: string; filename: string } | null> {
  const res = await fetch(wikipediaApiUrl({ action: "query", titles: title, prop: "pageimages", pithumbsize: "1600" }));
  if (!res.ok) return null;
  const data = (await res.json()) as WikiPageImagesResponse;
  const page = Object.values(data.query?.pages ?? {})[0];
  const thumbnailUrl = page?.thumbnail?.source;
  const filename = page?.pageimage;
  if (!thumbnailUrl || !filename) return null;
  return { thumbnailUrl, filename };
}

async function queryImageCredit(filename: string): Promise<PhotoCredit | undefined> {
  try {
    const res = await fetch(
      wikipediaApiUrl({ action: "query", titles: `File:${filename}`, prop: "imageinfo", iiprop: "extmetadata|url" }),
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as WikiImageInfoResponse;
    const info = Object.values(data.query?.pages ?? {})[0]?.imageinfo?.[0];
    const artistHtml = info?.extmetadata?.Artist?.value;
    const license = info?.extmetadata?.LicenseShortName?.value;
    const sourceUrl = info?.descriptionurl ?? info?.url;
    if (!artistHtml || !license || !sourceUrl) return undefined;
    const name = stripHtmlTags(artistHtml);
    if (!name) return undefined;
    return { name, license, sourceUrl };
  } catch {
    return undefined;
  }
}

async function fetchCapitalPhoto(capital: string, countryName: string): Promise<CapitalPhoto | null> {
  const candidates = [capital, `${capital}, ${countryName}`];
  for (const title of candidates) {
    try {
      const found = await queryPageImage(title);
      if (found) return { url: found.thumbnailUrl, credit: await queryImageCredit(found.filename) };
    } catch {
      // network hiccup or bad match -- try the next candidate title
    }
  }
  return null;
}

const photoCache = new Map<string, CapitalPhoto | null>();
let currentPhotoToken = 0;

function loadCapitalPhoto(country: Country): Promise<CapitalPhoto | null> {
  const cached = photoCache.get(country.code);
  if (cached !== undefined) return Promise.resolve(cached);
  return fetchCapitalPhoto(country.capital, country.name).then((photo) => {
    photoCache.set(country.code, photo);
    return photo;
  });
}

function resetPhotoLayer(): void {
  skylinePhotoEl.classList.remove("visible");
  skylinePhotoEl.style.backgroundImage = "";
  photoCreditEl.hidden = true;
  photoCreditEl.replaceChildren();
}

function applyPhoto(photo: CapitalPhoto | null): void {
  if (!photo) return; // generative skyline underneath stays visible
  const credit = photo.credit;
  const preload = new Image();
  // Credit goes up with the photo, not before it: until onload the silhouette
  // is still what's on screen, and crediting a photographer for it is wrong.
  preload.onload = () => {
    skylinePhotoEl.style.backgroundImage = `url("${photo.url}")`;
    skylinePhotoEl.classList.add("visible");
    if (!credit) return;
    const link = document.createElement("a");
    link.href = credit.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = credit.name;
    photoCreditEl.replaceChildren("Photo: ", link, ` (${credit.license}) · Wikimedia Commons`);
    photoCreditEl.hidden = false;
  };
  preload.src = photo.url;
}

function animateNumber(el: HTMLElement, target: number, format: (value: number) => string): void {
  const duration = 1000;
  const start = performance.now();
  function tick(now: number) {
    const elapsed = Math.min(1, (now - start) / duration);
    // easeOutExpo -- lands on the figure early and settles, rather than the
    // long linear-ish crawl an easeOutCubic leaves at the tail.
    const eased = elapsed === 1 ? 1 : 1 - 2 ** (-10 * elapsed);
    el.textContent = format(target * eased);
    if (elapsed < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// --- Stat hotspot dots + popover ------------------------------------------

let openPopover: { dot: HTMLButtonElement; meta: StatMeta } | null = null;
let popoverHideTimer = 0;

function closePopover(): void {
  if (openPopover) {
    openPopover.dot.setAttribute("aria-expanded", "false");
    openPopover = null;
  }
  // Kept in the layout until the exit transition finishes, then hidden for
  // real so it stays out of the a11y tree and off the tab order.
  popoverEl.classList.remove("open");
  clearTimeout(popoverHideTimer);
  popoverHideTimer = window.setTimeout(
    () => {
      popoverEl.hidden = true;
    },
    prefersReducedMotion ? 0 : 180,
  );
}

// Measured from the layout box, not getBoundingClientRect: the entrance
// transition scales the popover, and a scaled rect would mis-centre it.
function positionPopover(dot: HTMLButtonElement): void {
  const heroRect = heroEl.getBoundingClientRect();
  const dotRect = dot.getBoundingClientRect();
  const popWidth = popoverEl.offsetWidth;
  const popHeight = popoverEl.offsetHeight;
  const margin = 12;

  let left = dotRect.left - heroRect.left + dotRect.width / 2 - popWidth / 2;
  left = Math.min(Math.max(left, margin), heroRect.width - popWidth - margin);

  let top = dotRect.top - heroRect.top - popHeight - 14;
  if (top < margin) {
    top = dotRect.bottom - heroRect.top + 14;
  }
  top = Math.min(Math.max(top, margin), heroRect.height - popHeight - margin);

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
  clearTimeout(popoverHideTimer);
  popoverEl.hidden = false;
  dot.setAttribute("aria-expanded", "true");
  openPopover = { dot, meta };
  positionPopover(dot);
  // Placed before the entrance runs, so it grows from where it will sit.
  requestAnimationFrame(() => popoverEl.classList.add("open"));
}

function renderHotspots(country: Country): void {
  closePopover();
  statDotsEl.replaceChildren();
  const count = Math.min(allStatMeta.length, hotspotPositions.length);
  for (let i = 0; i < count; i++) {
    const meta = allStatMeta[i];
    const pos = hotspotPositions[i];

    const label = document.createElement("span");
    label.className = "stat-dot-label";
    label.textContent = meta.label;

    const mark = document.createElement("span");
    mark.className = "stat-dot-mark";
    mark.setAttribute("aria-hidden", "true");

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "stat-dot";
    dot.style.left = `${pos.xPct}%`;
    dot.style.top = `${pos.yPct}%`;
    dot.style.setProperty("--i", String(i)); // drives the reveal stagger in CSS
    dot.setAttribute("aria-expanded", "false");
    dot.setAttribute("aria-description", "Tap for the figure");
    dot.append(label, mark);
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

// Coarse continent outlines as flat [lon, lat, ...] pairs of real degrees, run
// through the same orthographic projection the country dots use. Deliberately
// low-poly, and split where a landmass spans too much longitude to survive
// being half-turned away (North America at -100, Eurasia along its length):
// this is a sphere a few hundred pixels across that never stops turning, so
// silhouette is the only thing that reads, and coastline detail is cost with
// nothing to show for it.
const LANDMASSES: number[][] = [
  // Africa
  [
    -17, 14, -16, 20, -12, 27, -9, 32, -5, 36, 10, 37, 20, 32, 25, 32, 32, 31, 35, 28, 37, 22, 39, 15,
    43, 11, 51, 11, 51, 5, 41, -2, 40, -10, 35, -18, 33, -26, 32, -29, 28, -33, 25, -34, 18, -34,
    15, -27, 12, -18, 13, -9, 9, -1, 9, 4, 3, 6, -5, 5, -8, 4, -13, 8,
  ],
  // Europe
  [
    -9, 37, -9, 43, -1, 44, -2, 48, 2, 51, 5, 53, 8, 55, 10, 58, 6, 61, 12, 66, 20, 70, 28, 71,
    33, 69, 32, 60, 28, 58, 24, 56, 21, 55, 19, 50, 22, 46, 28, 45, 28, 41, 23, 40, 16, 42, 12, 45,
    7, 44, 3, 42, -2, 37,
  ],
  // Britain and Ireland
  [-5, 50, -3, 53, -3, 58, -5, 58, -8, 55, -10, 52, -6, 50],
  // Russia, west of the Yenisei
  [
    33, 69, 45, 67, 60, 70, 75, 73, 90, 75, 95, 72, 92, 64, 85, 58, 78, 55, 70, 53, 62, 52, 55, 52,
    48, 50, 42, 46, 38, 45, 33, 52,
  ],
  // Siberia and the Russian far east
  [
    95, 72, 105, 76, 115, 74, 128, 73, 140, 72, 150, 70, 160, 69, 170, 67, 180, 66, 178, 60, 170, 60,
    163, 58, 158, 52, 145, 45, 140, 40, 130, 42, 125, 50, 120, 53, 115, 50, 110, 50, 105, 52, 100, 52,
    95, 55, 92, 64,
  ],
  // China and mainland south-east Asia
  [
    92, 28, 95, 33, 100, 38, 105, 40, 110, 42, 118, 40, 122, 38, 122, 32, 118, 25, 110, 21, 108, 15,
    106, 10, 103, 1, 100, 7, 98, 10, 99, 20, 95, 22,
  ],
  // South Asia
  [68, 24, 70, 28, 75, 32, 80, 30, 88, 27, 92, 25, 92, 22, 88, 21, 85, 19, 80, 15, 77, 8, 73, 16, 70, 20],
  // Arabia, Iran and Anatolia
  [35, 37, 40, 38, 45, 39, 50, 40, 55, 38, 60, 37, 60, 30, 58, 25, 56, 26, 52, 24, 50, 20, 45, 13, 43, 13, 40, 20, 37, 28, 35, 30],
  // Australia
  [
    113, -22, 114, -26, 115, -34, 118, -35, 123, -34, 129, -32, 134, -33, 138, -35, 145, -38, 150, -37,
    153, -28, 153, -25, 146, -19, 142, -11, 136, -12, 130, -11, 126, -14, 122, -18, 117, -20,
  ],
  // South America
  [
    -77, 8, -72, 11, -62, 10, -52, 5, -50, 0, -44, -2, -35, -6, -38, -13, -40, -20, -48, -25, -53, -34,
    -58, -38, -62, -40, -65, -45, -68, -52, -72, -52, -71, -45, -73, -37, -71, -30, -70, -22, -76, -14,
    -81, -6, -80, 0, -78, 2,
  ],
  // North America, west of the 100th meridian
  [
    -168, 66, -160, 70, -145, 70, -130, 70, -115, 70, -100, 70, -100, 25, -105, 22, -110, 24, -114, 28,
    -118, 31, -122, 37, -124, 42, -124, 48, -128, 52, -135, 58, -145, 60, -155, 58, -166, 60,
  ],
  // North America, east of it -- the shared straight seam is invisible once both are filled
  [
    -100, 70, -90, 72, -82, 73, -78, 70, -70, 62, -64, 58, -56, 52, -62, 47, -70, 45, -74, 40, -78, 35,
    -81, 31, -80, 25, -85, 30, -90, 29, -97, 26, -100, 25,
  ],
  // Central America
  [-92, 18, -88, 21, -86, 16, -83, 10, -79, 9, -77, 8, -83, 8, -87, 13, -92, 15],
  // Greenland
  [-45, 60, -50, 65, -55, 70, -60, 76, -50, 82, -30, 83, -22, 75, -25, 70, -35, 66],
];

/** One canvas showing the globe. Two exist -- the landing's and the hero's --
 * and both are drawn by the same code at the same rotation, so the handoff
 * between the screens is a cross-fade between two views of one world rather
 * than two implementations that could drift apart. */
interface GlobeView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** The box the canvas fills. Measured instead of the canvas itself, because
   * the canvas is CSS-transformed (the zoom, the handoff) and its own rect
   * would report the transformed size. */
  host: HTMLElement;
  radiusFactor: number;
  width: number;
  height: number;
  /** Whether this view's screen is on-screen right now. Both are live during
   * the handoff; a view whose screen is display:none is not drawn at all. */
  live: boolean;
}

function createView(canvas: HTMLCanvasElement, host: HTMLElement, radiusFactor: number): GlobeView {
  return { canvas, ctx: canvas.getContext("2d")!, host, radiusFactor, width: 0, height: 0, live: false };
}

const landingView = createView(landingCanvas, landingEl, 0.42);
const heroView = createView(globeCanvas, frameEl, 0.34);
const views = [landingView, heroView];

function sizeView(view: GlobeView): void {
  const rect = view.host.getBoundingClientRect();
  view.width = rect.width;
  view.height = rect.height;
  // A hidden screen measures zero: leave the canvas alone and wait to be
  // called again when it is revealed (see the ResizeObserver below).
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = window.devicePixelRatio || 1;
  view.canvas.width = Math.max(1, Math.round(rect.width * dpr));
  view.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  view.canvas.style.width = `${rect.width}px`;
  view.canvas.style.height = `${rect.height}px`;
  view.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeCanvas(): void {
  for (const view of views) sizeView(view);
}

// Where the sun is, as a fraction of the radius from the centre. Everything
// that suggests a lit ball rather than a flat disc -- the ocean gradient, the
// terminator, the bright rim -- is placed from this one vector.
const LIGHT_X = -0.4;
const LIGHT_Y = -0.45;

function drawLandmasses(view: GlobeView, cx: number, cy: number, radius: number, atRotation: number): void {
  const { ctx } = view;
  ctx.fillStyle = "#487f60";
  for (const points of LANDMASSES) {
    let anyVisible = false;
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 2) {
      const point = projectGlobe(points[i], points[i + 1], atRotation);
      let dx = (point.xPct - 50) / 50;
      let dy = (point.yPct - 50) / 50;
      if (point.depth < 0) {
        // Behind the sphere: push the vertex out to the limb, so a landmass
        // turning away hugs the edge instead of folding back through the face.
        const length = Math.hypot(dx, dy) || 1;
        dx /= length;
        dy /= length;
      } else {
        anyVisible = true;
      }
      const x = cx + dx * radius;
      const y = cy + dy * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (anyVisible) ctx.fill();
  }
}

function drawGraticule(view: GlobeView, cx: number, cy: number, radius: number, atRotation: number): void {
  const { ctx } = view;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.085)";
  ctx.lineWidth = 1;

  const plot = (lon: number, lat: number, penDown: boolean): boolean => {
    const point = projectGlobe(lon, lat, atRotation);
    if (point.depth < 0) return false; // gone round the back -- lift the pen
    const x = cx + ((point.xPct - 50) / 50) * radius;
    const y = cy + ((point.yPct - 50) / 50) * radius;
    if (penDown) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    return true;
  };

  ctx.beginPath();
  for (let lon = -180; lon < 180; lon += 30) {
    let penDown = false;
    for (let lat = -80; lat <= 80; lat += 10) penDown = plot(lon, lat, penDown);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    let penDown = false;
    for (let lon = -180; lon <= 180; lon += 10) penDown = plot(lon, lat, penDown);
  }
  ctx.stroke();
}

function drawView(view: GlobeView, atRotation: number): void {
  const { ctx, width: w, height: h } = view;
  if (w === 0 || h === 0) return;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * view.radiusFactor;
  const lightX = cx + LIGHT_X * radius;
  const lightY = cy + LIGHT_Y * radius;

  // Atmosphere: a halo just outside the sphere, brightest where the light is.
  const halo = ctx.createRadialGradient(cx, cy, radius * 0.96, cx, cy, radius * 1.16);
  halo.addColorStop(0, "rgba(96, 165, 232, 0.34)");
  halo.addColorStop(0.55, "rgba(70, 130, 200, 0.12)");
  halo.addColorStop(1, "rgba(60, 120, 190, 0)");
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.16, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();

  // Ocean, lit from LIGHT_X/LIGHT_Y rather than filled flat.
  const ocean = ctx.createRadialGradient(lightX, lightY, radius * 0.05, cx, cy, radius * 1.05);
  ocean.addColorStop(0, "#3d6f9e");
  ocean.addColorStop(0.45, "#1f4568");
  ocean.addColorStop(1, "#0b1e33");
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = ocean;
  ctx.fill();

  // Everything on the surface is clipped to the sphere: limb-clamped coastline
  // vertices land exactly on the edge, and rounding shouldn't spill past it.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  drawLandmasses(view, cx, cy, radius, atRotation);
  drawGraticule(view, cx, cy, radius, atRotation);

  // Day/night: the same light vector again, darkening away from it into the
  // far limb, which is what stops the sphere reading as a flat disc.
  const terminator = ctx.createRadialGradient(lightX, lightY, radius * 0.1, lightX, lightY, radius * 2.05);
  terminator.addColorStop(0, "rgba(4, 10, 20, 0)");
  terminator.addColorStop(0.45, "rgba(4, 10, 20, 0.22)");
  terminator.addColorStop(1, "rgba(2, 6, 14, 0.82)");
  ctx.fillStyle = terminator;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  ctx.restore();

  // Rim light along the lit edge -- drawn after the terminator so the far limb
  // keeps its darkness and only the sunward side catches the highlight.
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, radius * 0.008);
  const rim = ctx.createLinearGradient(cx + LIGHT_X * radius, cy + LIGHT_Y * radius, cx - LIGHT_X * radius, cy - LIGHT_Y * radius);
  rim.addColorStop(0, "rgba(173, 216, 255, 0.75)");
  rim.addColorStop(0.55, "rgba(120, 175, 235, 0.18)");
  rim.addColorStop(1, "rgba(120, 175, 235, 0.05)");
  ctx.strokeStyle = rim;
  ctx.stroke();

  // The data layer, on top of the shading: one dot per country, sized by its
  // share of the world's births. Far-side dots stay faint rather than vanish.
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
    const alpha = 0.18 + 0.72 * depthT;

    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.6, size / 2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(242, 201, 76, ${alpha.toFixed(3)})`;
    ctx.fill();
  }
}

function drawGlobe(atRotation: number): void {
  for (const view of views) {
    if (view.live) drawView(view, atRotation);
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

  resetPhotoLayer();
  const photoToken = ++currentPhotoToken;
  loadCapitalPhoto(country).then((photo) => {
    if (photoToken !== currentPhotoToken) return; // superseded by a later spin
    applyPhoto(photo);
  });

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

// --- Landing -> game handoff ------------------------------------------------

const HANDOFF_MS = 760;

let currentScreen: "landing" | "game" = "landing";

function startGame(): void {
  if (currentScreen === "game") return;
  currentScreen = "game";

  heroEl.hidden = false;
  heroView.live = true;
  // The hero canvas had no box at all until this line: it was display:none at
  // load, so anything measured then would have sized it to zero. Measure and
  // draw now, in the frame it becomes visible.
  sizeView(heroView);
  drawGlobe(rotation);

  landingEl.classList.add("leaving");
  heroEl.classList.add("entering");

  window.setTimeout(
    () => {
      landingEl.hidden = true;
      landingView.live = false;
      heroEl.classList.remove("entering");
      // Hands the keyboard straight to the control that replaced Start.
      spinBtn.focus();
    },
    prefersReducedMotion ? 0 : HANDOFF_MS,
  );
}

// --- "How this works" dialog ------------------------------------------------

let helpHideTimer = 0;

function isHelpOpen(): boolean {
  return !helpBackdropEl.hidden;
}

function openHelp(): void {
  if (isHelpOpen()) return;
  clearTimeout(helpHideTimer);
  helpBackdropEl.hidden = false;
  helpToggleEl.setAttribute("aria-expanded", "true");
  // Same order as the stat popover: in the layout at its from-state for a
  // frame, then transitioned open -- and focused once it is really there.
  requestAnimationFrame(() => {
    helpBackdropEl.classList.add("open");
    helpDialogEl.focus();
  });
}

function closeHelp(): void {
  if (!isHelpOpen()) return;
  helpBackdropEl.classList.remove("open");
  helpToggleEl.setAttribute("aria-expanded", "false");
  clearTimeout(helpHideTimer);
  helpHideTimer = window.setTimeout(
    () => {
      helpBackdropEl.hidden = true;
    },
    prefersReducedMotion ? 0 : 220,
  );
  helpToggleEl.focus();
}

helpToggleEl.addEventListener("click", () => {
  if (isHelpOpen()) closeHelp();
  else openHelp();
});

helpCloseEl.addEventListener("click", closeHelp);

helpBackdropEl.addEventListener("click", (event) => {
  if (event.target === helpBackdropEl) closeHelp();
});

// aria-modal hides the rest of the page from assistive tech, but a sighted
// keyboard user can still tab straight out of a dialog nothing has made inert.
helpDialogEl.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const focusable = [...helpDialogEl.querySelectorAll<HTMLElement>("button, a[href]")];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === helpDialogEl)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
});

// --- Boot -------------------------------------------------------------------

const sourceNames = data.meta.sources.map((s) => s.name).join(" and ");
methodologyIntroEl.textContent =
  `Dataset compiled ${data.meta.compiledAt} from ${sourceNames}. ${allCountries.length} countries have ` +
  `enough data to be in the lottery pool; each is weighted by its own real population and birth-rate figures.`;

landingView.live = true;
resizeCanvas();
if (prefersReducedMotion) {
  drawGlobe(rotation);
} else {
  scheduleFrame();
}

function handleLayoutChange(): void {
  resizeCanvas();
  drawGlobe(rotation);
  if (openPopover) positionPopover(openPopover.dot);
}

window.addEventListener("resize", handleLayoutChange);

// Catches the resizes a window `resize` event never reports: a screen being
// revealed with a real box for the first time, and the mobile URL bar or an
// orientation change resizing a screen without resizing the window.
const layoutObserver = new ResizeObserver(handleLayoutChange);
for (const view of views) layoutObserver.observe(view.host);

startBtn.addEventListener("click", startGame);
spinBtn.addEventListener("click", spin);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (isHelpOpen()) closeHelp();
    else if (openPopover) closePopover();
    return;
  }
  if (event.code !== "Space" && event.code !== "Enter") return;
  if (document.activeElement !== document.body) return;
  if (isHelpOpen()) return;
  event.preventDefault();
  if (currentScreen === "landing") startGame();
  else spin();
});
