"""
config.py — Shared config for GraphRag.
Reuses the same .env file as GraphSchema (NEO4J + GEMINI credentials).
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

# Neo4j
NEO4J_URI      = os.getenv("NEO4J_URI")
NEO4J_USER     = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

# GraphRag settings
MAX_HOPS            = 5       # local traversal depth
MAX_CONTEXT_NODES   = 200     # cap to avoid context overflow
CONVERSATION_WINDOW = 10      # max turns kept in memory
