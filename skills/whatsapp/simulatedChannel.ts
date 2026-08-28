// skills/whatsapp/simulatedChannel.ts
// Week 10 -- an interactive stand-in for a real WhatsApp connection. There is
// no live WhatsApp Business API / OpenClaw channel account linked in this
// environment (that requires phone verification and QR-code linking, which
// isn't possible in a sandboxed setup) -- this lets a person type messages
// and see onWhatsAppMessage()'s real replies, the same loop a real WhatsApp
// webhook would drive.
//
// Usage: node skills/whatsapp/simulatedChannel.ts
import readline from "node:readline";
import { onWhatsAppMessage } from "./messageHandler.ts";

const WHATSAPP_CONTACT = "+1-555-0100"; // stand-in for a real WhatsApp userId

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "You: " });

console.log("Simulated WhatsApp -- type a message and press Enter (Ctrl+C to quit).\n");
rl.prompt();

// A conversation is sequential: each reply can depend on state the previous
// message set (e.g. "show me more like this" needs the prior search's
// results). With piped/multi-line input, readline can emit several "line"
// events back-to-back in the same tick -- reacting to each with its own
// independent async call would run them concurrently and race, so incoming
// messages are queued and drained one at a time instead.
const queue: string[] = [];
let draining = false;
let closed = false;

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  while (queue.length > 0) {
    const message = queue.shift()!;
    const reply = await onWhatsAppMessage(message, WHATSAPP_CONTACT);
    console.log(`\nAssistant: ${reply}\n`);
  }
  draining = false;
  if (closed) {
    console.log("(session ended)");
    process.exit(0);
  } else {
    rl.prompt();
  }
}

rl.on("line", (message) => {
  queue.push(message);
  void drainQueue();
});

rl.on("close", () => {
  closed = true;
  if (!draining && queue.length === 0) {
    console.log("(session ended)");
    process.exit(0);
  }
  // otherwise drainQueue's own tail (above) exits once the queue empties
});
