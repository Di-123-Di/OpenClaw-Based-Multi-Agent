// skills/orchestrator/test.ts
// Week 9 -- (1) a unit-test suite for classifyIntent, matching parse.ts's
// PASS/FAIL style, and (2) a live end-to-end run of orchestrate() across
// every routing path, including the handbook's mixed-intent example.
//
// Usage: node skills/orchestrator/test.ts
import { classifyIntent, type Intent } from "./classifyIntent.ts";
import { orchestrate } from "./orchestrate.ts";
import { clearSession } from "../property-search/session.ts";

// --- Part 1: classifyIntent unit tests ---
type Case = { query: string; expected: Intent };
const CASES: Case[] = [
  { query: "3 bedroom homes in Irvine under 2m", expected: "search" },
  { query: "3 bedroom condos in Newport Beach with a pool", expected: "search" },
  { query: "Is now a good time to buy in San Diego?", expected: "market" },
  { query: "What is the average price per sq ft in Pasadena?", expected: "market" },
  { query: "What does DOM mean?", expected: "knowledge" },
  { query: "What columns are in california_sold?", expected: "knowledge" },
  { query: "What is a list-to-close ratio?", expected: "knowledge" },
  { query: "Find me something similar to that one", expected: "recommend" },
  { query: "Show me more like this", expected: "recommend" },
  { query: "Find me affordable homes in Pasadena and tell me whether prices are rising.", expected: "mixed" },
  { query: "3 bedroom homes in Irvine under 2m and is the market rising?", expected: "mixed" },
  { query: "asdlkjasldkj random gibberish", expected: "unknown" },
];

let passed = 0;
console.log("=== classifyIntent unit tests ===");
for (const { query, expected } of CASES) {
  const actual = classifyIntent(query);
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  "${query}" -> ${actual} (expected ${expected})`);
  if (ok) passed++;
}
console.log(`\n${passed}/${CASES.length} classifyIntent tests passed`);

// --- Part 2: orchestrate() end to end, across all five agents ---
console.log("\n=== orchestrate() end-to-end ===");

async function run(label: string, userId: string, query: string): Promise<void> {
  console.log(`\n--- ${label} ---`);
  console.log(`Q: ${query}`);
  console.log(await orchestrate(query, userId));
}

clearSession("test-search");
await run("search -> propertySearchAgent", "test-search", "3 bedroom condos in Irvine under 2m");

clearSession("test-market");
await run("market -> marketStatsAgent", "test-market", "Is now a good time to buy in San Diego?");

clearSession("test-knowledge");
await run("knowledge -> ragAgent", "test-knowledge", "What is a list-to-close ratio?");

// recommend needs a prior search in the same session so session.lastResults is populated.
clearSession("test-recommend");
await orchestrate("condos in Irvine under 2m", "test-recommend");
await run("recommend -> recommendationAgent (after a prior search)", "test-recommend", "Show me more like this");

clearSession("test-recommend-empty");
await run("recommend -> recommendationAgent (no prior search)", "test-recommend-empty", "Show me more like this");

// The handbook's literal example: no parseable budget/type, so
// propertySearchAgent correctly asks a follow-up rather than search.
clearSession("test-mixed-handbook");
await run(
  "mixed -> propertySearchAgent + marketStatsAgent (handbook's exact example)",
  "test-mixed-handbook",
  "Find me affordable homes in Pasadena and tell me whether prices are rising."
);

// Same mixed intent, but with a parseable budget + type, showing the full
// happy path (real listings, not just a follow-up question).
clearSession("test-mixed-full");
await run(
  "mixed -> propertySearchAgent + marketStatsAgent (full happy path)",
  "test-mixed-full",
  "Find me single family homes under $900k in Pasadena and tell me whether prices are rising."
);

clearSession("test-unknown");
await run("unknown -> fallback message", "test-unknown", "asdlkjasldkj random gibberish");

process.exit(0);
