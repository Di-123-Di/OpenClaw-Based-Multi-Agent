# skills/rag/agent_cli.py
# Week 9 -- thin JSON-in/JSON-out adapter so the TypeScript orchestrator can
# call this Python skill as a subprocess. rag.py's own __main__ block stays
# untouched (human-readable output for its self-test and demo.py) -- this is
# a separate entry point, not a replacement for it.
#
# Usage: python3 agent_cli.py "<question>"
# Prints one line of JSON: {"ok": true, "answer": "...", "sources": [...]}
#                       or {"ok": false, "error": "..."}

import json
import sys

from rag import load_index, rag_answer

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "question argument is required"}))
        sys.exit(1)

    query = sys.argv[1]

    try:
        index = load_index()
        result = rag_answer(query, index)
        print(json.dumps({"ok": True, **result}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
