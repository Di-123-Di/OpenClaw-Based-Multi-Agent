// skills/orchestrator/agents.ts
// Week 9 -- the Agent Registry: one thin wrapper per specialized skill,
// giving every agent the same shape so orchestrate.ts can call any of them
// without caring whether the underlying skill is TypeScript or Python.
import { handleMessage } from "../property-search/conversation.ts";
import { getSession } from "../property-search/session.ts";
import type { ListingRow } from "../property-search/search.ts";
import { answerMarketQuestion, extractCity } from "../market-stats/agent.ts";
import { callPythonAgent } from "./pythonBridge.ts";
import { approveDraft, sendApprovedEmail } from "../email/emailTool.ts";
import {
  buildMarketReportEmail, buildPropertySummaryEmail, buildRecommendationDigestEmail, buildListingAlertEmail,
} from "../email/templates.ts";

// propertySearchAgent -- queries rets_property with structured filters.
// Delegates to the Week 4 conversational agent (session-aware: it asks
// follow-up questions across turns and remembers earlier answers).
export async function propertySearchAgent(query: string, userId: string): Promise<string> {
  return handleMessage(userId, query);
}

// marketStatsAgent -- aggregates california_sold for trends and comps.
export async function marketStatsAgent(query: string): Promise<string> {
  return answerMarketQuestion(query);
}

// recommendationAgent -- surfaces similar listings with comp validation,
// based on the most recent listing the user's session has seen.
export async function recommendationAgent(userId: string): Promise<string> {
  const session = getSession(userId);
  const target = session.lastResults?.[0];
  if (!target) {
    return "I don't have a recent listing to compare against yet -- search for some homes first, then ask for something similar.";
  }

  const result = await callPythonAgent("skills/recommendation/agent_cli.py", [target.L_ListingID]);
  if (!result.ok) {
    return `I couldn't generate recommendations right now (${result.error}).`;
  }

  const recs = result.recommendations as any[];
  if (recs.length === 0) {
    return "I couldn't find any comparable listings for that one.";
  }
  const cards = recs.map((r) => {
    const comp = r.comp_validation;
    const compLine = comp.delta_pct === null
      ? "no recent comps to validate against"
      : `${Math.abs(comp.delta_pct)}% ${comp.delta_pct > 0 ? "above" : "below"} recent comps`;
    return `🏠 ${r.address}, ${r.city} — $${r.price.toLocaleString()} | ${r.beds}bd/${r.baths}ba | score ${r.similarity_score}/100 | ${compLine}`;
  }).join("\n");
  return `Because you liked ${target.L_Address}, ${target.L_City}, here are similar listings:\n${cards}`;
}

// semanticSearchAgent -- vibe/descriptive queries ("charming craftsman with
// character") that have no structured filter words for propertySearchAgent
// to key off of. Sets session.lastResults the same way propertySearchAgent
// does, so "show me more like this" chains into recommendationAgent
// regardless of which search path found the listing. Semantic-search's
// index cache doesn't carry pool/view/photo-count, so those three fields
// are filled with honest "unknown" defaults rather than guessed.
export async function semanticSearchAgent(query: string, userId: string): Promise<string> {
  const result = await callPythonAgent("skills/semantic-search/agent_cli.py", [query]);
  if (!result.ok) {
    return `I couldn't search by description right now (${result.error}).`;
  }

  const listings = result.listings as any[];
  if (listings.length === 0) {
    return "I couldn't find anything matching that description.";
  }

  const session = getSession(userId);
  session.lastResults = listings.map((l): ListingRow => ({
    L_ListingID: l.listing_id,
    L_Address: l.address,
    L_City: l.city,
    price: l.price,
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft,
    type: l.type,
    PoolPrivateYN: "",
    ViewYN: "",
    PhotoCount: 0,
  }));

  const cards = listings.map((l) =>
    `🏠 ${l.address}, ${l.city} — $${l.price.toLocaleString()} | ${l.beds}bd/${l.baths}ba | ${l.sqft} sqft | ${Math.round(l.similarity * 100)}% match`
  ).join("\n");
  return `Here are homes that match that description:\n${cards}`;
}

// ragAgent -- answers conceptual and definitional questions, grounded in
// indexed source documents rather than the model's own memory.
export async function ragAgent(query: string): Promise<string> {
  const result = await callPythonAgent("skills/rag/agent_cli.py", [query]);
  if (!result.ok) {
    return `I couldn't look that up right now (${result.error}).`;
  }
  return `${result.answer}\n\n(sources: ${result.sources.join(", ")})`;
}

// emailDraftAgent -- picks one of the four Week 11 email use cases from
// the query's wording and the user's session context, drafts it, and holds
// it in session.pendingEmailDraft. It never sends -- approveDraft() and
// sendApprovedEmail() only run from emailApproveAgent, after the user
// explicitly replies to the preview this function returns. `to` defaults
// to the operator's own inbox (EMAIL_USER) the same way Week 10's WhatsApp
// layer defaulted to selfChatMode for testing without a second real inbox.
export async function emailDraftAgent(query: string, userId: string): Promise<string> {
  const session = getSession(userId);
  const to = process.env.EMAIL_USER ?? "";
  if (!to) return "No email address is configured to send from (EMAIL_USER is unset).";

  try {
    let draft;
    if (/\b(similar|comparable|recommend|more like)\b/i.test(query)) {
      const target = session.lastResults?.[0];
      if (!target) return "I don't have a recent listing to build a recommendation email from -- search for some homes first.";
      draft = await buildRecommendationDigestEmail(to, target.L_ListingID, target.L_Address, target.L_City);
    } else if (/\b(summary|this (listing|home|property))\b/i.test(query)) {
      const target = session.lastResults?.[0];
      if (!target) return "I don't have a recent listing to summarize -- search for some homes first.";
      draft = await buildPropertySummaryEmail(to, target.L_ListingID);
    } else if (/\b(new listing|alert)\b/i.test(query)) {
      const result = await buildListingAlertEmail(to, session.filters, "2026-01-01");
      draft = result.draft;
    } else {
      const city = extractCity(query) ?? session.filters.city;
      if (!city) return "Which city should the market report cover?";
      draft = await buildMarketReportEmail(to, city);
    }

    session.pendingEmailDraft = draft;
    return `Draft ready:\nTo: ${draft.to}\nSubject: ${draft.subject}\n\nReply "approve" to send it.`;
  } catch (err: any) {
    return `I couldn't put that email together (${err.message}).`;
  }
}

// emailApproveAgent -- the only place in this project that can actually
// call sendApprovedEmail(). Requires a draft to already be sitting in the
// session from emailDraftAgent -- there is no path from a fresh message
// straight to a send.
export async function emailApproveAgent(userId: string): Promise<string> {
  const session = getSession(userId);
  const draft = session.pendingEmailDraft;
  if (!draft) return "I don't have a pending email draft to send.";

  try {
    await sendApprovedEmail(approveDraft(draft));
    session.pendingEmailDraft = null;
    return `Sent! "${draft.subject}" was delivered to ${draft.to}.`;
  } catch (err: any) {
    return `Sending failed (${err.message}). The draft is still pending -- try approving again.`;
  }
}
