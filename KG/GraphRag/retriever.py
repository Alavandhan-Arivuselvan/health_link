"""
retriever.py — Graph traversal layer for GraphRag.

Two modes:
  - local_retrieve(entities)  : anchors on matched entities, walks up to MAX_HOPS
  - global_retrieve()         : pulls full patient timeline + all inferred edges

All functions return plain Python dicts/lists — no Neo4j objects leak out.
"""

from neo4j import GraphDatabase
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, MAX_HOPS, MAX_CONTEXT_NODES

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


# ─────────────────────────────────────────────
# ENTITY DETECTION
# Finds canonical nodes whose names match keywords in the user query
# ─────────────────────────────────────────────

def detect_entities(query_text: str) -> dict:
    """
    Searches canonical type nodes (TestType, DrugType, DiagnosisType, MetricType)
    for names that appear in the user's query (case-insensitive).
    Returns matched entities grouped by type.
    """
    query_lower = query_text.lower()

    with driver.session() as session:
        tests = session.run("""
            MATCH (t:TestType)
            RETURN t.canonical_id AS id, t.display_name AS name, 'TestType' AS type
        """).data()

        drugs = session.run("""
            MATCH (d:DrugType)
            RETURN d.canonical_id AS id, d.display_name AS name, 'DrugType' AS type
        """).data()

        diagnoses = session.run("""
            MATCH (d:DiagnosisType)
            RETURN d.canonical_id AS id, d.display_name AS name, 'DiagnosisType' AS type
        """).data()

        metrics = session.run("""
            MATCH (m:MetricType)
            RETURN m.canonical_id AS id, m.display_name AS name, 'MetricType' AS type
        """).data()

    matched = {"tests": [], "drugs": [], "diagnoses": [], "metrics": []}

    for t in tests:
        if t["name"] and t["name"].lower() in query_lower:
            matched["tests"].append(t)

    for d in drugs:
        if d["name"] and d["name"].lower() in query_lower:
            matched["drugs"].append(d)

    for dx in diagnoses:
        if dx["name"] and dx["name"].lower() in query_lower:
            matched["diagnoses"].append(dx)

    for m in metrics:
        if m["name"] and m["name"].lower() in query_lower:
            matched["metrics"].append(m)

    return matched


# ─────────────────────────────────────────────
# DATE RANGE DETECTION
# Extracts date filters from query if user mentions a time window
# ─────────────────────────────────────────────

def detect_date_range(query_text: str) -> dict:
    """
    Detects date range hints from natural language.
    Returns {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"} or {} if none found.
    """
    import re
    from datetime import datetime, timedelta

    today = datetime.now()
    query_lower = query_text.lower()

    # Explicit YYYY-MM-DD dates
    dates = re.findall(r'\d{4}-\d{2}-\d{2}', query_text)
    if len(dates) >= 2:
        return {"start": min(dates), "end": max(dates)}
    if len(dates) == 1:
        return {"start": dates[0], "end": today.strftime("%Y-%m-%d")}

    # Natural language windows
    windows = {
        "last week":    7,
        "past week":    7,
        "last month":   30,
        "past month":   30,
        "last 3 months": 90,
        "last three months": 90,
        "last 6 months": 180,
        "last six months": 180,
        "last year":    365,
        "past year":    365,
        "this year":    (today - today.replace(month=1, day=1)).days,
    }

    for phrase, days in windows.items():
        if phrase in query_lower:
            start = (today - timedelta(days=days)).strftime("%Y-%m-%d")
            return {"start": start, "end": today.strftime("%Y-%m-%d")}

    return {}


# ─────────────────────────────────────────────
# LOCAL RETRIEVAL
# Anchors on matched entities, walks outward up to MAX_HOPS
# ─────────────────────────────────────────────

