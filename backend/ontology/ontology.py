"""
Medical Report Ontology Processor
==================================
Parses raw OCR-scanned text from medical reports (discharge summaries,
prescriptions, invoices) and produces a structured dictionary with lab
observations mapped to LOINC codes.

Usage:
    from ontology import process_medical_report
    result = process_medical_report(raw_ocr_text)
"""

import os
import re
import json
import csv
from datetime import datetime
from typing import Optional

import pandas as pd
from rapidfuzz import process as fuzz_process, fuzz

# ---------------------------------------------------------------------------
# Path to bundled LOINC dataset (relative to this file)
# ---------------------------------------------------------------------------
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_LOINC_CORE_CSV = os.path.join(
    _BASE_DIR, "Loinc_2.82", "LoincTableCore", "LoincTableCore.csv"
)

# ═══════════════════════════════════════════════════════════════════════════
# 1.  LOINC INDEX  — lazy-loaded singleton
# ═══════════════════════════════════════════════════════════════════════════

class LoincIndex:
    """In-memory LOINC lookup built from LoincTableCore.csv."""

    _instance: Optional["LoincIndex"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance

    # ---- loading --------------------------------------------------------

    def _load(self):
        if self._loaded:
            return
        df = pd.read_csv(
            _LOINC_CORE_CSV,
            dtype=str,
            usecols=[
                "LOINC_NUM", "COMPONENT", "PROPERTY", "TIME_ASPCT",
                "SYSTEM", "SCALE_TYP", "METHOD_TYP", "CLASS",
                "LONG_COMMON_NAME", "SHORTNAME", "STATUS",
            ],
        )
        # Keep only active codes
        df = df[df["STATUS"] == "ACTIVE"].copy()
        df["COMPONENT_LOWER"] = df["COMPONENT"].str.lower().str.strip()

        self._df = df
        # Build a dict mapping lowercased component → list of records
        self._component_map: dict[str, list[dict]] = {}
        for _, row in df.iterrows():
            key = row["COMPONENT_LOWER"]
            entry = {
                "loinc_num": row["LOINC_NUM"],
                "component": row["COMPONENT"],
                "long_common_name": row["LONG_COMMON_NAME"],
                "class": row["CLASS"],
                "system": row["SYSTEM"],
                "property": row["PROPERTY"],
                "scale_type": row["SCALE_TYP"],
            }
            self._component_map.setdefault(key, []).append(entry)

        # Flat list of unique component names for fuzzy matching
        self._component_names = list(self._component_map.keys())
        self._loaded = True

    # ---- public API -----------------------------------------------------

    def search(self, term: str, threshold: int = 70, limit: int = 3) -> list[dict]:
        """Fuzzy-search for a lab term in the LOINC component list.

        Returns up to *limit* matches scoring ≥ *threshold*.
        Each result dict has keys: loinc_num, component, long_common_name,
        class, system, property, scale_type, score.
        """
        self._load()
        term_lower = term.lower().strip()

        # Try exact match first
        if term_lower in self._component_map:
            results = []
            for entry in self._component_map[term_lower][:limit]:
                results.append({**entry, "score": 100})
            return results

        # Fuzzy match
        matches = fuzz_process.extract(
            term_lower,
            self._component_names,
            scorer=fuzz.WRatio,
            limit=limit,
            score_cutoff=threshold,
        )
        results = []
        for matched_name, score, _ in matches:
            for entry in self._component_map[matched_name][:1]:
                results.append({**entry, "score": round(score, 1)})
        return results

    def best_match(self, term: str, threshold: int = 70) -> Optional[dict]:
        """Return the single best LOINC match, or None."""
        hits = self.search(term, threshold=threshold, limit=1)
        return hits[0] if hits else None


# Global convenience accessor
_loinc = LoincIndex()


# ═══════════════════════════════════════════════════════════════════════════
# 2.  SECTION PARSERS
# ═══════════════════════════════════════════════════════════════════════════

def _clean(val: str) -> str:
    """Strip whitespace and common OCR artefacts."""
    return re.sub(r"\s+", " ", val).strip()


# ---- 2a. Demographics & visit info -------------------------------------

def parse_demographics(text: str) -> dict:
    """Extract patient demographics and visit metadata."""
    data: dict = {}

    patterns = {
        "name":             r"(?:NAME\s*(?:OF\s*(?:THE\s*)?)?PATIENT)\s*[:\-]\s*(.+)",
        "age_sex":          r"AGE\s*/\s*SEX\s*[:\-]\s*(.+)",
        "address":          r"ADDRESS\s*[:\-]\s*(.+)",
        "admission_date":   r"DATE\s*OF\s*ADMISSION\s*[:\-]\s*([\d/]+)",
        "discharge_date":   r"DATE\s*OF\s*DISCHARGE\s*[:\-]\s*([\d/]+)",
        "consultant":       r"CONSULTANT\s*[:\-]\s*(.+)",
        "diagnosis":        r"DIAGNOSIS\s*[:\-]\s*(.+)",
        "department":       r"DEPARTMENT\s*[:\-]\s*(.+)",
        "room_no":          r"Room\s*No\s*[:\-]\s*(.+)",
        "accommodation":    r"AccommodationType\s*[:\-]\s*(.+)",
    }

    for key, pat in patterns.items():
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            data[key] = _clean(m.group(1))

    # Split age / sex
    if "age_sex" in data:
        parts = re.split(r"\s*/\s*", data.pop("age_sex"), maxsplit=1)
        data["age"] = parts[0].strip()
        data["sex"] = parts[1].strip() if len(parts) > 1 else None

    patient = {
        "name": data.get("name"),
        "age": data.get("age"),
        "sex": data.get("sex"),
        "address": data.get("address"),
    }
    visit = {
        "admission_date": data.get("admission_date"),
        "discharge_date": data.get("discharge_date"),
        "consultant": data.get("consultant"),
        "department": data.get("department"),
        "room_no": data.get("room_no"),
        "accommodation_type": data.get("accommodation"),
    }
    return {
        "patient": patient,
        "visit": visit,
        "diagnosis": data.get("diagnosis"),
    }


# ---- 2b. Vitals --------------------------------------------------------

def parse_vitals(text: str) -> dict:
    """Extract vital signs (BP, pulse, SpO2)."""
    vitals: dict = {}

    bp = re.search(r"BP[.\s]*[:\-]?\s*([\d]+\s*/\s*[\d]+)\s*(?:mm/?hg)?", text, re.I)
    if bp:
        vitals["blood_pressure"] = _clean(bp.group(1))

    pr = re.search(r"P\.?R\.?\s*[:\-]?\s*([\d]+)\s*(?:m(?:in|ints?))?", text, re.I)
    if pr:
        vitals["pulse_rate"] = pr.group(1).strip()

    spo2 = re.search(r"SPO2\s*[:\-]?\s*([\d]+)\s*%?", text, re.I)
    if spo2:
        vitals["spo2_percent"] = spo2.group(1).strip()

    return vitals


# ---- 2c. Clinical summary / course in hospital -------------------------

def parse_clinical_summary(text: str) -> dict:
    """Extract free-text clinical summary and hospital course."""
    data: dict = {}

    # Chief complaint / clinical summary
    m = re.search(
        r"CLINICAL\s*SUMMARY\s*[:\-]?\s*(.+?)(?=COURSE\s*IN\s*HOSPITAL|COMPLETE\s*BLOOD|$)",
        text, re.I | re.S,
    )
    if m:
        data["clinical_summary"] = _clean(m.group(1))

    # Course in hospital
    m = re.search(
        r"COURSE\s*IN\s*HOSPITAL\s*[:\-]?\s*(.+?)(?=COMPLETE\s*BLOOD|HAEMATOLOGY|$)",
        text, re.I | re.S,
    )
    if m:
        data["course_in_hospital"] = _clean(m.group(1))

    return data


# ---- 2d. Lab results ---------------------------------------------------

# Common lab‐test aliases → canonical search terms for LOINC
_LAB_ALIASES: dict[str, str] = {
    "haemoglobin":          "Hemoglobin",
    "hemoglobin":           "Hemoglobin",
    "total wbc count":      "Leukocytes",
    "wbc count":            "Leukocytes",
    "neutrophils":          "Neutrophils/100 leukocytes",
    "lymphocyte":           "Lymphocytes/100 leukocytes",
    "lymphocytes":          "Lymphocytes/100 leukocytes",
    "eosinophils":          "Eosinophils/100 leukocytes",
    "rbc count":            "Erythrocytes",
    "pcv":                  "Hematocrit",
    "mcv":                  "Erythrocyte mean corpuscular volume",
    "mch":                  "Erythrocyte mean corpuscular hemoglobin",
    "mchc":                 "Erythrocyte mean corpuscular hemoglobin concentration",
    "total billirubin":     "Bilirubin.total",
    "total bilirubin":      "Bilirubin.total",
    "direct billirubin":    "Bilirubin.direct",
    "sgot":                 "Aspartate aminotransferase",
    "scot":                 "Aspartate aminotransferase",
    "sgpt":                 "Alanine aminotransferase",
    "alk phosphatise":      "Alkaline phosphatase",
    "alk phosphatase":      "Alkaline phosphatase",
    "total protein":        "Protein",
    "serum albumin":        "Albumin",
    "globulin":             "Globulin",
    "fbs":                  "Glucose [Mass/volume] in Blood",
    "ppbs":                 "Glucose [Mass/volume] in Blood",
    "cholestrol":           "Cholesterol",
    "cholesterol":          "Cholesterol",
    "hdl cholesterol":      "Cholesterol in HDL",
    "ldl cholesterol":      "Cholesterol in LDL",
    "vldl cholesterol":     "Cholesterol in VLDL",
    "t.c/hdl ratio":        "Cholesterol.total/Cholesterol in HDL",
    "specific gravity":     "Specific gravity",
    "glucose":              "Glucose",
}

# Regex patterns for extracting lab values from noisy OCR text
_LAB_PATTERNS: list[tuple[str, str]] = [
    # "TestName - Value unit"  or  "TestName: Value unit"
    (r"(Haemoglobin|Hemoglobin)\s*[:\-]?\s*([\d.§]+)\s*[,.]?\s*([a-z/%]+)",      "haemoglobin"),
    (r"Total\s*wbc\s*count\s*[:\-]?\s*([\d]+)\s*(Cells/cumm?)",                    "total wbc count"),
    (r"(Neutrophils|Neu\s*trophils)\s*[:\-]?\s*([\d]+)\s*(%)",                      "neutrophils"),
    (r"(Lymphocyte)\s*[:\-]?\s*([\d]+)\s*(%)",                                      "lymphocyte"),
    (r"(Eosinophils)\s*[:\-]?\s*([\d]+)\s*(%)",                                     "eosinophils"),
    (r"RBC\s*count\s*[:\-]?\s*([\d.]+)\s*(million\s*/\s*cumm?)",                    "rbc count"),
    (r"Pcv\s*[:\-]?\s*([\d]+)\s*(%)",                                               "pcv"),
    (r"MCV\s*[:\-]?\s*([\d]+)\s*(cumm?)",                                           "mcv"),
    (r"MCH\s*[:\-]?\s*([\d]+)\s*(pg)",                                              "mch"),
    (r"MCHC\s*[:\-]?\s*([\d]+)",                                                    "mchc"),
    (r"Total\s*billirubin\s*[:\-]?\s*([\d.]+)\s*(mg[./]d[l1])",                     "total billirubin"),
    (r"Direct\s*billirubin\s*[:\-]?\s*([\d.]+)\s*(mg/dl)",                          "direct billirubin"),
    (r"SCOT\s*[:\-]?\s*([\d]+)",                                                    "scot"),
    (r"SGPT\s*[:\-]?\s*([\d]+)\s*(Iu/[l1])?",                                      "sgpt"),
    (r"Alk\s*phosphat[is]+e?\s*[:\-]?\s*([\d]+)",                                   "alk phosphatise"),
    (r"TOTAL\s*PROTEIN\s*[:\-]?\s*([\d.]+)",                                        "total protein"),
    (r"Serum\s*Albumin\s*[:\-]?\s*([\d.]+)",                                        "serum albumin"),
    (r"Globulin\s*[:\-]?\s*([\d.]+)",                                               "globulin"),
    (r"FBS\s*[:\-]?\s*([\d]+)",                                                     "fbs"),
    (r"PPBS\s*[:\-]?\s*([\d]+)",                                                    "ppbs"),
    (r"Cholestrol\s*[:\-]?\s*([\d]+)",                                              "cholestrol"),
    (r"Hdl?\s*cholesterol\s*[:\-]?\s*([\d]+)",                                      "hdl cholesterol"),
    (r"Ldl\s*cholesterol\s*[:\-]?\s*([\d]+)",                                       "ldl cholesterol"),
    (r"Vldl\s*cholesterol\s*[:\-]?\s*([\d]+)",                                      "vldl cholesterol"),
    (r"T\.c/hdl\s*ratio\s*[:\-]?\s*([\d]+)",                                        "t.c/hdl ratio"),
    (r"Specific\s*gravity\s*[:\-]?\s*([\d.]+)",                                     "specific gravity"),
]


def parse_lab_results(text: str) -> list[dict]:
    """Extract lab results and map each to a LOINC code."""
    results: list[dict] = []
    seen: set[str] = set()

    for pattern, alias_key in _LAB_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if not m:
            continue
        if alias_key in seen:
            continue
        seen.add(alias_key)

        groups = m.groups()
        # Find the first numeric-looking group as the value
        value = None
        unit = None
        for g in groups:
            if g is None:
                continue
            if re.match(r"^[\d.§]+$", g):
                value = g.replace("§", "5")  # common OCR mis-read of '5'
            elif value is not None:
                unit = g
                break

        if value is None:
            continue

        # Categorize the test
        category = _categorize_lab(alias_key)

        # Look up LOINC
        search_term = _LAB_ALIASES.get(alias_key, alias_key)
        loinc_match = _loinc.best_match(search_term, threshold=65)

        entry: dict = {
            "test_name": alias_key.replace("_", " ").title(),
            "value": value,
            "unit": unit,
            "category": category,
            "loinc_code": loinc_match["loinc_num"] if loinc_match else None,
            "loinc_name": loinc_match["long_common_name"] if loinc_match else None,
            "loinc_score": loinc_match["score"] if loinc_match else None,
        }
        results.append(entry)

    # Also try to pick up urine analysis qualitative results
    _parse_urine_qualitative(text, results)

    return results


def _categorize_lab(alias: str) -> str:
    """Assign a high-level category to a lab test."""
    haem = {"haemoglobin", "hemoglobin", "total wbc count", "wbc count",
            "neutrophils", "lymphocyte", "lymphocytes", "eosinophils",
            "rbc count", "pcv", "mcv", "mch", "mchc"}
    liver = {"total billirubin", "total billirubin", "direct billirubin",
             "scot", "sgot", "sgpt", "alk phosphatise", "alk phosphatase",
             "total protein", "serum albumin", "globulin"}
    diabetic = {"fbs", "ppbs"}
    lipid = {"cholestrol", "cholesterol", "hdl cholesterol",
             "ldl cholesterol", "vldl cholesterol", "t.c/hdl ratio"}
    urine = {"specific gravity", "glucose", "leukocytes", "nitrite",
             "keytones", "urobilinogen", "bilirubin"}
    if alias in haem:
        return "Haematology"
    if alias in liver:
        return "Liver Function Test"
    if alias in diabetic:
        return "Diabetic Profile"
    if alias in lipid:
        return "Lipid Profile"
    if alias in urine:
        return "Urine Analysis"
    return "Other"


def _parse_urine_qualitative(text: str, results: list[dict]):
    """Pick up qualitative urine results (Negative / Normal / Positive)."""
    urine_quals = [
        (r"Urobilinogen\s*[:\-]?\s*(Normal|Negative|Positive)",    "Urobilinogen"),
        (r"Billrubin\s*[:\-]?\s*(Normal|Negative|Positive)",       "Bilirubin (urine)"),
        (r"[Ll]eukocytes?\s*[:\-]?\s*(normal|negative|positive)",  "Leukocytes (urine)"),
        (r"Nitrite\s*[:\-]?\s*(normal|negative|positive)",         "Nitrite (urine)"),
        (r"Glucose\s*[:\-]?\s*(Normal|Negative|Positive)",         "Glucose (urine)"),
        (r"Keytones\s*[:\-]?\s*(Normal|Negative|Positive)",        "Ketones (urine)"),
    ]
    for pat, name in urine_quals:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            search_term = name.split("(")[0].strip()
            loinc_match = _loinc.best_match(search_term, threshold=60)
            results.append({
                "test_name": name,
                "value": m.group(1).capitalize(),
                "unit": None,
                "category": "Urine Analysis",
                "loinc_code": loinc_match["loinc_num"] if loinc_match else None,
                "loinc_name": loinc_match["long_common_name"] if loinc_match else None,
                "loinc_score": loinc_match["score"] if loinc_match else None,
            })


# ---- 2e. Medications ---------------------------------------------------

def parse_medications(text: str) -> list[dict]:
    """Extract medications with dosage schedules."""
    meds: list[dict] = []

    # Tablet pattern:  T.DRUGNAME: (M-A-N)   or   T.DRUGNAME (M-A-N)
    for m in re.finditer(
        r"T\.([A-Z]+)\s*[:\-]?\s*\((\d+)\s*-\s*(\d+)\s*-\s*(\d+)\)", text, re.I
    ):
        meds.append({
            "name": m.group(1).strip().title(),
            "form": "Tablet",
            "dosage_schedule": {
                "morning": int(m.group(2)),
                "afternoon": int(m.group(3)),
                "night": int(m.group(4)),
            },
            "volume": None,
        })

    # Syrup pattern:  SYP.DRUGNAME: Nml  or  5YP.DRUGNAME: Nml
    for m in re.finditer(
        r"[5S]YP\.([A-Z\s]+?)\s*[:\-]\s*([\d]+)\s*(ml)", text, re.I
    ):
        meds.append({
            "name": m.group(1).strip().title(),
            "form": "Syrup",
            "dosage_schedule": None,
            "volume": f"{m.group(2)}{m.group(3)}",
        })

    return meds


# ---- 2f. Billing -------------------------------------------------------

def parse_billing(text: str) -> dict | None:
    """Extract billing metadata and line-item totals."""
    # Only attempt on pages that look like invoices
    if not re.search(r"(?:Invoice|Bill\s*No|CASH\s*BILL)", text, re.I):
        return None

    data: dict = {}

    bill_no = re.search(r"Bill\s*No\s*[:\-]?\s*([\w/]+)", text, re.I)
    if bill_no:
        data["bill_no"] = bill_no.group(1).strip()

    bill_date = re.search(r"Bill\s*Date\s*[:\-]?\s*([\d/]+)", text, re.I)
    if bill_date:
        data["bill_date"] = bill_date.group(1).strip()

    # Extract billing line items (description + amount)
    items: list[dict] = []
    for m in re.finditer(
        r"([\w\s]+?(?:Charges?|Fees?|Administration|Medicines|Drugs|Investigations?|Implants?))"
        r"[|\s]*[\d]*[|\s]*([\d,]+)\s*$",
        text, re.I | re.M,
    ):
        desc = _clean(m.group(1))
        amount = m.group(2).replace(",", "")
        if amount.isdigit():
            items.append({"description": desc, "amount": int(amount)})
    data["items"] = items

    # Total
    total_match = re.search(r"Total\s*[|\s]*([\d,]+)", text, re.I)
    if total_match:
        data["total"] = int(total_match.group(1).replace(",", ""))

    # Payment info
    paid = re.search(r"Payment\s*Mode\s*[:\-]?\s*(\w+)", text, re.I)
    if paid:
        data["payment_mode"] = paid.group(1).strip()

    return data


# ---- 2g. Advice --------------------------------------------------------

def parse_advice(text: str) -> str | None:
    m = re.search(r"ADVICE\s*[:\-]?\s*(.+?)(?:\n|$)", text, re.I)
    return _clean(m.group(1)) if m else None


# ═══════════════════════════════════════════════════════════════════════════
# 3.  MAIN ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════

def process_medical_report(raw_text: str) -> dict:
    """
    Parse a raw OCR-scanned medical report and return structured data.

    Parameters
    ----------
    raw_text : str
        The full OCR text, potentially spanning multiple pages
        delimited by ``--- Page N ---`` markers.

    Returns
    -------
    dict
        Structured dictionary containing patient info, visit details,
        diagnosis, vitals, lab results (with LOINC codes), medications,
        billing info, and processing metadata.
    """
    # --- split into pages -------------------------------------------------
    pages = re.split(r"---\s*Page\s*\d+\s*---", raw_text)
    pages = [p.strip() for p in pages if p.strip()]

    full_text = "\n".join(pages)

    # --- demographics & visit (first occurrence wins) --------------------
    demo = parse_demographics(full_text)

    # --- vitals -----------------------------------------------------------
    vitals = parse_vitals(full_text)

    # --- clinical narrative -----------------------------------------------
    clinical = parse_clinical_summary(full_text)

    # --- lab results with LOINC mapping -----------------------------------
    lab_results = parse_lab_results(full_text)

    # --- medications ------------------------------------------------------
    medications = parse_medications(full_text)

    # --- billing (may come from invoice pages) ----------------------------
    billing = None
    for page in pages:
        b = parse_billing(page)
        if b:
            billing = b
            break

    # --- advice -----------------------------------------------------------
    advice = parse_advice(full_text)

    # --- assemble output --------------------------------------------------
    return {
        "patient": demo.get("patient"),
        "visit": demo.get("visit"),
        "diagnosis": demo.get("diagnosis"),
        "clinical_summary": clinical.get("clinical_summary"),
        "course_in_hospital": clinical.get("course_in_hospital"),
        "vitals": vitals,
        "lab_results": lab_results,
        "medications": medications,
        "billing": billing,
        "advice": advice,
        "metadata": {
            "source_pages": len(pages),
            "processing_timestamp": datetime.now().isoformat(),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
# 4.  SAMPLE OCR TEXT  +  SELF-TEST
# ═══════════════════════════════════════════════════════════════════════════

_SAMPLE_OCR = """\
--- Page 1 ---
TRUSTED CARE
DISCHARGE SUMMARY
NAME OF THE PATIENT: Mr. SONAIMUTHU
AGE / SEX: 71 Yrs / Male
ADDRESS: Manamadurai
DATE OF ADMISSION : 21/01/2019
DATE OF DISCHARGE: 25/01/2019
CONSULTANT: DR. Anand MBBS, MD.
DIAGNOSIS: LOWER OESOPHAGEAL HIATUS HERNIA
CLINICAL SUMMARY
Patient came to the hospital with complaints of inability to swallow food and vomiting of undigested food
particles for past 3 months.
BP. 80/50 mm/hg
P.R 56mints
SPO2 97%
COURSE IN HOSPITAL:
CT scan of chest and abdomen done revealed, dialation of oesophagus with thin regular wall and air fluid level within,
subcarinal oesophageal narrowing present small hiatus hernia. Patient was treated conservatively with antibiotics, antiematics
and ppi. Patient improved symptomatically with ability to swallow solid foods with no episodes of vomiting. Patient was
advised endoscopy and dilatation of oesophagus with biopsy at a later stage.
COMPLETE BLOOD CELL COUNT:
HAEMATOLOGY
SCOT-29 full Urobllinogen-Normal
Haemoglobin10.5,m/d1
Total wbc count-8900 Cells/cum SGPT-27 Iu/1 Billrubin-Negative
DIABETIC PROFILE
Neu trophils-69% TOTAL PROTEIN-7.6
FBS-95
Lymphocyte-26% Serum Albumin-4.1 PPBS-159
LIPID PROFILE
Eosinophils-5% Globulin-2.6
Cholestrol- 179
RBC count- 3.9 million / cumm Alk phosphatise-79 HdI cholesterol-32
URINE ANALYSIS
Pcv - 42% Ldl cholesterol-128
Specific gravity:I.010
MCV-74 cumm Vldl cholesterol-33
MCH -28pg I.eukocytes-negative T.c/hdl ratio-5
MCHC 425m 7a [Nitrite-negative i
LIVER FUNCTION TEST
Glucose-Normal
Total billiruhin0.2mg.d1
Direct billirubin- 0.1mg/dl Keytones-Negative Po
ADVICE: FOLLOW UP AFTER 5 DAYS


--- Page 2 ---
@)SANGEETHA HOSPITAL

T.EM ESET: (1-0-1)

T.YEES D: (1-0-1)

T.DIGIPEN: (1-0-1)

T.ACILOC: (1-0-1)

T.MUCYST: (0-0-1)

T.NEFTRON: (1-0-1)

T.AZ1THRAL: (0-0-1)

5YP.LUPIZ1ME PLUS: 10ml

5YP.SUCRAFIL PLUS: 5ml
When and how to obtain urgent care :
Report in case of pain, bleeding and or other emergencies.
Summary Prepared By: Dr. Anand
(This is not a legal document. This report is given to enable the patient to understand their disease nature, treatment and
follow up. Any clarification, if necessary should be discussed with the consultant)
The content of discharge summary and follow up instructions including drugs has been explained to me in my
understandable language.
Attenders Sign:
Name & Relationship:
Phone No:


--- Page 3 ---
TRUSTED CARE
Invoice
Bill No: SHO0012/102/19 Bill Date: 23/07/2019
NAME OF THE PATIENT: — Mr. SONAIMUTHU
AGE / SEX: 71 Yrs / Male
ADDRESS: 74/36 New Street, Vadavalli, Manamadurai
DATE OF ADMISSION : 21/01/2019 3.30PM
DATE OF DISCHARGE: 25/01/2019 4.50PM
CONSULTANT: DR. Anand MBBS, MD.
DIAGNOSIS: LOWER OESOPHAGEAL HIATUS HERNIA
DEPARTMENT: Critical care
AccommodationType: Special
Room No: 102
Nursing Charges 1000
RMO Charges 8800
Surgeon Charges 9000
Anesthetist Charges 2000
Specialist Charges 1500


--- Page 4 ---
(@)SANGEETHA HOSPITAL

@) TRUSTED CARE


--- Page 5 ---
SANGEETHA HOSPITAL
TRUSTED CARE
OP CASH BILL
Bill. No: SSH/000123/072019 Bill Date: 21/07/2019
Patient Name: Mr. SONAIMUTHU Age / Sex: 71 Yrs / Male
Address: Manamadurai Lab Ref.No : OP/989859438
Consultant: Dr.Anand
Total 2780
(Rupees Two Thousand Seven Hundred And Eighty Rupees Only)
For Sangeetha Hospitals

Paid Date: 21/07/2019 Payment Mode: Cash
Billed By : Kavitha 21/07/2019 12:32:56 PM
"""


if __name__ == "__main__":
    print("=" * 70)
    print("  Medical Report Ontology Processor - Self-Test")
    print("=" * 70)

    result = process_medical_report(_SAMPLE_OCR)

    # ---- assertions -----------------------------------------------------
    assert result["patient"]["name"], "Patient name should be extracted"
    assert result["diagnosis"], "Diagnosis should be extracted"
    assert result["vitals"].get("blood_pressure"), "BP should be extracted"
    assert len(result["lab_results"]) >= 5, (
        f"Expected ≥5 lab results, got {len(result['lab_results'])}"
    )
    assert len(result["medications"]) >= 4, (
        f"Expected ≥4 medications, got {len(result['medications'])}"
    )
    loinc_mapped = [r for r in result["lab_results"] if r["loinc_code"]]
    assert len(loinc_mapped) >= 3, (
        f"Expected ≥3 LOINC-mapped results, got {len(loinc_mapped)}"
    )

    # ---- pretty-print ---------------------------------------------------
    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))

    print("\n" + "=" * 70)
    print(f"  [OK] All assertions passed")
    print(f"    - Patient  : {result['patient']['name']}")
    print(f"    - Diagnosis: {result['diagnosis']}")
    print(f"    - Vitals   : {len(result['vitals'])} extracted")
    print(f"    - Lab tests: {len(result['lab_results'])} extracted, "
          f"{len(loinc_mapped)} LOINC-mapped")
    print(f"    - Meds     : {len(result['medications'])} extracted")
    print(f"    - Billing  : {'yes' if result['billing'] else 'no'}")
    print("=" * 70)
