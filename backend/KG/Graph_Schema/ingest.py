"""
ingest.py — Pass 1 ingestion pipeline.
Handles .txt and .pdf files for medical and scan reports.
"""

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

def read_file(path: str) -> str:
    """
    Read a file and return its text content.
    Handles both .txt and .pdf files automatically.
    """
    p = Path(path)

    if p.suffix.lower() == ".pdf":
        return read_pdf(path)
    else:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read().strip()
        except UnicodeDecodeError:
            with open(path, "r", encoding="latin-1") as f:
                return f.read().strip()


def read_pdf(path: str) -> str:
    """Extract text from a PDF using pymupdf (pip install pymupdf)."""
    try:
        import fitz  # pymupdf
    except ImportError:
        raise ImportError("pymupdf is not installed. Run: pip install pymupdf")

    doc = fitz.open(path)
    page_count = doc.page_count
    pages_text = [page.get_text() for page in doc]
    doc.close()

    full_text = "\n".join(pages_text).strip()

    if not full_text:
        raise ValueError(f"PDF appears to be scanned (image-only) — no text extracted from {path}")

    print(f"  ✓ PDF read: {page_count} pages, {len(full_text)} chars")
    return full_text


def read_json_file(path: str):
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

    print("\n-> Reading file...")
    text = read_file(file_path)
    if not text:
        print("✗ File is empty.")
        return

    print("\n-> Fetching existing canonicals from graph...")
    existing = graph_db.get_existing_canonicals()
    print(f"  Found: {len(existing['tests'])} tests, {len(existing['drugs'])} drugs, {len(existing['diagnoses'])} diagnoses")

    print("\n-> Extracting ...")
    extracted = extract_medical_report(text, existing, date)

    if not extracted:
        print("✗ Extraction failed.")
        return

    graph_db.upsert_visit(date)
    graph_db.upsert_medical_data_container(date)

    profile = extracted.get("patient_profile", {})
    if profile and any(v for v in profile.values() if v):
        graph_db.upsert_patient_profile(profile)

    lab_results = extracted.get("lab_results", [])
    if lab_results:
        print(f"\n-> Writing {len(lab_results)} lab results...")
        for lr in lab_results:
            graph_db.upsert_test_type(
                canonical_id=lr["canonical_id"],
                display_name=lr["display_name"],
                unit=lr.get("unit"),
                normal_range=lr.get("normal_range")
            )
            graph_db.insert_lab_result(
                date=date,
                test_canonical_id=lr["canonical_id"],
                value=lr.get("value", ""),
                unit=lr.get("unit", ""),
                normal_range=lr.get("normal_range", ""),
                status=lr.get("status", "")
            )

    prescriptions = extracted.get("prescriptions", [])
    if prescriptions:
        print(f"\n-> Writing {len(prescriptions)} prescriptions...")
        for rx in prescriptions:
            graph_db.insert_prescription(
                date=date,
                drug=rx["drug"],
                dose=rx.get("dose", ""),
                frequency=rx.get("frequency", ""),
                canonical_drug_id=rx["canonical_drug_id"]
            )

    diagnoses = extracted.get("diagnoses", [])
    if diagnoses:
        print(f"\n-> Writing {len(diagnoses)} diagnoses...")
        for dx in diagnoses:
            graph_db.insert_diagnosis(
                date=date,
                name=dx["name"],
                canonical_id=dx["canonical_id"],
                icd_code=dx.get("icd_code")
            )

    if extracted.get("raw_notes"):
        print(f"\n  Notes: {extracted['raw_notes']}")

    print(f"\n✓ Medical report ingested for {date}")
    return extracted


# ─────────────────────────────────────────────
# SCAN REPORT INGESTION
# ─────────────────────────────────────────────

def ingest_scan_report(file_path: str, date: str, modality: str = None, body_part: str = None):
    print(f"\n{'='*50}")
    print(f"INGESTING SCAN on {date} (modality: {modality or 'auto-detect'})")
    print('='*50)

    print("\n-> Reading file...")
    text = read_file(file_path)

    print("\n-> Fetching existing canonicals...")
    existing = graph_db.get_existing_canonicals()

    print("\n-> Extracting ...")
    extracted = extract_scan_report(text, existing, date, modality, body_part)

    if not extracted:
        print("✗ Extraction failed.")
        return

    graph_db.upsert_visit(date)
    scan_id = graph_db.upsert_scan_container(
        date=date,
        modality=extracted.get("modality", modality),
        body_part=extracted.get("body_part", body_part)
    )

    findings = extracted.get("findings", [])
    if findings:
        print(f"\n-> Writing {len(findings)} findings...")
        for f in findings:
            graph_db.insert_finding(
                scan_id=scan_id,
                description=f["description"],
                severity=f.get("severity"),
                canonical_id=f.get("canonical_id")
            )

    if extracted.get("raw_notes"):
        print(f"\n  Notes: {extracted['raw_notes']}")

    print(f"\n✓ Scan ingested for {date}")
    return extracted


