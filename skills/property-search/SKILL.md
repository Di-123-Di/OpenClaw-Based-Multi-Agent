---
name: property-search
description: Parse a free-text real-estate query into a structured filter object for rets_property (city, price, beds, baths, sqft, type, pool, view).
---

# Property Search — Natural Language Query Parser

## Purpose
Turn a free-text real-estate request (e.g. "3-bedroom condos in Irvine under
$1.5M with a pool") into a structured filter object that maps to `rets_property`
columns. This is the natural-language front-end for the database query layer
(Week 3). It does not touch the database itself.

## When to use
Use this skill whenever a user describes the properties they are looking for in
plain language and the system needs concrete filters to search active MLS listings.

## Output schema
The parser returns an object with these fields (null = user did not specify):

    city      -> L_City         (string, Title-Cased)
    maxPrice  -> L_SystemPrice   (number, "<=")
    minBeds   -> L_Keyword2      (number, ">=")
    minBaths  -> LM_Dec_3        (number, ">=")
    minSqft   -> LM_Int2_3       (number, ">=")
    type      -> L_Type_         (string, e.g. "Condominium")
    pool      -> PoolPrivateYN   ("True" | "False" | null)
    hasView   -> ViewYN          ("True" | "False" | null)

## How to run
    node skills/property-search/parse.ts

Runs the parser against a 14-case test suite and prints PASS/FAIL per case,
then a summary line (14/14 tests passed).

## Supported patterns
- City: "in <City>" (multi-word cities and a trailing state, e.g. "in Los Angeles, CA").
- Price: "under / below / less than / up to / max <amount>", with k / m units.
- Beds / baths / sqft: "3 bed", "2.5 bath", "2000 sqft".
- Type: condo, townhome / townhouse, single family, land (word-boundary matched,
  so "island" is not treated as "land").
- Pool / view: positive and negated ("no pool" -> "False").

## Known limitations (regex-based; documented, not yet handled)
- Spelled-out numbers: "three bedroom", "1.5 million", "900 thousand".
- Ranges: "between 800k and 1.2m" (would need separate min + max price fields).
- City without "in": "Irvine condos" is not detected.
- Fractional baths other than .5: "2.25 baths", "2 1/2 baths".
- "3+ beds" is read as 3 (the "+" is ignored; the field is already a minimum).

## Future work
For robust, production-grade understanding, the parsing logic should be delegated
to the LLM inside OpenClaw (a SKILL.md instruction that extracts the same fields
as JSON). An LLM naturally handles synonyms, negation, spelled-out numbers, and
ranges that regular expressions cannot. Fuzzy semantic descriptions
("charming craftsman with character") are handled separately by the vector search
built in Week 6.
