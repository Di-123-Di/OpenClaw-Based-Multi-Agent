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
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { onWhatsAppMessage } from "./messageHandler.ts";
import { exportSessions, importSessions } from "../property-search/session.ts";

// property-search's session.ts keeps conversation state (like the last
// search results "show me more like this" refers to) in an in-memory Map.
// That works for demo.ts/simulatedChannel.ts, which run as one long-lived
// process for the whole conversation, but OpenClaw spawns a brand-new
// process for every single real WhatsApp message -- so the Map reset on
// every message, and "show me more like this" always found an empty
// session even right after a search. Persisting it to a small JSON file
// between invocations is the minimal fix that doesn't change how the
// already-tested in-memory callers behave.
const SESSION_STORE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "session-store.json",
);

try {
  importSessions(JSON.parse(readFileSync(SESSION_STORE_PATH, "utf-8")));
} catch {
  // No store yet (first message ever) -- start with empty sessions.
}

const [, , message, userId] = process.argv;

if (!message || !userId) {
  console.error("Usage: node pluginEntry.ts <message> <userId>");
  process.exit(1);
}

const reply = await onWhatsAppMessage(message, userId);
console.log(JSON.stringify({ reply }));

writeFileSync(SESSION_STORE_PATH, JSON.stringify(exportSessions()));

// property-search's db.ts opens a pooled MySQL connection that otherwise
// keeps this one-shot process alive indefinitely once a query has actually
// run on it (a fresh, never-queried pool doesn't open a live socket, which
// is why intent paths that skip the DB exit fine on their own) -- confirmed
// by tracing a hung real invocation: orchestrate() had already returned the
// correct result, but the process never returned to the shell. Exiting
// explicitly after the one line of output is flushed is safe and simplest,
// versus threading a pool.end() through every agent that might touch it.
process.exit(0);