def local_retrieve(entities: dict, date_range: dict = None) -> dict:
    """
    For each matched entity type, retrieves:
    - All instances (LabResult, Prescription, Diagnosis, Metric) linked to that canonical
    - Their TREND_OF chains (full history)
    - Inferred edges touching any of these nodes
    - The Visit context for each instance
    """
    date_filter_start = date_range.get("start", "1900-01-01") if date_range else "1900-01-01"
    date_filter_end   = date_range.get("end",   "2999-12-31") if date_range else "2999-12-31"

    results = {
        "lab_trends":     [],
        "prescriptions":  [],
        "diagnoses":      [],
        "metric_trends":  [],
        "scan_findings":  [],
        "inferred_edges": [],
        "visits":         [],
    }

    with driver.session() as session:

        # ── Lab results + TREND_OF chain ──────────────────────────
        for test in entities.get("tests", []):
            rows = session.run("""
                MATCH (t:TestType {canonical_id: $cid})
                MATCH (l:LabResult)-[:INSTANCE_OF]->(t)
                WHERE l.date >= $start AND l.date <= $end
                OPTIONAL MATCH (l)-[:TREND_OF*1..5]->(prev:LabResult)
                RETURN t.display_name AS test_name,
                       l.result_id AS id, l.date AS date,
                       l.value AS value, l.unit AS unit,
                       l.status AS status, l.normal_range AS normal_range,
                       collect({date: prev.date, value: prev.value,
                                unit: prev.unit, status: prev.status}) AS history
                ORDER BY l.date DESC
                LIMIT $limit
            """, cid=test["id"], start=date_filter_start,
                 end=date_filter_end, limit=MAX_CONTEXT_NODES).data()
            results["lab_trends"].extend(rows)

        # ── Prescriptions ─────────────────────────────────────────
        for drug in entities.get("drugs", []):
            rows = session.run("""
                MATCH (d:DrugType {canonical_id: $cid})
                MATCH (rx:Prescription)-[:INSTANCE_OF]->(d)
                WHERE rx.date >= $start AND rx.date <= $end
                OPTIONAL MATCH (rx)-[:CONTINUES_FROM*1..5]->(prev:Prescription)
                RETURN d.display_name AS drug_name,
                       rx.rx_id AS id, rx.date AS date,
                       rx.dose AS dose, rx.frequency AS frequency,
                       collect({date: prev.date, dose: prev.dose,
                                frequency: prev.frequency}) AS history
                ORDER BY rx.date DESC
                LIMIT $limit
            """, cid=drug["id"], start=date_filter_start,
                 end=date_filter_end, limit=MAX_CONTEXT_NODES).data()
            results["prescriptions"].extend(rows)

        # ── Diagnoses ─────────────────────────────────────────────
        for dx in entities.get("diagnoses", []):
            rows = session.run("""
                MATCH (dt:DiagnosisType {canonical_id: $cid})
                MATCH (dg:Diagnosis)-[:INSTANCE_OF]->(dt)
                WHERE dg.date >= $start AND dg.date <= $end
                RETURN dt.display_name AS diagnosis_name,
                       dg.diag_id AS id, dg.date AS date,
                       dg.icd_code AS icd_code
                ORDER BY dg.date DESC
                LIMIT $limit
            """, cid=dx["id"], start=date_filter_start,
                 end=date_filter_end, limit=MAX_CONTEXT_NODES).data()
            results["diagnoses"].extend(rows)

        # ── Wearable metrics + TREND_OF chain ────────────────────
        for metric in entities.get("metrics", []):
            rows = session.run("""
                MATCH (mt:MetricType {canonical_id: $cid})
                MATCH (m:Metric)-[:INSTANCE_OF]->(mt)
                WHERE m.date >= $start AND m.date <= $end
                  AND m.aggregation IN ['daily_avg', 'daily_total', 'raw']
                OPTIONAL MATCH (m)-[:TREND_OF*1..5]->(prev:Metric)
                RETURN mt.display_name AS metric_name,
                       m.metric_id AS id, m.date AS date,
                       m.value AS value, m.unit AS unit,
                       m.aggregation AS aggregation,
                       collect({date: prev.date, value: prev.value}) AS history
                ORDER BY m.date DESC
                LIMIT $limit
            """, cid=metric["id"], start=date_filter_start,
                 end=date_filter_end, limit=MAX_CONTEXT_NODES).data()
            results["metric_trends"].extend(rows)

        # ── Inferred edges touching any retrieved node IDs ────────
        all_ids = (
            [r["id"] for r in results["lab_trends"]] +
            [r["id"] for r in results["prescriptions"]] +
            [r["id"] for r in results["diagnoses"]] +
            [r["id"] for r in results["metric_trends"]]
        )

        if all_ids:
            inferred = session.run("""
                MATCH (a)-[r]->(b)
                WHERE r.inferred_by = 'llm'
                  AND (r.source_id IN $ids OR r.target_id IN $ids)
                RETURN type(r) AS relation_type,
                       r.source_id AS source_id,
                       r.target_id AS target_id,
                       r.confidence AS confidence,
                       r.reason AS reason
                ORDER BY r.confidence DESC
                LIMIT 50
            """, ids=all_ids).data()
            results["inferred_edges"].extend(inferred)

    return results


# ─────────────────────────────────────────────
# GLOBAL RETRIEVAL
# Full patient timeline — all data types + all inferred edges
# ─────────────────────────────────────────────

