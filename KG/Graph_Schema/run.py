"""
run.py — Interactive runner for the Health Knowledge Graph.
Just run: python run.py
No command line arguments needed.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime


# ─────────────────────────────────────────────
# DISPLAY HELPERS
# ─────────────────────────────────────────────

def clear():
    os.system('cls' if os.name == 'nt' else 'clear')

def header():
    print("\n" + "="*55)
    print("       🏥  HEALTH KNOWLEDGE GRAPH")
    print("="*55)

def section(title):
    print(f"\n── {title} {'─'*(45 - len(title))}")

def success(msg): print(f"  ✓ {msg}")
def warn(msg):    print(f"  ⚠ {msg}")
def error(msg):   print(f"  ✗ {msg}")
def info(msg):    print(f"  → {msg}")

def ask(prompt, default=None):
    """Simple input with optional default."""
    suffix = f" [{default}]" if default else ""
    value = input(f"\n  {prompt}{suffix}: ").strip()
    return value if value else default

def choose(prompt, options: list):
    """
    Show a numbered menu and return the chosen option.
    options: list of strings
    """
    print(f"\n  {prompt}")
    for i, opt in enumerate(options, 1):
        print(f"    {i}. {opt}")
    while True:
        raw = input("\n  Enter number: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return options[int(raw) - 1]
        print("  Invalid choice, try again.")

def confirm(prompt):
    ans = input(f"\n  {prompt} (y/n): ").strip().lower()
    return ans in ("y", "yes")


# ─────────────────────────────────────────────
# STEP 1: SETUP / CREDENTIALS
# ─────────────────────────────────────────────

def load_env_file():
    """Load .env file into a dict. Returns empty dict if file doesn't exist."""
    env = {}
    env_path = Path(".env")
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    return env


def save_env_file(env: dict):
    with open(".env", "w") as f:
        for k, v in env.items():
            f.write(f"{k}={v}\n")


def is_placeholder(val):
    """Returns True if value is empty or an unfilled placeholder."""
    if not val:
        return True
    placeholders = ["your_actual_gemini_key_here", "your_neo4j_password_here",
                    "your_gemini_api_key_here", "your_password_here"]
    return val.strip() in placeholders


def setup_credentials():
    """
    Check if .env exists and has all required keys.
    If not, walk the user through filling them in.
    """
    section("Setup & Credentials")

    env = load_env_file()
    changed = False

    # ── Gemini API Key ──────────────────────────
    if is_placeholder(env.get("GEMINI_API_KEY")):
        print("\n  You need a Gemini API key.")
        print("  Get one free at: https://aistudio.google.com  →  'Get API Key'")
        key = ask("Paste your Gemini API key")
        if not key:
            error("Gemini API key is required. Exiting.")
            sys.exit(1)
        env["GEMINI_API_KEY"] = key
        changed = True
    else:
        success("Gemini API key found.")

    # ── Neo4j Connection Type ───────────────────
    if is_placeholder(env.get("NEO4J_URI")):
        print("\n  Which Neo4j are you using?")
        db_type = choose("Select database type:", [
            "Neo4j AuraDB (cloud) — neo4j+s://xxxxxx.databases.neo4j.io",
            "Neo4j Desktop (local) — bolt://localhost:7687",
        ])

        if "AuraDB" in db_type:
            print("\n  Find your connection details in AuraDB console:")
            print("  aura.neo4j.io → your instance → 'Connect' tab")
            uri = ask("Paste your AuraDB URI (starts with neo4j+s://)")
            if not uri or not uri.startswith("neo4j"):
                error("Invalid URI. It should start with neo4j+s://")
                sys.exit(1)
            env["NEO4J_URI"] = uri
            env["NEO4J_USERNAME"] = ask("AuraDB username", default="neo4j")
            pwd = ask("AuraDB password")
            if not pwd:
                error("Password is required.")
                sys.exit(1)
            env["NEO4J_PASSWORD"] = pwd
        else:
            env["NEO4J_URI"] = "bolt://localhost:7687"
            env["NEO4J_USERNAME"] = "neo4j"
            pwd = ask("Neo4j Desktop password")
            if not pwd:
                error("Password is required.")
                sys.exit(1)
            env["NEO4J_PASSWORD"] = pwd

        changed = True

    elif is_placeholder(env.get("NEO4J_PASSWORD")):
        # URI exists but password is missing/placeholder
        print(f"\n  Neo4j URI: {env.get('NEO4J_URI')}")
        pwd = ask("Enter your Neo4j password")
        if not pwd:
            error("Password is required.")
            sys.exit(1)
        env["NEO4J_PASSWORD"] = pwd
        if not env.get("NEO4J_USERNAME"):
            env["NEO4J_USERNAME"] = "neo4j"
        changed = True

    else:
        success(f"Neo4j URI found: {env.get('NEO4J_URI')}")

    # ── Save & Load ─────────────────────────────
    if changed:
        save_env_file(env)
        success(".env saved.")

    # Push into os.environ so all modules can read them
    for k, v in env.items():
        os.environ[k] = v

    success("Credentials loaded.")
    return env


