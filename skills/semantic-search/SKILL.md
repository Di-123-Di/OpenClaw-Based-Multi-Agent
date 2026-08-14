---
name: semantic-search
description: Find active listings that match a free-text vibe or description ("charming craftsman with mountain views and character") using OpenAI embeddings and cosine similarity, even without exact keyword overlap.
---

# Semantic Property Search — Embedding-Based Similarity

## Purpose
Go beyond the structured keyword filters in `property-search` (Week 2/3). A
query like "charming craftsman with mountain views and character" should
match relevant listings even when none of those exact words appear in the
listing. This skill embeds `rets_property.L_Remarks` (full-text listing
descriptions) plus key structured fields with an OpenAI embedding model, then
ranks listings by cosine similarity to the embedded query.

## When to use
Use this skill for vibe-based, descriptive, or "find me something like X"
queries. Use `property-search` instead when the user gives concrete filters
(city, exact price ceiling, bed/bath count) — that path is deterministic and
auditable; this one is fuzzy by design.

## Files
    embed.py        -> get_embedding(text), get_embeddings_batch(texts),
                        build_listing_text(row)
    build_index.py   -> pulls a sample of active listings from rets_property,
                        embeds them, and caches the index to index_cache.json
    search.py        -> find_similar_listings(query, top_k): embeds the query
                        and returns the top_k most similar cached listings

## How to run
    python3 skills/semantic-search/build_index.py 500
    python3 skills/semantic-search/search.py "modern minimalist condo close to the beach"

`build_index.py` must be run at least once before `search.py` will work — it
writes `index_cache.json` alongside these files.

`search.py` doubles as both the importable `find_similar_listings()` function
and a minimal one-query self-test when run directly (`python3 search.py
"<query>"`), the same dual role every core file in this project has since
Week 2's `parse.ts`.

## Why only a sample, not all ~53K active listings
Embedding every active listing would mean tens of thousands of paid OpenAI
calls for a demo that only needs to prove the retrieval works. `build_index.py`
instead pulls a random sample (default 500, only listings with `L_Remarks`
longer than 30 characters) and batches them into groups of 100 listings per
API call, so the whole index builds in well under a minute. The `search.py`
side is unaffected by sample size — real production use would swap the same
cache format for a proper vector database and embed the full table once,
with incremental re-embedding on `ModificationTimestamp` changes.

## Embedding model & similarity
- Model: `text-embedding-3-small` (OpenAI) — matches the Week 6 handbook spec.
- Each listing's embedding input combines type, city, beds/baths, sqft, year
  built, price, and remarks (`build_listing_text`) — the same shape the
  handbook's `build_listing_embedding` uses, so price and physical facts
  contribute to similarity alongside the free-text description.
- Similarity: cosine similarity (`sklearn.metrics.pairwise.cosine_similarity`)
  between the query embedding and every cached listing embedding, ranked
  descending, top-K returned.

## Design notes
- `index_cache.json` is a local, gitignored artifact (it contains real MLS
  listing data pulled from the database, which the project keeps out of
  version control) — regenerate it by re-running `build_index.py`, don't
  expect it to be present after a fresh clone.
- `get_embeddings_batch` embeds many listings in one OpenAI request instead
  of one request per listing — the same total token cost, far fewer round
  trips, which is what keeps `build_index.py` fast.
- This skill is read-only with respect to `rets_property` — it queries the
  same active-listing table `property-search` does, and complements rather
  than replaces the structured filter path (see `property-search/SKILL.md`
  "Design notes & extensibility").

## Verified results (not hypothetical)
Three semantically distinct queries against the same 500-listing index
returned three non-overlapping, on-theme result sets: a mountain/craftsman
query surfaced homes described as "Custom-built Craftsman retreat with ...
canyon views" and "Mountain-View Custom Home"; a beach-condo query surfaced
oceanfront condos in Redondo Beach, Venice, and Pacifica; a family-home query
surfaced larger homes with pools, cul-de-sacs, and multigenerational layouts.
None of these were hand-picked — they came back from real OpenAI API calls
against the live `idx_exchange` database.