def global_retrieve(date_range: dict = None) -> dict:
    """
    Pulls the entire patient graph:
    - Patient profile
    - All visits with their lab results, prescriptions, diagnoses
    - All scan findings
    - Wearable daily summaries (aggregated, not raw minute-level)
    - All LLM-inferred edges
    """
    date_filter_start = date_range.get("start", "1900-01-01") if date_range else "1900-01-01"
    date_filter_end   = date_range.get("end",   "2999-12-31") if date_range else "2999-12-31"

    with driver.session() as session:

        # Patient profile
        profile = session.run("""
            MATCH (p:PatientProfile {id: 'patient'})
            RETURN p.name AS name, p.dob AS dob, p.sex AS sex,
                   p.blood_group AS blood_group,
                   p.chronic_conditions AS chronic_conditions
        """).data()

        # All visits in range
        visits = session.run("""
            MATCH (v:Visit)
            WHERE v.date >= $start AND v.date <= $end
            RETURN v.date AS date
            ORDER BY v.date ASC
        """, start=date_filter_start, end=date_filter_end).data()

        # All lab results
        labs = session.run("""
            MATCH (l:LabResult)-[:INSTANCE_OF]->(t:TestType)
            WHERE l.date >= $start AND l.date <= $end
            RETURN t.display_name AS test, l.date AS date,
                   l.value AS value, l.unit AS unit,
                   l.status AS status, l.normal_range AS normal_range,
                   l.result_id AS id
            ORDER BY l.date ASC
        """, start=date_filter_start, end=date_filter_end).data()

        # All prescriptions
        prescriptions = session.run("""
            MATCH (rx:Prescription)-[:INSTANCE_OF]->(d:DrugType)
            WHERE rx.date >= $start AND rx.date <= $end
            RETURN d.display_name AS drug, rx.date AS date,
                   rx.dose AS dose, rx.frequency AS frequency,
                   rx.rx_id AS id
            ORDER BY rx.date ASC
        """, start=date_filter_start, end=date_filter_end).data()

        # All diagnoses
        diagnoses = session.run("""
            MATCH (dg:Diagnosis)-[:INSTANCE_OF]->(dt:DiagnosisType)
            WHERE dg.date >= $start AND dg.date <= $end
            RETURN dt.display_name AS diagnosis, dg.date AS date,
                   dg.icd_code AS icd_code, dg.diag_id AS id
            ORDER BY dg.date ASC
        """, start=date_filter_start, end=date_filter_end).data()

        # All scan findings
        findings = session.run("""
            MATCH (s:Scan)-[:CONTAINS]->(f:Finding)
            WHERE s.date >= $start AND s.date <= $end
            RETURN s.modality AS modality, s.body_part AS body_part,
                   s.date AS date, f.description AS description,
                   f.severity AS severity, f.finding_id AS id
            ORDER BY s.date ASC
        """, start=date_filter_start, end=date_filter_end).data()

        # Wearable — daily aggregates only (no raw minute-level)
        wearable = session.run("""
            MATCH (m:Metric)-[:INSTANCE_OF]->(mt:MetricType)
            WHERE m.date >= $start AND m.date <= $end
              AND m.aggregation IN ['daily_avg', 'daily_total']
            RETURN mt.display_name AS metric, m.date AS date,
                   m.value AS value, m.unit AS unit,
                   m.aggregation AS aggregation, m.metric_id AS id
            ORDER BY m.date ASC
        """, start=date_filter_start, end=date_filter_end).data()

        # All LLM-inferred edges
        inferred = session.run("""
            MATCH (a)-[r]->(b)
            WHERE r.inferred_by = 'llm'
            RETURN type(r) AS relation_type,
                   r.source_id AS source_id,
                   r.target_id AS target_id,
                   r.confidence AS confidence,
                   r.reason AS reason
            ORDER BY r.confidence DESC
            LIMIT 100
        """).data()

        # TREND_OF chains — summarise deltas for key tests
        trends = session.run("""
            MATCH (new:LabResult)-[:TREND_OF]->(old:LabResult)
            MATCH (new)-[:INSTANCE_OF]->(t:TestType)
            WHERE new.date >= $start AND new.date <= $end
            RETURN t.display_name AS test,
                   old.date AS from_date, old.value AS from_value,
                   new.date AS to_date,   new.value AS to_value,
                   new.unit AS unit,      new.status AS status
            ORDER BY t.display_name, new.date ASC
        """, start=date_filter_start, end=date_filter_end).data()

    return {
        "patient_profile": profile[0] if profile else {},
        "visits":          visits,
        "lab_results":     labs,
        "prescriptions":   prescriptions,
        "diagnoses":       diagnoses,
        "scan_findings":   findings,
        "wearable":        wearable,
        "inferred_edges":  inferred,
        "lab_trends":      trends,
    }


# ─────────────────────────────────────────────
# UTILITY
# ─────────────────────────────────────────────

def get_graph_summary() -> dict:
    """Quick stats — used by query engine to decide if graph has enough data."""
    with driver.session() as session:
        # Use independent subqueries so a missing label doesn't zero out everything
        counts = session.run("""
            CALL {
                MATCH (v:Visit) RETURN count(v) AS visits
            }
            CALL {
                MATCH (l:LabResult) RETURN count(l) AS labs
            }
            CALL {
                MATCH (s:Scan) RETURN count(s) AS scans
            }
            CALL {
                MATCH (m:Metric) RETURN count(m) AS metrics
            }
            RETURN visits, labs, scans, metrics
        """).single()

        date_span = session.run("""
            MATCH (v:Visit)
            RETURN min(v.date) AS earliest, max(v.date) AS latest
        """).single()

    return {
        "visits":   counts["visits"]  if counts else 0,
        "labs":     counts["labs"]    if counts else 0,
        "scans":    counts["scans"]   if counts else 0,
        "metrics":  counts["metrics"] if counts else 0,
        "earliest": date_span["earliest"] if date_span else None,
        "latest":   date_span["latest"]   if date_span else None,
    }


def close():
    driver.close()