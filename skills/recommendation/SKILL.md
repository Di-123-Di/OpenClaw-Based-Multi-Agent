---
name: recommendation
description: Given a listing a user likes, surface the top 5 comparable active listings using a hybrid structured + semantic similarity score, each with a comp-validated price check from california_sold.
---

# Recommendation Engine — Hybrid Similarity + Comp Validation

## Purpose
Given a listing ID a user likes, answer "what else should they look at?" with
a ranked list of comparable active listings, plus a check on whether each
recommendation's price is actually supported by recent nearby sales. This is
the Week 7 skill from the handbook, sitting on top of `property-search`
(structured filters), `market-stats` (comps), and `semantic-search`
(embeddings).

## When to use
Use this after a user has expressed interest in a specific listing (via
`property-search` results, or directly by listing ID) and wants similar
options — as opposed to a fresh search with new filters.

## Files
    score.py      -> calculate_similarity_score(target, candidate, target_emb,
                      candidate_emb): the 0-100 hybrid score
    comps.py       -> validate_with_comps(city, sqft, price, months=6): checks
                      a price against recent california_sold comps
    embed.py       -> get_embedding(text), build_listing_text(row) -- embeds
                      the target listing on demand
    recommend.py   -> recommend_similar_listings(listing_id, top_k=5): the
                      full pipeline; also runnable as a single-target CLI
                      self-test

## How to run
    python3 skills/recommendation/recommend.py <L_ListingID>
    python3 skills/recommendation/recommend.py    # self-test default: picks
                                                    # a real listing from the
                                                    # cached candidate index

Requires `skills/semantic-search/index_cache.json` to already exist (run
`python3 skills/semantic-search/build_index.py 500` first if it doesn't).

## The hybrid score (0-100)
Structured fields contribute up to 60 points, matching the handbook exactly:
- Price gap: < $50K -> 20, < $150K -> 12, < $300K -> 5, else 0
- Same bed count -> 15
- Same city -> 15
- Sqft gap: < 300 -> 10, < 700 -> 5, else 0

Embedding cosine similarity (over `L_Remarks` + key structured fields, same
text shape as `semantic-search`) contributes the remaining 40 points:
`score += cosine_similarity(target_emb, candidate_emb) * 40`.

## Comp validation
For each of the top 5 recommended listings, `validate_with_comps` looks at
Residential comps in the *same city*, with living area within +/-20% of the
recommendation's sqft, sold in the trailing 6 months, and compares the
recommendation's list price to `avg($/sqft of comps) * sqft`. `delta_pct` is
positive when the listing is priced above what comps support, negative when
below. Cities with no matching comps return `delta_pct: None` rather than a
divide-by-zero — the handbook's original SQL doesn't guard this case, but
several less-common cities in the sampled data genuinely have zero
6-month Residential comps in that sqft band, so the guard is necessary, not
theoretical.

## Design notes
- **Target is fetched live, candidates come from the Week 6 cache.** The
  listing a user "liked" is queried fresh from `rets_property` and embedded
  on the spot (one API call), so it can be *any* current active listing —
  not only one of the 500 already in `semantic-search`'s cache. Candidates
  are still limited to that cached 500, for the same cost/latency reasons
  documented in `semantic-search/SKILL.md`.
- **`embed.py` here duplicates two small functions from
  `semantic-search/embed.py`** rather than importing across skill folders.
  Each skill stays a self-contained, independently runnable unit — consistent
  with how OpenClaw skills are meant to be modular capability units, not
  modules that reach into each other's internals. The duplicated surface is
  intentionally tiny (embed one string, build one text blob).
- **Missing MLS fields don't crash scoring.** Some active listings have a
  null `sqft`, `beds`, or `price` (seen in real data, e.g. an under-specified
  mobile-home lot listing). `calculate_similarity_score` skips a comparison
  when either side is missing that field, rather than raising — a `None`
  field means "unknown," not "identical" or "maximally different."

## Verified example (real data, not illustrative)
Recommending against a $485,000 Apple Valley listing returned a same-city
listing 1.3% off in price and within 39 sqft as the #1 result (score
90.92/100), with progressively lower scores for listings in neighboring
cities — and each recommendation came with a real comp check (e.g. "listed
$478,800, comps suggest ~$539,645, 11.3% below comps, 138 comps").
