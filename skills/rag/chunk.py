# skills/rag/chunk.py
# Week 8 -- split a document's text into overlapping character-based chunks.


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> list[str]:
    """Slide a window of chunk_size characters across text, stepping by
    (chunk_size - overlap) each time. The overlap means a sentence spanning
    a chunk boundary still appears whole in at least one chunk."""
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks
