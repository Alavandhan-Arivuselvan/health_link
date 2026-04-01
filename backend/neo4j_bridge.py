# neo4j_bridge.py

"""
neo4j_bridge.py
Place this file in: health_link/backend/

Bridges the backend upload flow to KG/Graph_Schema's own Gemini-based
extraction + Neo4j ingestion pipeline.

Instead of translating utils.py's parsed_json, this calls ingest.py
directly with the file path so it uses Gemini's specialised medical
extraction prompts for accurate data.

Called as a non-fatal background step AFTER the file is saved.
"""

import os
import sys
import datetime

# ── Resolve path to KG/Graph_Schema from backend/ ─────────────────────────────
_BACKEND_DIR    = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT   = os.path.dirname(_BACKEND_DIR)           # health_link/
_GRAPH_SCHEMA   = os.path.join(_PROJECT_ROOT, "KG", "Graph_Schema")
if not os.path.exists(_GRAPH_SCHEMA):
    _GRAPH_SCHEMA = os.path.join(_BACKEND_DIR, "KG", "Graph_Schema")

if _GRAPH_SCHEMA not in sys.path:
    sys.path.insert(0, _GRAPH_SCHEMA)

# SSL cert fix for Neo4j AuraDB on Windows
try:
    import certifi
    os.environ.setdefault('SSL_CERT_FILE', certifi.where())
except ImportError:
    pass

# Load Graph_Schema's .env so graph_db.py / extractor.py get their creds
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_GRAPH_SCHEMA, ".env"))
except Exception:
    pass

# Import the KG modules
_NEO4J_OK = False
try:
    import graph_db
    import ingest as kg_ingest
    graph_db.setup_constraints()
    _NEO4J_OK = True
    print("✅ neo4j_bridge: KG pipeline loaded (graph_db + ingest).")
except Exception as _e:
    print(f"⚠️  neo4j_bridge: KG pipeline not available — {_e}")


# ──────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ──────────────────────────────────────────────────────────────────────────────

def ingest_report_to_neo4j(file_path: str) -> bool:
    """
    Ingest a medical report (PDF/text) into Neo4j using the KG/Graph_Schema
    pipeline: reads file → Gemini LLM extraction → graph_db writes.

    This does NOT use utils.py's extraction — it runs its own Gemini-based
    extraction for accurate medical data.
    """
    if not _NEO4J_OK:
        print("⚠️  neo4j_bridge: skipped (Neo4j not available)")
        return False

    try:
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        print(f"🔗 neo4j_bridge: ingesting medical report → {file_path}")
        result = kg_ingest.ingest_medical_report(file_path, today)
        if result:
            print(f"✅ neo4j_bridge: medical report ingestion done for {today}")
            return True
        else:
            print(f"⚠️  neo4j_bridge: extraction returned empty for {file_path}")
            return False
    except Exception as e:
        print(f"❌ neo4j_bridge (report): {e}")
        import traceback; traceback.print_exc()
        return False


def ingest_scan_to_neo4j(file_path: str) -> bool:
    """
    Ingest a scan report (PDF/text) into Neo4j using the KG/Graph_Schema
    pipeline: reads file → Gemini LLM extraction → graph_db writes.
    """
    if not _NEO4J_OK:
        print("⚠️  neo4j_bridge: skipped (Neo4j not available)")
        return False

    try:
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        print(f"🔗 neo4j_bridge: ingesting scan report → {file_path}")
        result = kg_ingest.ingest_scan_report(file_path, today)
        if result:
            print(f"✅ neo4j_bridge: scan ingestion done for {today}")
            return True
        else:
            print(f"⚠️  neo4j_bridge: scan extraction returned empty for {file_path}")
            return False
    except Exception as e:
        print(f"❌ neo4j_bridge (scan): {e}")
        import traceback; traceback.print_exc()
        return False


def get_graph_data() -> dict:
    """
    Read the full knowledge graph from Neo4j.
    Returns {"nodes": [...], "edges": [...]}.
    Each node: {id, label, group, properties}
    Each edge: {from, to, label}
    """
    if not _NEO4J_OK:
        return {"nodes": [], "edges": []}

    try:
        with graph_db.driver.session() as session:
            # Fetch all nodes
            nodes_result = session.run("""
                MATCH (n)
                RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS props
            """)
            nodes = []
            for r in nodes_result:
                label = r["labels"][0] if r["labels"] else "Unknown"
                props = dict(r["props"])
                display = (
                    props.get("display_name")
                    or props.get("name")
                    or props.get("drug")
                    or props.get("description")
                    or props.get("date")
                    or props.get("canonical_id")
                    or label
                )
                nodes.append({
                    "id": r["id"],
                    "label": str(display),
                    "group": label,
                    "properties": {k: str(v) for k, v in props.items()},
                })

            # Fetch all relationships
            rels_result = session.run("""
                MATCH (a)-[r]->(b)
                RETURN elementId(a) AS source, elementId(b) AS target, type(r) AS type
            """)
            edges = []
            for r in rels_result:
                edges.append({
                    "from": r["source"],
                    "to": r["target"],
                    "label": r["type"],
                })

        return {"nodes": nodes, "edges": edges}

    except Exception as e:
        print(f"❌ neo4j_bridge (get_graph_data): {e}")
        return {"nodes": [], "edges": []}