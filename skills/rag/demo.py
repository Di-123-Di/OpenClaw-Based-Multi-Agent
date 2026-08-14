# skills/rag/demo.py
# Week 8 demo -- narrated walkthrough of the RAG skill for a live
# presentation: the three required questions, plus an out-of-scope question
# that proves the assistant says "not covered" instead of hallucinating.
#
# Usage: python3 skills/rag/demo.py

from rag import load_index, rag_answer

DEMO_QUESTIONS = [
    "What does DOM mean?",
    "What columns are in california_sold?",
    "What is a list-to-close ratio?",
    "What is the capital of France?",  # out of scope -- proves grounding
]


def print_header(title: str) -> None:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


print_header("Week 8 -- RAG Knowledge Assistant")
index = load_index()
print(f"Index: {len(index)} chunks across 4 source documents "
      "(real_estate_primer, trestle_field_definitions, "
      "week5_market_summary, idx_schema_reference)")

for question in DEMO_QUESTIONS:
    print_header(f"Q: {question}")
    result = rag_answer(question, index)
    print(result["answer"])
    print(f"\nSources: {', '.join(result['sources'])}")
