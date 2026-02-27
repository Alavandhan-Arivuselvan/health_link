"""
checkin.py — Daily health check-in for the Health Knowledge Graph.

Behaviour:
  - Skips if already completed today
  - Generates 5 personalised questions from last visit data
  - Rotates topics so same question isn't repeated next day
  - Follows up on any concerning answers from yesterday
  - Saves responses to graph as CheckIn node

Usage:
    python checkin.py
"""

import os
import re
import json
from datetime import datetime
from pathlib import Path

from neo4j import GraphDatabase
from google import genai

from config import (
    NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD,
    GEMINI_API_KEY, GEMINI_MODEL
)

# ─────────────────────────────────────────────
# CONNECTIONS
# ─────────────────────────────────────────────

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
client = genai.Client(api_key=GEMINI_API_KEY)

TODAY = datetime.now().strftime("%Y-%m-%d")

# All possible topic areas — Gemini picks from these to avoid repetition
ALL_TOPICS = [
    "medication_adherence",
    "side_effects",
    "energy_fatigue",
    "diet_choices",
    "hydration",
    "sleep_quality",
    "physical_activity",
    "stress_mood",
    "pain_discomfort",
    "symptoms_general",
    "blood_sugar_awareness",
    "vision_changes",
    "digestive_health",
    "motivation",
]


# ─────────────────────────────────────────────
# DISPLAY HELPERS
# ─────────────────────────────────────────────

def clear():
    os.system('cls' if os.name == 'nt' else 'clear')

def header():
    print("\n" + "═"*55)
    print("   ✅  DAILY HEALTH CHECK-IN")
    print("═"*55)
    print("  5 quick questions. Takes under a minute.")
    print("─"*55)

def section(title):
    print(f"\n  ── {title}")


# ─────────────────────────────────────────────
# STEP 1: SKIP IF ALREADY DONE TODAY
# ─────────────────────────────────────────────

def already_checked_in_today() -> bool:
    """Returns True if a CheckIn node with today's date already exists."""
    with driver.session() as session:
        result = session.run("""
            MATCH (c:CheckIn {date: $today})
            RETURN count(c) AS count
        """, today=TODAY).single()
    return result and result["count"] > 0


# ─────────────────────────────────────────────
# STEP 2: FETCH LAST VISIT + RECENT CHECK-INS
# ─────────────────────────────────────────────

def fetch_last_visit() -> dict:
    """Pulls all data from the most recent Visit node."""
    with driver.session() as session:

        latest = session.run("""
            MATCH (v:Visit)
            RETURN v.date AS date
            ORDER BY v.date DESC
            LIMIT 1
        """).single()

        if not latest:
            return {}

        date = latest["date"]

        labs = session.run("""
            MATCH (v:Visit {date: $date})-[:HAS_MEDICAL_DATA]->(m:MedicalData)
            MATCH (m)-[:CONTAINS]->(l:LabResult)-[:INSTANCE_OF]->(t:TestType)
            RETURN t.display_name AS test, l.value AS value,
                   l.unit AS unit, l.status AS status,
                   l.normal_range AS normal_range
        """, date=date).data()

        rxs = session.run("""
            MATCH (v:Visit {date: $date})-[:HAS_MEDICAL_DATA]->(m:MedicalData)
            MATCH (m)-[:CONTAINS]->(rx:Prescription)-[:INSTANCE_OF]->(d:DrugType)
            RETURN d.display_name AS drug, rx.dose AS dose, rx.frequency AS frequency
        """, date=date).data()

        diagnoses = session.run("""
            MATCH (v:Visit {date: $date})-[:HAS_MEDICAL_DATA]->(m:MedicalData)
            MATCH (m)-[:CONTAINS]->(dg:Diagnosis)-[:INSTANCE_OF]->(dt:DiagnosisType)
            RETURN dt.display_name AS name, dg.icd_code AS icd_code
        """, date=date).data()

        findings = session.run("""
            MATCH (v:Visit {date: $date})-[:HAS_SCAN]->(s:Scan)
            MATCH (s)-[:CONTAINS]->(f:Finding)
            RETURN s.modality AS modality, f.description AS description,
                   f.severity AS severity
        """, date=date).data()

        wearable = session.run("""
            MATCH (m:Metric)-[:INSTANCE_OF]->(mt:MetricType)
            WHERE m.date <= $date
              AND m.aggregation IN ['daily_avg', 'daily_total']
            RETURN mt.display_name AS metric, m.value AS value,
                   m.unit AS unit, m.date AS date
            ORDER BY m.date DESC
            LIMIT 20
        """, date=date).data()

    return {
        "visit_date":    date,
        "labs":          labs,
        "prescriptions": rxs,
        "diagnoses":     diagnoses,
        "findings":      findings,
        "wearable":      wearable,
    }


