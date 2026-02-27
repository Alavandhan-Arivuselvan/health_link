"""
graph_db.py — All Neo4j interactions for the health knowledge graph.

Node labels used:
  - PatientProfile   : single node, created once
  - Visit            : one per date
  - MedicalData      : container for lab/prescription/diagnosis on a visit
  - Scan             : container for imaging on a visit
  - WearableLog      : container for wearable metrics on a visit
  - LabResult        : individual test observation
  - Prescription     : individual drug record
  - Diagnosis        : clinical diagnosis
  - Finding          : imaging finding inside a Scan
  - Metric           : individual wearable data point
  - TestType         : canonical test name node (e.g. "HbA1c") — shared across time
"""

from neo4j import GraphDatabase
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
from datetime import datetime


driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


# ─────────────────────────────────────────────
# CONSTRAINTS & INDEXES (run once on setup)
# ─────────────────────────────────────────────

def setup_constraints():
    """Create uniqueness constraints and indexes. Safe to run multiple times."""
    queries = [
        "CREATE CONSTRAINT IF NOT EXISTS FOR (p:PatientProfile) REQUIRE p.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (v:Visit) REQUIRE v.date IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (t:TestType) REQUIRE t.canonical_id IS UNIQUE",
        "CREATE INDEX IF NOT EXISTS FOR (l:LabResult) ON (l.date)",
        "CREATE INDEX IF NOT EXISTS FOR (m:Metric) ON (m.date)",
    ]
    with driver.session() as session:
        for q in queries:
            session.run(q)
    print("✓ Constraints and indexes ready.")


# ─────────────────────────────────────────────
# PATIENT PROFILE
# ─────────────────────────────────────────────

def upsert_patient_profile(profile: dict):
    """
    Create or update the single PatientProfile node.
    profile keys: name, dob, sex, blood_group, chronic_conditions (list)
    """
    with driver.session() as session:
        session.run("""
            MERGE (p:PatientProfile {id: 'patient'})
            SET p.name             = $name,
                p.dob              = $dob,
                p.sex              = $sex,
                p.blood_group      = $blood_group,
                p.chronic_conditions = $chronic_conditions,
                p.updated_at       = $now
        """,
            name=profile.get("name", "Unknown"),
            dob=profile.get("dob"),
            sex=profile.get("sex"),
            blood_group=profile.get("blood_group"),
            chronic_conditions=profile.get("chronic_conditions", []),
            now=datetime.now().isoformat()
        )
    print(f"✓ PatientProfile upserted: {profile.get('name')}")


def get_patient_profile() -> dict:
    with driver.session() as session:
        result = session.run("MATCH (p:PatientProfile {id: 'patient'}) RETURN p").single()
        if result:
            return dict(result["p"])
        return {}


# ─────────────────────────────────────────────
# VISIT
# ─────────────────────────────────────────────

def upsert_visit(date: str) -> str:
    """
    Ensure a Visit node exists for the given date.
    Links it to PatientProfile.
    Returns the date (used as visit identifier).
    """
    with driver.session() as session:
        session.run("""
            MERGE (p:PatientProfile {id: 'patient'})
            MERGE (v:Visit {date: $date})
            MERGE (p)-[:HAS_VISIT]->(v)
        """, date=date)
    return date


# ─────────────────────────────────────────────
# DATA CONTAINERS (MedicalData, Scan, WearableLog)
# ─────────────────────────────────────────────

def upsert_medical_data_container(date: str):
    with driver.session() as session:
        session.run("""
            MERGE (v:Visit {date: $date})
            MERGE (m:MedicalData {date: $date})
            MERGE (v)-[:HAS_MEDICAL_DATA]->(m)
        """, date=date)


def upsert_scan_container(date: str, modality: str, body_part: str = None):
    """One Scan node per (date, modality). Multiple scans on same day = multiple nodes."""
    scan_id = f"{date}_{modality.lower().replace(' ', '_')}"
    with driver.session() as session:
        session.run("""
            MERGE (v:Visit {date: $date})
            MERGE (s:Scan {scan_id: $scan_id})
            SET s.date      = $date,
                s.modality  = $modality,
                s.body_part = $body_part
            MERGE (v)-[:HAS_SCAN]->(s)
        """, date=date, scan_id=scan_id, modality=modality, body_part=body_part)
    return scan_id


def upsert_wearable_container(date: str, device: str = "unknown"):
    with driver.session() as session:
        session.run("""
            MERGE (v:Visit {date: $date})
            MERGE (w:WearableLog {date: $date})
            SET w.device = $device
            MERGE (v)-[:HAS_WEARABLE_LOG]->(w)
        """, date=date, device=device)


# ─────────────────────────────────────────────
# CANONICAL TEST TYPE NODE
# ─────────────────────────────────────────────

