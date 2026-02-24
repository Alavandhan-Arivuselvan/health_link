import os
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai
from neo4j import GraphDatabase
import json

# Load environment
load_dotenv()

# Gemini setup
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-3-flash-preview")

# Neo4j setup
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

# Predefined relation types (for consistency)
ALLOWED_RELATIONS = [
    "HAS_NAME", "HAS_AGE_SEX", "HAS_DIAGNOSIS", "HAS_SYMPTOM",
    "HAS_VALUE", "HAS_NORMAL_RANGE", "PRESCRIBED_DOSE", "TREATED_WITH",
    "MEASURED_ON", "CONSULTED_WITH", "REPORTED_ON"
]

# 1. Read text file
def read_report(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read().strip()
    return text

# 2. Gemini prompt to extract structured JSON + triples
def extract_structured_and_triples(text, report_date=None):
    if report_date is None:
        report_date = datetime.now().strftime("%Y-%m-%d")

    prompt = f"""
You are a precise medical knowledge graph extractor.

INPUT TEXT:
{text}

TASK:
1. First, extract structured data as JSON.
2. Then, from that structured data, generate consistent triples.

OUTPUT FORMAT: ONLY valid JSON object with two keys:
{{
  "structured": {{ ... }},
  "triples": [ ... ]
}}

NO explanations, NO markdown, NO extra text. Start directly with {{

"structured" keys (use null if missing):
- patient_name
- age_sex
- admission_date
- discharge_date
- consultant
- diagnosis
- chief_complaints
- lab_tests: [{{test, value, unit, normal_range}}]
- medications: [{{drug, dose, frequency}}]
- other_notes

Normalize names (HbA1c, not HBA1C)

"triples" array: ONLY these 5 keys per object:
- subject (canonical name)
- relation (UPPER_SNAKE_CASE, only from: {', '.join(ALLOWED_RELATIONS)})
- object (canonical name or value)
- subject_type (Patient, Test, Value, Drug, Dose, Diagnosis, etc.)
- object_type (same as above)

Add "date": "{report_date}" to each triple.

Examples:
{{
  "structured": {{ "patient_name": "Mr. SONAIMUTHU", ... }},
  "triples": [
    {{"subject": "Patient", "relation": "HAS_NAME", "object": "Mr. SONAIMUTHU", "subject_type": "Patient", "object_type": "Name", "date": "{report_date}"}},
    {{"subject": "HbA1c", "relation": "HAS_VALUE", "object": "7.8%", "subject_type": "Test", "object_type": "Value", "date": "{report_date}"}}
  ]
}}
"""

    response = model.generate_content(prompt)
    raw = response.text.strip()

    # Clean markdown if added
    if raw.startswith("```json"):
        raw = raw.split("```json")[1].split("```")[0].strip()

    try:
        data = json.loads(raw)
        return data.get("triples", [])
    except Exception as e:
        print("Parse failed:", e)
        print("Raw response:", raw[:800])
        return []

# 3. Add to Neo4j with MERGE (automatic connection)
def add_to_graph(triples):
    with driver.session() as session:
        for t in triples:
            subj = t["subject"]
            obj = t["object"]
            rel = t["relation"]
            s_type = t["subject_type"]
            o_type = t["object_type"]
            date = t.get("date", datetime.now().strftime("%Y-%m-%d"))

            session.run("""
                MERGE (s:HealthEntity {canonical_lower: toLower($subj), type: $s_type})
                SET s.name = $subj
                MERGE (o:HealthEntity {canonical_lower: toLower($obj), type: $o_type})
                SET o.name = $obj
                MERGE (s)-[r:`%s` {date: $date}]->(o)
                SET r.source_date = $date
            """ % rel, subj=subj, obj=obj, s_type=s_type, o_type=o_type, date=date)

        print(f"Added/merged {len(triples)} triples into the graph.")

# 4. Main execution
if __name__ == "__main__":
    # Change this to your text file path
    file_path = "reports/sample_report.txt"  # ← put your text file here

    text = read_report(file_path)
    print("Report text loaded.")

    triples = extract_structured_and_triples(text)
    
    if triples:
        print(f"Generated {len(triples)} triples:")
        for t in triples:
            print(t)
        
        add_to_graph(triples)
        print("Graph updated!")
    else:
        print("No triples generated.")