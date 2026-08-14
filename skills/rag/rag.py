# skills/rag/rag.py
# Week 8 -- retrieve relevant chunks for a query and generate a grounded
# answer using only that retrieved context.
#
# Usage:
#   python3 skills/rag/rag.py "What does DOM mean?"

import json
import os
import sys

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from embed import client, get_embedding

CACHE_PATH = os.path.join(os.path.dirname(__file__), "rag_index_cache.json")
CHAT_MODEL = "gpt-4o-mini"


def load_index() -> list[dict]:
    if not os.path.exists(CACHE_PATH):
        raise FileNotFoundError(
            f"No RAG index at {CACHE_PATH}. Build it first: "
            "python3 skills/rag/build_index.py"
        )
    with open(CACHE_PATH) as f:
        return json.load(f)


def retrieve(query: str, index: list[dict], top_k: int = 4) -> list[dict]:
    """Return the top_k chunks most semantically similar to the query."""
    q_emb = np.array(get_embedding(query)).reshape(1, -1)
    scored = [
        (doc, cosine_similarity(q_emb, np.array(doc["embedding"]).reshape(1, -1))[0][0])
        for doc in index
    ]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return [doc for doc, _ in scored[:top_k]]


def rag_answer(query: str, index: list[dict], top_k: int = 4) -> dict:
    """Answer `query` using only the retrieved chunks as context -- the
    model is instructed not to draw on outside knowledge, so an answer
    outside the indexed documents should come back as "not covered" rather
    than a guess."""
    chunks = retrieve(query, index, top_k)
    context = "\n\n".join(f"[{c['source']}]\n{c['chunk']}" for c in chunks)
    prompt = (
        "Answer the question using only the context below. "
        "If the context does not contain the answer, say so explicitly "
        "instead of guessing.\n\n"
        f"Context:\n{context}\n\nQuestion: {query}"
    )
    resp = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return {
        "answer": resp.choices[0].message.content,
        "sources": sorted({c["source"] for c in chunks}),
    }


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "What does DOM mean?"
    index = load_index()
    result = rag_answer(query, index)
    print(f"Q: {query}\n")
    print(f"A: {result['answer']}\n")
    print(f"Sources: {', '.join(result['sources'])}")
