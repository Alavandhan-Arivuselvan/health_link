"""
query_engine.py — Core GraphRag query engine.

Responsibilities:
  1. Classify query as LOCAL or GLOBAL
  2. Route to appropriate retriever
  3. Build context from graph data
  4. Manage conversation history (multi-turn)
  5. Call Gemini with grounded prompt
  6. Return cited answer
"""

import json
import re
from google import genai

from graphrag_config import GEMINI_API_KEY, GEMINI_MODEL, CONVERSATION_WINDOW
from retriever import detect_entities, detect_date_range, local_retrieve, global_retrieve, get_graph_summary
from context_builder import build_local_context, build_global_context

client = genai.Client(api_key=GEMINI_API_KEY)


# ─────────────────────────────────────────────
# CONVERSATION MEMORY
# ─────────────────────────────────────────────

class ConversationHistory:
    def __init__(self, window: int = CONVERSATION_WINDOW):
        self.window = window
        self.turns  = []   # list of {"role": "user"|"assistant", "content": str}

    def add(self, role: str, content: str):
        self.turns.append({"role": role, "content": content})
        # Keep only last N turns (user + assistant pairs)
        if len(self.turns) > self.window * 2:
            self.turns = self.turns[-(self.window * 2):]

    def format_for_prompt(self) -> str:
        if not self.turns:
            return "(No previous conversation)"
        lines = []
        for t in self.turns:
            prefix = "User" if t["role"] == "user" else "Assistant"
            lines.append(f"{prefix}: {t['content']}")
        return "\n".join(lines)

    def clear(self):
        self.turns = []

    def __len__(self):
        return len(self.turns)


# ─────────────────────────────────────────────
# QUERY CLASSIFIER
# ─────────────────────────────────────────────

GLOBAL_KEYWORDS = [
    "summary", "summarise", "summarize", "overview", "everything", "overall",
    "all", "health", "general", "history", "timeline", "full", "complete",
    "what's been happening", "how am i doing", "how have i been",
    "any concerns", "any issues", "any patterns", "broad", "across"
]

LOCAL_KEYWORDS = [
    "specific", "trend", "when", "last time", "how many times",
    "what happened to", "show me", "tell me about", "details on"
]


def classify_query(query: str, entities: dict) -> str:
    """
    Returns 'local' or 'global'.

    Logic:
    1. If specific entities were matched (test/drug/diagnosis/metric name found),
       it's LOCAL — user is asking about something specific.
    2. If broad/summary keywords present with no specific entity, it's GLOBAL.
    3. Fallback: GLOBAL (safer for open-ended questions).
    """
    query_lower = query.lower()

    has_entities = any(
        entities.get(k) for k in ["tests", "drugs", "diagnoses", "metrics"]
    )

    has_global_keyword = any(kw in query_lower for kw in GLOBAL_KEYWORDS)
    has_local_keyword  = any(kw in query_lower for kw in LOCAL_KEYWORDS)

    if has_entities and not has_global_keyword:
        return "local"

    if has_entities and has_local_keyword:
        return "local"

    if has_global_keyword:
        return "global"

    # If entities found alongside global keywords (e.g. "summarise my HbA1c history")
    if has_entities:
        return "local"

    return "global"


# ─────────────────────────────────────────────
# PROMPT BUILDER
# ─────────────────────────────────────────────

