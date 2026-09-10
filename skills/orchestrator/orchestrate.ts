// skills/orchestrator/orchestrate.ts
// Week 9 -- the single OpenClaw entry point. Classifies each incoming
// query's intent, then routes it to one specialized agent, or fans out to
// several in parallel and merges their replies for a mixed-intent query.
import { fileURLToPath } from "node:url";
import { classifyIntent } from "./classifyIntent.ts";
import { getSession } from "../property-search/session.ts";
import {
  propertySearchAgent, marketStatsAgent, recommendationAgent, ragAgent,
  emailDraftAgent, emailApproveAgent, semanticSearchAgent,
} from "./agents.ts";

function formatCombinedResponse(searchReply: string, marketReply: string): string {
  return `${searchReply}\n\n---\n\n${marketReply}`;
}

// Week 4's conversation agent asks a follow-up question ("What is your
// budget?") whenever city, budget, or type is still missing. The user's
// answer to that question -- "under 2 million" -- carries no property
// vocabulary at all, so classifyIntent correctly finds no domain signal and
// returns "unknown". Without this check the default branch below replies
// "I'm not sure how to help with that", drops the answer, and leaves the
// session untouched -- so the next turn asks for the budget all over again.
// Same reasoning APPROVE_RE documents for "approve": a reply to a prompt the
// agent just showed the user is not a new request to route by domain
// keywords. conversation.ts's own three checks define what "still waiting"
// means, so this mirrors them rather than inventing a second rule.
function isAwaitingFollowUp(userId: string): boolean {
  const session = getSession(userId);
  if (session.step === 0) return false; // no search turn yet -- nothing was asked
  const f = session.filters;
  return !f.city || !f.maxPrice || !f.type;
}

export async function orchestrate(query: string, userId: string): Promise<string> {
  const intent = classifyIntent(query);

  // A reply to the follow-up question conversation.ts just asked belongs to
  // the search conversation already in progress, whatever its wording.
  if (intent === "unknown" && isAwaitingFollowUp(userId)) {
    return propertySearchAgent(query, userId);
  }

  switch (intent) {
    case "search":
      return propertySearchAgent(query, userId);

    case "market":
      return marketStatsAgent(query);

    case "recommend":
      return recommendationAgent(userId);

    case "knowledge":
      return ragAgent(query);

    case "email":
      return emailDraftAgent(query, userId);

    case "approve":
      return emailApproveAgent(userId);

    case "vibe":
      return semanticSearchAgent(query, userId);

    case "mixed": {
      const [searchReply, marketReply] = await Promise.all([
        propertySearchAgent(query, userId),
        marketStatsAgent(query),
      ]);
      return formatCombinedResponse(searchReply, marketReply);
    }

    default:
      return "I'm not sure how to help with that. Try asking about properties, market trends, or real estate terms.";
  }
}

// --- Demo: runs ONLY when this file is executed directly ---
const runDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (runDirectly) {
  const userId = "orchestrator-demo-user";
  const query = process.argv[2] ||
    "Find me single family homes under $900k in Pasadena and tell me whether prices are rising.";
  console.log(`Query: "${query}"`);
  console.log(`Intent: ${classifyIntent(query)}\n`);
  console.log(await orchestrate(query, userId));
  process.exit(0);
}
