import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  annualBirths,
  oddsOf,
  pickCountry,
  project,
  statRange,
  survivalProbability,
  weightedAverage,
  type Country,
} from "../lottery";

// Small hand-picked fixtures, not the real countries.json — the point of a
// unit test is a total the reader can check by hand.
const stat = (value: number) => ({ value, year: 2024 });

const countryA: Country = {
  code: "AAA",
  name: "Aland",
  capital: "Aville",
  region: "Testland",
  lat: 0,
  lon: 0,
  population: stat(1_000_000),
  birthRatePer1000: stat(20), // annualBirths = 20,000
  lifeExpectancy: stat(70),
};

const countryB: Country = {
  code: "BBB",
  name: "Borogovia",
  capital: "Bville",
  region: "Testland",
  lat: 10,
  lon: 20,
  population: stat(2_000_000),
  birthRatePer1000: stat(10), // annualBirths = 20,000
  lifeExpectancy: stat(80),
};

const countryC: Country = {
  code: "CCC",
  name: "Carpania",
  capital: "Cville",
  region: "Testland",
  lat: -10,
  lon: -20,
  population: stat(500_000),
  birthRatePer1000: stat(20), // annualBirths = 10,000
};

const fixtureCountries = [countryA, countryB, countryC]; // total = 50,000

describe("annualBirths", () => {
  it("multiplies population by crude birth rate per 1,000", () => {
    expect(annualBirths(countryA)).toBe(20_000);
    expect(annualBirths(countryC)).toBe(10_000);
  });
});

describe("pickCountry", () => {
  // Weights are 20,000 / 20,000 / 10,000 out of a 50,000 total, so the
  // cumulative ranges are A [0, 0.4), B [0.4, 0.8), C [0.8, 1). Picking rng
  // values well inside each range (not on the boundary) keeps the expected
  // country unambiguous.
  it("picks the country whose cumulative weight range contains the draw", () => {
    expect(pickCountry(fixtureCountries, () => 0.1)).toBe(countryA);
    expect(pickCountry(fixtureCountries, () => 0.5)).toBe(countryB);
    expect(pickCountry(fixtureCountries, () => 0.9)).toBe(countryC);
  });

  it("throws rather than silently returning nothing for an empty pool", () => {
    expect(() => pickCountry([], () => 0.5)).toThrow();
  });
});

describe("oddsOf", () => {
  it("reports the real numbers behind the percentage, not just the percentage", () => {
    const odds = oddsOf(countryA, fixtureCountries);
    expect(odds.countryBirths).toBe(20_000);
    expect(odds.worldBirths).toBe(50_000);
    expect(odds.percentage).toBeCloseTo(40, 5);
  });
});

describe("survivalProbability", () => {
  it("converts infant mortality per 1,000 into a survival chance", () => {
    expect(survivalProbability(25)).toBeCloseTo(0.975, 10);
    expect(survivalProbability(0)).toBe(1);
  });
});

describe("statRange", () => {
  it("returns the min/max only among countries that report the stat", () => {
    // countryC has no lifeExpectancy, so it's excluded from the range.
    expect(statRange(fixtureCountries, (c) => c.lifeExpectancy)).toEqual({ min: 70, max: 80 });
  });

  it("returns undefined when nobody in the pool reports the stat", () => {
    expect(statRange(fixtureCountries, (c) => c.pm25)).toBeUndefined();
  });
});

describe("weightedAverage", () => {
  it("weights each country's stat by its own annual births", () => {
    // (70 * 20,000 + 80 * 20,000) / (20,000 + 20,000) = 75, countryC excluded
    expect(weightedAverage(fixtureCountries, (c) => c.lifeExpectancy)).toBeCloseTo(75, 10);
  });

  it("returns undefined when nobody in the pool reports the stat", () => {
    expect(weightedAverage(fixtureCountries, (c) => c.pm25)).toBeUndefined();
  });
});

describe("project", () => {
  it("maps the centre of the map to (50%, 50%)", () => {
    expect(project(0, 0)).toEqual({ xPct: 50, yPct: 50 });
  });

  it("maps the north-west corner (antimeridian, north pole) to (0%, 0%)", () => {
    expect(project(-180, 90)).toEqual({ xPct: 0, yPct: 0 });
  });

  it("maps the south-east corner (antimeridian, south pole) to (100%, 100%)", () => {
    expect(project(180, -90)).toEqual({ xPct: 100, yPct: 100 });
  });

  it("clamps out-of-range coordinates instead of drawing off-canvas", () => {
    expect(project(200, 100)).toEqual({ xPct: 100, yPct: 0 });
  });
});

// DOM checks against the BUILT page, matching spec/invariants.test.ts's
// pattern: run `pnpm build` first (the `check` script does).
const distPath = resolve("dist/index.html");
const doc = new JSDOM(readFileSync(distPath, "utf8")).window.document;

describe("the birth lottery page", () => {
  it("has a spin control -- the one stated, testable interaction", () => {
    const spin = doc.querySelector('[data-testid="spin"]');
    expect(spin).toBeTruthy();
    expect(spin?.tagName).toBe("BUTTON");
  });

  it("shows no country before the first spin", () => {
    const content = doc.querySelector('[data-field="content"]');
    const placeholder = doc.querySelector('[data-field="placeholder"]');
    expect(content?.hasAttribute("hidden")).toBe(true);
    expect(placeholder?.hasAttribute("hidden")).toBe(false);
  });

  it("always shows how the odds are calculated -- no secrets", () => {
    const methodology = doc.querySelector('[data-testid="methodology"]');
    expect(methodology).toBeTruthy();
    expect(methodology?.hasAttribute("hidden")).toBe(false);
    const text = (methodology?.textContent ?? "").replace(/\s+/g, " ");
    expect(text).toContain("World Bank");
    expect(text.toLowerCase()).toContain("population");
    expect(text.toLowerCase()).toContain("birth rate");
  });
});
