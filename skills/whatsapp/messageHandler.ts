// skills/whatsapp/messageHandler.ts
// Week 10 -- the WhatsApp-facing adapter over the Week 9 orchestrator.
// Architecture: WhatsApp -> OpenClaw Channel -> orchestrate() -> [agents] ->
// rets_property / california_sold -> formatForWhatsApp() -> WhatsApp.
import { orchestrate } from "../orchestrator/orchestrate.ts";

const MAX_MESSAGE_LENGTH = 3500; // WhatsApp allows far longer messages, but a
// single wall-of-text bubble is poor chat UX; cap and point the user at a
// narrower question instead, the same "no bulk dump" spirit as every other
// skill's LIMIT-50-rows rule.

// Stub: a real deployment would call the OpenClaw WhatsApp channel's typing
// indicator here (e.g. `openclaw.channels.whatsapp.sendTyping(userId)`). No
// live WhatsApp/OpenClaw channel is connected in this environment -- see
// SKILL.md for what is and isn't actually wired to a real WhatsApp account.
async function sendTypingIndicator(_userId: string): Promise<void> {
  // no-op placeholder
}

// orchestrate() already returns clean, chat-ready plain text (property
// cards, market snapshots, grounded answers) -- every agent's formatting was
// built with a conversational channel in mind from Week 3 onward. This
// function's job is WhatsApp-specific safety, not re-formatting from scratch:
// cap message length, and never return an empty bubble.
export function formatForWhatsApp(response: string): string {
  const text = (response ?? "").trim();
  if (!text) return "No results found.";
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return `${text.slice(0, MAX_MESSAGE_LENGTH)}\n\n... (truncated -- ask a more specific question for fewer results)`;
}

export async function onWhatsAppMessage(message: string, userId: string): Promise<string> {
  await sendTypingIndicator(userId);
  try {
    const result = await orchestrate(message, userId);
    return formatForWhatsApp(result);
  } catch (err) {
    console.error("Orchestration error:", err);
    return "Sorry, I hit an issue. Please try again.";
  }
}
