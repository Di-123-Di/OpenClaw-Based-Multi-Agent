---
name: orchestrator
description: A single entry point that classifies each incoming query's intent and routes it to the right specialized agent (property search, market stats, recommendation, RAG knowledge, email draft/approve), or fans out to several in parallel for mixed-intent queries.
---

# Multi-Agent Orchestrator

## Purpose
Combine every agent built in Weeks 2-8 behind one function, `orchestrate(query,
userId)`, so a user (or, from Week 10 on, a WhatsApp message) never has to
know which underlying skill answers their question. This is the Week 9
skill from the handbook.

## When to use
This is the top-level entry point, not something other skills call into —
Week 10's WhatsApp layer and Week 11's email workflows both call
`orchestrate()` rather than any individual agent directly.

## Agent Registry (6 agents)
| Agent | Underlying skill | Language |
|---|---|---|
| `propertySearchAgent` | `property-search` (Week 2-4) — session-aware, asks follow-ups | TypeScript, in-process |
| `marketStatsAgent` | `market-stats` (Week 5) | TypeScript, in-process |
| `recommendationAgent` | `recommendation` (Week 7) | Python, via subprocess |
| `ragAgent` | `rag` (Week 8) | Python, via subprocess |
| `emailDraftAgent` | `email` (Week 11) — drafts one of four templates, never sends | TypeScript, in-process |
| `emailApproveAgent` | `email` (Week 11) — the only path that can call `sendApprovedEmail` | TypeScript, in-process |

## Files
    pythonBridge.ts   -> callPythonAgent(scriptPath, args): spawns a Python
                         agent_cli.py and parses its JSON stdout
    agents.ts         -> the six agent wrapper functions
    classifyIntent.ts -> classifyIntent(query): rule-based intent classifier
    orchestrate.ts     -> orchestrate(query, userId): the routing switch
    test.ts            -> classifyIntent unit tests + end-to-end orchestrate()
                         run across every agent, including mixed intent
    demo.ts            -> short narrated walkthrough for live presentations

## How to run
    node skills/orchestrator/orchestrate.ts "<query>"
    node skills/orchestrator/test.ts
    node skills/orchestrator/demo.ts

`test.ts` is the actual deliverable proof: 16 classifyIntent unit tests, plus
13 live `orchestrate()` calls covering all six routing paths (search,
market, knowledge, recommend — both with and without a prior search in the
session — mixed intent in both the handbook's literal example and a
fuller happy-path version, the unknown fallback in all three of its states
(fresh session, mid-conversation, and after a completed search), and email
drafting/approve
-- the approve path only against an empty session, since actually approving
a real pending draft would send a real email through this project's real
Gmail credentials; that send path is tested separately in
`email/guardrails.test.ts` against a mocked transporter). `demo.ts` is a
separate, shorter file for presentations — the classifier deciding on a few
sample queries, then the flagship mixed-intent case, then one more routing
path chosen to make the TypeScript-to-Python bridge visible. It does not
re-prove correctness `test.ts` already proves; it narrates a subset of it.

## Bridging TypeScript and Python
`recommendation` and `rag` are Python (they need numpy/sklearn/openai
embeddings). Rather than reimplement them in TypeScript, or have the
orchestrator import Python modules (impossible in-process), each of those
two skills got a small new file, `agent_cli.py`, that wraps its existing
public function in JSON-in/JSON-out form:

    python3 skills/rag/agent_cli.py "What does DOM mean?"
    -> {"ok": true, "answer": "...", "sources": [...]}

`recommend.py`'s and `rag.py`'s own `__main__` blocks (used by their
self-tests and `demo.py` files) are untouched — `agent_cli.py` is a separate
entry point, not a replacement. `pythonBridge.ts`'s `callPythonAgent()`
spawns the project's venv Python on that script and parses one line of JSON
back.

