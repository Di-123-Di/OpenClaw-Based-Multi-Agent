# skills/semantic-search/agent_cli.py
# Wires Week 6's semantic search into the orchestrator (not part of the
# original handbook weeks -- added after noticing vibe-style queries had no
# path through classifyIntent at all). Thin JSON-in/JSON-out adapter so the
# TypeScript orchestrator can call this Python skill as a subprocess,
# call this Python skill as a subprocess, matching the same pattern
# recommendation/agent_cli.py and rag/agent_cli.py already use. search.py's
# own __main__ block (human-readable output for its self-test) stays
# untouched -- this is a separate entry point, not a replacement.
#
# Usage: python3 agent_cli.py "<free-text description>" [top_k]
# Prints one line of JSON: {"ok": true, "listings": [...]}
#                       or {"ok": false, "error": "..."}

import json
import sys

from search import find_similar_listings

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "query argument is required"}))
        sys.exit(1)

    query = sys.argv[1]
    top_k = int(sys.argv[2]) if len(sys.argv) > 2 else 5

    try:
        listings = find_similar_listings(query, top_k=top_k)
        print(json.dumps({"ok": True, "listings": listings}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
