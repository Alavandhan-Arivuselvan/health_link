"""
analysis.py — Pass 2: Semantic relationship inference.

Queries a window of the patient's graph, sends it to the LLM,
and writes back inferred cross-modal semantic edges.

All inferred edges are tagged with inferred_by: "llm" so they're
never confused with raw factual data from ingestion.
"""

import json
import re
from datetime import datetime, timedelta
from neo4j import GraphDatabase
from google import genai

from config import GEMINI_API_KEY, GEMINI_MODEL, NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

client = genai.Client(api_key=GEMINI_API_KEY)
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


# ─────────────────────────────────────────────
# GRAPH QUERY: BUILD SUBGRAPH SUMMARY
# ─────────────────────────────────────────────

def fetch_analysis_window(anchor_date: str, days_back: int = 90) -> dict:
    anchor = datetime.strptime(anchor_date, "%Y-%m-%d")
    start_date = (anchor - timedelta(days=days_back)).strftime("%Y-%m-%d")

    with driver.session() as session:

        lab_results = session.run("""
            MATCH (l:LabResult)
            WHERE l.date >= $start AND l.date <= $anchor
            MATCH (l)-[:INSTANCE_OF]->(t:TestType)
            OPTIONAL MATCH (l)-[:TREND_OF]->(prev:LabResult)
            RETURN t.display_name AS test, l.value AS value,
                   l.unit AS unit, l.status AS status,
                   l.date AS date, l.result_id AS id,
                   prev.value AS prev_value, prev.date AS prev_date
            ORDER BY l.date DESC
        """, start=start_date, anchor=anchor_date).data()

        diagnoses = session.run("""
            MATCH (d:Diagnosis)
            WHERE d.date >= $start AND d.date <= $anchor
            RETURN d.name AS name, d.icd_code AS icd,
                   d.date AS date, d.diag_id AS id
            ORDER BY d.date DESC
        """, start=start_date, anchor=anchor_date).data()

        prescriptions = session.run("""
            MATCH (rx:Prescription)
            WHERE rx.date >= $start AND rx.date <= $anchor
            RETURN rx.drug AS drug, rx.dose AS dose,
                   rx.frequency AS frequency, rx.date AS date, rx.rx_id AS id
            ORDER BY rx.date DESC
        """, start=start_date, anchor=anchor_date).data()

        findings = session.run("""
            MATCH (s:Scan)-[:CONTAINS]->(f:Finding)
            WHERE s.date >= $start AND s.date <= $anchor
            RETURN s.modality AS modality, s.body_part AS body_part,
                   f.description AS description, f.severity AS severity,
                   s.date AS date, f.finding_id AS id
            ORDER BY s.date DESC
        """, start=start_date, anchor=anchor_date).data()

        wearable = session.run("""
            MATCH (w:WearableLog)-[:CONTAINS]->(m:Metric)
            WHERE m.date >= $start AND m.date <= $anchor
            MATCH (m)-[:INSTANCE_OF]->(mt:MetricType)
            RETURN mt.display_name AS metric, m.value AS value,
                   m.unit AS unit, m.date AS date,
                   m.aggregation AS aggregation, m.metric_id AS id
            ORDER BY m.date DESC
            LIMIT 200
        """, start=start_date, anchor=anchor_date).data()

        existing_inferred = session.run("""
            MATCH (a)-[r]->(b)
            WHERE r.inferred_by = 'llm'
            RETURN type(r) AS rel_type,
                   r.source_id AS source_id,
                   r.target_id AS target_id,
                   r.confidence AS confidence
            LIMIT 100
        """).data()

    return {
        "window": {"start": start_date, "end": anchor_date, "days": days_back},
        "lab_results": lab_results,
        "diagnoses": diagnoses,
        "prescriptions": prescriptions,
        "findings": findings,
        "wearable": wearable,
        "existing_inferred_edges": existing_inferred
    }


# ─────────────────────────────────────────────
# LLM: INFER NEW RELATIONSHIPS
# ─────────────────────────────────────────────

