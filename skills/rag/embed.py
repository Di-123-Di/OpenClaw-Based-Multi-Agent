# skills/rag/embed.py
# Week 8 -- embedding helper, mirroring semantic-search/embed.py so this
# skill folder stays self-contained (see recommendation/embed.py for the
# same reasoning).

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


def get_embeddings_batch(texts: list[str], model: str = EMBEDDING_MODEL) -> list[list[float]]:
    cleaned = [t.replace("\n", " ").strip()[:MAX_INPUT_CHARS] for t in texts]
    response = client.embeddings.create(model=model, input=cleaned)
    return [d.embedding for d in response.data]
