// skills/orchestrator/demo.ts
// Week 9 demo -- a short, narrated walkthrough for a live presentation.
// Separate from test.ts, which is an exhaustive proof suite (12 unit tests
// + 8 full scenarios); this file shows only the parts that make the
// orchestration story clear in a couple of minutes: the intent classifier
// deciding in real time, then the flagship mixed-intent example, then one
// more routing path that shows off the TypeScript-to-Python bridge.
//
// Usage: node skills/orchestrator/demo.ts
import { classifyIntent } from "./classifyIntent.ts";
import { orchestrate } from "./orchestrate.ts";
import { clearSession } from "../property-search/session.ts";

function printHeader(title: string): void {
  console.log(`\n${"=".repeat(70)}\n${title}\n${"=".repeat(70)}`);
}

printHeader("Week 9 -- Multi-Agent Orchestrator");
console.log("One entry point. Five specialized agents behind it.");

printHeader("1. The intent classifier deciding, live");
const sampleQueries = [
  "3 bedroom condos in Irvine under 2m",
  "Is now a good time to buy in San Diego?",
  "What is a list-to-close ratio?",
  "Show me more like this",
];
for (const q of sampleQueries) {
  console.log(`"${q}"  ->  ${classifyIntent(q)}`);
}

printHeader("2. The flagship case -- one query, two agents, one answer");
clearSession("demo-mixed");
const mixedQuery = "Find me single family homes under $900k in Pasadena and tell me whether prices are rising.";
console.log(`Q: ${mixedQuery}`);
console.log(`Intent: ${classifyIntent(mixedQuery)} (propertySearchAgent + marketStatsAgent, run in parallel)\n`);
console.log(await orchestrate(mixedQuery, "demo-mixed"));

printHeader("3. Recommendation -- crossing from TypeScript into Python");
clearSession("demo-recommend");
await orchestrate("condos in Irvine under 2m", "demo-recommend"); // populates session.lastResults
const recommendQuery = "Show me more like this";
console.log(`Q: ${recommendQuery}`);
console.log(`Intent: ${classifyIntent(recommendQuery)} (recommendationAgent -> Python subprocess -> back to TS)\n`);
console.log(await orchestrate(recommendQuery, "demo-recommend"));

process.exit(0);
