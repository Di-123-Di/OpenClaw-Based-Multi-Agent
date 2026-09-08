// skills/property-search/session.ts
// Week 4 — per-user conversation state, so the agent remembers preferences across turns.
import type { PropertyFilters } from "./parse.ts";
import type { ListingRow } from "./search.ts";
import type { EmailDraft } from "../email/emailTool.ts";

export interface UserSession {
  filters: PropertyFilters;        // accumulated search criteria
  step: number;                    // how many turns so far
  lastResults: ListingRow[] | null; // most recent search results (Week 9: orchestrator's recommend intent reads this)
  pendingEmailDraft: EmailDraft | null; // Week 11: awaiting an "approve" reply before it can be sent
}

// In-memory store: one session per userId.
const sessions = new Map<string, UserSession>();

function emptyFilters(): PropertyFilters {
  return {
    city: null, maxPrice: null, minBeds: null, minBaths: null,
    minSqft: null, type: null, pool: null, hasView: null,
  };
}

export function getSession(userId: string): UserSession {
  if (!sessions.has(userId)) {
    sessions.set(userId, { filters: emptyFilters(), step: 0, lastResults: null, pendingEmailDraft: null });
  }
  return sessions.get(userId)!;
}

// Merge newly-parsed filters into the session. Only overwrite fields the user
// actually mentioned this turn (non-null), so earlier answers are remembered.
export function mergeFilters(userId: string, incoming: PropertyFilters): UserSession {
  const session = getSession(userId);
  for (const key of Object.keys(incoming) as (keyof PropertyFilters)[]) {
    if (incoming[key] !== null) {
      (session.filters[key] as any) = incoming[key];
    }
  }
  session.step += 1;
  return session;
}

export function clearSession(userId: string): void {
  sessions.delete(userId);
}

// The in-memory Map above only survives within a single process's lifetime.
// That's fine for demo.ts/simulatedChannel.ts (one long-running process for
// the whole conversation), but the real OpenClaw plugin (pluginEntry.ts)
// spawns a brand-new process per incoming WhatsApp message, so the Map
// resets on every single message -- "show me more like this" always saw an
// empty session because the search that set lastResults ran in a different,
// already-exited process. These two functions let pluginEntry.ts persist
// the Map to a file between invocations without changing how every other
// caller (which never touches these) uses sessions.
export function exportSessions(): Record<string, UserSession> {
  return Object.fromEntries(sessions);
}

export function importSessions(data: Record<string, UserSession>): void {
  for (const [userId, session] of Object.entries(data)) {
    sessions.set(userId, session);
  }
}
