"""
run.py — Interactive CLI for the Health Knowledge Graph RAG system.

Usage: python run.py

Features:
  - Conversational multi-turn Q&A with memory
  - Automatic LOCAL / GLOBAL query routing
  - Specific date + value citations in every answer
  - Special commands: /clear, /stats, /history, /exit
"""

import os
import sys
from datetime import datetime
from pathlib import Path

from query_engine import query, ConversationHistory
from retriever import get_graph_summary, close


# ─────────────────────────────────────────────
# DISPLAY HELPERS
# ─────────────────────────────────────────────

def clear():
    os.system('cls' if os.name == 'nt' else 'clear')

def header():
    print("\n" + "═"*60)
    print("   🧠  HEALTH KNOWLEDGE GRAPH — RAG ASSISTANT")
    print("═"*60)
    print("  Ask anything about your health records.")
    print("  Commands: /clear  /stats  /history  /exit")
    print("─"*60)

def divider():
    print("\n" + "─"*60)

def print_answer(result: dict):
    mode      = result.get("mode", "?").upper()
    date_range = result.get("date_range", {})
    answer    = result.get("answer", "")

    dr_str = ""
    if date_range:
        dr_str = f" | {date_range.get('start','?')} → {date_range.get('end','?')}"

    print(f"\n  [Mode: {mode}{dr_str}]\n")
    # Indent each line of the answer for clean display
    for line in answer.split("\n"):
        print(f"  {line}")

def print_stats(stats: dict):
    print("\n  ── Graph Stats ──────────────────────────────")
    print(f"  Visits:       {stats.get('visits', 0)}")
    print(f"  Lab results:  {stats.get('labs', 0)}")
    print(f"  Scans:        {stats.get('scans', 0)}")
    print(f"  Wearable pts: {stats.get('metrics', 0)}")
    earliest = stats.get('earliest', 'N/A')
    latest   = stats.get('latest', 'N/A')
    print(f"  Date span:    {earliest} → {latest}")
    print("  ─────────────────────────────────────────────")

def print_history(history: ConversationHistory):
    if not history.turns:
        print("\n  No conversation history yet.")
        return
    print(f"\n  ── Conversation History ({len(history.turns)//2} turns) ──")
    for i, turn in enumerate(history.turns):
        prefix = "You" if turn["role"] == "user" else "AI "
        content = turn["content"]
        # Truncate long assistant answers in history display
        if turn["role"] == "assistant" and len(content) > 200:
            content = content[:200] + "..."
        print(f"\n  [{prefix}] {content}")
    print()


# ─────────────────────────────────────────────
# SETUP: CREDENTIALS
# ─────────────────────────────────────────────

def load_env():
    """Load .env from current dir or parent dir (GraphSchema sibling)."""
    # Try current dir first
    if Path(".env").exists():
        from dotenv import load_dotenv
        load_dotenv()
        return True

    # Try parent dir (KG/.env)
    parent_env = Path("..") / ".env"
    if parent_env.exists():
        from dotenv import load_dotenv
        load_dotenv(parent_env)
        return True

    # Try GraphSchema sibling
    sibling_env = Path("..") / "GraphSchema" / ".env"
    if sibling_env.exists():
        from dotenv import load_dotenv
        load_dotenv(sibling_env)
        return True

    return False


def check_credentials():
    """Verify required env vars are set."""
    found = load_env()
    missing = []

    for var in ["GEMINI_API_KEY", "NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"]:
        if not os.environ.get(var):
            missing.append(var)

    if missing:
        print(f"\n  ✗ Missing credentials: {', '.join(missing)}")
        print("  Make sure your .env file exists in KG/GraphRag/, KG/, or KG/GraphSchema/")
        print("  Required vars: GEMINI_API_KEY, NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD")
        sys.exit(1)

    print(f"  ✓ Credentials loaded.")
    if not found:
        print("  ⚠  No .env file found — relying on system environment variables.")


def test_connections():
    """Quick connectivity check before entering the query loop."""
    print("\n  → Testing connections...")

    # Neo4j
    try:
        from neo4j import GraphDatabase
        import config
        d = GraphDatabase.driver(config.NEO4J_URI, auth=(config.NEO4J_USER, config.NEO4J_PASSWORD))
        d.verify_connectivity()
        d.close()
        print("  ✓ Neo4j connected.")
    except Exception as e:
        print(f"  ✗ Neo4j connection failed: {e}")
        if "neo4j+s://" in (os.environ.get("NEO4J_URI") or ""):
            print("  Tip: Check AuraDB is RUNNING (free tier pauses after 3 days idle)")
        sys.exit(1)

    # Gemini
    try:
        from google import genai as g
        c = g.Client(api_key=os.environ["GEMINI_API_KEY"])
        c.models.generate_content(model="gemini-3-flash-preview", contents="Say OK")
        print("  ✓ Gemini connected.")
    except Exception as e:
        print(f"  ✗ Gemini connection failed: {e}")
        sys.exit(1)


# ─────────────────────────────────────────────
# MAIN LOOP
# ─────────────────────────────────────────────

def main():
    clear()
    header()

    # Setup
    check_credentials()
    test_connections()

    # Show graph stats on startup
    stats = get_graph_summary()
    print()
    print_stats(stats)

    if stats["visits"] == 0:
        print("\n  ⚠  Your graph is empty.")
        print("  Run the GraphSchema pipeline first to ingest medical data.")
        print("  (KG/GraphSchema/run.py)")
        sys.exit(0)

    # Init conversation history
    history = ConversationHistory()

    print(f"\n  Graph has data from {stats.get('earliest','?')} → {stats.get('latest','?')}")
    print("  Ready. Ask your first question below.\n")

    # Query loop
    while True:
        try:
            divider()
            user_input = input("  You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\n  Goodbye!\n")
            close()
            sys.exit(0)

        if not user_input:
            continue

        # ── Special commands ──────────────────────────────────────
        cmd = user_input.lower()

        if cmd in ("/exit", "/quit", "exit", "quit"):
            print("\n  Goodbye!\n")
            close()
            sys.exit(0)

        if cmd == "/clear":
            history.clear()
            print("\n  ✓ Conversation history cleared.")
            continue

        if cmd == "/stats":
            stats = get_graph_summary()
            print_stats(stats)
            continue

        if cmd == "/history":
            print_history(history)
            continue

        if cmd == "/help":
            print("\n  Commands:")
            print("    /clear    — clear conversation history")
            print("    /stats    — show graph data counts")
            print("    /history  — show conversation so far")
            print("    /exit     — quit")
            print("\n  Example questions:")
            print("    'Summarise my health over the last 6 months'")
            print("    'What has been happening with my HbA1c?'")
            print("    'Are there any connections between my scan findings and lab results?'")
            print("    'What medications am I on and when were they prescribed?'")
            print("    'What does last month's wearable data look like?'")
            continue

        # ── Query ─────────────────────────────────────────────────
        print("\n  Thinking...", end="", flush=True)
        try:
            result = query(user_input, history)
            print("\r" + " "*20 + "\r", end="")  # clear "Thinking..."
            print_answer(result)
        except Exception as e:
            print(f"\n\n  ✗ Error: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
