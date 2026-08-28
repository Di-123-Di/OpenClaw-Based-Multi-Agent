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

## Honest scope note -- what's real vs. simulated
There is no live WhatsApp Business API account connected in this
environment. Linking a real WhatsApp number requires phone verification and
scanning a QR code with `openclaw channels login --channel whatsapp` (Week
0's setup step) against an actual phone -- not something a sandboxed coding
session can do. So:

- **Real and tested**: `onWhatsAppMessage()`, `formatForWhatsApp()`, and the
  full round trip through the Week 9 orchestrator into real MySQL data and
  real OpenAI calls. Every reply shown in this skill's demo is genuine
  output, not mocked.
- **Stubbed**: `sendTypingIndicator()` and the transport itself (there is no
  code here that speaks the WhatsApp wire protocol or calls Meta's API --
  that lives inside OpenClaw's channel layer, which this project treats as
  the platform underneath it, the same way Weeks 1-9 never called a real
  `openclaw` binary either).
- **`simulatedChannel.ts`** stands in for the missing real connection: it's
  an interactive terminal loop that calls `onWhatsAppMessage()` exactly the
  way a real incoming-webhook handler would, so the actual conversational
  logic is exercised end to end by a human typing, not just by a script.

## Files
    messageHandler.ts   -> onWhatsAppMessage(message, userId),
                           formatForWhatsApp(response), sendTypingIndicator()
    simulatedChannel.ts -> interactive REPL standing in for a real WhatsApp
                           connection
    demo.ts             -> scripted 3-turn conversation covering search,
                           market, and recommend

## How to run
    node skills/whatsapp/demo.ts             # scripted, non-interactive
    node skills/whatsapp/simulatedChannel.ts # type messages yourself

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

## Verified example (real data, not illustrative)
A 3-message scripted conversation (`demo.ts`) produced: 10 real Pasadena
listings under $1.5M with photo counts, a live Pasadena market snapshot
(498 sold homes, 54.8% price increase since Dec 2025), and 5 real
comp-validated recommendations based on the first listing from that search
-- the same session-memory hand-off Week 9's orchestrator already proved,
now reachable through the WhatsApp-shaped entry point.
