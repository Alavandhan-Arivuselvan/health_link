"""
context_builder.py — Converts raw graph data into structured text context for the LLM.

Design principles:
  - Always include specific dates and values (grounding rule)
  - Group data by type for readability
  - Include TREND_OF deltas as explicit statements
  - Include inferred edges with their confidence + reason
  - Cap output to avoid context overflow
"""

import json
from datetime import datetime


def _fmt_date(d: str) -> str:
    """Format YYYY-MM-DD to a more readable form."""
    try:
        return datetime.strptime(d, "%Y-%m-%d").strftime("%d %b %Y")
    except:
        return d or "unknown date"


def _trend_direction(old_val, new_val) -> str:
    """Returns ↑ / ↓ / → based on numeric comparison."""
    try:
        diff = float(new_val) - float(old_val)
        if diff > 0:   return "↑"
        if diff < 0:   return "↓"
        return "→"
    except:
        return "→"


# ─────────────────────────────────────────────
# LOCAL CONTEXT BUILDER
# ─────────────────────────────────────────────

def build_local_context(graph_data: dict, entities: dict) -> str:
    """
    Builds context string from local_retrieve() output.
    Focuses on the specific entities the user asked about.
    """
    sections = []

    # ── Lab Trends ──────────────────────────────────────────────
    if graph_data.get("lab_trends"):
        lines = ["LAB RESULTS & TRENDS:"]
        for row in graph_data["lab_trends"]:
            test   = row.get("test_name", "Unknown Test")
            date   = _fmt_date(row.get("date"))
            value  = row.get("value", "N/A")
            unit   = row.get("unit", "")
            status = row.get("status", "")
            nrange = row.get("normal_range", "")

            status_tag = f" [{status.upper()}]" if status else ""
            nrange_tag = f" (normal: {nrange})" if nrange else ""
            lines.append(f"  • {test} on {date}: {value} {unit}{status_tag}{nrange_tag}")

            # Show history chain
            history = [h for h in (row.get("history") or []) if h.get("date")]
            history_sorted = sorted(history, key=lambda x: x.get("date", ""), reverse=True)
            for h in history_sorted[:4]:  # show last 4 historical values
                h_date  = _fmt_date(h.get("date"))
                h_val   = h.get("value", "N/A")
                h_unit  = h.get("unit", unit)
                h_stat  = h.get("status", "")
                h_tag   = f" [{h_stat.upper()}]" if h_stat else ""
                arrow   = _trend_direction(h_val, value)
                lines.append(f"    ↳ {h_date}: {h_val} {h_unit}{h_tag}  {arrow}")

        sections.append("\n".join(lines))

    # ── Prescriptions ────────────────────────────────────────────
    if graph_data.get("prescriptions"):
        lines = ["PRESCRIPTIONS:"]
        for row in graph_data["prescriptions"]:
            drug  = row.get("drug_name", "Unknown Drug")
            date  = _fmt_date(row.get("date"))
            dose  = row.get("dose", "")
            freq  = row.get("frequency", "")
            lines.append(f"  • {drug} {dose} {freq} — prescribed {date}")

            history = [h for h in (row.get("history") or []) if h.get("date")]
            history_sorted = sorted(history, key=lambda x: x.get("date", ""), reverse=True)
            for h in history_sorted[:3]:
                lines.append(f"    ↳ {_fmt_date(h.get('date'))}: {h.get('dose','')} {h.get('frequency','')}")

        sections.append("\n".join(lines))

    # ── Diagnoses ────────────────────────────────────────────────
    if graph_data.get("diagnoses"):
        lines = ["DIAGNOSES:"]
        for row in graph_data["diagnoses"]:
            name = row.get("diagnosis_name", "Unknown")
            date = _fmt_date(row.get("date"))
            icd  = row.get("icd_code", "")
            icd_tag = f" (ICD: {icd})" if icd else ""
            lines.append(f"  • {name}{icd_tag} — diagnosed {date}")
        sections.append("\n".join(lines))

    # ── Wearable Metric Trends ────────────────────────────────────
    if graph_data.get("metric_trends"):
        lines = ["WEARABLE METRICS:"]
        for row in graph_data["metric_trends"]:
            metric = row.get("metric_name", "Unknown Metric")
            date   = _fmt_date(row.get("date"))
            value  = row.get("value", "N/A")
            unit   = row.get("unit", "")
            agg    = row.get("aggregation", "")
            agg_tag = f" ({agg})" if agg else ""
            lines.append(f"  • {metric} on {date}: {value} {unit}{agg_tag}")

            history = [h for h in (row.get("history") or []) if h.get("date")]
            history_sorted = sorted(history, key=lambda x: x.get("date", ""), reverse=True)
            for h in history_sorted[:4]:
                h_date = _fmt_date(h.get("date"))
                h_val  = h.get("value", "N/A")
                arrow  = _trend_direction(h_val, value)
                lines.append(f"    ↳ {h_date}: {h_val} {unit}  {arrow}")

        sections.append("\n".join(lines))

    # ── Scan Findings ────────────────────────────────────────────
    if graph_data.get("scan_findings"):
        lines = ["SCAN FINDINGS:"]
        for row in graph_data["scan_findings"]:
            mod  = row.get("modality", "Scan")
            part = row.get("body_part", "")
            date = _fmt_date(row.get("date"))
            desc = row.get("description", "")
            sev  = row.get("severity", "")
            sev_tag = f" [{sev}]" if sev else ""
            lines.append(f"  • {mod} ({part}) on {date}: {desc}{sev_tag}")
        sections.append("\n".join(lines))

    # ── Inferred Edges ────────────────────────────────────────────
    if graph_data.get("inferred_edges"):
        lines = ["AI-INFERRED RELATIONSHIPS (confidence score included):"]
        for edge in graph_data["inferred_edges"]:
            rel    = edge.get("relation_type", "RELATED_TO").replace("_", " ")
            src    = edge.get("source_id", "?")
            tgt    = edge.get("target_id", "?")
            conf   = edge.get("confidence", 0)
            reason = edge.get("reason", "")
            lines.append(f"  • [{conf:.0%} confidence] {src} → {rel} → {tgt}")
            if reason:
                lines.append(f"    Reason: {reason}")
        sections.append("\n".join(lines))

    if not sections:
        return "No relevant data found in the graph for this query."

    return "\n\n".join(sections)


