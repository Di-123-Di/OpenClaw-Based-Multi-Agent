---
name: whatsapp
description: The WhatsApp-facing message handler that wires the Week 9 orchestrator to a conversational channel -- property search, market questions, and recommendations, all through one onWhatsAppMessage() entry point.
---

# WhatsApp Communication Layer

## Purpose
Wire the Week 9 orchestrator to WhatsApp as the primary conversational
interface: `WhatsApp -> OpenClaw Channel -> orchestrate() -> [agents] ->
rets_property / california_sold -> formatForWhatsApp() -> WhatsApp`. This is
the Week 10 skill from the handbook.

## Status -- real, live-connected WhatsApp (not simulated)
This originally shipped with `simulatedChannel.ts` standing in for a real
connection ("not something a sandboxed coding session can do"). That's no
longer true: this project is wired to a real WhatsApp number through a real
OpenClaw plugin, `openclaw-plugin/`, installed at
`~/.openclaw/extensions/idx-exchange-orchestrator/`.

- **Real and tested**: `onWhatsAppMessage()`, `formatForWhatsApp()`, the full
  round trip through the orchestrator into real MySQL data and real OpenAI
  calls, *and* the live transport itself -- real inbound WhatsApp messages
  are intercepted by `openclaw-plugin/index.js`'s `before_dispatch` hook
  before OpenClaw's own default agent ever sees them, and routed into this
  project's code via `pluginEntry.ts`.
- **`sendTypingIndicator()`** is still a no-op stub -- OpenClaw's plugin API
  for this project's channel didn't need it to get a working end-to-end
  connection, so it wasn't built past the placeholder.
- **`simulatedChannel.ts` and `demo.ts`** are kept as they were: a fast,
  no-real-WhatsApp-account-needed way to exercise the exact same
  `onWhatsAppMessage()` logic the real plugin calls, useful for iterating on
  agent logic without needing the phone in hand.

## Files
    messageHandler.ts        -> onWhatsAppMessage(message, userId),
                                formatForWhatsApp(response), sendTypingIndicator()
    simulatedChannel.ts      -> interactive REPL, no real WhatsApp needed
    demo.ts                  -> scripted 3-turn conversation covering search,
                                market, and recommend
    pluginEntry.ts           -> subprocess entry point the real plugin spawns
                                per message; also persists session state to
                                session-store.json between invocations (see
                                Design notes)
    openclaw-plugin/index.js -> the real OpenClaw plugin: registers a
                                before_dispatch hook via api.on(...) that
                                claims WhatsApp messages before OpenClaw's
                                own default agent runs

## How to run
    node skills/whatsapp/demo.ts             # scripted, non-interactive
    node skills/whatsapp/simulatedChannel.ts # type messages yourself, no real WhatsApp needed

Installing/reinstalling the real plugin into a running OpenClaw gateway:

    openclaw plugins install skills/whatsapp/openclaw-plugin --force
    openclaw config set 'plugins.entries.idx-exchange-orchestrator.config.projectRoot' "$(pwd)"
    openclaw gateway restart

`projectRoot` is a required plugin config value (see `openclaw.plugin.json`'s
`configSchema`), not a hardcoded path -- the plugin runs from
`~/.openclaw/extensions/`, outside this repo, so it can't locate the project
on its own. Set once per machine; see README.md's "Real WhatsApp connection"
step for the full setup.

## Deviation from the handbook's `formatForWhatsApp` shape
The handbook's `formatForWhatsApp` takes a structured `AgentResult` (a raw
`.listings` array it formats into cards, or a plain `.response` string
fallback). This implementation's `orchestrate()` instead returns an
already-formatted string, because every agent has produced clean,
conversational text as its return contract since Week 3 -- `conversation.ts`
builds the 🏠-card lines, `market-stats/agent.ts` builds the snapshot text,
`recommend.py` results get card-formatted in `orchestrator/agents.ts`.
Re-introducing a second, parallel "raw data" contract solely for this one
channel would mean formatting the same data two different ways in two
different places instead of one. `formatForWhatsApp()` here does what's
actually channel-specific: cap message length and guarantee a non-empty
reply -- not re-implement card formatting that already exists and is already
tested.

