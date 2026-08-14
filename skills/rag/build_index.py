# skills/rag/build_index.py
# Week 8 -- chunk and embed every document under knowledge/, caching the
# result so rag.py doesn't re-embed on every query.
#
# Usage: python3 skills/rag/build_index.py

import json
import os

from chunk import chunk_text
from embed import get_embeddings_batch

KNOWLEDGE_DIR = os.path.join(os.path.dirname(__file__), "knowledge")
CACHE_PATH = os.path.join(os.path.dirname(__file__), "rag_index_cache.json")
BATCH_SIZE = 50  # chunks embedded per OpenAI request


def load_documents() -> list[dict]:
    """One document per .md file under knowledge/, titled by filename."""
    docs = []
    for filename in sorted(os.listdir(KNOWLEDGE_DIR)):
        if not filename.endswith(".md"):
            continue
        path = os.path.join(KNOWLEDGE_DIR, filename)
        with open(path) as f:
            content = f.read()
        docs.append({"title": filename, "content": content})
    return docs


def build_index() -> None:
    docs = load_documents()
    print(f"Loaded {len(docs)} documents from {KNOWLEDGE_DIR}")

    chunk_records = []
    for doc in docs:
        # 600/100 (the handbook's example) splits our schema-reference tables
        # mid-row -- a reference table only means something whole, so a
        # larger window keeps each table intact in a single chunk instead of
        # scattering its rows across chunks with weaker individual similarity
        # to a query about the table as a whole.
        chunks = chunk_text(doc["content"], chunk_size=3000, overlap=300)
        for chunk in chunks:
            chunk_records.append({"source": doc["title"], "chunk": chunk})
    print(f"Split into {len(chunk_records)} chunks. Embedding in batches of {BATCH_SIZE}...")

    indexed = []
    for start in range(0, len(chunk_records), BATCH_SIZE):
        batch = chunk_records[start : start + BATCH_SIZE]
        texts = [r["chunk"] for r in batch]
        embeddings = get_embeddings_batch(texts)
        for record, embedding in zip(batch, embeddings):
            indexed.append({**record, "embedding": embedding})
        print(f"  embedded {min(start + BATCH_SIZE, len(chunk_records))}/{len(chunk_records)}")

    with open(CACHE_PATH, "w") as f:
        json.dump(indexed, f)
    print(f"Saved index for {len(indexed)} chunks to {CACHE_PATH}")


if __name__ == "__main__":
    build_index()
