# skills/recommendation/agent_cli.py
# Week 9 -- thin JSON-in/JSON-out adapter so the TypeScript orchestrator can
# call this Python skill as a subprocess. recommend.py's own __main__ block
# stays untouched (human-readable output for its self-test and demo.py) --
# this is a separate entry point, not a replacement for it.
#
# Usage: python3 agent_cli.py <L_ListingID> [top_k]
# Prints one line of JSON: {"ok": true, "recommendations": [...]}
#                       or {"ok": false, "error": "..."}

import json
import sys

from recommend import recommend_similar_listings

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "listing_id argument is required"}))
        sys.exit(1)

    listing_id = sys.argv[1]
    top_k = int(sys.argv[2]) if len(sys.argv) > 2 else 5

    try:
        recommendations = recommend_similar_listings(listing_id, top_k=top_k)
        print(json.dumps({"ok": True, "recommendations": recommendations}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
