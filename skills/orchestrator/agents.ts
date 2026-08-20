// skills/orchestrator/agents.ts
// Week 9 -- the Agent Registry: one thin wrapper per specialized skill,
// giving every agent the same shape so orchestrate.ts can call any of them
// without caring whether the underlying skill is TypeScript or Python.
import { handleMessage } from "../property-search/conversation.ts";
import { getSession } from "../property-search/session.ts";
import { answerMarketQuestion } from "../market-stats/agent.ts";
import { callPythonAgent } from "./pythonBridge.ts";

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

// ragAgent -- answers conceptual and definitional questions, grounded in
// indexed source documents rather than the model's own memory.
export async function ragAgent(query: string): Promise<string> {
  const result = await callPythonAgent("skills/rag/agent_cli.py", [query]);
  if (!result.ok) {
    return `I couldn't look that up right now (${result.error}).`;
  }
  return `${result.answer}\n\n(sources: ${result.sources.join(", ")})`;
}

// emailDraftAgent -- composes formatted property or market summaries.
// Week 11 builds the real draft-then-approve workflow; this stub only
// exists so the Agent Registry is complete and callable end to end. It is
// intentionally not wired into classifyIntent()/orchestrate()'s routing
// yet -- the handbook's own orchestrate() switch statement doesn't route
// to it either, matching this same "registered, not yet reachable" state.
export async function emailDraftAgent(_content: string): Promise<string> {
  return "Email drafting isn't available yet -- that's a Week 11 feature (draft-then-approve workflow with human sign-off before anything sends).";
}
