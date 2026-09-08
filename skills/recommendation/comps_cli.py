# skills/recommendation/comps_cli.py
# Week 11 -- thin JSON-in/JSON-out adapter so the TypeScript email skill can
# validate a single listing's price against sold comps, the same way
# agent_cli.py already bridges recommend.py. comps.py itself stays untouched.
#
# Usage: python3 comps_cli.py <city> <sqft> <price> [months]
# Prints one line of JSON: {"ok": true, "comps": {...}}
#                       or {"ok": false, "error": "..."}

import json
import sys

from comps import validate_with_comps

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"ok": False, "error": "city, sqft, and price arguments are required"}))
        sys.exit(1)

    city = sys.argv[1]
    sqft = int(sys.argv[2])
    price = int(sys.argv[3])
    months = int(sys.argv[4]) if len(sys.argv) > 4 else 6

    try:
        comps = validate_with_comps(city, sqft, price, months=months)
        print(json.dumps({"ok": True, "comps": comps}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