## classifyIntent — rule-based, not an LLM call
Same design philosophy as Week 2's `parsePropertyQuery`: deterministic,
free, and unit-testable, rather than an API call (with its cost and
latency) on every single routing decision. Definitional phrasing ("what
does X mean", "what is a X") is checked first and wins outright, so "What
is a list-to-close ratio?" routes to `knowledge` even though
"list-to-close" is also a market-domain term that would otherwise trigger
`market`. As with `parsePropertyQuery`, this targets clear phrasing; a
genuinely ambiguous query (e.g. one with no domain vocabulary at all) falls
through to `unknown`, and an LLM-based classifier — using the exact same
`Intent` return type, so nothing downstream would need to change — is the
natural upgrade path if broader phrasing coverage is ever needed.

## Two real bugs this week's integration testing found and fixed
Building the mixed-intent test case ("...in Pasadena and tell me whether
prices are rising.") surfaced two pre-existing bugs in Week 2's and Week 5's
city-extraction regexes: neither treated `"\s+and"` as a stop word, so both
captured everything up through "...and tell me whether prices are rising"
as the "city" instead of stopping at "Pasadena". Fixed in
`property-search/parse.ts`'s `cityMatch` and `market-stats/agent.ts`'s
`extractCity` by adding `and` (and a trailing period) to their stop-word
alternations — verified parse.ts's own 14/14 test suite still passes after
the change. This is the same kind of real, integration-testing-surfaced fix
as Weeks 6-8 each found in their own underlying skills.

## Design notes
- **`recommendationAgent` takes only `userId`, not a listing.** The
  handbook's own `orchestrate()` reads `session.lastResults?.[0]` — "the
  listing the user was just shown" — rather than asking the query to name
  one. That required extending `property-search`'s `UserSession` with a
  `lastResults` field, populated by `conversation.ts` after every
  successful search. If a user asks for recommendations with no prior
  search in their session, the agent says so explicitly rather than
  erroring or guessing a listing.
- **`emailDraftAgent` and `emailApproveAgent` split drafting from sending.**
  `emailDraftAgent` picks one of the email skill's four templates from the
  query's wording and the session's last search results, and stores the
  result in `session.pendingEmailDraft` — it never calls
  `sendApprovedEmail`. `emailApproveAgent` is the only function in this
  project that does, and only once `classifyIntent` sees an `"approve"`-
  shaped reply. This mirrors the same "the agent that decides what to say
  is not the same code path that's allowed to act" separation the email
  skill's `SKILL.md` documents for `draftEmail`/`sendApprovedEmail`
  themselves.
- **`formatCombinedResponse` just concatenates** the two agents' replies
  with a separator — the handbook doesn't specify its shape, and there's no
  requirement yet (WhatsApp formatting is Week 10) to do more than show
  both answers clearly.
- **The `unknown` fallback defers to a conversation already in progress.**
  Week 4's `conversation.ts` asks a follow-up question whenever city,
  budget, or type is missing, but the answer to one of those questions
  ("under 2 million") contains no property vocabulary, so `classifyIntent`
  finds no domain signal and returns `unknown` — routing it to the fallback
  message would drop the answer and leave the session unchanged, so the
  next turn asks for the budget again. `orchestrate()` therefore checks
  `isAwaitingFollowUp(userId)` before the switch and hands an `unknown`
  query back to `propertySearchAgent` when the session is mid-conversation,
  mirroring `conversation.ts`'s own three missing-field checks rather than
  inventing a second rule for what "still waiting" means. This is the same
  reasoning `APPROVE_RE` documents for `"approve"`: a reply to a prompt the
  agent just showed the user is not a new request to route by domain
  keywords. Once all three fields are filled the session is no longer
  awaiting anything, so a genuinely off-topic message still gets the
  fallback — both directions are covered in `test.ts`.

## Verified results (real, not illustrative)
`node skills/orchestrator/test.ts` passes 16/16 classifyIntent unit tests
and completes all 10 end-to-end scenarios against the live database and real
OpenAI calls: real Irvine listings for a search query, a real San Diego
market snapshot, a grounded RAG answer for "What is a list-to-close
ratio?", five real comp-validated recommendations after a prior search (and
a graceful message when there isn't one), the handbook's mixed-intent
example correctly fanning out to both `propertySearchAgent` and
`marketStatsAgent` in parallel and merging their replies, and a real market-
report email draft built from a prior search's city (plus a graceful
"nothing pending" reply when `"approve"` is sent with no draft queued).