def build_prompt(query: str, context: str, history: ConversationHistory,
                 mode: str, entities: dict, role: str = "patient") -> str:

    entity_summary = []
    for etype, elist in entities.items():
        if elist:
            names = ", ".join(e["name"] for e in elist)
            entity_summary.append(f"{etype}: {names}")

    entity_str = "; ".join(entity_summary) if entity_summary else "none detected"

    history_str = history.format_for_prompt()

    if role == "doctor":
        is_first = len(history.turns) == 0
        if is_first:
            system_intro = "You are a professional medical assistant helping a doctor review a patient's health records. Greet the doctor warmly (e.g. 'Hello Doctor!'). Address the user as 'Doctor' — NOT by the patient's name. The patient data below belongs to someone the doctor is examining."
        else:
            system_intro = "You are a professional medical assistant helping a doctor review a patient's health records. Do NOT greet or say hello — just answer the question directly. Address the user as 'Doctor' only if needed — NOT by the patient's name. The patient data below belongs to someone the doctor is examining."
    else:
        system_intro = "You are a friendly, knowledgeable medical assistant chatting with a patient about their health data."

    prompt = f"""{system_intro}

━━━ YOUR RULES ━━━
1. Answer ONLY from the graph data provided below. Do NOT use outside medical knowledge to fill gaps.
2. Always cite specific dates and values when they appear in the data. Example: "Your HbA1c was 7.8% on 15 Jan 2025".
3. If a trend exists, describe it in natural language (e.g. "it went up from 5.2 to 6.1").
4. If the data does not contain enough information to answer, say so clearly.
5. Do not speculate or suggest diagnoses beyond what is in the graph.

━━━ RESPONSE STYLE ━━━
- Default: Give short, simple, friendly answers — like a quick chat with a doctor friend.
- Only give a detailed / longer explanation when the user specifically asks for it (examples: "can you explain in detail?", "tell me more", "give full details", "break it down", "why is that happening?", "what does this mean step by step").
- When detailed mode is requested: include more context, trends over time, comparisons between dates, and clearer explanations — but still only use the provided graph data.

━━━ FORMATTING RULES (VERY IMPORTANT) ━━━
- Write in plain conversational text like a chat message.
- Do NOT use markdown formatting: no #, ##, **, *, bullet points, or numbered lists.
- Do NOT use headers or bold text.
- Use short paragraphs separated by blank lines.
- Keep default answers concise (usually 1–4 sentences).
- Use simple dashes (-) only if listing 3+ items, and keep them brief.

━━━ QUERY MODE ━━━
{mode.upper()} QUERY
Entities detected in query: {entity_str}

━━━ CONVERSATION HISTORY ━━━
{history_str}

━━━ PATIENT HEALTH GRAPH DATA ━━━
{context}

━━━ CURRENT QUESTION ━━━
{query}

━━━ YOUR ANSWER (plain text, no markdown) ━━━"""

    return prompt


# ─────────────────────────────────────────────
# MAIN QUERY FUNCTION
# ─────────────────────────────────────────────

def query(user_query: str, history: ConversationHistory, role: str = "patient") -> dict:
    """
    Main entry point. Takes a user question and conversation history.
    Returns a dict with: answer, mode, entities_matched, graph_stats.
    """

    # 1. Check graph has data
    stats = get_graph_summary()
    if stats["visits"] == 0:
        return {
            "answer": "The health graph is empty. Please ingest some medical data first using the GraphSchema pipeline.",
            "mode": "none",
            "entities_matched": {},
            "graph_stats": stats
        }

    # 2. Detect entities and date range in query
    entities   = detect_entities(user_query)
    date_range = detect_date_range(user_query)

    # 3. Classify query
    mode = classify_query(user_query, entities)

    # 4. Retrieve from graph
    print(f"\n  → Mode: {mode.upper()} | Date range: {date_range or 'all time'}")
    if mode == "local":
        matched_count = sum(len(v) for v in entities.values())
        print(f"  → Entities matched: {matched_count}")
        graph_data = local_retrieve(entities, date_range)
    else:
        graph_data = global_retrieve(date_range)

    # 5. Build context
    if mode == "local":
        context = build_local_context(graph_data, entities)
    else:
        context = build_global_context(graph_data)

    # 6. Build prompt with history
    prompt = build_prompt(user_query, context, history, mode, entities, role)

    # 7. Call Gemini
    print(f"  → Calling Gemini ({GEMINI_MODEL})...")
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt
    )
    answer = response.text.strip()

    # 8. Update conversation history
    history.add("user", user_query)
    history.add("assistant", answer)

    return {
        "answer":           answer,
        "mode":             mode,
        "entities_matched": entities,
        "graph_stats":      stats,
        "date_range":       date_range,
    }