def fetch_recent_checkins(limit: int = 3) -> list:
    """
    Returns the last N check-ins (excluding today) with their responses
    and the topic contexts used — so we can rotate and follow up.
    """
    with driver.session() as session:
        rows = session.run("""
            MATCH (c:CheckIn)
            WHERE c.date < $today
            RETURN c.date AS date, c.responses AS responses_json
            ORDER BY c.date DESC
            LIMIT $limit
        """, today=TODAY, limit=limit).data()

    checkins = []
    for row in rows:
        try:
            responses = json.loads(row["responses_json"])
            checkins.append({
                "date":      row["date"],
                "responses": responses,
            })
        except Exception:
            pass

    return checkins


# ─────────────────────────────────────────────
# STEP 3: BUILD PROMPT CONTEXT
# ─────────────────────────────────────────────

def _build_visit_summary(visit_data: dict) -> str:
    labs_str = "\n".join(
        f"  - {l['test']}: {l['value']} {l['unit']} [{l.get('status','?')}]"
        f" (normal: {l.get('normal_range','')})"
        for l in visit_data.get("labs", [])
    ) or "  (none)"

    rx_str = "\n".join(
        f"  - {r['drug']} {r['dose']} {r['frequency']}"
        for r in visit_data.get("prescriptions", [])
    ) or "  (none)"

    dx_str = "\n".join(
        f"  - {d['name']}"
        for d in visit_data.get("diagnoses", [])
    ) or "  (none)"

    findings_str = "\n".join(
        f"  - {f['modality']}: {f['description']} [{f.get('severity','')}]"
        for f in visit_data.get("findings", [])
    ) or "  (none)"

    wearable_str = "\n".join(
        f"  - {w['metric']}: {w['value']} {w['unit']} ({w['date']})"
        for w in visit_data.get("wearable", [])[:8]
    ) or "  (none)"

    return f"""Lab Results:
{labs_str}

Prescriptions:
{rx_str}

Diagnoses:
{dx_str}

Scan Findings:
{findings_str}

Recent Wearable Data:
{wearable_str}"""


def _build_history_context(recent_checkins: list) -> tuple[str, list, list]:
    """
    Returns:
      - formatted history string for prompt
      - list of topic contexts used recently (to avoid repeating)
      - list of concerning answers to follow up on
    """
    if not recent_checkins:
        return "(No previous check-ins)", [], []

    used_topics = []
    concerns    = []
    lines       = []

    # Concern indicators — answers containing these words flag a follow-up
    concern_keywords = [
        "rough", "missed", "tired", "wiped", "exhausted", "pain",
        "bad", "not good", "off track", "quite a bit", "can't",
        "haven't", "sluggish", "queasy", "upset", "worse", "struggling"
    ]

    for ci in recent_checkins:
        lines.append(f"  Check-in on {ci['date']}:")
        for r in ci.get("responses", []):
            topic  = r.get("context", "")
            answer = r.get("answer", "")
            q      = r.get("question", "")

            if topic:
                used_topics.append(topic)

            # Flag concerning answers
            answer_lower = answer.lower()
            if any(kw in answer_lower for kw in concern_keywords):
                concerns.append({
                    "date":     ci["date"],
                    "question": q,
                    "answer":   answer,
                    "topic":    topic,
                })

            lines.append(f"    [{topic}] Q: {q}")
            lines.append(f"             A: {answer}")

    return "\n".join(lines), used_topics, concerns


# ─────────────────────────────────────────────
# STEP 4: GENERATE 5 QUESTIONS
# ─────────────────────────────────────────────

