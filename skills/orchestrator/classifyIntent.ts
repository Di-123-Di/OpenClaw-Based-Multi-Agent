// skills/orchestrator/classifyIntent.ts
// Week 9 -- rule-based intent classifier, in the same spirit as Week 2's
// parsePropertyQuery: deterministic, fast, dependency-free, and testable,
// rather than an LLM call on every routing decision. Covers the handbook's
// sample queries and clear variants; genuinely ambiguous phrasing is a
// known limitation (see SKILL.md) with an LLM-based classifier as the
// natural upgrade path -- same tradeoff parse.ts documents for its own
// rule-based extraction.
export type Intent = "search" | "market" | "recommend" | "knowledge" | "mixed" | "unknown";

// Definitional phrasing ("what does X mean", "what is a X") takes priority
// over domain-word matches below, so "What is a list-to-close ratio?" is
// classified as a knowledge question even though "list-to-close" is also a
// market-domain term.
const KNOWLEDGE_RE = /\b(what does\s+.+\s+(mean|stand for)|what columns|what fields|meaning of|glossary|stands for)\b|(^|\s)define\s|what is (a|an) [\w\s-]{2,40}\??$/i;

const RECOMMEND_RE = /\b(similar|comparable|recommend(ed)?|more like (this|that|it)|like (the )?(last|previous|that) one)\b/i;

// "sqft" alone is ambiguous (a search filter's threshold vs. a market
// metric's unit), so it only counts as a search signal when it follows a
// number ("2000 sqft") -- "price per sq ft" has no leading number and
// correctly falls through to MARKET_RE instead.
const SEARCH_RE = /\b(\d+\s*(bed|bath)s?|bedrooms?|bathrooms?|condo(minium)?s?|townhomes?|townhouses?|single family|\d[\d,]*\s*(sqft|sq\s?ft|square feet)|homes?|houses?|listings?|properties|pool)\b/i;

const MARKET_RE = /\b(market|trend|rising|falling|appreciat|depreciat|good time to (buy|sell)|average price|price per (sq ?ft|square foot)|days on market|list-to-close|sale-to-list)\b/i;

export function classifyIntent(query: string): Intent {
  const isKnowledge = KNOWLEDGE_RE.test(query);
  const isRecommend = RECOMMEND_RE.test(query);
  const isSearch = SEARCH_RE.test(query);
  const isMarket = MARKET_RE.test(query);

  if (isKnowledge) return "knowledge"; // definitional phrasing wins outright
  if (isRecommend) return "recommend";
  if (isSearch && isMarket) return "mixed";
  if (isSearch) return "search";
  if (isMarket) return "market";
  return "unknown";
}
