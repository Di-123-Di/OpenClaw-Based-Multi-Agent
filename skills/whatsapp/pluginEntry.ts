// skills/whatsapp/pluginEntry.ts
// Week 10 -- entry point invoked as a subprocess by the real OpenClaw plugin
// at skills/whatsapp/openclaw-plugin/index.ts. Reads a message and userId
// from argv, calls onWhatsAppMessage(), and prints the reply as one JSON
// line to stdout. This is the same "spawn, parse one JSON line" bridge
// pattern orchestrator/pythonBridge.ts uses to reach the Python skills --
// applied here so a plugin running inside OpenClaw's own process (installed
// to ~/.openclaw/extensions, outside this project) can still reach this
// project's logic, by absolute path, without relative imports across
// process boundaries.
import { onWhatsAppMessage } from "./messageHandler.ts";

const [, , message, userId] = process.argv;

if (!message || !userId) {
  console.error("Usage: node pluginEntry.ts <message> <userId>");
  process.exit(1);
}

const reply = await onWhatsAppMessage(message, userId);
console.log(JSON.stringify({ reply }));

// property-search's db.ts opens a pooled MySQL connection that otherwise
// keeps this one-shot process alive indefinitely once a query has actually
// run on it (a fresh, never-queried pool doesn't open a live socket, which
// is why intent paths that skip the DB exit fine on their own) -- confirmed
// by tracing a hung real invocation: orchestrate() had already returned the
// correct result, but the process never returned to the shell. Exiting
// explicitly after the one line of output is flushed is safe and simplest,
// versus threading a pool.end() through every agent that might touch it.
process.exit(0);
