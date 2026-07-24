// skills/market-stats/demo.ts
// Week 5 demo — scripted walkthrough of the market-stats skill for live demos.
// Usage: node skills/market-stats/demo.ts [city]
import { getCityMarketSummary, getMonthlyTrend, getTopMarkets } from "./stats.ts";
import { answerMarketQuestion } from "./agent.ts";

const city = process.argv[2] || "Irvine";

console.log(`\n=== 1. City market summary — ${city} ===`);
const summary = await getCityMarketSummary(city, 12);
console.log(`Sold last 12 months:  ${summary.soldCount}`);
console.log(`Median close price:   $${summary.medianClosePrice?.toLocaleString() ?? "n/a"}`);
console.log(`Avg close price:      $${summary.avgClosePrice?.toLocaleString() ?? "n/a"}`);
console.log(`Avg price / sqft:     $${summary.avgPricePerSqft ?? "n/a"}`);
console.log(`Avg days on market:   ${summary.avgDaysOnMarket ?? "n/a"}`);
console.log(`List-to-close ratio:  ${summary.listToClosePct ?? "n/a"}%`);
console.log(`Active listings now:  ${summary.activeListingCount}`);

console.log(`\n=== 2. Monthly price trend — ${city} ===`);
const trend = await getMonthlyTrend(city, 12);
for (const t of trend) {
  const change = t.priceChangePct !== null ? `${t.priceChangePct > 0 ? "+" : ""}${t.priceChangePct}%` : "n/a";
  console.log(`${t.month}  ${t.sales} sales  avg $${t.avgPrice?.toLocaleString() ?? "n/a"}  ${t.avgDom ?? "n/a"} DOM  (${change} MoM)`);
}

console.log(`\n=== 3. Natural-language market Q&A ===`);
const questions = [
  `Is now a good time to buy in ${city}?`,
  "What is the average price per sq ft in Pasadena?",
  "What about Atlantis?", // unknown-city edge case
];
for (const q of questions) {
  console.log(`\nUser:  ${q}`);
  console.log(`Agent: ${await answerMarketQuestion(q)}`);
}

console.log(`\n=== 4. Top California markets by sold volume (12 months) ===`);
const top = await getTopMarkets(12, 10);
top.forEach((c, i) => {
  console.log(`${i + 1}. ${c.city} — ${c.soldCount} sold, avg $${c.avgClosePrice?.toLocaleString() ?? "n/a"}`);
});

process.exit(0);