def generate_questions(visit_data: dict, recent_checkins: list) -> list:
    """
    Generates 5 personalised check-in questions using:
    - Last visit health data (for relevance)
    - Recent check-in history (for rotation + follow-up)
    """
    history_str, used_topics, concerns = _build_history_context(recent_checkins)
    visit_summary = _build_visit_summary(visit_data)

    # Topics NOT used recently — prefer these
    available_topics = [t for t in ALL_TOPICS if t not in used_topics[-5:]]
    topics_str = ", ".join(available_topics[:8]) if available_topics else "any topic"

    # Format concerns for follow-up instruction
    if concerns:
        concerns_str = "\n".join(
            f"  - On {c['date']}, they said '{c['answer']}' to: \"{c['question']}\""
            for c in concerns[:3]
        )
        followup_instruction = f"""
IMPORTANT — Follow up on these concerning answers from recent check-ins:
{concerns_str}
Include at least 1 question that checks in on how these specific issues are today.
"""
    else:
        followup_instruction = "(No concerning answers to follow up on.)"

    prompt = f"""
You are a friendly health assistant generating a daily check-in for a patient.

━━━ LAST VISIT DATA ({visit_data.get('visit_date', 'unknown')}) ━━━
{visit_summary}

━━━ RECENT CHECK-IN HISTORY ━━━
{history_str}

━━━ ROTATION RULES ━━━
Topics used recently (DO NOT repeat these): {", ".join(used_topics[-5:]) or "none yet"}
Preferred fresh topics to pick from: {topics_str}

━━━ FOLLOW-UP INSTRUCTIONS ━━━
{followup_instruction}

━━━ TASK ━━━
Generate exactly 5 check-in questions for TODAY.

RULES:
- Each question must be SHORT, conversational, friendly — not clinical.
- Directly tied to their health data (specific drug, diagnosis, lab result, or metric).
- Exactly 4 answer options each — quick and distinct, covering the realistic range.
- Mix of: 1-2 follow-up questions on concerns (if any) + 3-4 fresh topic questions.
- Do NOT repeat questions from recent history.
- context field: one of the topic slugs (e.g. "medication_adherence", "sleep_quality").

━━━ OUTPUT — valid JSON only, no markdown ━━━
[
  {{
    "id": 1,
    "question": "How consistent have you been taking your Metformin this week?",
    "context": "medication_adherence",
    "options": [
      "Took every dose",
      "Missed 1-2 doses",
      "Missed several doses",
      "Haven't been taking it"
    ]
  }}
]

Generate all 5 questions now. JSON only.
"""

    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    raw = response.text.strip()
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'^```\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        questions = json.loads(raw)
        if isinstance(questions, list) and len(questions) > 0:
            return questions
    except json.JSONDecodeError as e:
        print(f"\n  ⚠ Could not parse questions: {e}")
        print(f"  Raw output:\n{raw[:400]}")

    return []


# ─────────────────────────────────────────────
# STEP 5: INTERACTIVE Q&A
# ─────────────────────────────────────────────

def ask_questions(questions: list) -> list:
    responses = []
    print(f"\n  Answer each question by typing a number (1-4).\n")

    for q in questions:
        print(f"  ─────────────────────────────────────────────")
        print(f"  Q{q['id']}/5  {q['question']}")
        print()

        options = q.get("options", [])
        for j, opt in enumerate(options, 1):
            print(f"    {j}.  {opt}")

        while True:
            raw = input("\n  Your answer: ").strip()
            if raw.isdigit() and 1 <= int(raw) <= len(options):
                chosen = options[int(raw) - 1]
                print(f"  ✓ Got it.\n")
                responses.append({
                    "question_id":  q["id"],
                    "question":     q["question"],
                    "context":      q.get("context", ""),
                    "answer":       chosen,
                    "answer_index": int(raw) - 1,
                })
                break
            else:
                print(f"  Please enter a number between 1 and {len(options)}.")

    return responses


# ─────────────────────────────────────────────
# STEP 6: SAVE CHECK-IN TO GRAPH
# ─────────────────────────────────────────────

