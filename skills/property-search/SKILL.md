---
name: property-search
description: Parse a free-text real-estate query into a structured filter object for rets_property (city, price, beds, baths, sqft, type, pool, view).
---

# Property Search — Natural Language Query Parser

## Purpose
Turn a free-text real-estate request (e.g. "3-bedroom condos in Irvine under
$1.5M with a pool") into a structured filter object that maps to `rets_property`
columns. This is the natural-language front-end for the database query layer
(Week 3). It does not touch the database itself.

## When to use
Use this skill whenever a user describes the properties they are looking for in
plain language and the system needs concrete filters to search active MLS listings.

## Output schema
The parser returns an object with these fields (null = user did not specify):

    city      -> L_City         (string, Title-Cased)
    maxPrice  -> L_SystemPrice   (number, "<=")
    minBeds   -> L_Keyword2      (number, ">=")
    minBaths  -> LM_Dec_3        (number, ">=")
    minSqft   -> LM_Int2_3       (number, ">=")
    type      -> L_Type_         (string, e.g. "Condominium")
    pool      -> PoolPrivateYN   ("True" | "False" | null)
    hasView   -> ViewYN          ("True" | "False" | null)

## How to run
    node skills/property-search/parse.ts

Runs the parser against a 14-case test suite and prints PASS/FAIL per case,
then a summary line (14/14 tests passed).

## Supported patterns
- City: "in <City>" (multi-word cities and a trailing state, e.g. "in Los Angeles, CA").
- Price: "under / below / less than / up to / max <amount>", with k / m units.
- Beds / baths / sqft: "3 bed", "2.5 bath", "2000 sqft".
- Type: condo, townhome / townhouse, single family, land (word-boundary matched,
  so "island" is not treated as "land").
- Pool / view: positive and negated ("no pool" -> "False").

## Scope boundaries
The extractor targets the common, well-defined filter vocabulary. The following
inputs are intentionally out of scope and validated as such:
- Spelled-out numbers ("three bedroom", "1.5 million", "900 thousand").
- Price ranges ("between 800k and 1.2m"), which would require separate min/max fields.
- City stated without "in" ("Irvine condos").
- Fractional baths other than .5 ("2.25 baths", "2 1/2 baths").

## Design notes & extensibility
The filter extractor is intentionally rule-based: it is deterministic, fast,
dependency-free, and fully unit-tested — the right properties for a structured
search front-end, where every query must map to predictable, verifiable filters.
The output schema is engine-agnostic: the same `PropertyFilters` contract and test
suite can back an alternative LLM-based extractor to widen natural-language
coverage (synonyms, spelled-out numbers, price ranges) with no change to any
downstream code, while the existing normalization remains as a validation guardrail.
Fuzzy, semantic matching ("charming craftsman with character") is served by the
vector search layer (Week 6), which complements this structured filter path rather
than replacing it.

## Database integration (Week 3)

The parsed filter object is executed against MySQL by a small, safe query layer.

Files:

    db.ts      -> connection pool + a parameterized query() helper
    search.ts  -> searchActiveListings(filters) and getSoldComps(city, months)
    run.ts     -> full pipeline: free text -> filters -> active listing cards

Run the full pipeline:

    node skills/property-search/run.ts "3 bedroom homes in Irvine under 2m"

Query functions:
- searchActiveListings(filters, page, limit) — builds a dynamic WHERE from only the
  filters that are set, over rets_property WHERE L_Status = 'Active', ordered by
  price, paginated.
- getSoldComps(city, months) — recent Residential sold comps from california_sold
  for market and price validation (used in Weeks 5 and 7).

Safety:
- All user-supplied values are bound through ? placeholders (parameterized queries)
  to prevent SQL injection.
- LIMIT is capped at 50 rows per query (no bulk data export).
- Database credentials are read from .env, never hard-coded.


## Conversational agent (Week 4)

The single-shot search becomes a multi-turn conversation with per-user memory.

Files:

    session.ts       -> per-user state (Map by userId) + mergeFilters
    conversation.ts  -> handleMessage(userId, text): parse -> merge -> ask or search
    chat.ts          -> demo that simulates a multi-turn conversation

Run the conversation demo:

    node skills/property-search/chat.ts

How it works:
- Each user message is parsed by the Week 2 parser, then merged into the user's
  session. Only fields mentioned this turn overwrite stored ones, so earlier
  answers (like the city) are remembered across turns.
- If city, budget, or type is still missing, the agent asks a follow-up question.
- Once enough is known, it searches rets_property and returns cards with address,
  price, beds/baths, and photo count.