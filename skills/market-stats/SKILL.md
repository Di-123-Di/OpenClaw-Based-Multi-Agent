---
name: market-stats
description: Answer market questions ("average price per sqft in Pasadena", "is now a good time to buy in San Diego?") with data-backed summaries from california_sold sold comps.
---

# Market Stats — Sold-Comps Analytics Agent

## Purpose
Turn a market question into a data-backed summary sourced from the 439K-record
`california_sold` sold-transactions table (a ~87K-row local subset spanning
Dec 2025 - Jun 2026 in this environment), cross-checked against current active
inventory in `rets_property`. This is the market-analytics skill referenced in
the project README's skill table.

## When to use
Use this skill whenever a user asks about pricing, market pace, or trends for a
California city, rather than asking to see individual listings (that is the
`property-search` skill).

## Files
    stats.ts   -> query layer: getCityMarketSummary, getMonthlyTrend, getTopMarkets
    agent.ts   -> answerMarketQuestion(query): free text -> data-backed summary
    trend.py   -> pandas/sqlalchemy trend analysis (get_price_trend, get_city_market_summary)

## Core metrics (per city, over a trailing N-month window)
- Sold count, average close price, **median close price**
- Average price per square foot
- Average days on market
- List-to-close ratio (`AVG(ClosePrice / ListPrice) * 100`) — how close final
  sale price tracks the original asking price; a proxy for negotiation leverage
- Active listing count from `rets_property` (current inventory)
- Month-by-month sold count, average price, and month-over-month % price change

## How to run
    node skills/market-stats/stats.ts "San Diego"
    node skills/market-stats/agent.ts
    python3 skills/market-stats/trend.py "Pasadena" 24

`stats.ts` prints a 12-month city summary, a 24-month trend, and a top-10 market
leaderboard. `agent.ts` runs a handful of sample market questions through
`answerMarketQuestion`. `trend.py` mirrors the same trend/summary math in
pandas, for ad hoc exploration outside the OpenClaw runtime.

## Median, without a built-in MEDIAN()
MySQL 8 has no `MEDIAN()` aggregate. The median close price is computed by
ranking sold prices with `ROW_NUMBER() OVER (ORDER BY ClosePrice)` alongside
`COUNT(*) OVER ()`, then averaging the middle row (odd count) or middle two
rows (even count) — the standard window-function median pattern.

## Natural-language city extraction (agent.ts)
`extractCity()` looks for "in / for / about / near <City>" and title-cases the
result, reusing the normalization approach from the Week 2 parser. A small
stoplist (`the`, `market`, `area`, ...) prevents filler words from being
mistaken for a city name (e.g. "tell me about the market" asks a follow-up
instead of querying `City = 'The'`). Unknown or unmatched cities get an
explicit "no data" response rather than a misleading zero-filled summary.

## Design notes
- Trend descriptions report what the data shows (e.g. "prices have risen ~8%
  since December") rather than a buy/sell recommendation — the agent presents
  data, it does not give investment advice.
- All city names are bound through `?` / named placeholders (parameterized
  queries); month windows are clamped to `[1, 120]` before being interpolated
  into `INTERVAL ... MONTH`, the same pattern `search.ts` uses for `LIMIT`.
- Every query is scoped to `PropertyType = 'Residential'` and a bounded trailing
  window, matching the Week 5 handbook spec; leaderboard and per-row results are
  capped (`LIMIT ? <= 50`), consistent with the project-wide no-bulk-export rule.

## Data caveat (local environment)
The local `idx_exchange` import is a subset (~87K of the full ~439K
`california_sold` rows) concentrated in Dec 2025 - Jun 2026, plus a handful of
clearly bad outlier rows (e.g. `CloseDate` values in 2028/2030/2072) that a
12-month window naturally excludes. Month-over-month trends are meaningful in
this environment; true year-over-year comparisons will need the full dataset.