## Design notes
- **`projectRoot` comes from plugin config, not a hardcoded path.** Earlier
  versions of `index.js` had this project's absolute path written directly
  into the source, which only ever worked on the one machine it was written
  on -- cloning the repo anywhere else would make the plugin fail on the
  first real WhatsApp message with an opaque "file not found." It now reads
  `api.pluginConfig.projectRoot`, declared in `openclaw.plugin.json`'s
  `configSchema` and set per-machine in `~/.openclaw/openclaw.json` -- not
  in this project's own `.env`, which the plugin has no way to locate
  without already knowing this same path. `register()` checks for it and
  logs a clear error (declining to register the hook) if it's missing,
  rather than failing confusingly later.
- **`sendTypingIndicator` is a documented stub, not a fake success.** It
  no-ops rather than pretending to call a WhatsApp API that isn't connected
  -- the alternative (silently "succeeding" at something that never
  happened) would be misleading about what's actually been built.
- **Message length cap (3500 chars).** WhatsApp technically allows much
  longer messages, but a giant single bubble is bad chat UX -- same
  no-bulk-dump reasoning behind every skill's `LIMIT 50` rows rule.
- **Errors never reach the user as a stack trace.** `onWhatsAppMessage`'s
  try/catch (matching the handbook exactly) logs the real error server-side
  and replies with a plain "Sorry, I hit an issue" -- a WhatsApp user should
  never see raw exception text.
- **Two non-interoperating hook APIs exist in OpenClaw.**
  `api.registerHook(name, handler, opts)` writes into a legacy
  `registry.hooks` array (an old event-emitter path) that the live dispatch
  pipeline never actually reads for `before_dispatch` -- it never throws and
  even shows up in `openclaw plugins inspect --runtime`'s output, which is
  what made this so hard to catch. The dispatch pipeline only reads
  `registry.typedHooks`, populated exclusively by `api.on(name, handler)`.
  Found by reading OpenClaw's installed source directly
  (`registry-B8eQDFB4.js`), not its docs or `.d.ts` files, both of which
  describe `registerHook` and made it look like the modern, correct call.
- **Each real WhatsApp message is a brand-new OS process**, since the
  plugin spawns `pluginEntry.ts` fresh per message rather than keeping one
  long-lived process. Two consequences: (1) `property-search/db.ts`'s MySQL
  pool keeps a process alive indefinitely once a query has run on it, so
  `pluginEntry.ts` calls `process.exit(0)` right after printing its reply
  instead of waiting for a natural exit; (2) the in-memory session `Map`
  resets every message, so `pluginEntry.ts` also persists it to
  `session-store.json` between invocations -- otherwise "show me more like
  this" would never see the search that just happened one message ago.
  `demo.ts`/`simulatedChannel.ts` don't need this, since they run as one
  long-lived process for a whole conversation.

## Verified example (real data, not illustrative)
A 3-message scripted conversation (`demo.ts`) produced: 10 real Pasadena
listings under $1.5M with photo counts, a live Pasadena market snapshot
(498 sold homes, 54.8% price increase since Dec 2025), and 5 real
comp-validated recommendations based on the first listing from that search
-- the same session-memory hand-off Week 9's orchestrator already proved,
now reachable through the WhatsApp-shaped entry point.

On the real, live-connected WhatsApp number: "3 bedroom condos in Irvine
under 2m" -> "Is now a good time to buy in Irvine?" -> "Show me more like
this" -> "What does DOM mean?" -> "What's the weather today?" produced five
correct, agent-appropriate replies in one real conversation -- including the
recommend intent correctly recalling the listing from the first message
across three separate real OS processes, and the last message getting the
graceful unknown-intent fallback instead of a guess.