def infer_relationships(subgraph: dict) -> list:
    prompt = f"""
You are a clinical data analyst working on a patient health knowledge graph.
Identify meaningful relationships between data points that a doctor would find clinically significant.

━━━ PATIENT DATA WINDOW ({subgraph['window']['start']} to {subgraph['window']['end']}) ━━━

LAB RESULTS:
{json.dumps(subgraph['lab_results'], indent=2)}

DIAGNOSES:
{json.dumps(subgraph['diagnoses'], indent=2)}

PRESCRIPTIONS:
{json.dumps(subgraph['prescriptions'], indent=2)}

SCAN FINDINGS:
{json.dumps(subgraph['findings'], indent=2)}

WEARABLE DATA:
{json.dumps(subgraph['wearable'], indent=2)}

ALREADY INFERRED (do NOT recreate):
{json.dumps(subgraph['existing_inferred_edges'], indent=2)}

━━━ TASK ━━━
Find new clinically meaningful relationships:
1. CORRELATIONS — two values high/low at same time
2. ANOMALIES — value outside normal range
3. CROSS-MODAL — wearable pattern matches lab/scan finding
4. TREATMENT RESPONSE — drug may explain lab value change
5. PROGRESSION — worsening or improving trend over time

━━━ RULES ━━━
- Only clinically significant links. No weak speculative links.
- source_id and target_id must EXACTLY match the id values from the data above.
- relation_type: UPPER_SNAKE_CASE, invent freely.
- confidence: 0.0-1.0
- reason: 1-2 sentence clinical explanation.

━━━ OUTPUT — valid JSON array only, no markdown ━━━
[
  {{
    "source_id": "hba1c_2025-01-15",
    "target_id": "heart_rate_2025-01-15",
    "relation_type": "CORRELATED_WITH",
    "confidence": 0.75,
    "reason": "Elevated HbA1c coincides with elevated resting heart rate, consistent with autonomic dysfunction."
  }}
]

If no meaningful relationships exist, return: []
"""

    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    raw = response.text.strip()
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else []
    except json.JSONDecodeError as e:
        print(f"  ⚠ Analysis JSON parse failed: {e}")
        print(f"  Raw output:\n{raw[:600]}")
        return []


# ─────────────────────────────────────────────
# GRAPH WRITE: INFERRED EDGES
# ─────────────────────────────────────────────

def write_inferred_relationships(relationships: list, analysis_window: dict):
    written = 0
    skipped = 0
    now = datetime.now().isoformat()
    window_str = f"{analysis_window['start']}/{analysis_window['end']}"

    with driver.session() as session:
        for rel in relationships:
            source_id = rel.get("source_id")
            target_id = rel.get("target_id")
            rel_type = rel.get("relation_type", "RELATED_TO").upper().replace(" ", "_")
            confidence = float(rel.get("confidence", 0.5))
            reason = rel.get("reason", "")

            if not source_id or not target_id:
                skipped += 1
                continue

            try:
                result = session.run(f"""
                    MATCH (a)
                    WHERE a.result_id = $sid OR a.rx_id = $sid
                       OR a.finding_id = $sid OR a.diag_id = $sid
                       OR a.metric_id = $sid
                    MATCH (b)
                    WHERE b.result_id = $tid OR b.rx_id = $tid
                       OR b.finding_id = $tid OR b.diag_id = $tid
                       OR b.metric_id = $tid
                    MERGE (a)-[r:`{rel_type}` {{inferred_by: 'llm', source_id: $sid, target_id: $tid}}]->(b)
                    SET r.confidence      = $confidence,
                        r.reason          = $reason,
                        r.analysis_window = $window,
                        r.created_at      = $now
                    RETURN count(r) AS created
                """, sid=source_id, tid=target_id,
                     confidence=confidence, reason=reason,
                     window=window_str, now=now)

                record = result.single()
                if record and record["created"] > 0:
                    written += 1
                    print(f"  ↳ [{rel_type}] {source_id} → {target_id} ({confidence:.2f})")
                else:
                    skipped += 1
                    print(f"  ⚠ Node not found: {source_id} → {target_id}")

            except Exception as e:
                print(f"  ✗ Failed {rel_type}: {e}")
                skipped += 1

    print(f"\n  ✓ Analysis complete: {written} edges written, {skipped} skipped")
    return written


# ─────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────

def run_analysis_pass(anchor_date: str, days_back: int = 90):
    print(f"\n  → Fetching data ({days_back} days back from {anchor_date})...")
    subgraph = fetch_analysis_window(anchor_date, days_back)

    total = (len(subgraph["lab_results"]) + len(subgraph["findings"]) +
             len(subgraph["wearable"]) + len(subgraph["diagnoses"]))

    if total < 2:
        print("  ⚠ Not enough data points yet. Ingest more data first.")
        return

    print(f"  Data found: {len(subgraph['lab_results'])} labs, "
          f"{len(subgraph['findings'])} scan findings, "
          f"{len(subgraph['wearable'])} wearable points, "
          f"{len(subgraph['diagnoses'])} diagnoses")

    print("\n  → Running LLM inference...")
    relationships = infer_relationships(subgraph)

    if not relationships:
        print("  No new relationships identified.")
        return

    print(f"  LLM found {len(relationships)} potential relationships")
    print("\n  → Writing to graph...")
    write_inferred_relationships(relationships, subgraph["window"])