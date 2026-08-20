// skills/orchestrator/orchestrate.ts
// Week 9 -- the single OpenClaw entry point. Classifies each incoming
// query's intent, then routes it to one specialized agent, or fans out to
// several in parallel and merges their replies for a mixed-intent query.
import { fileURLToPath } from "node:url";
import { classifyIntent } from "./classifyIntent.ts";
import {
  propertySearchAgent, marketStatsAgent, recommendationAgent, ragAgent,
} from "./agents.ts";

function formatCombinedResponse(searchReply: string, marketReply: string): string {
  return `${searchReply}\n\n---\n\n${marketReply}`;
}

export async function orchestrate(query: string, userId: string): Promise<string> {
  const intent = classifyIntent(query);

  switch (intent) {
    case "search":
      return propertySearchAgent(query, userId);

    case "market":
      return marketStatsAgent(query);

    case "recommend":
      return recommendationAgent(userId);

    case "knowledge":
      return ragAgent(query);

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