# ─────────────────────────────────────────────
# WEARABLE DATA INGESTION
# ─────────────────────────────────────────────

def parse_fitbit_custom_format(data: dict) -> list:
    """
    Parser for the custom Fitbit export format:
    {
      "period": "...",
      "steps": {"2026-02-14": 10676, ...},
      "heart_rate": {
        "daily_summaries": {"2026-02-14": {"resting_bpm": 71, "zones": [...]}},
        "intraday_minute_level": {"2026-02-14": [{"time": "05:10:00", "bpm": 94}, ...]}
      },
      "sleep": {
        "daily_sleep": {"2026-02-14": {"hours_asleep": ..., "minutes_asleep": ..., ...}}
      }
    }
    Returns list of daily records in our standard format.
    """
    by_date = {}

    def add(date, metric_name, canonical_id, value, unit, aggregation, timestamp=None):
        if date not in by_date:
            by_date[date] = []
        entry = {
            "metric_name": metric_name,
            "canonical_id": canonical_id,
            "value": float(value),
            "unit": unit,
            "aggregation": aggregation
        }
        if timestamp:
            entry["timestamp"] = timestamp
        by_date[date].append(entry)

    # ── Steps ──────────────────────────────────
    steps = data.get("steps", {})
    for date, count in steps.items():
        if count is not None:
            add(date, "Steps", "steps", count, "steps", "daily_total")

    # ── Heart Rate ─────────────────────────────
    hr_data = data.get("heart_rate", {})

    # Daily summaries: resting BPM + zone minutes
    daily_hr = hr_data.get("daily_summaries", {})
    for date, summary in daily_hr.items():
        resting = summary.get("resting_bpm")
        if resting is not None:
            add(date, "Resting Heart Rate", "resting_heart_rate", resting, "bpm", "daily_avg")

        zones = summary.get("zones", [])
        for zone in zones:
            zone_name = zone.get("name", "")
            minutes = zone.get("minutes")
            if minutes is None:
                continue
            name_map = {
                "Out of Range": ("HR Out of Range Minutes", "hr_out_of_range_min", "min"),
                "Fat Burn":     ("HR Fat Burn Zone Minutes", "hr_fat_burn_min", "min"),
                "Cardio":       ("HR Cardio Zone Minutes", "hr_cardio_min", "min"),
                "Peak":         ("HR Peak Zone Minutes", "hr_peak_min", "min"),
            }
            if zone_name in name_map:
                display, canonical, unit = name_map[zone_name]
                add(date, display, canonical, minutes, unit, "daily_total")

    # Intraday: raw minute-level BPM (store as individual raw metrics)
    intraday = hr_data.get("intraday_minute_level", {})
    for date, readings in intraday.items():
        if not isinstance(readings, list):
            continue
        # Compute daily avg/min/max from intraday
        bpms = [r["bpm"] for r in readings if "bpm" in r and r["bpm"] is not None]
        if bpms:
            add(date, "Heart Rate", "heart_rate", round(sum(bpms)/len(bpms), 1), "bpm", "daily_avg")
            add(date, "Heart Rate", "heart_rate", min(bpms), "bpm", "daily_min")
            add(date, "Heart Rate", "heart_rate", max(bpms), "bpm", "daily_max")

    # ── Sleep ──────────────────────────────────
    sleep_data = data.get("sleep", {})
    daily_sleep = sleep_data.get("daily_sleep", {})

    for date, sleep in daily_sleep.items():
        hours = sleep.get("hours_asleep")
        if hours is not None:
            add(date, "Sleep Duration", "sleep_duration", hours, "hours", "daily_total")

        efficiency = sleep.get("efficiency_percent")
        if efficiency is not None:
            add(date, "Sleep Efficiency", "sleep_efficiency", efficiency, "%", "daily_avg")

        time_in_bed = sleep.get("time_in_bed_minutes")
        if time_in_bed is not None:
            add(date, "Time in Bed", "time_in_bed", time_in_bed, "min", "daily_total")

        stages = sleep.get("stages", {})
        stage_map = {
            "deep":  ("Deep Sleep", "sleep_deep", "min"),
            "light": ("Light Sleep", "sleep_light", "min"),
            "rem":   ("REM Sleep", "sleep_rem", "min"),
            "wake":  ("Wake During Sleep", "sleep_wake", "min"),
        }
        for stage_key, (display, canonical, unit) in stage_map.items():
            stage = stages.get(stage_key, {})
            mins = stage.get("minutes")
            if mins is not None:
                add(date, display, canonical, mins, unit, "daily_total")

    # Build output records
    records = []
    for date in sorted(by_date.keys()):
        records.append({
            "device": "Fitbit",
            "date": date,
            "metrics": by_date[date]
        })

    return records


