// skills/orchestrator/classifyIntent.ts
// Week 9 -- rule-based intent classifier, in the same spirit as Week 2's
// parsePropertyQuery: deterministic, fast, dependency-free, and testable,
// rather than an LLM call on every routing decision. Covers the handbook's
// sample queries and clear variants; genuinely ambiguous phrasing is a
// known limitation (see SKILL.md) with an LLM-based classifier as the
// natural upgrade path -- same tradeoff parse.ts documents for its own
// rule-based extraction.
export type Intent = "search" | "market" | "recommend" | "knowledge" | "email" | "approve" | "vibe" | "mixed" | "unknown";

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

// Week 11 -- "approve" must win outright, the same way KNOWLEDGE_RE does,
// since it's a one-word reply to a draft the agent just showed the user,
// not a new question to route by domain keywords.
const APPROVE_RE = /\b(approve|confirm(ed)? (it|send|that)|yes,? send( it)?|send it|go ahead(?: and send)?)\b/i;

// "email" is an unambiguous signal in this domain -- no property or market
// question would naturally contain the word -- so a plain keyword match is
// enough, same reasoning SEARCH_RE uses for its own domain words.
const EMAIL_RE = /\bemail\b/i;

// Vibe-style, descriptive queries ("a charming craftsman with character")
// have no structured filter words at all -- SEARCH_RE requires a concrete
// bed/bath/type/price term, which is exactly what these queries don't have.
// Without this, they fell through to "unknown" and got the generic fallback
// message, even though semantic-search can actually answer them. This is a
// real rule-based classifier's real limit: it can only catch descriptive
// language it has a word list for, not "any sentence with no keywords
// that also isn't gibberish" -- an LLM-based classifier (see the module
// docstring) is the honest fix for that, this is a narrower patch that
// covers the common case.
const VIBE_RE = /\b(charming|cozy|character|quaint|rustic|craftsman|storybook|unique|ambiance|vibe|feel|style|cottage|charm)\b/i;

export function classifyIntent(query: string): Intent {
  const isKnowledge = KNOWLEDGE_RE.test(query);
  const isApprove = APPROVE_RE.test(query);
  const isEmail = EMAIL_RE.test(query);
  const isRecommend = RECOMMEND_RE.test(query);
  const isSearch = SEARCH_RE.test(query);
  const isMarket = MARKET_RE.test(query);

  if (isKnowledge) return "knowledge"; // definitional phrasing wins outright
  if (isApprove) return "approve"; // a reply to an already-shown draft, not a new request
  if (isEmail) return "email";
  if (isRecommend) return "recommend";
  if (isSearch && isMarket) return "mixed";
  if (isSearch) return "search";
  if (isMarket) return "market";
  if (VIBE_RE.test(query)) return "vibe"; // checked last: only for what nothing else recognized
  return "unknown";
}
