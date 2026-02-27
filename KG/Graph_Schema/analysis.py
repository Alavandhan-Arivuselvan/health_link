"""
analysis.py — Pass 2: Semantic relationship inference.

Runs AFTER ingestion. Queries a window of the patient's graph,
sends it to the LLM, and writes back inferred cross-modal
semantic edges like CORRELATED_WITH, MAY_INDICATE, ANOMALY_DETECTED.

All inferred edges are tagged with:
  - inferred_by: "llm"
  - confidence: 0.0 - 1.0
  - created_at: ISO timestamp
  - analysis_window: date range used

This clearly separates raw facts (written by ingest.py) from
derived insights (written by analysis.py).
"""

import json
import re
from datetime import datetime, timedelta

import google.generativeai as genai
from neo4j import GraphDatabase

from config import GEMINI_API_KEY, GEMINI_MODEL, NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(GEMINI_MODEL)
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


# ─────────────────────────────────────────────
# GRAPH QUERY: BUILD SUBGRAPH SUMMARY
# ─────────────────────────────────────────────

def fetch_analysis_window(anchor_date: str, days_back: int = 90) -> dict:
    """
    Fetches all patient data within the last N days of anchor_date.
    Returns a structured summary dict that gets passed to the LLM.
    """
    from datetime import datetime
    anchor = datetime.strptime(anchor_date, "%Y-%m-%d")
    start_date = (anchor - timedelta(days=days_back)).strftime("%Y-%m-%d")

    with driver.session() as session:

        # Lab results in window
        lab_results = session.run("""
            MATCH (l:LabResult)
            WHERE l.date >= $start AND l.date <= $anchor
            MATCH (l)-[:INSTANCE_OF]->(t:TestType)
            OPTIONAL MATCH (l)-[:TREND_OF]->(prev:LabResult)
            RETURN t.display_name AS test,
                   l.value AS value,
                   l.unit AS unit,
                   l.status AS status,
                   l.date AS date,
                   l.result_id AS id,
                   prev.value AS prev_value,
                   prev.date AS prev_date
            ORDER BY l.date DESC
        """, start=start_date, anchor=anchor_date).data()

        # Diagnoses in window
        diagnoses = session.run("""
            MATCH (d:Diagnosis)
            WHERE d.date >= $start AND d.date <= $anchor
            RETURN d.name AS name, d.icd_code AS icd, d.date AS date, d.diag_id AS id
            ORDER BY d.date DESC
        """, start=start_date, anchor=anchor_date).data()

        # Prescriptions in window
        prescriptions = session.run("""
            MATCH (rx:Prescription)
            WHERE rx.date >= $start AND rx.date <= $anchor
            RETURN rx.drug AS drug, rx.dose AS dose,
                   rx.frequency AS frequency, rx.date AS date, rx.rx_id AS id
            ORDER BY rx.date DESC
        """, start=start_date, anchor=anchor_date).data()

        # Scan findings in window
        findings = session.run("""
            MATCH (s:Scan)-[:CONTAINS]->(f:Finding)
            WHERE s.date >= $start AND s.date <= $anchor
            RETURN s.modality AS modality, s.body_part AS body_part,
                   f.description AS description, f.severity AS severity,
                   s.date AS date, f.finding_id AS id
            ORDER BY s.date DESC
        """, start=start_date, anchor=anchor_date).data()

        # Wearable metrics in window (daily aggregates only to keep context manageable)
        wearable = session.run("""
            MATCH (w:WearableLog)-[:CONTAINS]->(m:Metric)
            WHERE m.date >= $start AND m.date <= $anchor
              AND m.aggregation IN ['daily_avg', 'daily_total', 'daily_min', 'daily_max', 'raw']
            MATCH (m)-[:INSTANCE_OF]->(mt:MetricType)
            RETURN mt.display_name AS metric, m.value AS value,
                   m.unit AS unit, m.date AS date,
                   m.aggregation AS aggregation, m.metric_id AS id
            ORDER BY m.date DESC
            LIMIT 500
        """, start=start_date, anchor=anchor_date).data()

        # Existing inferred edges (to avoid re-inferring same things)
        existing_inferred = session.run("""
            MATCH (a)-[r]->(b)
            WHERE r.inferred_by = 'llm'
            RETURN type(r) AS rel_type,
                   a.result_id AS source_id, b.result_id AS target_id,
                   r.confidence AS confidence,
                   r.created_at AS created_at
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
    """
    Sends the subgraph summary to LLM and asks it to identify
    meaningful cross-modal and temporal relationships.

    Returns a list of relationship dicts ready for graph insertion.
    """

    prompt = f"""
You are a clinical data analyst working on a patient health knowledge graph.
Your job is to identify meaningful relationships between data points that a doctor would find clinically significant.

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

ALREADY INFERRED EDGES (do NOT re-create these):
{json.dumps(subgraph['existing_inferred_edges'], indent=2)}

━━━ YOUR TASK ━━━
Identify new clinically meaningful relationships between these data points.
Focus on:
1. CORRELATIONS — Two values that are unusually high/low at the same time (e.g. high HbA1c + high resting heart rate)
2. ANOMALIES — A value significantly outside normal range that deserves flagging
3. PROGRESSION — A value worsening or improving over time (beyond the TREND_OF chain)
4. CROSS-MODAL LINKS — Wearable data pattern that corresponds to a lab finding or scan finding
5. TREATMENT RESPONSE — A prescription that may explain a change in lab values or symptoms

━━━ RULES ━━━
- Only create relationships that have real clinical significance. Don't manufacture weak links.
- Confidence score: 0.0-1.0. Use < 0.5 only for speculative but potentially useful links.
- source_id and target_id must EXACTLY match the id values (result_id, rx_id, finding_id, diag_id, metric_id) from the data above.
- relation_type: UPPER_SNAKE_CASE. You can invent new types — they don't need to match a fixed list.
  Suggested types: CORRELATED_WITH, MAY_INDICATE, ANOMALY_DETECTED, TREATMENT_RESPONSE,
  WORSENING_TREND, IMPROVING_TREND, CROSS_MODAL_CORRELATION, REQUIRES_ATTENTION
- reason: 1-2 sentence clinical explanation a doctor would understand.

━━━ OUTPUT FORMAT ━━━
Return ONLY a valid JSON array. No markdown. No explanation.

[
  {{
    "source_id": "hba1c_2025-01-15",
    "target_id": "heart_rate_2025-01-15",
    "relation_type": "CORRELATED_WITH",
    "confidence": 0.75,
    "reason": "Elevated HbA1c (7.8%) coincides with consistently elevated resting heart rate (88 bpm avg) over the same period, consistent with autonomic dysfunction in poorly controlled diabetes.",
    "direction": "source_to_target"
  }}
]

If no meaningful relationships exist, return an empty array: []
"""

    response = model.generate_content(prompt)
    raw = response.text.strip()
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        relationships = json.loads(raw)
        if not isinstance(relationships, list):
            return []
        return relationships
    except json.JSONDecodeError as e:
        print(f"⚠ Analysis JSON parse failed: {e}")
        print(f"Raw output:\n{raw[:800]}")
        return []


# ─────────────────────────────────────────────
# GRAPH WRITE: INFERRED EDGES
# ─────────────────────────────────────────────

def write_inferred_relationships(relationships: list, analysis_window: dict):
    """
    Writes inferred semantic edges to the graph.
    These are clearly tagged as LLM-inferred so they're never
    confused with raw factual data.
    """
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

            # Find source and target nodes by any known ID property
            try:
                result = session.run(f"""
                    MATCH (a)
                    WHERE a.result_id = $source_id OR a.rx_id = $source_id
                       OR a.finding_id = $source_id OR a.diag_id = $source_id
                       OR a.metric_id = $source_id
                    MATCH (b)
                    WHERE b.result_id = $target_id OR b.rx_id = $target_id
                       OR b.finding_id = $target_id OR b.diag_id = $target_id
                       OR b.metric_id = $target_id
                    MERGE (a)-[r:`{rel_type}` {{inferred_by: 'llm', source_id: $source_id, target_id: $target_id}}]->(b)
                    SET r.confidence       = $confidence,
                        r.reason           = $reason,
                        r.analysis_window  = $window,
                        r.created_at       = $now
                    RETURN count(r) AS created
                """, source_id=source_id, target_id=target_id,
                     confidence=confidence, reason=reason,
                     window=window_str, now=now)

                record = result.single()
                if record and record["created"] > 0:
                    written += 1
                    print(f"  ↳ [{rel_type}] {source_id} → {target_id} (confidence: {confidence:.2f})")
                else:
                    skipped += 1
                    print(f"  ⚠ Skipped (node not found): {source_id} → {target_id}")

            except Exception as e:
                print(f"  ✗ Failed to write {rel_type}: {e}")
                skipped += 1

    print(f"\n✓ Analysis complete: {written} edges written, {skipped} skipped")
    return written


# ─────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────

def run_analysis_pass(anchor_date: str, days_back: int = 90):
    """
    Full Pass 2 pipeline.
    Called by ingest.py after each ingestion, or can be run standalone.
    """
    print(f"\n→ Fetching data window ({days_back} days back from {anchor_date})...")
    subgraph = fetch_analysis_window(anchor_date, days_back)

    total_data_points = (
        len(subgraph["lab_results"]) +
        len(subgraph["findings"]) +
        len(subgraph["wearable"]) +
        len(subgraph["diagnoses"])
    )

    if total_data_points < 2:
        print("⚠ Not enough data points for meaningful analysis. Skipping.")
        return

    print(f"  Data in window: {len(subgraph['lab_results'])} labs, "
          f"{len(subgraph['findings'])} findings, "
          f"{len(subgraph['wearable'])} wearable points, "
          f"{len(subgraph['diagnoses'])} diagnoses")

    print("\n→ Running LLM relationship inference...")
    relationships = infer_relationships(subgraph)

    if not relationships:
        print("  No new relationships identified.")
        return

    print(f"  LLM identified {len(relationships)} potential relationships")
    print("\n→ Writing inferred relationships to graph...")
    write_inferred_relationships(relationships, subgraph["window"])


# ─────────────────────────────────────────────
# CLI (standalone usage)
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run Pass 2 analysis on patient graph")
    parser.add_argument("--date",      default=datetime.now().strftime("%Y-%m-%d"),
                        help="Anchor date (YYYY-MM-DD). Defaults to today.")
    parser.add_argument("--days-back", type=int, default=90,
                        help="How many days back to include in analysis window (default: 90)")
    args = parser.parse_args()

    run_analysis_pass(args.date, args.days_back)
    driver.close()
