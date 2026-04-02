"""
extractor.py — LLM extraction using the new google-genai SDK.
Install: pip install google-genai
"""

import json
import re
import os
from google import genai
from config import GEMINI_API_KEY, GEMINI_MODEL

client = genai.Client(api_key=GEMINI_API_KEY)


def _call_llm(prompt: str) -> str:
    """Single helper that calls Gemini and returns raw text."""
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt
    )
    return response.text.strip()


def _parse_json(raw: str) -> dict | list | None:
    """Strip markdown fences and parse JSON."""
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'^```\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  ⚠ JSON parse failed: {e}")
        print(f"  Raw output:\n{raw[:800]}")
        return None


# ─────────────────────────────────────────────
# MEDICAL REPORT EXTRACTION
# ─────────────────────────────────────────────

def extract_medical_report(report_text: str, existing_canonicals: dict, report_date: str) -> dict:
    existing_tests     = json.dumps(existing_canonicals.get("tests", []), indent=2)
    existing_drugs     = json.dumps(existing_canonicals.get("drugs", []), indent=2)
    existing_diagnoses = json.dumps(existing_canonicals.get("diagnoses", []), indent=2)

    prompt = f"""
You are a precise medical knowledge graph extractor.

━━━ EXISTING CANONICAL NAMES (reuse these exact IDs if entity matches) ━━━
Tests:     {existing_tests if existing_tests != '[]' else '(none yet)'}
Drugs:     {existing_drugs if existing_drugs != '[]' else '(none yet)'}
Diagnoses: {existing_diagnoses if existing_diagnoses != '[]' else '(none yet)'}

━━━ RULES ━━━
- canonical_id: lowercase, underscores. e.g. "hba1c", "fasting_glucose", "metformin"
- display_name: proper medical caps. e.g. "HbA1c", "Fasting Glucose", "Metformin"
- Normalize units: mg/dL, %, g/dL, mmHg
- status: "normal" | "high" | "low" | "critical" — infer from value vs normal_range, or null
- Report date to use for all entries: {report_date}
- organ_mapping: Map any found diseases, symptoms, or medications to the relevant organ from this EXACT list ONLY: ["Heart", "Left Lung", "Right Lung", "Stomach", "Liver", "Intestines", "Pectorals", "Abdominals", "Trapezius", "Lats", "Glutes", "Left Shoulder", "Right Shoulder", "Left Arm", "Right Arm", "Left Forearm", "Right Forearm", "Left Thigh", "Right Thigh", "Left Calf", "Right Calf", "Left Foot", "Right Foot"]. Use keys "medications", "diagnostics", "other".

━━━ REPORT ━━━
{report_text}

━━━ OUTPUT — valid JSON only, no markdown ━━━
{{
  "patient_profile": {{
    "name": null,
    "dob": null,
    "sex": null,
    "blood_group": null,
    "chronic_conditions": []
  }},
  "lab_results": [
    {{"display_name": "HbA1c", "canonical_id": "hba1c", "value": "7.8", "unit": "%", "normal_range": "4.0-5.6%", "status": "high"}}
  ],
  "prescriptions": [
    {{"drug": "Metformin", "canonical_drug_id": "metformin", "dose": "500mg", "frequency": "twice daily"}}
  ],
  "diagnoses": [
    {{"name": "Type 2 Diabetes Mellitus", "canonical_id": "type2_diabetes", "icd_code": "E11"}}
  ],
  "organ_mapping": {{
    "Heart": {{
      "medications": ["Metoprolol"],
      "diagnostics": ["Cardiomegaly"],
      "other": []
    }}
  }},
  "raw_notes": "any date discrepancies or observations"
}}
"""

    raw = _call_llm(prompt)
    data = _parse_json(raw)
    if data:
        data["report_date"] = report_date
    return data or {}


# ─────────────────────────────────────────────
# SCAN REPORT EXTRACTION
# ─────────────────────────────────────────────

def extract_scan_report(scan_text: str, existing_canonicals: dict,
                         scan_date: str, modality: str, body_part: str = None) -> dict:
    existing_findings = json.dumps(existing_canonicals.get("findings", []), indent=2)

    prompt = f"""
You are a medical imaging report extractor.

━━━ EXISTING FINDINGS (reuse canonical_id if same finding) ━━━
{existing_findings if existing_findings != '[]' else '(none yet)'}

━━━ RULES ━━━
- canonical_id: lowercase underscores. e.g. "cardiomegaly", "pleural_effusion_right"
- severity: "mild" | "moderate" | "severe" | "normal" | null

━━━ SCAN DETAILS ━━━
Date: {scan_date} | Modality: {modality or 'DETECT FROM REPORT'} | Body Part: {body_part or 'DETECT FROM REPORT'}

━━━ REPORT ━━━
{scan_text}

━━━ OUTPUT — valid JSON only, no markdown ━━━
{{
  "modality": "{modality}",
  "body_part": "chest",
  "findings": [
    {{"canonical_id": "cardiomegaly", "description": "Mild cardiomegaly noted", "severity": "mild"}}
  ],
  "raw_notes": ""
}}
"""

    raw = _call_llm(prompt)
    data = _parse_json(raw)
    if data:
        data["scan_date"] = scan_date
    return data or {}