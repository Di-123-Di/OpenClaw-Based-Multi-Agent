// skills/market-stats/agent.ts
// Week 5 — the market-stats OpenClaw skill: turns a free-text market question
// into a data-backed summary sourced from california_sold + rets_property.
import { fileURLToPath } from "node:url";
import { getCityMarketSummary, getMonthlyTrend } from "./stats.ts";

// Filler words that can follow "in / for / about" without naming a real city
// ("tell me about the market" should ask a follow-up, not query City = "The").
const NON_CITY_WORDS = new Set(["the", "this", "that", "here", "there", "it", "market", "area", "region"]);

function extractCity(query: string): string | null {
  const match = query.match(/(?:in|for|about|near)\s+([A-Za-z\s]+?)(?:[?.!,]|\s+(?:right now|over|for|market)|$)/i);
  const raw = match?.[1];
  if (!raw) return null;
  const cleaned = raw.replace(/,?\s*(ca|california)\s*$/i, "").trim().replace(/\s+/g, " ");
  if (!cleaned || NON_CITY_WORDS.has(cleaned.toLowerCase())) return null;
  return cleaned.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// Describes the trailing 12-month price movement without making a timing
// recommendation — the agent reports what the data shows, not investment advice.
function describeTrend(trend: Awaited<ReturnType<typeof getMonthlyTrend>>): string {
  const withPrice = trend.filter((t) => t.avgPrice !== null);
  if (withPrice.length < 2) return "not enough monthly history yet to describe a trend";
  const first = withPrice[0].avgPrice!;
  const last = withPrice[withPrice.length - 1].avgPrice!;
  const changePct = Math.round(((last - first) / first) * 1000) / 10;
  if (changePct > 1) return `average prices have risen about ${changePct}% since ${withPrice[0].month}`;
  if (changePct < -1) return `average prices have fallen about ${Math.abs(changePct)}% since ${withPrice[0].month}`;
  return `average prices have stayed roughly flat since ${withPrice[0].month}`;
}

export async function answerMarketQuestion(query: string): Promise<string> {
  const city = extractCity(query);
  if (!city) {
    return "Which city would you like market stats for? For example: \"average price per sqft in Pasadena\".";
  }

  const summary = await getCityMarketSummary(city, 12);
  if (summary.soldCount === 0) {
    return `I don't have recorded sales for ${city} in the last 12 months — try a nearby city or a wider date range.`;
  }

  const trend = await getMonthlyTrend(city, 12);

  return [
    `Market snapshot for ${city} (last ${summary.months} months, ${summary.soldCount} sold homes):`,
    `- Median close price: $${summary.medianClosePrice?.toLocaleString() ?? "n/a"} ` +
      `(avg $${summary.avgClosePrice?.toLocaleString() ?? "n/a"}, ~$${summary.avgPricePerSqft ?? "n/a"}/sqft)`,
    `- Average days on market: ${summary.avgDaysOnMarket ?? "n/a"}`,
    `- List-to-close ratio: ${summary.listToClosePct ?? "n/a"}% (how close final sale price tracks asking price)`,
    `- Currently ${summary.activeListingCount} active listings for sale`,
    `- Trend: ${describeTrend(trend)}`,
  ].join("\n");
}

// --- Demo: runs ONLY when this file is executed directly ---
const runDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (runDirectly) {
  const questions = [
    "Is now a good time to buy in San Diego?",
    "What is the average price per sq ft in Pasadena?",
    "How's the market in Irvine right now?",
    "What about Atlantis?",
    "Tell me about the market",
  ];
  for (const q of questions) {
    console.log(`Q: ${q}`);
    console.log(await answerMarketQuestion(q));
    console.log();
  }
  process.exit(0);
}
