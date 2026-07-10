// skills/property-search/parse.ts
// Week 2 — parse a free-text query into a structured filter object.
// Semantics: minBeds/minBaths/minSqft = minimum (>=), maxPrice = maximum (<=).
import { fileURLToPath } from "node:url";

export type PropertyFilters = {
  city: string | null;
  maxPrice: number | null;
  minBeds: number | null;
  minBaths: number | null;
  minSqft: number | null;
  type: string | null;
  pool: string | null;
  hasView: string | null;
};

function detectFlag(query: string, word: string): string | null {
  const present = new RegExp(`\\b${word}\\b`, "i").test(query);
  if (!present) return null;
  const negated = new RegExp(`\\b(no|without|not)\\s+(a\\s+)?${word}\\b`, "i").test(query);
  return negated ? "False" : "True";
}

function normalizeCity(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,?\s*(ca|california)\s*$/i, "").trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function parsePropertyQuery(query: string): PropertyFilters {
  const empty: PropertyFilters = {
    city: null, maxPrice: null, minBeds: null, minBaths: null,
    minSqft: null, type: null, pool: null, hasView: null,
  };
  if (!query || !query.trim()) return empty;

  const cityMatch  = query.match(/in ([A-Za-z\s]+?)(?:\s+under|\s+below|\s+with|\s+at|\s+over|,|$)/i);
  const priceMatch = query.match(/(?:under|below|less than|up to|max|maximum|at most)\s+\$?([\d,.]+)\s*(k|m)?/i);
  const bedsMatch  = query.match(/(\d+)[\s-]*(bed|beds|bedroom|bedrooms)/i);
  const bathsMatch = query.match(/(\d+(?:\.5)?)[\s-]*(bath|baths|bathroom|bathrooms)/i);
  const sqftMatch  = query.match(/(\d[\d,]*)[\s-]*(sqft|sq ft|square feet)/i);

  const typeMap: Record<string, string> = {
    condo: "Condominium", townhome: "Townhouse", townhouse: "Townhouse",
    "single family": "SingleFamilyResidence", land: "UnimprovedLand",
  };
  const typeKey = Object.keys(typeMap).find((k) => new RegExp(`\\b${k}s?\\b`, "i").test(query));

  let maxPrice: number | null = null;
  if (priceMatch) {
    maxPrice = Number(priceMatch[1].replace(/,/g, ""));
    const unit = priceMatch[2]?.toLowerCase();
    if (unit === "k") maxPrice *= 1_000;
    if (unit === "m") maxPrice *= 1_000_000;
  }

  return {
    city:     normalizeCity(cityMatch?.[1]),
    maxPrice,
    minBeds:  bedsMatch  ? Number(bedsMatch[1])  : null,
    minBaths: bathsMatch ? Number(bathsMatch[1]) : null,
    minSqft:  sqftMatch  ? Number(sqftMatch[1].replace(/,/g, "")) : null,
    type:     typeKey ? typeMap[typeKey] : null,
    pool:     detectFlag(query, "pool"),
    hasView:  detectFlag(query, "view"),
  };
}

// --- Test suite: runs ONLY when this file is executed directly ---
const runDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (runDirectly) {
  type TestCase = { query: string; expected: Partial<PropertyFilters> };
  const TEST_QUERIES: TestCase[] = [
    { query: "3 bedroom condos in Irvine under $1.5M with a pool",
      expected: { city: "Irvine", maxPrice: 1500000, minBeds: 3, type: "Condominium", pool: "True" } },
    { query: "homes in Pasadena under $900k", expected: { city: "Pasadena", maxPrice: 900000 } },
    { query: "2.5 bath house in San Diego", expected: { city: "San Diego", minBaths: 2.5 } },
    { query: "condos in Newport Beach under $2M", expected: { city: "Newport Beach", maxPrice: 2000000, type: "Condominium" } },
    { query: "single family with ocean view in Malibu", expected: { city: "Malibu", type: "SingleFamilyResidence", hasView: "True" } },
    { query: "show me some houses", expected: { city: null, maxPrice: null, minBeds: null, type: null } },
    { query: "4 bedroom homes over 2000 sqft in Irvine", expected: { city: "Irvine", minBeds: 4, minSqft: 2000 } },
    { query: "townhomes in Riverside", expected: { city: "Riverside", type: "Townhouse" } },
    { query: "CONDOS IN IRVINE", expected: { city: "Irvine", type: "Condominium" } },
    { query: "land in Temecula under $500k", expected: { city: "Temecula", maxPrice: 500000, type: "UnimprovedLand" } },
    { query: "3 bedroom home in Irvine with no pool", expected: { city: "Irvine", minBeds: 3, pool: "False" } },
    { query: "condos in Los Angeles, CA under $1m", expected: { city: "Los Angeles", maxPrice: 1000000, type: "Condominium" } },
    { query: "island cottage in Avalon below $2m", expected: { city: "Avalon", type: null, maxPrice: 2000000 } },
    { query: "", expected: { city: null, maxPrice: null, minBeds: null, type: null, pool: null } },
  ];
  let passed = 0;
  for (const { query, expected } of TEST_QUERIES) {
    const result = parsePropertyQuery(query);
    const fields = Object.keys(expected) as (keyof PropertyFilters)[];
    const ok = fields.every((f) => result[f] === expected[f]);
    console.log(`${ok ? "PASS" : "FAIL"}  "${query}"`);
    if (ok) passed++;
  }
  console.log(`\n${passed}/${TEST_QUERIES.length} tests passed`);
}

