// skills/property-search/conversation.ts
// Week 4 — turn a single-shot search into a multi-turn conversation.
import { parsePropertyQuery } from "./parse.ts";
import { searchActiveListings } from "./search.ts";
import { mergeFilters } from "./session.ts";

// Handle ONE user message. Returns what the agent should say back.
export async function handleMessage(userId: string, text: string): Promise<string> {
  // 1) Parse this message and merge it into the user's remembered preferences.
  const incoming = parsePropertyQuery(text);
  const session = mergeFilters(userId, incoming);
  const f = session.filters;

  // 2) If a key detail is still missing, ask a follow-up question.
  if (!f.city)     return "Which city are you looking in?";
  if (!f.maxPrice) return "What is your budget?";
  if (!f.type)     return "Any preference — condo, townhome, or single family?";

  // 3) Enough info — search and return formatted results.
  const listings = await searchActiveListings(f);
  if (listings.length === 0) {
    return `No active listings match your criteria in ${f.city}. Try a higher budget or a different city.`;
  }
  const cards = listings.map((r) =>
    `🏠 ${r.L_Address}, ${r.L_City} — $${r.price?.toLocaleString()} | ` +
    `${r.beds}bd/${r.baths}ba | ${r.PhotoCount} photos`
  ).join("\n");
  return `Here are ${listings.length} homes in ${f.city}:\n${cards}`;
}
