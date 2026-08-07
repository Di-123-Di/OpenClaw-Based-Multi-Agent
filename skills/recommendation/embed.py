# skills/recommendation/embed.py
# Week 7 -- embeds a single target listing on demand.
#
# This intentionally mirrors skills/semantic-search/embed.py rather than
# importing it: each skill folder stays self-contained (no cross-skill
# imports), and this file only needs the single-text path, not the batch
# helper that build_index.py uses.

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

EMBEDDING_MODEL = "text-embedding-3-small"
MAX_INPUT_CHARS = 8000

client = OpenAI()


def get_embedding(text: str, model: str = EMBEDDING_MODEL) -> list[float]:
    text = text.replace("\n", " ").strip()[:MAX_INPUT_CHARS]
    response = client.embeddings.create(model=model, input=text)
    return response.data[0].embedding


def build_listing_text(row: dict) -> str:
    """Same shape as semantic-search's build_listing_text -- must match so a
    target listing's embedding is comparable to the cached candidate pool."""
    return f"""
{row["L_Type_"]} in {row["L_City"]}, CA.
{row["L_Keyword2"]} beds, {row["LM_Dec_3"]} baths.
{row["LM_Int2_3"]} sq ft. Built {row["YearBuilt"]}.
Price: ${row["L_SystemPrice"]:,}.
{row.get("L_Remarks", "")}
""".strip()
