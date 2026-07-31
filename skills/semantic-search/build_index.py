# skills/semantic-search/build_index.py
# Week 6 -- build a local embedding index over a sample of active listings.
#
# Full corpus (~53K active listings with remarks) is not embedded here: it is
# unnecessary for a demo and would mean tens of thousands of paid API calls.
# A random sample is embedded instead, batched to keep API round trips low.
#
# Usage:
#   python3 skills/semantic-search/build_index.py 500

import json
import os
import sys

import mysql.connector
from dotenv import load_dotenv

from embed import build_listing_text, get_embeddings_batch

load_dotenv()

CACHE_PATH = os.path.join(os.path.dirname(__file__), "index_cache.json")
BATCH_SIZE = 100  # listings embedded per OpenAI request


def fetch_sample_listings(limit: int) -> list[dict]:
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
        WHERE L_Status = 'Active' AND CHAR_LENGTH(L_Remarks) > 30
        ORDER BY RAND()
        LIMIT %s
        """,
        (limit,),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows


def build_index(limit: int = 500) -> None:
    print(f"Fetching {limit} active listings with remarks...")
    rows = fetch_sample_listings(limit)
    print(f"Got {len(rows)} listings. Embedding in batches of {BATCH_SIZE}...")

    indexed = []
    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start : start + BATCH_SIZE]
        texts = [build_listing_text(r) for r in batch]
        embeddings = get_embeddings_batch(texts)
        for row, embedding in zip(batch, embeddings):
            indexed.append(
                {
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
                    "embedding": embedding,
                }
            )
        print(f"  embedded {min(start + BATCH_SIZE, len(rows))}/{len(rows)}")

    with open(CACHE_PATH, "w") as f:
        json.dump(indexed, f)
    print(f"Saved index for {len(indexed)} listings to {CACHE_PATH}")


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    build_index(n)
