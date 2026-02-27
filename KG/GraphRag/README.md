# Health Knowledge Graph — GraphRag

A conversational RAG (Retrieval-Augmented Generation) system built directly on top of the patient health knowledge graph in Neo4j. Ask natural language questions about your health records and get grounded, cited answers.

---

## Folder Structure

```
KG/
├── GraphSchema/       ← ingest pipeline (writes to Neo4j)
└── GraphRag/          ← this folder (reads from Neo4j, answers questions)
    ├── config.py          # credentials + settings
    ├── retriever.py       # Cypher graph traversal (local + global)
    ├── context_builder.py # formats graph data into LLM context
    ├── query_engine.py    # query routing, prompt building, Gemini call
    └── run.py             # interactive CLI
```

---

## How It Works

```
Your question
      ↓
Query Engine — classifies: LOCAL or GLOBAL?
      ↓
Retriever — runs Cypher traversal (up to 5 hops for local)
      ↓
Context Builder — formats graph data as structured text with dates + values
      ↓
Gemini — answers grounded in graph data only
      ↓
CLI — prints cited answer
```

### LOCAL queries
Triggered when your question mentions a specific test, drug, diagnosis, or metric by name.
Examples:
- *"What has been happening with my HbA1c?"*
- *"Tell me about my Metformin prescription history"*
- *"Show me my resting heart rate over the last month"*

### GLOBAL queries
Triggered for broad health overview questions.
Examples:
- *"Summarise my health over the last 6 months"*
- *"Are there any patterns across my lab results and wearable data?"*
- *"Give me a full health overview"*

---

## Setup

GraphRag reuses the **same `.env` file** as GraphSchema. It will look for `.env` in:
1. `KG/GraphRag/` (current dir)
2. `KG/` (parent dir)
3. `KG/GraphSchema/` (sibling)

No extra setup needed if GraphSchema is already working.

### Install dependencies (if not already installed)
```bash
pip install neo4j google-genai python-dotenv
```

---

## Usage

```bash
cd KG/GraphRag
python run.py
```

### Special commands inside the CLI

| Command    | Action                          |
|------------|---------------------------------|
| `/stats`   | Show graph data counts          |
| `/history` | Show conversation so far        |
| `/clear`   | Clear conversation memory       |
| `/help`    | Show example questions          |
| `/exit`    | Quit                            |

---

## Key Design Decisions

**Pure graph traversal — no embeddings**
All retrieval is done via Cypher queries. Entity matching is by keyword search against canonical node names. This keeps it deterministic and avoids vector DB complexity.

**5-hop local traversal**
For local queries, TREND_OF and CONTINUES_FROM chains are walked up to 5 hops, giving full historical context for any specific test or drug.

**Grounded answers only**
The LLM is instructed to answer exclusively from the graph data provided — no outside medical knowledge fills gaps. If data isn't there, it says so.

**Conversation memory**
Last 10 turns are kept in memory and included in every prompt, enabling follow-up questions like "what about last month specifically?" or "is that related to my diagnosis?".

**Inferred edges included**
AI-inferred relationships from GraphSchema Pass 2 (CORRELATED_WITH, MAY_INDICATE etc.) are included in context with their confidence scores, so the LLM can reason about cross-modal patterns.