# ─────────────────────────────────────────────
# STEP 2: TEST CONNECTIONS
# ─────────────────────────────────────────────

def test_connections():
    section("Testing Connections")

    # Test Neo4j
    uri = os.environ.get("NEO4J_URI", "")
    info(f"Connecting to Neo4j at {uri} ...")
    try:
        from neo4j import GraphDatabase
        d = GraphDatabase.driver(
            uri,
            auth=(os.environ["NEO4J_USERNAME"], os.environ["NEO4J_PASSWORD"])
        )
        d.verify_connectivity()
        d.close()
        success("Neo4j connected.")
    except Exception as e:
        error(f"Neo4j connection failed: {e}")
        if "neo4j+s://" in uri or "aura" in uri.lower():
            print("\n  AuraDB tips:")
            print("  • Check your URI at: aura.neo4j.io → your instance → Connect tab")
            print("  • Make sure the instance is RUNNING (not paused — free tier pauses after 3 days)")
            print("  • Password is shown only once — reset it in the AuraDB console if lost")
        else:
            print("\n  Neo4j Desktop tips:")
            print("  • Open Neo4j Desktop and click START on your database")
            print("  • Default URI is bolt://localhost:7687")
        print("\n  Delete your .env file and run again to re-enter credentials.")
        sys.exit(1)

    # Test Gemini
    info("Connecting to Gemini...")
    try:
        from google import genai as genai_sdk
        c = genai_sdk.Client(api_key=os.environ["GEMINI_API_KEY"])
        c.models.generate_content(model="gemini-2.0-flash", contents="Say OK")
        success("Gemini connected.")
    except Exception as e:
        error(f"Gemini connection failed: {e}")
        print("\n  Check your Gemini API key at: aistudio.google.com")
        sys.exit(1)


# ─────────────────────────────────────────────
# STEP 3: CHOOSE WHAT TO DO
# ─────────────────────────────────────────────

def main_menu():
    section("What would you like to do?")
    return choose("Choose an option:", [
        "Ingest a medical report (lab results, prescriptions, diagnoses)",
        "Ingest a scan report (X-Ray, MRI, CT, Ultrasound)",
        "Ingest wearable data (heart rate, steps, SpO2, etc.)",
        "Exit"
    ])


# ─────────────────────────────────────────────
# FILE PICKER
# ─────────────────────────────────────────────

