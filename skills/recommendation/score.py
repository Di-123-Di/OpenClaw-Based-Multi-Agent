# skills/recommendation/score.py
# Week 7 -- hybrid similarity score: structured MLS fields (60 points max) plus
# embedding cosine similarity (40 points max).

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


def calculate_similarity_score(
    target: dict,
    candidate: dict,
    target_emb: list[float],
    candidate_emb: list[float],
) -> float:
    """Score how similar `candidate` is to `target`, on a 0-100 scale.
    `target` and `candidate` use the friendly field names shared with the
    semantic-search index cache: price, beds, city, sqft."""
    score = 0.0

    # Structured similarity -- up to 60 points. Some MLS rows have missing
    # price/sqft; a missing field simply contributes no points rather than
    # raising, since "unknown" shouldn't be scored as "similar".
    if target.get("price") is not None and candidate.get("price") is not None:
        price_diff = abs(target["price"] - candidate["price"])
        if price_diff < 50_000:
            score += 20
        elif price_diff < 150_000:
            score += 12
        elif price_diff < 300_000:
            score += 5

    if target.get("beds") is not None and target["beds"] == candidate.get("beds"):
        score += 15
    if target.get("city") is not None and target["city"] == candidate.get("city"):
        score += 15

    if target.get("sqft") is not None and candidate.get("sqft") is not None:
        sqft_diff = abs(target["sqft"] - candidate["sqft"])
        if sqft_diff < 300:
            score += 10
        elif sqft_diff < 700:
            score += 5

    # Semantic similarity -- up to 40 points
    sem_sim = cosine_similarity(
        np.array(target_emb).reshape(1, -1),
        np.array(candidate_emb).reshape(1, -1),
    )[0][0]
    score += sem_sim * 40

    return round(score, 2)
