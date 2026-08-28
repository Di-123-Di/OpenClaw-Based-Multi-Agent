// skills/whatsapp/demo.ts
// Week 10 demo -- a scripted WhatsApp conversation exercising the deliverable
// end to end: property search, a market question, and a recommendation,
// all through onWhatsAppMessage() exactly as a real webhook would call it.
//
// Usage: node skills/whatsapp/demo.ts
import { onWhatsAppMessage } from "./messageHandler.ts";
import { clearSession } from "../property-search/session.ts";

const userId = "+1-555-0100"; // stand-in WhatsApp contact
clearSession(userId);

const conversation = [
  "single family homes in Pasadena under 1.5m",
  "Is now a good time to buy in Pasadena?",
  "Show me more like this",
];

for (const message of conversation) {
  console.log(`\n[WhatsApp] You: ${message}`);
  const reply = await onWhatsAppMessage(message, userId);
  console.log(`[WhatsApp] Assistant:\n${reply}`);
}

process.exit(0);