def save_checkin(visit_date: str, responses: list):
    checkin_id   = f"checkin_{TODAY}_{datetime.now().strftime('%H%M%S')}"
    checkin_time = datetime.now().isoformat()
    responses_json = json.dumps(responses)

    with driver.session() as session:
        session.run("""
            MERGE (v:Visit {date: $visit_date})
            CREATE (c:CheckIn {
                checkin_id:    $checkin_id,
                date:          $today,
                timestamp:     $checkin_time,
                responses:     $responses_json,
                visit_date:    $visit_date
            })
            MERGE (v)-[:HAS_CHECKIN]->(c)
        """,
            visit_date=visit_date,
            checkin_id=checkin_id,
            today=TODAY,
            checkin_time=checkin_time,
            responses_json=responses_json,
        )

    print(f"  ✓ Check-in saved (id: {checkin_id})")


# ─────────────────────────────────────────────
# STEP 7: SUMMARY
# ─────────────────────────────────────────────

def generate_summary(responses: list, visit_data: dict, had_concerns: bool) -> str:
    responses_str = "\n".join(
        f"  Q: {r['question']}\n  A: {r['answer']}"
        for r in responses
    )

    followup_note = (
        "Some of these questions were follow-ups on issues from yesterday — "
        "note whether things have improved, stayed the same, or gotten worse."
        if had_concerns else ""
    )

    prompt = f"""
A patient just completed their daily health check-in. Here are their answers:

{responses_str}

Their health context:
- Diagnoses: {', '.join(d['name'] for d in visit_data.get('diagnoses', [])) or 'none'}
- Medications: {', '.join(r['drug'] for r in visit_data.get('prescriptions', [])) or 'none'}

{followup_note}

Write a SHORT (3-4 sentences) friendly summary of how they seem to be doing today.
- Warm and direct, not clinical.
- Highlight anything that stands out — positive or concerning.
- End with one practical suggestion if something needs attention.
- Plain sentences only. No bullet points.
"""

    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return response.text.strip()


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    clear()
    header()

    # Skip if already done today
    if already_checked_in_today():
        print(f"\n  ✓ You've already completed today's check-in ({TODAY}).")
        print("  Come back tomorrow!\n")
        driver.close()
        return

    # Fetch data
    section("Loading your latest health data...")
    visit_data = fetch_last_visit()

    if not visit_data:
        print("\n  ⚠ No visits found in your graph.")
        print("  Ingest a medical report first using Graph_Schema/run.py\n")
        driver.close()
        return

    print(f"  ✓ Last visit: {visit_data['visit_date']}")
    print(f"  Found: {len(visit_data['labs'])} lab results, "
          f"{len(visit_data['prescriptions'])} prescriptions, "
          f"{len(visit_data['diagnoses'])} diagnoses")

    # Fetch recent check-in history
    recent_checkins = fetch_recent_checkins(limit=3)
    if recent_checkins:
        print(f"  ✓ Last {len(recent_checkins)} check-in(s) loaded for rotation + follow-up")
    else:
        print(f"  → No previous check-ins found — generating fresh questions")

    # Detect if there were concerns yesterday for summary context
    _, _, concerns = _build_history_context(recent_checkins)
    had_concerns = len(concerns) > 0

    if had_concerns:
        print(f"  ⚠ {len(concerns)} concern(s) from recent check-ins — will follow up")

    # Generate questions
    section("Generating your personalised questions...")
    questions = generate_questions(visit_data, recent_checkins)

    if not questions:
        print("\n  ✗ Could not generate questions. Check your Gemini connection.\n")
        driver.close()
        return

    print(f"  ✓ {len(questions)} questions ready.\n")

    # Ask questions
    print("═"*55)
    responses = ask_questions(questions)

    # Save to graph
    section("Saving your check-in...")
    save_checkin(visit_data["visit_date"], responses)

    # Summary
    section("Today's summary")
    print("\n  Generating insight...\n")
    summary = generate_summary(responses, visit_data, had_concerns)
    print("  " + "\n  ".join(summary.split("\n")))

    print("\n" + "═"*55)
    print("  Check-in complete. See you tomorrow!")
    print("═"*55 + "\n")

    driver.close()


if __name__ == "__main__":
    main()