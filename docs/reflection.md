# Reflection

*Written at the end of the 11-week build. Covers what actually happened
across the project, not a generic retrospective template.*

## What worked

**Rule-based intent classification instead of an LLM call on every message.**
`classifyIntent()` is a deterministic regex classifier, not a model call —
free, instant, and fully unit-testable (16/16 cases). It's also more
robust than it sounds: when a mid-conversation follow-up answer ("under 2
million") has no property vocabulary and would otherwise misroute to the
fallback message, `orchestrate()` checks whether the session is still
waiting on a question `propertySearchAgent` just asked, and routes it back
correctly. An LLM-based classifier would have handled that case "for free,"
but at the cost of latency and money on every single message, for a
classification problem that turned out to be solvable with plain rules.

**Splitting "decide what to do" from "do the irreversible thing."** The
email skill's `draftEmail -> approveDraft -> sendApprovedEmail` isn't just
a naming convention — `sendApprovedEmail` structurally refuses to run
unless `draft.status === "approved"`. The same pattern shows up in the
orchestrator: `emailDraftAgent` can never call `sendApprovedEmail`;
`emailApproveAgent` is the only function in the whole project that can.
Separating "who decides" from "who acts" made the safety guardrail testable
(`guardrails.test.ts` mocks the transport and proves the send path is
actually gated) instead of just documented.

**Refusing to trust a signal that only looks correct.** The biggest bug in
the whole project — a WhatsApp plugin hook that compiled cleanly, matched
the official docs, and even showed as "successfully registered" in
OpenClaw's own inspection tool, but was silently never invoked — was only
found by refusing to stop at those surface-level confirmations and reading
OpenClaw's actual installed source. The same instinct caught a subtler
problem later: an AI-suggested resume bullet claimed a specific 41% latency
improvement, and a search of the entire codebase turned up no benchmarking
code that could have produced that number. Both cases were the same
lesson — "it compiles," "the docs say so," and "it sounds specific enough
to be true" are not the same as verified.

## What I'd change

**The WhatsApp plugin hardcoded this project's absolute file path.**
`pythonBridge.ts` already had the right pattern for this (derive the
project root from the running file's own location), but the WhatsApp
plugin runs from a copy OpenClaw installs outside the repo, where that
trick doesn't work — so I hardcoded the path instead of solving it properly
the first time. It worked on my machine and stayed unnoticed for weeks
until an external code review flagged it. The fix (a `configSchema` entry
read via `api.pluginConfig`) wasn't hard; I should have reached for it
immediately instead of shipping a path that only worked for me.

**Documentation drifted out of sync with the code, repeatedly.** Several
`SKILL.md` files described a file that had been deleted weeks earlier, an
agent that was still called a "stub" long after it was fully implemented,
and a "no real WhatsApp connection" caveat that was flatly untrue by the
time anyone read it again. None of this was caught until a dedicated audit
pass. Updating docs in the same commit as the code change they describe —
not as a separate cleanup pass later — would have avoided all of it.

**Semantic search won't scale past the demo.** Similarity search runs as
brute-force cosine similarity over a 500-listing JSON cache, not a real
vector database. That's an honest, deliberate tradeoff for a project this
size, and it's called out explicitly in the architecture doc rather than
oversold as a "vector store" — but a real deployment against the full
228K-listing dataset would need FAISS, pgvector, or a managed vector DB.

**No habit of measuring performance until asked to.** There's no timing
instrumentation anywhere in the project. That's fine until someone asks
"how much faster is X" — which is exactly what surfaced the fabricated
resume metric above. If performance claims matter, the measurement should
exist before the claim does, not be reconstructed (or, worse, invented)
after the fact.

**Commit granularity was inconsistent.** Most weeks got their own commit,
but Week 2's code shipped inside a commit titled "Add README," so the
history doesn't actually show when that piece landed. Small enough not to
matter for this project, but a habit worth being stricter about.