def upsert_test_type(canonical_id: str, display_name: str, unit: str = None, normal_range: str = None):
    """
    TestType is a shared node representing the *concept* of a test (e.g. HbA1c).
    All LabResult nodes for this test link to it.
    This is what enables trend chains across time.
    """
    with driver.session() as session:
        session.run("""
            MERGE (t:TestType {canonical_id: $canonical_id})
            SET t.display_name  = $display_name,
                t.unit          = coalesce($unit, t.unit),
                t.normal_range  = coalesce($normal_range, t.normal_range)
        """, canonical_id=canonical_id, display_name=display_name,
             unit=unit, normal_range=normal_range)


def get_existing_test_types() -> list:
    """Returns list of canonical_id values already in graph. Used to feed back into LLM prompt."""
    with driver.session() as session:
        result = session.run("MATCH (t:TestType) RETURN t.canonical_id AS id, t.display_name AS name")
        return [{"id": r["id"], "name": r["name"]} for r in result]


# ─────────────────────────────────────────────
# LAB RESULTS (with TREND_OF linking)
# ─────────────────────────────────────────────

def insert_lab_result(date: str, test_canonical_id: str, value: str,
                       unit: str, normal_range: str, status: str):
    """
    Insert a LabResult node, link it to:
      - MedicalData container (for this visit)
      - TestType node (canonical concept)
      - Previous LabResult for same test via TREND_OF
    """
    result_id = f"{test_canonical_id}_{date}"

    with driver.session() as session:
        # Create LabResult and link to MedicalData + TestType
        session.run("""
            MERGE (l:LabResult {result_id: $result_id})
            SET l.date          = $date,
                l.value         = $value,
                l.unit          = $unit,
                l.normal_range  = $normal_range,
                l.status        = $status,
                l.test_id       = $test_canonical_id

            WITH l
            MATCH (m:MedicalData {date: $date})
            MERGE (m)-[:CONTAINS]->(l)

            WITH l
            MATCH (t:TestType {canonical_id: $test_canonical_id})
            MERGE (l)-[:INSTANCE_OF]->(t)
        """, result_id=result_id, date=date, value=value, unit=unit,
             normal_range=normal_range, status=status, test_canonical_id=test_canonical_id)

        # Find the most recent previous LabResult for same test and link TREND_OF
        session.run("""
            MATCH (current:LabResult {result_id: $result_id})
            MATCH (prev:LabResult {test_id: $test_canonical_id})
            WHERE prev.date < $date AND prev.result_id <> $result_id
            WITH current, prev ORDER BY prev.date DESC LIMIT 1
            MERGE (current)-[:TREND_OF]->(prev)
        """, result_id=result_id, date=date, test_canonical_id=test_canonical_id)

    print(f"  ↳ LabResult: {test_canonical_id} = {value} {unit} ({status}) on {date}")


# ─────────────────────────────────────────────
# PRESCRIPTIONS
# ─────────────────────────────────────────────

def insert_prescription(date: str, drug: str, dose: str, frequency: str, canonical_drug_id: str):
    """
    Insert a Prescription node linked to MedicalData.
    Also links to a canonical DrugType node for cross-time tracking.
    """
    rx_id = f"{canonical_drug_id}_{date}"
    with driver.session() as session:
        session.run("""
            MERGE (d:DrugType {canonical_id: $canonical_drug_id})
            SET d.display_name = $drug

            MERGE (rx:Prescription {rx_id: $rx_id})
            SET rx.date       = $date,
                rx.drug       = $drug,
                rx.dose       = $dose,
                rx.frequency  = $frequency,
                rx.drug_id    = $canonical_drug_id

            WITH rx, d
            MERGE (rx)-[:INSTANCE_OF]->(d)

            WITH rx
            MATCH (m:MedicalData {date: $date})
            MERGE (m)-[:CONTAINS]->(rx)

            WITH rx
            MATCH (prev:Prescription {drug_id: $canonical_drug_id})
            WHERE prev.date < $date AND prev.rx_id <> $rx_id
            WITH rx, prev ORDER BY prev.date DESC LIMIT 1
            MERGE (rx)-[:CONTINUES_FROM]->(prev)
        """, rx_id=rx_id, date=date, drug=drug, dose=dose,
             frequency=frequency, canonical_drug_id=canonical_drug_id)

    print(f"  ↳ Prescription: {drug} {dose} {frequency} on {date}")


# ─────────────────────────────────────────────
# DIAGNOSES
# ─────────────────────────────────────────────

def insert_diagnosis(date: str, name: str, canonical_id: str, icd_code: str = None):
    diag_id = f"{canonical_id}_{date}"
    with driver.session() as session:
        session.run("""
            MERGE (dt:DiagnosisType {canonical_id: $canonical_id})
            SET dt.display_name = $name,
                dt.icd_code     = coalesce($icd_code, dt.icd_code)

            MERGE (dg:Diagnosis {diag_id: $diag_id})
            SET dg.date         = $date,
                dg.name         = $name,
                dg.icd_code     = $icd_code,
                dg.diagnosis_id = $canonical_id

            WITH dg, dt
            MERGE (dg)-[:INSTANCE_OF]->(dt)

            WITH dg
            MATCH (m:MedicalData {date: $date})
            MERGE (m)-[:CONTAINS]->(dg)
        """, canonical_id=canonical_id, name=name, icd_code=icd_code,
             diag_id=diag_id, date=date)

    print(f"  ↳ Diagnosis: {name} on {date}")


