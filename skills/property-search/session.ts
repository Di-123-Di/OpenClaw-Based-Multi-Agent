// skills/property-search/session.ts
// Week 4 — per-user conversation state, so the agent remembers preferences across turns.
import type { PropertyFilters } from "./parse.ts";

export interface UserSession {
  filters: PropertyFilters; // accumulated search criteria
  step: number;             // how many turns so far
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
    sessions.set(userId, { filters: emptyFilters(), step: 0 });
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
