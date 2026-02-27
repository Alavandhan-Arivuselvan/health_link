"""
extractor.py — LLM-based extraction for medical reports.

Responsibilities:
  1. Accept raw report text + existing canonical names from graph
  2. Ask Gemini to extract structured data with canonical normalization
  3. Return clean, typed Python objects ready for graph insertion
"""

import json
import re
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(GEMINI_MODEL)


# ─────────────────────────────────────────────
# MAIN EXTRACTION FUNCTION
# ─────────────────────────────────────────────

def extract_medical_report(report_text: str, existing_canonicals: dict, report_date: str) -> dict:
    """
    Extracts structured data from a medical report text.

    Returns a dict with:
      - patient_profile: dict
      - lab_results: list of dicts
      - prescriptions: list of dicts
      - diagnoses: list of dicts
      - report_date: str
      - raw_notes: str
    """

    existing_tests_str     = json.dumps(existing_canonicals.get("tests", []), indent=2)
    existing_drugs_str     = json.dumps(existing_canonicals.get("drugs", []), indent=2)
    existing_diagnoses_str = json.dumps(existing_canonicals.get("diagnoses", []), indent=2)

    prompt = f"""
You are a precise medical knowledge graph extractor. Your job is to extract structured data from a medical report for storage in a patient health graph.

━━━ EXISTING CANONICAL NAMES IN GRAPH ━━━
These are entity names ALREADY in the patient's graph. If you encounter the same entity, you MUST use the exact canonical_id and display_name listed here. Do NOT create new names for existing concepts.

Tests already in graph:
{existing_tests_str if existing_tests_str != '[]' else '(none yet)'}

Drugs already in graph:
{existing_drugs_str if existing_drugs_str != '[]' else '(none yet)'}

Diagnoses already in graph:
{existing_diagnoses_str if existing_diagnoses_str != '[]' else '(none yet)'}

━━━ CANONICALIZATION RULES ━━━
- canonical_id: lowercase, underscores only, no spaces. e.g. "hba1c", "fasting_glucose", "metformin"
- display_name: proper medical capitalization. e.g. "HbA1c", "Fasting Glucose", "Metformin"
- If a test name in the report matches one in the graph (even if spelled differently), USE THE EXISTING canonical_id
- Normalize units: mg/dL not mgdl, % not percent, g/dL not g/dl
- status: "normal" | "high" | "low" | "critical" — derive from value vs normal_range, or null if unknown

━━━ REPORT DATE ━━━
Use this as the observation date for all findings: {report_date}
If the report mentions a different date, extract it and flag it in raw_notes.

━━━ INPUT REPORT ━━━
{report_text}

━━━ OUTPUT FORMAT ━━━
Return ONLY a valid JSON object. No markdown, no explanation, no extra text. Start directly with {{

{{
  "patient_profile": {{
    "name": "full name or null",
    "dob": "YYYY-MM-DD or null",
    "sex": "male|female|other or null",
    "blood_group": "A+|B-|etc or null",
    "chronic_conditions": ["condition1", "condition2"]
  }},
  "lab_results": [
    {{
      "display_name": "HbA1c",
      "canonical_id": "hba1c",
      "value": "7.8",
      "unit": "%",
      "normal_range": "4.0-5.6%",
      "status": "high"
    }}
  ],
  "prescriptions": [
    {{
      "drug": "Metformin",
      "canonical_drug_id": "metformin",
      "dose": "500mg",
      "frequency": "twice daily"
    }}
  ],
  "diagnoses": [
    {{
      "name": "Type 2 Diabetes Mellitus",
      "canonical_id": "type2_diabetes",
      "icd_code": "E11"
    }}
  ],
  "raw_notes": "any observations, warnings, or date discrepancies"
}}
"""

    response = model.generate_content(prompt)
    raw = response.text.strip()

    # Strip markdown fences if model adds them
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        data = json.loads(raw)
        data["report_date"] = report_date
        return data
    except json.JSONDecodeError as e:
        print(f"⚠ JSON parse failed: {e}")
        print(f"Raw LLM output:\n{raw[:1000]}")
        return {}


# ─────────────────────────────────────────────
# SCAN EXTRACTION
# ─────────────────────────────────────────────

def extract_scan_report(scan_text: str, existing_canonicals: dict,
                         scan_date: str, modality: str, body_part: str = None) -> dict:
    """
    Extracts findings from imaging reports (X-Ray, MRI, CT, Ultrasound).

    Returns:
      - modality: str
      - body_part: str
      - findings: list of dicts
      - scan_date: str
    """

    existing_findings_str = json.dumps(existing_canonicals.get("findings", []), indent=2)

    prompt = f"""
You are a medical imaging report extractor for a patient health graph.

━━━ EXISTING FINDINGS IN GRAPH ━━━
If a finding matches one already recorded, use the same canonical_id:
{existing_findings_str if existing_findings_str != '[]' else '(none yet)'}

━━━ CANONICALIZATION RULES ━━━
- canonical_id: lowercase, underscores. e.g. "cardiomegaly", "pleural_effusion_right"
- severity: "mild" | "moderate" | "severe" | "normal" | null
- description: concise radiological description

━━━ SCAN DETAILS ━━━
Date: {scan_date}
Modality: {modality}
Body Part: {body_part or 'not specified'}

━━━ REPORT TEXT ━━━
{scan_text}

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON. No markdown.

{{
  "modality": "{modality}",
  "body_part": "chest|abdomen|brain|etc",
  "findings": [
    {{
      "canonical_id": "cardiomegaly",
      "description": "Mild cardiomegaly noted",
      "severity": "mild"
    }}
  ],
  "scan_date": "{scan_date}",
  "raw_notes": "any relevant observations"
}}
"""

    response = model.generate_content(prompt)
    raw = response.text.strip()
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        data = json.loads(raw)
        data["scan_date"] = scan_date
        return data
    except json.JSONDecodeError as e:
        print(f"⚠ Scan JSON parse failed: {e}")
        print(f"Raw output:\n{raw[:800]}")
        return {}
