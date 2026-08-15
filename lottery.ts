// Pure logic for the birth lottery -- no DOM here. main.ts wires this into
// the page; spec/birth-lottery.test.ts exercises these functions directly.

export interface Stat {
  value: number;
  year: number;
}

export interface Country {
  code: string;
  name: string;
  capital: string;
  region: string;
  lat: number;
  lon: number;
  population: Stat;
  birthRatePer1000: Stat;
  lifeExpectancy?: Stat;
  infantMortalityPer1000?: Stat;
  maternalMortalityPer100k?: Stat;
  adultMortalityMalePer1000?: Stat;
  adultMortalityFemalePer1000?: Stat;
  basicWaterAccessPct?: Stat;
  electricityAccessPct?: Stat;
  pm25?: Stat;
  gdpPerCapitaPPP?: Stat;
  unemploymentPct?: Stat;
  extremePovertyPct?: Stat;
  internetUsePct?: Stat;
}

export interface Odds {
  countryBirths: number;
  worldBirths: number;
  percentage: number;
}

export interface Projected {
  xPct: number;
  yPct: number;
}

/** Estimated live births/year: population x crude birth rate. Both are real,
 * independently-sourced World Bank indicators for the country's own most
 * recent reported year (see countries.json meta for exact years/sources). */
export function annualBirths(country: Pick<Country, "population" | "birthRatePer1000">): number {
  return (country.population.value * country.birthRatePer1000.value) / 1000;
}

export function totalAnnualBirths(countries: Country[]): number {
  return countries.reduce((sum, c) => sum + annualBirths(c), 0);
}

/** The odds shown to the user, with the real numbers so the calculation is
 * checkable, not just asserted. */
export function oddsOf(country: Country, countries: Country[]): Odds {
  const countryBirths = annualBirths(country);
  const worldBirths = totalAnnualBirths(countries);
  return { countryBirths, worldBirths, percentage: (countryBirths / worldBirths) * 100 };
}

/** Weighted random draw over countries, weighted by annualBirths. `rng` is
 * injectable so tests are deterministic (a real call passes Math.random). */
export function pickCountry(countries: Country[], rng: () => number = Math.random): Country {
  if (countries.length === 0) {
    throw new Error("pickCountry: no countries to choose from");
  }
  const weights = countries.map(annualBirths);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let target = rng() * total;
  for (let i = 0; i < countries.length; i++) {
    target -= weights[i];
    if (target <= 0) return countries[i];
  }
  // Floating-point leftover from the last subtraction: land on the last
  // country rather than falling through undefined.
  return countries[countries.length - 1];
}

/** Chance of surviving infancy, derived from infant mortality rate (deaths
 * per 1,000 live births). This is the honestly-labelled proxy for "born a
 * healthy baby" -- it measures survival, not general health. */
export function survivalProbability(infantMortalityPer1000: number): number {
  return 1 - infantMortalityPer1000 / 1000;
}

/** Equirectangular projection: real (lon, lat) -> percentage position on a
 * plain rectangular canvas. No coastline art is drawn -- plotting every
 * country's real coordinates is what makes the dot-scatter read as a map. */
export function project(lon: number, lat: number): Projected {
  const xPct = ((lon + 180) / 360) * 100;
  const yPct = ((90 - lat) / 180) * 100;
  return {
    xPct: Math.min(100, Math.max(0, xPct)),
    yPct: Math.min(100, Math.max(0, yPct)),
  };
}