# ─────────────────────────────────────────────
# GLOBAL CONTEXT BUILDER
# ─────────────────────────────────────────────

def build_global_context(graph_data: dict) -> str:
    """
    Builds context string from global_retrieve() output.
    Gives a full structured overview of the patient's health record.
    """
    sections = []

    # ── Patient Profile ───────────────────────────────────────────
    profile = graph_data.get("patient_profile", {})
    if profile and any(profile.values()):
        lines = ["PATIENT PROFILE:"]
        if profile.get("name"):          lines.append(f"  Name:               {profile['name']}")
        if profile.get("dob"):           lines.append(f"  Date of Birth:      {profile['dob']}")
        if profile.get("sex"):           lines.append(f"  Sex:                {profile['sex']}")
        if profile.get("blood_group"):   lines.append(f"  Blood Group:        {profile['blood_group']}")
        conditions = profile.get("chronic_conditions") or []
        if conditions:
            lines.append(f"  Chronic Conditions: {', '.join(conditions)}")
        sections.append("\n".join(lines))

    # ── Visit Timeline ────────────────────────────────────────────
    visits = graph_data.get("visits", [])
    if visits:
        dates = [_fmt_date(v["date"]) for v in visits]
        sections.append(f"VISIT TIMELINE ({len(visits)} visits):\n  " + " | ".join(dates))

    # ── Lab Results ───────────────────────────────────────────────
    labs = graph_data.get("lab_results", [])
    if labs:
        lines = [f"LAB RESULTS ({len(labs)} records):"]
        # Group by test name for readability
        by_test = {}
        for l in labs:
            t = l.get("test", "Unknown")
            by_test.setdefault(t, []).append(l)

        for test_name, records in sorted(by_test.items()):
            readings = []
            for r in records:
                status = r.get("status", "")
                tag = f" [{status.upper()}]" if status else ""
                readings.append(f"{_fmt_date(r['date'])}: {r.get('value','?')} {r.get('unit','')}{tag}")
            lines.append(f"  {test_name}: " + " → ".join(readings))

        sections.append("\n".join(lines))

    # ── Lab Trends (delta summary) ────────────────────────────────
    trends = graph_data.get("lab_trends", [])
    if trends:
        lines = ["LAB TRENDS (changes over time):"]
        for t in trends:
            test     = t.get("test", "?")
            from_d   = _fmt_date(t.get("from_date"))
            to_d     = _fmt_date(t.get("to_date"))
            from_v   = t.get("from_value", "?")
            to_v     = t.get("to_value", "?")
            unit     = t.get("unit", "")
            status   = t.get("status", "")
            arrow    = _trend_direction(from_v, to_v)
            stat_tag = f" [{status.upper()}]" if status else ""
            lines.append(f"  {test}: {from_v} ({from_d}) {arrow} {to_v} {unit} ({to_d}){stat_tag}")
        sections.append("\n".join(lines))

    # ── Diagnoses ─────────────────────────────────────────────────
    diagnoses = graph_data.get("diagnoses", [])
    if diagnoses:
        lines = [f"DIAGNOSES ({len(diagnoses)} records):"]
        for d in diagnoses:
            icd = d.get("icd_code", "")
            icd_tag = f" (ICD: {icd})" if icd else ""
            lines.append(f"  • {d.get('diagnosis','?')}{icd_tag} — {_fmt_date(d.get('date'))}")
        sections.append("\n".join(lines))

    # ── Prescriptions ─────────────────────────────────────────────
    prescriptions = graph_data.get("prescriptions", [])
    if prescriptions:
        lines = [f"PRESCRIPTIONS ({len(prescriptions)} records):"]
        for rx in prescriptions:
            lines.append(f"  • {rx.get('drug','?')} {rx.get('dose','')} {rx.get('frequency','')} — {_fmt_date(rx.get('date'))}")
        sections.append("\n".join(lines))

    # ── Scan Findings ─────────────────────────────────────────────
    findings = graph_data.get("scan_findings", [])
    if findings:
        lines = [f"SCAN FINDINGS ({len(findings)} findings):"]
        for f in findings:
            sev = f.get("severity", "")
            sev_tag = f" [{sev}]" if sev else ""
            lines.append(f"  • {f.get('modality','?')} ({f.get('body_part','?')}) on {_fmt_date(f.get('date'))}: {f.get('description','?')}{sev_tag}")
        sections.append("\n".join(lines))

    # ── Wearable Summary ──────────────────────────────────────────
    wearable = graph_data.get("wearable", [])
    if wearable:
        lines = [f"WEARABLE DATA ({len(wearable)} data points):"]
        by_metric = {}
        for w in wearable:
            m = w.get("metric", "Unknown")
            by_metric.setdefault(m, []).append(w)

        for metric_name, records in sorted(by_metric.items()):
            vals = [f"{_fmt_date(r['date'])}: {r.get('value','?')} {r.get('unit','')}" for r in records[-5:]]
            lines.append(f"  {metric_name}: " + " | ".join(vals))

        sections.append("\n".join(lines))

    # ── Inferred Edges ────────────────────────────────────────────
    inferred = graph_data.get("inferred_edges", [])
    if inferred:
        lines = [f"AI-INFERRED RELATIONSHIPS ({len(inferred)} relationships):"]
        for edge in inferred:
            rel    = edge.get("relation_type", "RELATED_TO").replace("_", " ")
            conf   = edge.get("confidence", 0)
            reason = edge.get("reason", "")
            src    = edge.get("source_id", "?")
            tgt    = edge.get("target_id", "?")
            lines.append(f"  • [{conf:.0%}] {src} → {rel} → {tgt}")
            if reason:
                lines.append(f"    {reason}")
        sections.append("\n".join(lines))

    if not sections:
        return "No health data found in the graph."

    return "\n\n".join(sections)
