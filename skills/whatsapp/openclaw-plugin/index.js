// skills/whatsapp/openclaw-plugin/index.js
// Week 10 -- the real OpenClaw plugin that wires this project's orchestrator
// into a live WhatsApp connection. Registers a "before_dispatch" hook (see
// PluginHookBeforeDispatchEvent / ...Context / ...Result in OpenClaw's own
// installed type definitions -- dist/hook-types-*.d.ts). Returning
// { handled: true, text } from this hook fully replaces OpenClaw's default
// LLM-agent reply for that message.
//
// api.on(...) vs api.registerHook(...): OpenClaw actually exposes two
// separate, non-interoperating hook systems (confirmed by reading
// dist/registry-B8eQDFB4.js directly, not the docs or the .d.ts files --
// both of which describe registerHook and made it look like the right,
// modern call). registerHook() writes into a legacy `registry.hooks` array
// driven by an old event-emitter path. The live message-dispatch pipeline's
// before_dispatch check (dist/dispatch-DnzGTpPs.js) only ever reads
// `registry.typedHooks`, which is populated exclusively by api.on(...) (see
// registerTypedHook in registry-B8eQDFB4.js). registerHook() never throws
// and even shows up in `openclaw plugins inspect --runtime`'s "Custom
// hooks" list, which is what made this so hard to find -- the handler was
// simply never wired into anything the real dispatcher consults.
//
// Plain JavaScript, not TypeScript: `openclaw plugins install` requires
// compiled JS output (./index.js/.mjs/.cjs) for installed packages -- it
// does not run .ts entry points through Node's native type stripping the
// way this project's own scripts do. This file has no TS-only syntax to
// strip, so it's written directly as JS rather than adding a build step.
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { spawn } from "node:child_process";

// This plugin is installed by OpenClaw into ~/.openclaw/extensions, outside
// this project, so it cannot use a relative import back to messageHandler.ts
// -- it reaches this project's logic over an absolute path instead, the same
// "spawn + parse one JSON line" pattern orchestrator/pythonBridge.ts uses.
const PROJECT_ROOT = "/Users/di/OpenClaw-Based Multi-Agent";
const ENTRY_SCRIPT = `${PROJECT_ROOT}/skills/whatsapp/pluginEntry.ts`;
const TIMEOUT_MS = 30_000;

function callProjectOrchestrator(message, userId) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [ENTRY_SCRIPT, message, userId], {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "pipe"], // no stdin -- see pythonBridge.ts's note on why
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`orchestrator entry timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    proc.on("error", (err) => { clearTimeout(timer); reject(err); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`orchestrator entry exited ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()).reply);
      } catch {
        reject(new Error(`orchestrator entry did not return valid JSON.\nstdout: ${stdout}\nstderr: ${stderr}`));
      }
    });
  });
}

export default definePluginEntry({
  id: "idx-exchange-orchestrator",
  name: "IDX Exchange Orchestrator Bridge",
  description:
    "Routes incoming WhatsApp messages to the IDX Exchange multi-agent orchestrator (property search, market stats, recommendations, RAG knowledge).",
  register(api) {
    api.on("before_dispatch", async (event, ctx) => {
      // Only take over WhatsApp; every other channel keeps OpenClaw's normal
      // built-in agent. Checking both event.channel and ctx.channelId
      // defensively since which one is populated can vary by channel.
      const channel = (event.channel ?? ctx.channelId ?? "").toLowerCase();
      if (!channel.includes("whatsapp")) return;

      const userId = event.senderId ?? ctx.senderId ?? "unknown";

      try {
        const reply = await callProjectOrchestrator(event.content, userId);
        return { handled: true, text: reply };
      } catch (err) {
        api.logger.error(`[idx-exchange] orchestrator call failed: ${err.message}`);
        return { handled: true, text: "Sorry, I hit an issue. Please try again." };
      }
    });
  },
});
