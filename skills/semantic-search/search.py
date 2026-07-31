# skills/semantic-search/search.py
# Week 6 -- semantic property search: free-text description -> top-K most
# similar active listings, ranked by embedding cosine similarity.
#
# Usage:
#   python3 skills/semantic-search/search.py "charming craftsman with mountain views and character"

import json
import os
import sys

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from embed import get_embedding

CACHE_PATH = os.path.join(os.path.dirname(__file__), "index_cache.json")


def load_index() -> list[dict]:
    if not os.path.exists(CACHE_PATH):
        raise FileNotFoundError(
            f"No index found at {CACHE_PATH}. Run build_index.py first: "
            "python3 skills/semantic-search/build_index.py"
        )
    with open(CACHE_PATH) as f:
        return json.load(f)


def find_similar_listings(query: str, top_k: int = 5) -> list[dict]:
    """Return the top_k listings most semantically similar to a free-text query."""
    index = load_index()
    query_vec = np.array(get_embedding(query)).reshape(1, -1)
    listing_vecs = np.array([item["embedding"] for item in index])

    scores = cosine_similarity(query_vec, listing_vecs)[0]
    ranked = sorted(zip(index, scores), key=lambda pair: pair[1], reverse=True)

    results = []
    for listing, score in ranked[:top_k]:
        result = {k: v for k, v in listing.items() if k != "embedding"}
        result["similarity"] = round(float(score), 4)
        results.append(result)
    return results


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "charming craftsman with mountain views and character"
    print(f'Query: "{query}"\n')
    for i, listing in enumerate(find_similar_listings(query, top_k=5), start=1):
        print(f"{i}. {listing['address']}, {listing['city']} -- ${listing['price']:,} "
              f"({listing['similarity']} similarity)")
        print(f"   {listing['beds']}bd/{listing['baths']}ba, {listing['sqft']} sqft, "
              f"built {listing['year_built']}, {listing['type']}")
        print(f"   {listing['remarks'][:150]}...")
        print()
