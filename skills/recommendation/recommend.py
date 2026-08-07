# skills/recommendation/recommend.py
# Week 7 -- given a listing a user likes, surface the top-K most similar
# active listings (hybrid structured + semantic score), each with a
# comp-validated price assessment from california_sold.
#
# Usage:
#   python3 skills/recommendation/recommend.py <L_ListingID>

import json
import os
import sys

import mysql.connector
from dotenv import load_dotenv

from comps import validate_with_comps
from embed import build_listing_text, get_embedding
from score import calculate_similarity_score

load_dotenv()

# Candidates are drawn from the same 500-listing embedding index Week 6 built,
# so recommending doesn't re-embed the whole active-listing table.
CANDIDATE_INDEX_PATH = os.path.join(
    os.path.dirname(__file__), "..", "semantic-search", "index_cache.json"
)


def _load_candidate_index() -> list[dict]:
    if not os.path.exists(CANDIDATE_INDEX_PATH):
        raise FileNotFoundError(
            f"No candidate index at {CANDIDATE_INDEX_PATH}. Build it first: "
            "python3 skills/semantic-search/build_index.py 500"
        )
    with open(CANDIDATE_INDEX_PATH) as f:
        return json.load(f)


def _fetch_target_row(listing_id: str) -> dict:
    conn = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE"),
    )
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT L_ListingID, L_Address, L_City, L_Type_, L_Keyword2, LM_Dec_3,
               LM_Int2_3, YearBuilt, L_SystemPrice, L_Remarks
        FROM rets_property
        WHERE L_ListingID = %s AND L_Status = 'Active'
        """,
        (listing_id,),
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if row is None:
        raise ValueError(f"No active listing found with ID {listing_id}")
    return row


def _to_comparable(row: dict) -> dict:
    """Map raw rets_property columns to the friendly field names score.py and
    the candidate index cache both use."""
    return {
        "listing_id": row["L_ListingID"],
        "address": row["L_Address"],
        "city": row["L_City"],
        "type": row["L_Type_"],
        "beds": row["L_Keyword2"],
        "baths": float(row["LM_Dec_3"]) if row["LM_Dec_3"] is not None else None,
        "sqft": row["LM_Int2_3"],
        "year_built": row["YearBuilt"],
        "price": row["L_SystemPrice"],
        "remarks": row["L_Remarks"],
    }


def recommend_similar_listings(listing_id: str, top_k: int = 5) -> list[dict]:
    """The target listing is fetched live and embedded on demand, so it can be
    any current active listing -- not only one already in the candidate index.
    Candidates are the other listings in that cached index."""
    target_row = _fetch_target_row(listing_id)
    target = _to_comparable(target_row)
    target_emb = get_embedding(build_listing_text(target_row))

    candidates = [c for c in _load_candidate_index() if c["listing_id"] != listing_id]

    scored = [
        (candidate, calculate_similarity_score(target, candidate, target_emb, candidate["embedding"]))
        for candidate in candidates
    ]
    scored.sort(key=lambda pair: pair[1], reverse=True)

    results = []
    for candidate, score in scored[:top_k]:
        comp = validate_with_comps(candidate["city"], candidate["sqft"], candidate["price"])
        result = {k: v for k, v in candidate.items() if k != "embedding"}
        result["similarity_score"] = score
        result["comp_validation"] = comp
        results.append(result)
    return results


if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_id = sys.argv[1]
    else:
        # Demo default: pick a real listing already in the candidate index, so
        # the self-test works without a listing ID on hand.
        target_id = _load_candidate_index()[0]["listing_id"]

    target_row = _fetch_target_row(target_id)
    print(f"Because you liked: {target_row['L_Address']}, {target_row['L_City']} "
          f"-- ${target_row['L_SystemPrice']:,}\n")

    for i, rec in enumerate(recommend_similar_listings(target_id, top_k=5), start=1):
        comp = rec["comp_validation"]
        if comp["delta_pct"] is None:
            comp_line = f"no recent comps in {rec['city']} to validate against"
        else:
            direction = "above" if comp["delta_pct"] > 0 else "below"
            comp_line = (
                f"listed ${rec['price']:,}, comps suggest ~${comp['comp_price']:,} "
                f"({abs(comp['delta_pct'])}% {direction} comps, {comp['comp_count']} comps)"
            )
        beds = rec["beds"] if rec["beds"] is not None else "?"
        baths = rec["baths"] if rec["baths"] is not None else "?"
        sqft = rec["sqft"] if rec["sqft"] is not None else "?"
        print(f"{i}. {rec['address']}, {rec['city']} -- ${rec['price']:,} "
              f"(score {rec['similarity_score']}/100)")
        print(f"   {beds}bd/{baths}ba, {sqft} sqft, {rec['type']}")
        print(f"   {comp_line}")
        print()
