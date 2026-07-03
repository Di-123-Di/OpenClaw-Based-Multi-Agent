# IDX Multi-Agent Real Estate Assistant

A production-grade, multi-agent AI assistant built on the **OpenClaw** runtime that
answers natural-language real-estate questions over two real MLS datasets
(~228K active listings + ~439K sold comps) and communicates through WhatsApp and
email. It performs live property search, market analytics, semantic recommendations,
retrieval-augmented knowledge answers, and safe, human-approved outbound messaging.

## Overview

Users chat in plain language — "show me 3-bedroom condos in Irvine under $1.5M with
a pool" or "is now a good time to buy in San Diego?" — and a coordinator routes each
request to the right specialized agent. Answers are grounded in structured MLS data
and historical comps rather than guessed.

## Features

- **Natural-language property search** over active MLS listings (`rets_property`).
- **Conversational, multi-turn memory** — the agent asks follow-ups and refines results.
- **Market analytics** — median price, price/sqft, days-on-market, and list-to-close
  trends from ~439K sold transactions (`california_sold`).
- **Comp-validated pricing** — recommendations checked against recent nearby sales.
- **Semantic similarity search** — OpenAI embeddings over listing remarks find homes
  by feel ("charming craftsman with character"), not just keywords.
- **Recommendation engine** — hybrid structured + semantic scoring.
- **RAG knowledge assistant** — grounded answers about MLS fields and real-estate terms.
- **Multi-agent orchestration** — a coordinator dispatches or fans out across agents.
- **WhatsApp interface** — the primary real-time conversational channel.
- **Email workflows with a draft-then-approve safety gate** — no message is ever sent
  without explicit human confirmation.

## Architecture

User → WhatsApp → OpenClaw Gateway → Orchestrator → Skill → Tools → MySQL → reply.
See the full component breakdown and request-flow diagram in
[docs/architecture.md](docs/architecture.md).

## Tech Stack

- **Runtime / orchestration:** OpenClaw (Node.js gateway, skills, channels, sessions)
- **Language:** TypeScript (skills/tools), Python (data + embeddings)
- **Database:** MySQL 8 (`idx_exchange`)
- **AI:** OpenAI embeddings (`text-embedding-3-small`) + an LLM for RAG and intent routing
- **Channels:** WhatsApp, email
- **Libraries:** pandas, numpy, scikit-learn, sqlalchemy, mysql-connector-python

## Data

Two tables in the `idx_exchange` MySQL schema:

- **rets_property** — active MLS listings; the live search/discovery table.
- **california_sold** — sold/closed transactions; historical comps and analytics.

They join on `rets_property.L_ListingID = california_sold.ListingKey`
(or on city + postal code for market-level analysis).

## Project Structure

    .
    ├── docs/
    │   └── architecture.md        # Architecture doc + request-flow diagram
    ├── skills/
    │   └── property-search/       # NL query -> structured filters
    │       ├── SKILL.md
    │       └── parse.ts
    ├── verify_setup.py            # Environment / DB connectivity check
    ├── .env                       # Secrets (never committed)
    └── README.md

## Getting Started

### Prerequisites

- Node.js 22.19+ (24 recommended)
- Python 3.11+
- MySQL 8
- An OpenClaw install (`npm install -g openclaw`)

### 1. Install

    git clone https://github.com/Di-123-Di/OpenClaw-Based-Multi-Agent.git
    cd OpenClaw-Based-Multi-Agent
    python3 -m venv venv
    source venv/bin/activate
    pip install pandas openai mysql-connector-python sqlalchemy scikit-learn numpy python-dotenv

### 2. Import the MLS data

    mysql -u root -p -e "CREATE DATABASE idx_exchange CHARACTER SET utf8mb4;"
    mysql -u root -p idx_exchange < rets_property.sql
    mysql -u root -p idx_exchange < california_sold.sql

### 3. Configure environment

Create a `.env` file (never committed):

    OPENAI_API_KEY=sk-...
    MYSQL_HOST=localhost
    MYSQL_USER=root
    MYSQL_PASSWORD=your_password
    MYSQL_DATABASE=idx_exchange
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASSWORD=your_app_password

### 4. Verify the setup

    python3 verify_setup.py

### 5. Run OpenClaw

    openclaw onboard          # one-time guided setup
    openclaw channels add     # connect WhatsApp
    openclaw status           # confirm the gateway is healthy

## Usage

Message the assistant on WhatsApp:

    "3-bedroom condos in Irvine under $1.5M with a pool"
    "What's the average price per sqft in Pasadena?"
    "Find homes like the last one but in Newport Beach"
    "What does DOM mean?"

## Skills

| Skill | Purpose | Data source |
|---|---|---|
| property-search | NL query -> structured filters | rets_property |
| market-stats | Aggregated trends and comps | california_sold |
| recommendation | Similar listings + comp validation | both tables |
| rag | Grounded conceptual answers | indexed docs |
| email-draft | Draft-then-approve email workflows | both tables |

## Safety & Guardrails

- Outbound email uses a **draft → human approval → send** flow; nothing is sent
  autonomously.
- Secrets live only in `.env` and are never logged or committed.
- Queries return bounded result sets (≤ 50 rows); no bulk data export.

## Testing

Each skill ships with its own test suite. For example:

    node skills/property-search/parse.ts

## Roadmap

Built incrementally over a 12-week program: environment setup, OpenClaw
architecture, NL search, database integration, conversational memory, market
analytics, embeddings, recommendations, RAG, orchestration, WhatsApp, and email
with safety guardrails.

## License & Confidentiality

Internal project for the IDX Exchange internship program. MLS data is proprietary
and is not included in this repository.