def normalize_wearable_json(data, default_date: str) -> list:
    """
    Auto-detect wearable JSON format and normalize into our standard format.
    Handles:
      - Our format: {"device":..., "date":..., "metrics": [...]}
      - This Fitbit format: {"period":..., "steps":{}, "heart_rate":{}, "sleep":{}}
      - Flat dict: {"heart_rate": 72, "steps": 8000}
      - List of records
    """
    if not isinstance(data, dict):
        return []

    # Already our format
    if "metrics" in data:
        return [data]

    # This Fitbit custom export format
    if "steps" in data and "heart_rate" in data:
        print("  ✓ Detected: Fitbit custom export format")
        return parse_fitbit_custom_format(data)

    # List of daily records
    if isinstance(data, list):
        records = []
        for item in data:
            records.extend(normalize_wearable_json(item, default_date))
        return records

    # Generic flat dict — supports multiple naming conventions for the same metric
    generic_map = {
        # Heart rate variants
        "heart_rate":           ("Heart Rate", "heart_rate", "bpm", "daily_avg"),
        "heart_rate_avg":       ("Heart Rate", "heart_rate", "bpm", "daily_avg"),
        "resting_heart_rate":   ("Resting Heart Rate", "resting_heart_rate", "bpm", "daily_avg"),
        "heart_rate_resting":   ("Resting Heart Rate", "resting_heart_rate", "bpm", "daily_avg"),
        # Steps variants
        "steps":                ("Steps", "steps", "steps", "daily_total"),
        "steps_total":          ("Steps", "steps", "steps", "daily_total"),
        # Sleep variants
        "sleep_hours":          ("Sleep Duration", "sleep_duration", "hours", "daily_total"),
        "sleep_duration":       ("Sleep Duration", "sleep_duration", "hours", "daily_total"),
        "sleep_asleep_minutes": ("Sleep Duration", "sleep_duration", "min", "daily_total"),
        "sleep_efficiency":     ("Sleep Efficiency", "sleep_efficiency", "%", "daily_avg"),
        "sleep_deep_minutes":   ("Deep Sleep", "sleep_deep", "min", "daily_total"),
        "sleep_rem_minutes":    ("REM Sleep", "sleep_rem", "min", "daily_total"),
        "sleep_light_minutes":  ("Light Sleep", "sleep_light", "min", "daily_total"),
        # Other metrics
        "spo2":                 ("SpO2", "spo2", "%", "daily_avg"),
        "weight":               ("Body Weight", "body_weight", "kg", "raw"),
        "bmi":                  ("BMI", "bmi", "", "raw"),
        "calories":             ("Calories", "calories", "kcal", "daily_total"),
        "calories_total":       ("Calories", "calories", "kcal", "daily_total"),
        "active_minutes":       ("Active Minutes", "active_minutes", "min", "daily_total"),
        "stress_score":         ("Stress Score", "stress_score", "", "daily_avg"),
    }
    metrics = []
    entry_date = data.get("date", default_date)
    for key, (display, canonical, unit, agg) in generic_map.items():
        if key in data:
            try:
                metrics.append({
                    "metric_name": display,
                    "canonical_id": canonical,
                    "value": float(data[key]),
                    "unit": unit,
                    "aggregation": agg
                })
            except (ValueError, TypeError):
                pass
    if metrics:
        return [{"device": "unknown", "date": entry_date, "metrics": metrics}]

    return []


def ingest_wearable_data(file_path: str, date: str):
    print(f"\n{'='*50}")
    print(f"INGESTING WEARABLE DATA for {date}")
    print('='*50)

    raw_data = read_json_file(file_path)

    print("\n-> Normalizing wearable format...")
    records = normalize_wearable_json(raw_data, date)

    if not records:
        print("  ✗ Could not parse wearable JSON.")
        print("  Supported formats: our format, Fitbit export, flat daily dict.")
        return

    total_metrics = sum(len(r.get("metrics", [])) for r in records)
    print(f"  ✓ Found {len(records)} day(s), {total_metrics} metric entries")

    for record in records:
        record_date = record.get("date", date)
        device = record.get("device", "unknown")
        metrics = record.get("metrics", [])

        if not metrics:
            continue

        graph_db.upsert_visit(record_date)
        graph_db.batch_insert_wearable_metrics(record_date, metrics, device)

    print(f"\n✓ Wearable data ingested: {len(records)} day(s).")