# ─────────────────────────────────────────────
# SCAN FINDINGS
# ─────────────────────────────────────────────

def insert_finding(scan_id: str, description: str, severity: str = None, canonical_id: str = None):
    finding_id = f"{scan_id}_{canonical_id or description[:20].replace(' ','_')}"
    with driver.session() as session:
        session.run("""
            MERGE (f:Finding {finding_id: $finding_id})
            SET f.description = $description,
                f.severity    = $severity,
                f.canonical_id = $canonical_id

            WITH f
            MATCH (s:Scan {scan_id: $scan_id})
            MERGE (s)-[:CONTAINS]->(f)
        """, finding_id=finding_id, description=description,
             severity=severity, canonical_id=canonical_id, scan_id=scan_id)

    print(f"  ↳ Finding in {scan_id}: {description}")


# ─────────────────────────────────────────────
# WEARABLE METRICS
# ─────────────────────────────────────────────

def insert_wearable_metric(date: str, metric_name: str, canonical_id: str,
                            value: float, unit: str, timestamp: str = None,
                            aggregation: str = "raw"):
    """
    aggregation: raw | daily_avg | daily_min | daily_max
    timestamp: ISO string for raw data, or None for daily aggregates
    """
    metric_id = f"{canonical_id}_{timestamp or date}"

    with driver.session() as session:
        # Create MetricType, Metric, and link to WearableLog container
        session.run("""
            MERGE (mt:MetricType {canonical_id: $canonical_id})
            SET mt.display_name = $metric_name, mt.unit = $unit

            MERGE (m:Metric {metric_id: $metric_id})
            SET m.date        = $date,
                m.timestamp   = $timestamp,
                m.value       = $value,
                m.unit        = $unit,
                m.metric_id   = $canonical_id,
                m.aggregation = $aggregation

            WITH m, mt
            MERGE (m)-[:INSTANCE_OF]->(mt)

            WITH m
            MATCH (w:WearableLog {date: $date})
            MERGE (w)-[:CONTAINS]->(m)
        """, metric_id=metric_id, date=date, timestamp=timestamp, value=value,
             unit=unit, canonical_id=canonical_id, metric_name=metric_name,
             aggregation=aggregation)

        # Link to the most recent previous Metric for the same canonical metric type.
        # Must be a separate query — MERGE + subsequent MATCH/ORDER BY LIMIT 1
        # cannot be combined reliably in a single Cypher statement.
        session.run("""
            MATCH (current:Metric {metric_id: $metric_id})
            MATCH (prev:Metric)
            WHERE prev.metric_id = $canonical_id
              AND prev.date < $date
              AND prev.metric_id = $canonical_id
              AND prev.aggregation = $aggregation
            WITH current, prev ORDER BY prev.date DESC LIMIT 1
            MERGE (current)-[:TREND_OF]->(prev)
        """, metric_id=metric_id, date=date,
             canonical_id=canonical_id, aggregation=aggregation)


def batch_insert_wearable_metrics(date: str, metrics: list, device: str = "unknown"):
    """
    metrics: list of dicts with keys: metric_name, canonical_id, value, unit,
                                      timestamp (optional), aggregation (optional)
    """
    upsert_wearable_container(date, device)
    for m in metrics:
        insert_wearable_metric(
            date=date,
            metric_name=m["metric_name"],
            canonical_id=m["canonical_id"],
            value=m["value"],
            unit=m["unit"],
            timestamp=m.get("timestamp"),
            aggregation=m.get("aggregation", "raw")
        )
    print(f"✓ Wearable metrics inserted for {date}: {len(metrics)} metrics")


# ─────────────────────────────────────────────
# UTILITY: GET EXISTING CANONICAL NAMES
# ─────────────────────────────────────────────

def get_existing_canonicals() -> dict:
    """
    Returns all canonical nodes already in graph so LLM can match against them.
    Used in Pass 1 extraction prompt to prevent name drift.
    """
    with driver.session() as session:
        tests = session.run("MATCH (t:TestType) RETURN t.canonical_id as id, t.display_name as name").data()
        drugs = session.run("MATCH (d:DrugType) RETURN d.canonical_id as id, d.display_name as name").data()
        diagnoses = session.run("MATCH (d:DiagnosisType) RETURN d.canonical_id as id, d.display_name as name").data()
        findings = session.run("MATCH (f:Finding) RETURN DISTINCT f.canonical_id as id, f.description as name").data()

    return {
        "tests": tests,
        "drugs": drugs,
        "diagnoses": diagnoses,
        "findings": [f for f in findings if f["id"]]
    }


def close():
    driver.close()