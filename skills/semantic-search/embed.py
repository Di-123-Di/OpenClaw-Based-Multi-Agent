# skills/semantic-search/embed.py
# Week 6 -- OpenAI embedding generation for active listings.

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

EMBEDDING_MODEL = "text-embedding-3-small"
MAX_INPUT_CHARS = 8000  # keeps each input safely under the model's token limit

client = OpenAI()


def get_embedding(text: str, model: str = EMBEDDING_MODEL) -> list[float]:
    """Embed a single string. Prefer get_embeddings_batch() for many listings --
    one batched request is far faster than one request per listing."""
    text = text.replace("\n", " ").strip()[:MAX_INPUT_CHARS]
    response = client.embeddings.create(model=model, input=text)
    return response.data[0].embedding


def get_embeddings_batch(texts: list[str], model: str = EMBEDDING_MODEL) -> list[list[float]]:
    """Embed many strings in one API call. The OpenAI embeddings endpoint accepts
    a list as `input`, so this trades N round trips for 1."""
    cleaned = [t.replace("\n", " ").strip()[:MAX_INPUT_CHARS] for t in texts]
    response = client.embeddings.create(model=model, input=cleaned)
    return [d.embedding for d in response.data]


def build_listing_text(row: dict) -> str:
    """Combine structured fields with the free-text remarks into one string --
    the same shape the query side must match for similarity to be meaningful."""
    return f"""
{row["L_Type_"]} in {row["L_City"]}, CA.
{row["L_Keyword2"]} beds, {row["LM_Dec_3"]} baths.
{row["LM_Int2_3"]} sq ft. Built {row["YearBuilt"]}.
Price: ${row["L_SystemPrice"]:,}.
{row.get("L_Remarks", "")}
""".strip()
