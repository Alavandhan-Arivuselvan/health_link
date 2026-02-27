"""
ingest.py — Pass 1 ingestion pipeline.

Orchestrates:
  1. Read report file
  2. Fetch existing canonicals from graph (for LLM context)
  3. LLM extraction
  4. Write all nodes and edges to Neo4j
  5. Trigger Pass 2 analysis (imported separately)

Usage:
  python ingest.py --type medical --file reports/report_2025_01_15.txt --date 2025-01-15
  python ingest.py --type scan    --file scans/chest_xray_2025_01_15.txt --date 2025-01-15 --modality "Chest X-Ray" --body-part chest
  python ingest.py --type wearable --file wearables/2025_01_15.json --date 2025-01-15
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import graph_db
from extractor import extract_medical_report, extract_scan_report
from config import DATE_FORMAT


# ─────────────────────────────────────────────
# FILE READERS
# ─────────────────────────────────────────────

def read_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def read_json_file(path: str) -> dict | list:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ─────────────────────────────────────────────
# MEDICAL REPORT INGESTION
# ─────────────────────────────────────────────

def ingest_medical_report(file_path: str, date: str):
    print(f"\n{'='*50}")
    print(f"INGESTING MEDICAL REPORT: {file_path}")
    print(f"Date: {date}")
    print('='*50)

    # Step 1: Read report
    text = read_text_file(file_path)

    # Step 2: Get existing canonicals from graph (prevents name drift)
    print("\n→ Fetching existing canonicals from graph...")
    existing = graph_db.get_existing_canonicals()
    print(f"  Found: {len(existing['tests'])} tests, {len(existing['drugs'])} drugs, {len(existing['diagnoses'])} diagnoses")

    # Step 3: LLM extraction
    print("\n→ Extracting with LLM...")
    extracted = extract_medical_report(text, existing, date)

    if not extracted:
        print("✗ Extraction failed. Aborting.")
        return

    # Step 4: Ensure Visit + MedicalData container exist
    graph_db.upsert_visit(date)
    graph_db.upsert_medical_data_container(date)

    # Step 5: Upsert patient profile (updates if new info found)
    profile = extracted.get("patient_profile", {})
    if profile and any(v for v in profile.values()):
        graph_db.upsert_patient_profile(profile)

    # Step 6: Lab results
    lab_results = extracted.get("lab_results", [])
    if lab_results:
        print(f"\n→ Writing {len(lab_results)} lab results...")
        for lr in lab_results:
            # Ensure TestType canonical node exists
            graph_db.upsert_test_type(
                canonical_id=lr["canonical_id"],
                display_name=lr["display_name"],
                unit=lr.get("unit"),
                normal_range=lr.get("normal_range")
            )
            # Insert the dated LabResult + TREND_OF link
            graph_db.insert_lab_result(
                date=date,
                test_canonical_id=lr["canonical_id"],
                value=lr.get("value", ""),
                unit=lr.get("unit", ""),
                normal_range=lr.get("normal_range", ""),
                status=lr.get("status", "")
            )

    # Step 7: Prescriptions
    prescriptions = extracted.get("prescriptions", [])
    if prescriptions:
        print(f"\n→ Writing {len(prescriptions)} prescriptions...")
        for rx in prescriptions:
            graph_db.insert_prescription(
                date=date,
                drug=rx["drug"],
                dose=rx.get("dose", ""),
                frequency=rx.get("frequency", ""),
                canonical_drug_id=rx["canonical_drug_id"]
            )

    # Step 8: Diagnoses
    diagnoses = extracted.get("diagnoses", [])
    if diagnoses:
        print(f"\n→ Writing {len(diagnoses)} diagnoses...")
        for dx in diagnoses:
            graph_db.insert_diagnosis(
                date=date,
                name=dx["name"],
                canonical_id=dx["canonical_id"],
                icd_code=dx.get("icd_code")
            )

    # Step 9: Print notes
    if extracted.get("raw_notes"):
        print(f"\n⚠ Notes from extractor: {extracted['raw_notes']}")

    print(f"\n✓ Medical report ingested successfully for {date}")
    return extracted


# ─────────────────────────────────────────────
# SCAN REPORT INGESTION
# ─────────────────────────────────────────────

def ingest_scan_report(file_path: str, date: str, modality: str, body_part: str = None):
    print(f"\n{'='*50}")
    print(f"INGESTING SCAN REPORT: {file_path}")
    print(f"Date: {date} | Modality: {modality} | Body: {body_part}")
    print('='*50)

    text = read_text_file(file_path)

    print("\n→ Fetching existing canonicals...")
    existing = graph_db.get_existing_canonicals()

    print("\n→ Extracting scan findings with LLM...")
    extracted = extract_scan_report(text, existing, date, modality, body_part)

    if not extracted:
        print("✗ Scan extraction failed. Aborting.")
        return

    # Ensure Visit exists
    graph_db.upsert_visit(date)

    # Create Scan container
    scan_id = graph_db.upsert_scan_container(
        date=date,
        modality=extracted.get("modality", modality),
        body_part=extracted.get("body_part", body_part)
    )

    # Insert findings
    findings = extracted.get("findings", [])
    if findings:
        print(f"\n→ Writing {len(findings)} findings...")
        for f in findings:
            graph_db.insert_finding(
                scan_id=scan_id,
                description=f["description"],
                severity=f.get("severity"),
                canonical_id=f.get("canonical_id")
            )

    if extracted.get("raw_notes"):
        print(f"\n⚠ Notes: {extracted['raw_notes']}")

    print(f"\n✓ Scan ingested successfully for {date}")
    return extracted


# ─────────────────────────────────────────────
# WEARABLE DATA INGESTION
# ─────────────────────────────────────────────

"""
Expected wearable JSON format:
{
  "device": "Apple Watch Series 9",
  "date": "2025-01-15",
  "metrics": [
    {"metric_name": "Heart Rate", "canonical_id": "heart_rate", "value": 72, "unit": "bpm", "aggregation": "daily_avg"},
    {"metric_name": "SpO2",       "canonical_id": "spo2",       "value": 97, "unit": "%",   "aggregation": "daily_avg"},
    {"metric_name": "Steps",      "canonical_id": "steps",      "value": 8432, "unit": "steps", "aggregation": "daily_total"},
    {"metric_name": "Heart Rate", "canonical_id": "heart_rate", "value": 145, "unit": "bpm",
     "timestamp": "2025-01-15T09:32:00", "aggregation": "raw"}
  ]
}
"""

def ingest_wearable_data(file_path: str, date: str):
    print(f"\n{'='*50}")
    print(f"INGESTING WEARABLE DATA: {file_path}")
    print(f"Date: {date}")
    print('='*50)

    data = read_json_file(file_path)

    # Support both direct dict and list of daily records
    if isinstance(data, list):
        records = data
    else:
        records = [data]

    for record in records:
        record_date = record.get("date", date)
        device = record.get("device", "unknown")
        metrics = record.get("metrics", [])

        if not metrics:
            print(f"  ⚠ No metrics in record for {record_date}")
            continue

        graph_db.upsert_visit(record_date)
        graph_db.batch_insert_wearable_metrics(record_date, metrics, device)

    print(f"\n✓ Wearable data ingested.")


# ─────────────────────────────────────────────
# CLI ENTRY POINT
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Health Knowledge Graph - Pass 1 Ingestor")
    parser.add_argument("--type",      required=True,  choices=["medical", "scan", "wearable"],
                        help="Type of data to ingest")
    parser.add_argument("--file",      required=True,  help="Path to input file")
    parser.add_argument("--date",      required=False, help="Report date (YYYY-MM-DD). Defaults to today.")
    parser.add_argument("--modality",  required=False, help="Scan modality (e.g. 'Chest X-Ray', 'MRI Brain')")
    parser.add_argument("--body-part", required=False, help="Body part imaged")
    parser.add_argument("--no-analysis", action="store_true",
                        help="Skip Pass 2 analysis after ingestion")

    args = parser.parse_args()

    # Default date to today
    date = args.date or datetime.now().strftime(DATE_FORMAT)

    # Validate date format
    try:
        datetime.strptime(date, DATE_FORMAT)
    except ValueError:
        print(f"✗ Invalid date format: {date}. Use YYYY-MM-DD.")
        sys.exit(1)

    # Validate file exists
    if not Path(args.file).exists():
        print(f"✗ File not found: {args.file}")
        sys.exit(1)

    # Setup graph constraints on first run
    graph_db.setup_constraints()

    # Run appropriate ingestor
    if args.type == "medical":
        ingest_medical_report(args.file, date)

    elif args.type == "scan":
        if not args.modality:
            print("✗ --modality is required for scan ingestion (e.g. 'Chest X-Ray')")
            sys.exit(1)
        ingest_scan_report(args.file, date, args.modality, args.body_part)

    elif args.type == "wearable":
        ingest_wearable_data(args.file, date)

    # Pass 2: run analysis after ingestion (unless skipped)
    if not args.no_analysis:
        try:
            from analysis import run_analysis_pass
            print(f"\n{'='*50}")
            print("RUNNING PASS 2: ANALYSIS")
            print('='*50)
            run_analysis_pass(date)
        except ImportError:
            print("\n⚠ analysis.py not found — skipping Pass 2 (build it next)")
        except Exception as e:
            print(f"\n⚠ Pass 2 failed: {e} — ingestion data is safe in graph")

    graph_db.close()


if __name__ == "__main__":
    main()
