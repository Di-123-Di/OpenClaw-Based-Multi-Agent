---
name: email
description: Draft-then-approve email workflow for listing alerts, weekly market reports, property summaries, and recommendation digests -- nothing sends without an explicit human approval step.
---

# Email Agent — Draft, Never Send Without Approval

## Purpose
Add outbound email to the assistant's capabilities -- listing alerts, market
reports, property summaries, recommendation digests -- with a hard guardrail
the handbook calls out as non-negotiable: no email leaves this system
without an explicit human approval step in between. This is the Week 11
skill, sitting on top of `property-search`, `market-stats`, and
`recommendation` for its data, and completing the `emailDraftAgent` stub
Week 9's Agent Registry already reserved a slot for.

## Files
    emailTool.ts       -> EmailDraft type, draftEmail(), approveDraft(),
                           sendApprovedEmail() -- the three-step gate itself
    templates.ts        -> buildListingAlertEmail(), buildMarketReportEmail(),
                           buildPropertySummaryEmail(),
                           buildRecommendationDigestEmail() -- one per
                           handbook use case, each ending at draftEmail()
    guardrails.test.ts  -> the safety guardrail test suite the handbook's
                           Deliverable names explicitly

## How to run
    node skills/email/guardrails.test.ts

Requires `nodemailer` (`npm install nodemailer`, already added to
`package.json`) and real `EMAIL_USER`/`EMAIL_PASSWORD` values in `.env` for
an actual send to succeed -- `sendApprovedEmail` will reach a real Gmail
SMTP call once a draft is approved, so guardrails.test.ts swaps
`transporter.sendMail` for a spy before any assertion runs. It never sends a
real email, no matter what the suite checks.

## The three-step gate
1. **`draftEmail(to, subject, body)`** -- pure data assembly. Returns
   `{ draft: { ..., status: "pending_approval" }, status: "pending_approval" }`.
   Cannot send; never touches the transporter.
2. **`approveDraft(draft)`** -- a human (or the chat flow standing in for
   one, via the orchestrator's "approve" intent) explicitly signs off on the
   *exact* content that was previewed. Returns a new object with
   `status: "approved"` rather than mutating in place.
3. **`sendApprovedEmail(draft)`** -- checks `draft.status === "approved"`
   itself and throws otherwise. This is the one piece that goes beyond the
   handbook's literal snippet: the handbook's version trusts the caller to
   only invoke it after approval; this version refuses structurally, so
   "never send without approval" can't be violated by a caller that simply
   forgot to check.

## Wired into the orchestrator (beyond the handbook's minimum)
`classifyIntent.ts` gained two intents: `"email"` (keyword `email`) and
`"approve"` (`approve`, `confirm`, `yes send it`, `send it`, `go ahead`).
`orchestrator/agents.ts`'s `emailDraftAgent` picks a template from the
query's wording and the session's last search results, drafts it, and
stores it in `session.pendingEmailDraft` -- `emailApproveAgent` is the
*only* function in this project that calls `sendApprovedEmail`, and it
refuses if there's no pending draft. This means a real chat conversation
(WhatsApp or otherwise) can go: "email me a market report for Irvine" ->
preview shown -> "approve" -> sent -- with the same session-memory pattern
Week 9's `lastResults` already established for the recommend intent.

## Design notes
- **Recipient defaults to the operator's own inbox (`EMAIL_USER`).** This
  project has no concept of "the user's email address" anywhere else (chat
  happens over WhatsApp, by phone number) -- defaulting to send-to-self is
  the same reasoning Week 10's `selfChatMode` used for testing WhatsApp
  without a second real account.
- **Row limits are inherited, not re-implemented.** `buildListingAlertEmail`
  calls `property-search/search.ts`'s new `getNewListings`, which caps at 50
  rows the same way `searchActiveListings` and `getSoldComps` already do --
  the "never bulk-export the full MLS dataset" rule is enforced once, at the
  query layer, not re-checked in every caller.
- **"New listing alert" filters by an explicit `sinceDate`, not "now."** A
  real alert job tracks "since the last time this saved search was
  checked," and this project's `rets_property` snapshot's most recent
  `ListingContractDate` is behind today's real calendar date anyway --
  `DATE_SUB(CURDATE(), INTERVAL n DAY)` would silently return zero rows.
- **`transporter` is exported from `emailTool.ts`, not kept private.** The
  only way to prove "draftEmail never sends" and "sendApprovedEmail sends
  exactly once, only after approval" without hitting real Gmail SMTP during
  automated testing is to give the test suite something to swap out.

## Verified example (real data, not illustrative)
`buildMarketReportEmail("test@example.com", "Irvine")` produced a real HTML
report: 991 sold homes, $1,520,000 median close price, 98.1% list-to-close
ratio, pulled live from `california_sold` via the same `stats.ts` functions
`market-stats/agent.ts` uses for its chat replies. `buildPropertySummaryEmail`
and `buildRecommendationDigestEmail` were verified against a real Irvine
condo, producing a genuine comp check ("48% below recent comps, based on 172
comparable sales") and five real similar-listing recommendations. All 9
guardrail tests pass.
