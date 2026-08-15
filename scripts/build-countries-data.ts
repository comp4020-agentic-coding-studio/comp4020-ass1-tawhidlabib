// Compiles countries.json from two public, no-auth sources:
//   - country identity/capital/coordinates: mledoze/countries (GitHub, MIT)
//   - all statistical indicators: World Bank Open Data API (CC BY-4.0)
// Re-run this whenever you want fresher numbers: `node scripts/build-countries-data.ts`
// It hits the network and overwrites countries.json; nothing here runs at
// site runtime — the compiled JSON is what ships.

const COUNTRIES_URL =
  "https://raw.githubusercontent.com/mledoze/countries/master/dist/countries.json";

const WORLD_BANK_BASE = "https://api.worldbank.org/v2/country/all/indicator";

// indicator code -> key in the compiled record
const INDICATORS = {
  "SP.POP.TOTL": "population",
  "SP.DYN.CBRT.IN": "birthRatePer1000",
  "SP.DYN.LE00.IN": "lifeExpectancy",
  "SP.DYN.IMRT.IN": "infantMortalityPer1000",
  "SH.STA.MMRT": "maternalMortalityPer100k",
  "SP.DYN.AMRT.MA": "adultMortalityMalePer1000",
  "SP.DYN.AMRT.FE": "adultMortalityFemalePer1000",
  "SH.H2O.BASW.ZS": "basicWaterAccessPct",
  "EG.ELC.ACCS.ZS": "electricityAccessPct",
  "EN.ATM.PM25.MC.M3": "pm25",
  "NY.GDP.PCAP.PP.CD": "gdpPerCapitaPPP",
  "SL.UEM.TOTL.ZS": "unemploymentPct",
  "SI.POV.DDAY": "extremePovertyPct",
  "IT.NET.USER.ZS": "internetUsePct",
} as const;

interface Stat {
  value: number;
  year: number;
}

interface CountryRecord {
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

interface WorldBankRow {
  countryiso3code: string;
  date: string;
  value: number | null;
}

async function fetchIndicator(code: string): Promise<Map<string, Stat>> {
  // Fetching a wide date range and picking the most recent non-null value
  // ourselves, rather than relying on the API's mrv+gapfill combination,
  // which returned all-null for some indicators (PM2.5, maternal mortality)
  // when scoped to "all countries" -- a server-side quirk, not a data gap.
  const url = `${WORLD_BANK_BASE}/${code}?format=json&per_page=20000&date=2000:2024`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`World Bank fetch failed for ${code}: ${res.status}`);
  const json = (await res.json()) as [unknown, WorldBankRow[]];
  const rows = json[1] ?? [];
  const map = new Map<string, Stat>();
  for (const row of rows) {
    if (row.value === null || row.value === undefined) continue;
    const year = Number(row.date);
    const existing = map.get(row.countryiso3code);
    if (!existing || existing.year < year) {
      map.set(row.countryiso3code, { value: row.value, year });
    }
  }
  return map;
}

async function main() {
  console.log("Fetching country identity/capital/coordinates...");
  const countriesRes = await fetch(COUNTRIES_URL);
  if (!countriesRes.ok) throw new Error(`countries fetch failed: ${countriesRes.status}`);
  const rawCountries = (await countriesRes.json()) as Array<{
    name: { common: string };
    cca3: string;
    capital?: string[];
    region: string;
    latlng?: [number, number];
    independent?: boolean;
  }>;

  console.log("Fetching World Bank indicators (14 requests)...");
  const indicatorMaps = new Map<string, Map<string, Stat>>();
  for (const [code, key] of Object.entries(INDICATORS)) {
    indicatorMaps.set(key, await fetchIndicator(code));
    console.log(`  ${code} -> ${key}: ${indicatorMaps.get(key)!.size} countries`);
  }

  const records: CountryRecord[] = [];
  let skippedNoCoreData = 0;

  for (const c of rawCountries) {
    if (!c.latlng || !c.capital || c.capital.length === 0) continue;

    const population = indicatorMaps.get("population")!.get(c.cca3);
    const birthRatePer1000 = indicatorMaps.get("birthRatePer1000")!.get(c.cca3);

    // Core weighting data (population x birth rate) is required to be in
    // the lottery pool at all -- see PROCESS.md / the odds methodology.
    if (!population || !birthRatePer1000) {
      skippedNoCoreData++;
      continue;
    }

    const record: CountryRecord = {
      code: c.cca3,
      name: c.name.common,
      capital: c.capital[0],
      region: c.region,
      lat: c.latlng[0],
      lon: c.latlng[1],
      population,
      birthRatePer1000,
    };

    for (const key of Object.values(INDICATORS)) {
      if (key === "population" || key === "birthRatePer1000") continue;
      const stat = indicatorMaps.get(key)!.get(c.cca3);
      if (stat) (record as Record<string, Stat>)[key] = stat;
    }

    records.push(record);
  }

  records.sort((a, b) => a.name.localeCompare(b.name));

  const output = {
    meta: {
      compiledAt: new Date().toISOString().slice(0, 10),
      sources: [
        {
          name: "mledoze/countries",
          url: "https://github.com/mledoze/countries",
          fields: "capital, region, country coordinates",
        },
        {
          name: "World Bank Open Data",
          url: "https://data.worldbank.org/",
          license: "CC BY-4.0",
          fields: Object.entries(INDICATORS).map(([code, key]) => `${key} (${code})`),
        },
      ],
      note: "Each stat carries the actual year it was reported for that country (most recent available, World Bank 'mrv=1&gapfill=Y'), not a single fixed year across all countries.",
    },
    countries: records,
  };

  const path = new URL("../countries.json", import.meta.url);
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(path, JSON.stringify(output, null, 2) + "\n"),
  );

  console.log(
    `\nWrote ${records.length} countries to countries.json (skipped ${skippedNoCoreData} missing core population/birth-rate data).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
