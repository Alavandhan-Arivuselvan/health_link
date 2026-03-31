# Health Knowledge Graph

A patient-specific health knowledge graph that ingests medical reports, scans, and wearable data into Neo4j — and grows by inferring cross-modal relationships automatically using an LLM.

---

## Architecture

```
One patient = One graph

(:PatientProfile)
    └─[:HAS_VISIT]─> (:Visit {date})
                          ├─[:HAS_MEDICAL_DATA]─> (:MedicalData)
                          │       ├─[:CONTAINS]─> (:LabResult) ─[:INSTANCE_OF]─> (:TestType)
                          │       │                    └─[:TREND_OF]─> (prev LabResult)
                          │       ├─[:CONTAINS]─> (:Prescription) ─[:INSTANCE_OF]─> (:DrugType)
                          │       │                    └─[:CONTINUES_FROM]─> (prev Prescription)
                          │       └─[:CONTAINS]─> (:Diagnosis) ─[:INSTANCE_OF]─> (:DiagnosisType)
                          │
                          ├─[:HAS_SCAN]─> (:Scan {modality, body_part})
                          │       └─[:CONTAINS]─> (:Finding)
                          │
                          └─[:HAS_WEARABLE_LOG]─> (:WearableLog)
                                  └─[:CONTAINS]─> (:Metric) ─[:INSTANCE_OF]─> (:MetricType)
```

**Canonical type nodes** (TestType, DrugType, DiagnosisType, MetricType) float independently and are shared across all visits. This is what enables time-series trend chains.

**Inferred edges** (written by Pass 2) are tagged `inferred_by: 'llm'` and are never confused with raw factual data.

---

## Two-Pass Design

### Pass 1 — Ingest
Triggered every time new data arrives.
- Reads raw file (text report or JSON)
- Fetches existing canonical names from graph → feeds to LLM to prevent name drift
- LLM extracts structured data with normalization
- Writes typed nodes to Neo4j
- Automatically creates `TREND_OF` and `CONTINUES_FROM` temporal chain links

### Pass 2 — Analysis
Runs automatically after every ingest (or manually).
- Queries a 90-day window of the graph
- Sends structured summary to LLM
- LLM identifies: correlations, anomalies, cross-modal links, treatment responses
- Writes semantic edges back to graph with confidence scores and reasons

---

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Copy and fill in your credentials
cp .env.example .env
```

Neo4j: Use [Neo4j Desktop](https://neo4j.com/download/) or [AuraDB free tier](https://neo4j.com/cloud/platform/aura-graph-database/).

---

## Usage

### Ingest a medical report
```bash
python ingest.py --type medical --file sample_data/report_2025_01_15.txt --date 2025-01-15
```

### Ingest a scan report
```bash
python ingest.py --type scan --file sample_data/chest_xray_2025_01_15.txt --date 2025-01-15 --modality "Chest X-Ray" --body-part chest
```

### Ingest wearable data
```bash
python ingest.py --type wearable --file sample_data/wearable_2025_01_15.json --date 2025-01-15
```

### Run analysis only (no new data)
```bash
python analysis.py --date 2025-01-15 --days-back 90
```

### Ingest without triggering Pass 2
```bash
python ingest.py --type medical --file report.txt --date 2025-01-15 --no-analysis
```

---

## Wearable JSON Format

```json
{
  "device": "Apple Watch Series 9",
  "date": "2025-01-15",
  "metrics": [
    {"metric_name": "Heart Rate",  "canonical_id": "heart_rate",  "value": 88,   "unit": "bpm",   "aggregation": "daily_avg"},
    {"metric_name": "SpO2",        "canonical_id": "spo2",        "value": 97,   "unit": "%",     "aggregation": "daily_avg"},
    {"metric_name": "Steps",       "canonical_id": "steps",       "value": 8432, "unit": "steps", "aggregation": "daily_total"},
    {"metric_name": "Heart Rate",  "canonical_id": "heart_rate",  "value": 145,  "unit": "bpm",
     "timestamp": "2025-01-15T09:32:00", "aggregation": "raw"}
  ]
}
```

Supported aggregation types: `raw`, `daily_avg`, `daily_min`, `daily_max`, `daily_total`

---

## File Structure

```
healthgraph/
├── config.py          # Environment config
├── graph_db.py        # All Neo4j operations
├── extractor.py       # LLM extraction (Pass 1)
├── ingest.py          # Ingest pipeline orchestrator
├── analysis.py        # Semantic inference (Pass 2)
├── requirements.txt
├── .env.example
└── sample_data/
    ├── report_2025_01_15.txt
    ├── chest_xray_2025_01_15.txt
    └── wearable_2025_01_15.json
```

---

## Key Design Decisions

**Why canonical type nodes?**
`TestType` nodes (e.g. HbA1c) are shared across all visits. Every `LabResult` links to its type via `INSTANCE_OF`. This means a single Cypher query can walk the full HbA1c history across years.

**Why TREND_OF chains?**
Each new LabResult automatically links to the previous one for the same test. This creates a linked list through time that the LLM can easily summarize as a trend.

**Why tag inferred edges?**
`inferred_by: 'llm'` on all Pass 2 edges means you can always distinguish facts from insights. You can also re-run analysis with a different model and compare, or delete stale inferences without touching raw data.

**Why feed canonicals back into LLM?**
Before each extraction, the existing TestType/DrugType/DiagnosisType names are fetched and embedded in the prompt. This is the primary guard against "HbA1c" vs "Glycated Hemoglobin" becoming two different nodes.