def pick_file(label, extensions=None):
    """
    Ask user for a file path. Shows files in current dir as hints.
    """
    print(f"\n  Enter the path to your {label}.")

    # Show nearby files as hint
    hints = []
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', '.env']]
        for f in files:
            if extensions is None or any(f.endswith(e) for e in extensions):
                hints.append(os.path.join(root, f).lstrip("./"))
        if len(hints) > 10:
            break

    if hints:
        print("\n  Files found in this folder:")
        for i, h in enumerate(hints[:10], 1):
            print(f"    {i}. {h}")
        raw = input("\n  Enter number OR type full path: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(hints):
            return hints[int(raw) - 1]
        return raw
    else:
        return ask(f"Full path to {label}")


def pick_date(label="Report date"):
    """Ask for date, default to today."""
    today = datetime.now().strftime("%Y-%m-%d")
    raw = ask(f"{label} (YYYY-MM-DD)", default=today)
    try:
        datetime.strptime(raw, "%Y-%m-%d")
        return raw
    except ValueError:
        warn(f"Invalid date '{raw}', using today: {today}")
        return today


# ─────────────────────────────────────────────
# INGEST FLOWS
# ─────────────────────────────────────────────

def flow_medical():
    section("Ingest Medical Report")
    file_path = pick_file("medical report (.txt or .pdf)", [".txt", ".pdf"])
    date = pick_date("Report date")

    if not Path(file_path).exists():
        error(f"File not found: {file_path}")
        return

    info(f"Ingesting {file_path} for {date}...")
    from ingest import ingest_medical_report
    ingest_medical_report(file_path, date)
    flow_analysis(anchor_date=date)


def flow_scan():
    section("Ingest Scan Report")
    file_path = pick_file("scan report (.txt or .pdf)", [".txt", ".pdf"])
    date = pick_date("Scan date")

    if not Path(file_path).exists():
        error(f"File not found: {file_path}")
        return

    # Modality is optional — LLM will detect it from the report if skipped
    print("\n  Scan type (press Enter to let the AI detect it from the report):")
    print("    1. Chest X-Ray       4. CT Abdomen        7. Ultrasound Pelvis")
    print("    2. MRI Brain         5. CT Chest          8. DEXA Scan")
    print("    3. MRI Spine         6. Ultrasound Abdomen  9. Other")
    raw = input("\n  Enter number or press Enter to skip: ").strip()

    modality_map = {
        "1": "Chest X-Ray", "2": "MRI Brain", "3": "MRI Spine",
        "4": "CT Abdomen",  "5": "CT Chest",  "6": "Ultrasound Abdomen",
        "7": "Ultrasound Pelvis", "8": "DEXA Scan"
    }

    if raw == "":
        modality = None
        info("Modality not specified — AI will detect from report content.")
    elif raw == "9":
        modality = ask("Enter scan type manually") or None
    elif raw in modality_map:
        modality = modality_map[raw]
    else:
        modality = raw or None

    info(f"Ingesting scan on {date} (modality: {modality or 'auto-detect'})...")
    from ingest import ingest_scan_report
    ingest_scan_report(file_path, date, modality, None)
    flow_analysis(anchor_date=date)


def flow_wearable():
    section("Ingest Wearable Data")

    print("""
  Your wearable JSON file should look like this:
  {
    "device": "Apple Watch",
    "date": "2025-01-15",
    "metrics": [
      {"metric_name": "Heart Rate", "canonical_id": "heart_rate",
       "value": 88, "unit": "bpm", "aggregation": "daily_avg"},
      {"metric_name": "Steps", "canonical_id": "steps",
       "value": 8432, "unit": "steps", "aggregation": "daily_total"}
    ]
  }
  See sample_data/wearable_2025_01_15.json for a full example.
    """)

    file_path = pick_file("wearable JSON file", [".json"])
    date = pick_date("Data date")

    if not Path(file_path).exists():
        error(f"File not found: {file_path}")
        return

    info(f"Ingesting wearable data for {date}...")
    from ingest import ingest_wearable_data
    ingest_wearable_data(file_path, date)
    flow_analysis(anchor_date=date)


def flow_analysis(anchor_date=None):
    section("Run Analysis")

    # Automatically use the full span of data in the graph — no prompting needed
    import graph_db
    with graph_db.driver.session() as session:
        result = session.run("""
            MATCH (v:Visit)
            RETURN min(v.date) AS earliest, max(v.date) AS latest
        """).single()

    if not result or not result["earliest"]:
        warn("No data in graph yet. Ingest some reports first.")
        return

    earliest = result["earliest"]
    latest   = result["latest"]

    # If called after a specific ingestion, use that date as anchor
    # Otherwise use the latest date in the graph
    anchor_date = anchor_date or latest

    from datetime import datetime
    delta = (datetime.strptime(latest, "%Y-%m-%d") -
             datetime.strptime(earliest, "%Y-%m-%d")).days + 1
    days_back = max(delta, 1)

    info(f"Analysing full data span: {earliest} → {latest} ({days_back} days)")
    from analysis import run_analysis_pass
    run_analysis_pass(anchor_date, days_back)





# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    clear()
    header()

    # Step 1: credentials
    setup_credentials()

    # Step 2: test connections
    test_connections()

    # Apply model override if fallback was detected
    if os.environ.get("GEMINI_MODEL_OVERRIDE"):
        import config
        config.GEMINI_MODEL = os.environ["GEMINI_MODEL_OVERRIDE"]

    # Step 3: setup graph constraints (safe to run every time)
    import graph_db
    graph_db.setup_constraints()

    # Step 4: main loop
    while True:
        choice = main_menu()

        if "medical report" in choice:
            flow_medical()
        elif "scan report" in choice:
            flow_scan()
        elif "wearable" in choice:
            flow_wearable()
        elif "Exit" in choice:
            print("\n  Goodbye!\n")
            graph_db.close()
            sys.exit(0)

        input("\n  Press Enter to return to menu...")


if __name__ == "__main__":
    main()