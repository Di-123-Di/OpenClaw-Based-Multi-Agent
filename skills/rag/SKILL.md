---
name: rag
description: Answers questions about real estate terminology, MLS field definitions, and market data by retrieving relevant chunks from indexed source documents and grounding the answer in them, rather than the model's own memory.
---

# RAG Knowledge Assistant — Retrieval-Augmented Generation

## Purpose
Answer conceptual and definitional questions ("What does DOM mean?", "What
is a list-to-close ratio?") and schema questions ("What columns are in
california_sold?") by retrieving the most relevant chunks from a small,
curated set of source documents and asking an LLM to answer using only that
retrieved context — grounded, not hallucinated. This is the Week 8 skill
from the handbook.

## When to use
Use this for "what does X mean" / "what is Y" / "what fields does table Z
have" questions, as opposed to `property-search` (find listings) or
`market-stats` (aggregate numbers over live data).

## Knowledge sources (4 documents)
The handbook's deliverable only requires 3 sources to answer its 3 sample
questions; this implementation adds a 4th for a documented reason:

1. **`knowledge/real_estate_primer.md`** — condensed from the Real Estate
   Data Analyst Primer: MLS basics, the transaction lifecycle, list vs.
   close price / sale-to-list ratio, commission structure, financing
   basics, MLS status codes, DOM/CDOM, property types.
2. **`knowledge/trestle_field_definitions.md`** — curated from the Trestle
   (RESO) Property metadata documentation: definitions for the ~40 fields
   actually used in `rets_property` / `california_sold` (ListPrice,
   ClosePrice, LivingArea, BedroomsTotal, StandardStatus, DaysOnMarket,
   CapRate, etc.). The full Trestle dictionary has hundreds of
   agent-contact and commercial-property fields irrelevant to this
   project, so only the relevant subset is indexed — not the whole PDF.
3. **`knowledge/week5_market_summary.md`** — a market report built from
   **real** output of the Week 5 `market-stats` skill (San Diego and
   Irvine 12-month summaries, monthly trend, top-markets leaderboard) —
   captured by actually running `stats.ts` while building this index, not
   fabricated placeholder numbers.
4. **`knowledge/idx_schema_reference.md`** *(added beyond the minimum)* —
   the handbook's own schema reference tables for both MySQL tables. The
   handbook flags that `rets_property`'s core search fields
   (`L_SystemPrice`, `L_Keyword2`, `LM_Dec_3`, `LM_Int2_3`, ...) use IDX's
   own legacy naming and are **not** in the Trestle/RESO documentation —
   this file is the only accurate source for those, and it also gives the
   assistant a complete, authoritative column list for `california_sold`
   rather than relying on the LLM to reconstruct one from scattered RESO
   field definitions.

## Files
    chunk.py         -> chunk_text(text, chunk_size, overlap)
    embed.py         -> get_embedding(text), get_embeddings_batch(texts)
    build_index.py   -> chunks + embeds every knowledge/*.md file, caches
                        the result to rag_index_cache.json
    rag.py           -> retrieve(query, index, top_k) and
                        rag_answer(query, index): the query-time pipeline
    demo.py          -> narrated walkthrough of the 3 required questions
                        plus one out-of-scope question

## How to run
    python3 skills/rag/build_index.py
    python3 skills/rag/rag.py "What does DOM mean?"
    python3 skills/rag/demo.py

`build_index.py` must run at least once before `rag.py` or `demo.py` will
work — it writes `rag_index_cache.json` alongside these files (gitignored,
like the other skills' embedding caches, since it's a regenerable derived
artifact).

## Chunk size — larger than the handbook's example, deliberately
The handbook's `chunk_text` defaults to `chunk_size=600, overlap=100`, tuned
for flowing prose. Two of this skill's four documents are mostly reference
tables (`idx_schema_reference.md`'s `california_sold` section alone is
~2000 characters). At 600 characters, `chunk_text` split those tables
mid-row: a first test of "What columns are in california_sold?" retrieved a
chunk that was cut off after `PropertyType`, and the model faithfully
answered from only the truncated context — 7 columns instead of 35.

The fix was to call `chunk_text(doc["content"], chunk_size=3000,
overlap=300)` in `build_index.py` so each schema table stays whole in one
chunk (10 chunks total instead of 44). `chunk_text`'s signature and logic
are unchanged from the handbook — only the parameters passed to it differ,
because a reference table is a unit of meaning that shouldn't be split
arbitrarily by character count.

## Design notes
- **The model is told to admit what it doesn't know.** `rag_answer`'s
  prompt explicitly instructs "if the context does not contain the answer,
  say so explicitly instead of guessing." Verified with "What is the
  capital of France?" — the assistant correctly responds that the context
  doesn't cover it, rather than answering from its own general knowledge.
  This is the actual point of RAG: grounding, not just cheaper search.
- **`rag_answer` returns which source documents were used**, not just the
  answer text — this is what lets a user (or this SKILL.md) verify an
  answer is actually grounded rather than taking it on faith.
- **`embed.py` duplicates the small embedding helper** from
  `semantic-search/embed.py` and `recommendation/embed.py` rather than
  importing across skill folders — same reasoning as `recommendation`'s
  SKILL.md: each skill stays self-contained.
- Chat model is `gpt-4o-mini`, per the handbook's `rag_answer` example —
  cheap and fast, appropriate for short grounded-QA responses over a small
  context window.

## Verified results (real, not illustrative)
All three required questions answer correctly and completely against the
live index: "What does DOM mean?" (correct definition), "What columns are
in california_sold?" (all 35 real columns, not a truncated subset), "What
is a list-to-close ratio?" (correct formula + a live example number from
the actual San Diego report). An out-of-scope control question ("What is
the capital of France?") correctly returns "not covered" instead of an
answer.
