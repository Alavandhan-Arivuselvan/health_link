"""
learn.py — Duolingo-style Health Learning Map
Just run: python learn.py
No command-line arguments needed.

Reads a medical report, generates personalized learning cards,
then quizzes you on what you learned.
"""

import os
import sys
import json
import re
import time
from pathlib import Path

# Fix SSL cert verification (Windows machines with incomplete cert stores)
try:
    import certifi
    os.environ.setdefault('SSL_CERT_FILE', certifi.where())
except ImportError:
    pass


# ─────────────────────────────────────────────
# TERMINAL STYLING
# ─────────────────────────────────────────────

# ANSI color codes
class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    BLUE    = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN    = "\033[96m"
    RED     = "\033[91m"
    WHITE   = "\033[97m"
    BG_BLUE = "\033[44m"
    BG_GREEN = "\033[42m"
    BG_RED  = "\033[41m"
    BG_YELLOW = "\033[43m"


def clear():
    os.system('cls' if os.name == 'nt' else 'clear')


def banner():
    print(f"""
{C.CYAN}{C.BOLD}
    ╔══════════════════════════════════════════════════╗
    ║                                                  ║
    ║   📚  HEALTH LEARNING MAP                        ║
    ║   Learn about YOUR health — one card at a time   ║
    ║                                                  ║
    ╚══════════════════════════════════════════════════╝
{C.RESET}""")


def box(title, content, color=C.CYAN):
    """Draw a nice box around content."""
    lines = content.split("\n")
    width = max(len(line) for line in lines + [title]) + 4
    width = max(width, 50)

    print(f"\n{color}  ┌{'─' * width}┐{C.RESET}")
    print(f"{color}  │ {C.BOLD}{title}{C.RESET}{color}{' ' * (width - len(title) - 1)}│{C.RESET}")
    print(f"{color}  ├{'─' * width}┤{C.RESET}")
    for line in lines:
        padding = width - len(line) - 1
        print(f"{color}  │{C.RESET} {line}{' ' * padding}{color}│{C.RESET}")
    print(f"{color}  └{'─' * width}┘{C.RESET}")


def progress_bar(current, total, label="Progress"):
    """Show a simple progress bar."""
    filled = int(30 * current / total)
    bar = "█" * filled + "░" * (30 - filled)
    pct = int(100 * current / total)
    print(f"\n  {C.DIM}{label}: {C.RESET}{C.GREEN}{bar}{C.RESET} {pct}%")


def section_header(emoji, title, num, total):
    """Section divider for learning cards."""
    print(f"\n\n  {C.DIM}{'─' * 50}{C.RESET}")
    print(f"  {C.BOLD}{emoji}  Section {num}/{total}: {title}{C.RESET}")
    print(f"  {C.DIM}{'─' * 50}{C.RESET}")


def success(msg):  print(f"  {C.GREEN}✓ {msg}{C.RESET}")
def warn(msg):     print(f"  {C.YELLOW}⚠ {msg}{C.RESET}")
def error(msg):    print(f"  {C.RED}✗ {msg}{C.RESET}")
def info(msg):     print(f"  {C.BLUE}→ {msg}{C.RESET}")


def wait_enter(msg="Press Enter to continue..."):
    input(f"\n  {C.DIM}{msg}{C.RESET}")


# ─────────────────────────────────────────────
# FILE READING (adapted from Graph_Schema)
# ─────────────────────────────────────────────

def read_file(path: str) -> str:
    """Read a .txt or .pdf file and return text content."""
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
    """Extract text from a PDF using pymupdf."""
    try:
        import fitz  # pymupdf
    except ImportError:
        error("pymupdf is not installed. Run: pip install pymupdf")
        sys.exit(1)

    doc = fitz.open(path)
    pages_text = [page.get_text() for page in doc]
    doc.close()
    full_text = "\n".join(pages_text).strip()

    if not full_text:
        error(f"PDF appears to be scanned (image-only) — no text extracted.")
        sys.exit(1)

    success(f"PDF read: {doc.page_count} pages, {len(full_text)} chars")
    return full_text


# ─────────────────────────────────────────────
# GEMINI SETUP
# ─────────────────────────────────────────────

def setup_gemini():
    """Load API key and initialize the Gemini client."""
    # Try to load from .env files in common locations
    try:
        from dotenv import load_dotenv
        # Check multiple .env locations
        for env_path in [
            Path(__file__).parent / "Graph_Schema" / ".env",
            Path(__file__).parent / ".env",
        ]:
            if env_path.exists():
                load_dotenv(env_path)
                break
    except ImportError:
        pass

    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        print(f"\n  {C.YELLOW}No Gemini API key found.{C.RESET}")
        print(f"  Get one free at: {C.CYAN}https://aistudio.google.com{C.RESET} → 'Get API Key'")
        api_key = input(f"\n  Paste your Gemini API key: ").strip()
        if not api_key:
            error("API key is required. Exiting.")
            sys.exit(1)
        os.environ["GEMINI_API_KEY"] = api_key

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        success("Gemini SDK loaded.")
        return client
    except Exception as e:
        error(f"Gemini setup failed: {e}")
        sys.exit(1)


GEMINI_MODEL = "gemini-3-flash-preview"


def call_llm(client, prompt: str) -> str:
    """Call Gemini with retry logic for rate limits."""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "rate" in err_str or "resource" in err_str:
                wait_time = 30 * (attempt + 1)
                warn(f"Rate limited. Waiting {wait_time}s before retry ({attempt+1}/{max_retries})...")
                time.sleep(wait_time)
            else:
                error(f"Gemini API error: {e}")
                sys.exit(1)
    error("Max retries exceeded. Please try again later.")
    sys.exit(1)


def parse_json(raw: str):
    """Strip markdown fences and parse JSON."""
    raw = re.sub(r'^```json\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'^```\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'\s*```$', '', raw, flags=re.MULTILINE)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        warn(f"JSON parse failed: {e}")
        return None


# ─────────────────────────────────────────────
# FILE PICKER
# ─────────────────────────────────────────────

def pick_file():
    """Interactive file picker — no CLI args needed."""
    print(f"\n  {C.BOLD}Select your medical report{C.RESET}")
    print(f"  {C.DIM}Supported formats: .txt, .pdf{C.RESET}")

    # Scan for compatible files nearby
    extensions = {".txt", ".pdf"}
    hints = []
    search_dirs = [
        Path("."),
        Path(__file__).parent,
        Path(__file__).parent / "Graph_Schema",
    ]

    seen = set()
    for search_dir in search_dirs:
        if not search_dir.exists():
            continue
        for f in sorted(search_dir.iterdir()):
            if f.is_file() and f.suffix.lower() in extensions:
                resolved = str(f.resolve())
                if resolved not in seen:
                    seen.add(resolved)
                    hints.append(f)

    if hints:
        print(f"\n  {C.CYAN}Files found nearby:{C.RESET}")
        for i, h in enumerate(hints[:15], 1):
            size_kb = h.stat().st_size / 1024
            print(f"    {C.BOLD}{i}.{C.RESET} {h.name}  {C.DIM}({size_kb:.0f} KB){C.RESET}")
        print(f"    {C.DIM}Or type a full file path{C.RESET}")

        raw = input(f"\n  Enter number or path: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(hints):
            return str(hints[int(raw) - 1])
        return raw
    else:
        return input(f"\n  Enter full path to your report: ").strip()


# ─────────────────────────────────────────────
# STEP 1: EXTRACT HEALTH DATA FROM REPORT
# ─────────────────────────────────────────────

def extract_health_data(client, report_text: str) -> dict:
    """Use Gemini to extract structured health data from a raw report."""
    info("Analyzing your report with AI...")

    prompt = f"""
You are a medical report analyzer. Extract ALL health data from this report into structured JSON.

━━━ REPORT ━━━
{report_text}

━━━ RULES ━━━
- Extract every lab result, vital sign, diagnosis, and medication you can find
- For each lab result: include the test name, the patient's value, the unit, and the normal range
- For each medication: include drug name, dosage, and what it's prescribed for
- For each diagnosis: include condition name and a brief description
- Include patient info if available (name, age, sex)
- If a value is outside normal range, mark status as "high" or "low"

━━━ OUTPUT — valid JSON only, no markdown ━━━
{{
  "patient_info": {{
    "name": "...",
    "age": "...",
    "sex": "..."
  }},
  "lab_results": [
    {{"name": "Fasting Blood Sugar", "value": "126", "unit": "mg/dL", "normal_range": "70-100 mg/dL", "status": "high"}}
  ],
  "vitals": [
    {{"name": "Blood Pressure", "value": "140/90", "unit": "mmHg", "normal_range": "120/80 mmHg", "status": "high"}}
  ],
  "medications": [
    {{"drug": "Metformin", "dose": "500mg", "frequency": "twice daily", "for_condition": "Type 2 Diabetes"}}
  ],
  "diagnoses": [
    {{"name": "Type 2 Diabetes Mellitus", "description": "A chronic condition affecting blood sugar regulation"}}
  ]
}}
"""

    raw = call_llm(client, prompt)
    data = parse_json(raw)

    if not data:
        error("Could not extract data from report. The file may not be a valid medical report.")
        sys.exit(1)

    # Count what we found
    labs = len(data.get("lab_results", []))
    vitals = len(data.get("vitals", []))
    meds = len(data.get("medications", []))
    diags = len(data.get("diagnoses", []))

    success(f"Found: {labs} lab results, {vitals} vitals, {meds} medications, {diags} diagnoses")
    return data


# ─────────────────────────────────────────────
# STEP 2: GENERATE LEARNING CARDS
# ─────────────────────────────────────────────

def generate_learning_content(client, health_data: dict) -> list:
    """Use Gemini to create educational learning sections from health data."""
    info("Creating your personalized learning cards...")

    prompt = f"""
You are a friendly health educator creating simple learning cards for a patient.
The patient has just received their medical report and wants to understand their health.

━━━ PATIENT'S HEALTH DATA ━━━
{json.dumps(health_data, indent=2)}

━━━ TASK ━━━
Create learning sections — one per health topic found in the data.
Each section should teach the patient about ONE aspect of their health.

For each section:
1. Use the patients ACTUAL values from their report
2. Explain in simple everyday English (no medical jargon)
3. Compare their value to what's normal
4. Explain what this means for their body in 2-3 simple sentences
5. Give 1-2 practical tips if the value is abnormal
6. Use a friendly, encouraging tone — like a helpful friend, not a scary doctor

Group related items together (e.g., all blood sugar related tests in one section).

━━━ RULES ━━━
- Each section should have 2-4 learning cards
- A card should be SHORT — max 3-4 sentences
- Use simple analogies where possible (e.g., "Think of cholesterol like traffic on a highway")
- DON'T be preachy or scary. Be informative and supportive.
- If everything is normal, still explain what the test measures and why it's good news

━━━ OUTPUT — valid JSON only, no markdown ━━━
[
  {{
    "section_title": "Blood Sugar Levels",
    "section_emoji": "🩸",
    "cards": [
      {{
        "card_title": "What is Blood Sugar?",
        "content": "Blood sugar (glucose) is the fuel your body uses for energy. When you eat, your body breaks down food into glucose..."
      }},
      {{
        "card_title": "Your Fasting Blood Sugar: 126 mg/dL",
        "content": "Your fasting blood sugar is 126 mg/dL, which is above the normal range of 70-100 mg/dL. This means..."
      }},
      {{
        "card_title": "What You Can Do",
        "content": "Small changes can make a big difference! Try to..."
      }}
    ]
  }}
]
"""

    raw = call_llm(client, prompt)
    sections = parse_json(raw)

    if not sections or not isinstance(sections, list):
        error("Could not generate learning content.")
        sys.exit(1)

    total_cards = sum(len(s.get("cards", [])) for s in sections)
    success(f"Created {len(sections)} learning sections with {total_cards} cards")
    return sections


# ─────────────────────────────────────────────
# STEP 3: GENERATE QUIZ
# ─────────────────────────────────────────────

def generate_quiz(client, sections: list) -> list:
    """Use Gemini to create a comprehension quiz based on the learning content."""
    info("Preparing your quiz...")

    # Build a summary of what was taught
    taught_content = ""
    for sec in sections:
        taught_content += f"\n## {sec['section_title']}\n"
        for card in sec.get("cards", []):
            taught_content += f"- {card['card_title']}: {card['content']}\n"

    prompt = f"""
You are creating a simple health quiz for a patient who just read these learning cards:

━━━ WHAT THE PATIENT LEARNED ━━━
{taught_content}

━━━ TASK ━━━
Create 5-8 multiple choice questions to check if the patient UNDERSTOOD the material.

━━━ RULES ━━━
- Test UNDERSTANDING, not memorization of specific numbers
- Questions should be practical: "What should you do if..." rather than "What is the exact value of..."
- Each question has 4 options (A, B, C, D) — only one is correct
- Include a short friendly explanation for the correct answer
- Keep the language simple and conversational
- Mix easy and slightly challenging questions
- Questions should relate directly to what was taught in the cards
- Don't make it feel like an exam — more like a fun check-in

━━━ OUTPUT — valid JSON only, no markdown ━━━
[
  {{
    "question": "If your blood sugar is higher than normal, what does that mean?",
    "options": {{
      "A": "Your body is using sugar too quickly",
      "B": "Your body isn't processing sugar efficiently",
      "C": "You need to eat more sugar",
      "D": "Your blood pressure is also high"
    }},
    "correct": "B",
    "explanation": "When blood sugar is high, it usually means your body isn't producing enough insulin or isn't using it well."
  }}
]
"""

    raw = call_llm(client, prompt)
    quiz = parse_json(raw)

    if not quiz or not isinstance(quiz, list):
        error("Could not generate quiz.")
        return []

    success(f"Quiz ready: {len(quiz)} questions")
    return quiz


# ─────────────────────────────────────────────
# DISPLAY: LEARNING CARDS
# ─────────────────────────────────────────────

def display_learning_sections(sections: list):
    """Show learning cards interactively, section by section."""
    total_sections = len(sections)
    card_num = 0
    total_cards = sum(len(s.get("cards", [])) for s in sections)

    print(f"\n\n  {C.BOLD}{C.CYAN}📖  YOUR LEARNING JOURNEY{C.RESET}")
    print(f"  {C.DIM}{total_sections} sections · {total_cards} cards to go{C.RESET}")
    wait_enter("Press Enter to start learning...")

    for sec_idx, section in enumerate(sections, 1):
        emoji = section.get("section_emoji", "📋")
        title = section.get("section_title", f"Section {sec_idx}")
        cards = section.get("cards", [])

        section_header(emoji, title, sec_idx, total_sections)

        for card_idx, card in enumerate(cards):
            card_num += 1
            progress_bar(card_num, total_cards, "Learning Progress")

            card_title = card.get("card_title", "")
            content = card.get("content", "")

            # Wrap content at ~60 chars for nice display
            wrapped = wrap_text(content, 55)
            box(f"{emoji} {card_title}", wrapped, C.CYAN)

            if card_num < total_cards:
                wait_enter("Press Enter for next card →")

    print(f"\n\n  {C.GREEN}{C.BOLD}🎉  You've completed all the learning cards!{C.RESET}")
    progress_bar(total_cards, total_cards, "Learning Progress")
    print()


def wrap_text(text: str, width: int = 55) -> str:
    """Wrap text to a given width."""
    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        if len(current_line) + len(word) + 1 <= width:
            current_line += (" " if current_line else "") + word
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return "\n".join(lines)


# ─────────────────────────────────────────────
# DISPLAY: QUIZ
# ─────────────────────────────────────────────

def run_quiz(questions: list):
    """Run the interactive quiz."""
    if not questions:
        warn("No quiz questions available.")
        return

    print(f"\n\n  {C.BOLD}{C.MAGENTA}🧠  QUIZ TIME!{C.RESET}")
    print(f"  {C.DIM}Let's check how much you remember.{C.RESET}")
    print(f"  {C.DIM}{len(questions)} questions · No pressure, this is just for fun!{C.RESET}")
    wait_enter("Press Enter to start the quiz...")

    score = 0
    total = len(questions)

    for i, q in enumerate(questions, 1):
        print(f"\n  {C.DIM}{'─' * 50}{C.RESET}")
        print(f"  {C.BOLD}Question {i}/{total}{C.RESET}")
        print()

        # Display question
        question_text = wrap_text(q.get("question", ""), 55)
        for line in question_text.split("\n"):
            print(f"  {C.WHITE}{C.BOLD}{line}{C.RESET}")

        print()

        # Display options
        options = q.get("options", {})
        for key in ["A", "B", "C", "D"]:
            if key in options:
                print(f"    {C.CYAN}{C.BOLD}{key}.{C.RESET} {options[key]}")

        # Get answer
        correct = q.get("correct", "A").upper()
        while True:
            answer = input(f"\n  {C.BOLD}Your answer (A/B/C/D): {C.RESET}").strip().upper()
            if answer in ["A", "B", "C", "D"]:
                break
            print(f"  {C.DIM}Please enter A, B, C, or D{C.RESET}")

        # Check answer
        explanation = q.get("explanation", "")

        if answer == correct:
            score += 1
            print(f"\n  {C.GREEN}{C.BOLD}✅ Correct!{C.RESET}")
        else:
            print(f"\n  {C.RED}{C.BOLD}❌ Not quite!{C.RESET} The answer is {C.GREEN}{correct}{C.RESET}")

        # Show explanation
        if explanation:
            exp_wrapped = wrap_text(explanation, 50)
            print(f"  {C.DIM}💡 {exp_wrapped}{C.RESET}")

        progress_bar(i, total, "Quiz Progress")

        if i < total:
            wait_enter()

    # ── Final Score ──────────────────────────
    show_score(score, total)


def show_score(score: int, total: int):
    """Display the final quiz score with encouragement."""
    pct = int(100 * score / total) if total > 0 else 0

    print(f"\n\n  {C.DIM}{'═' * 50}{C.RESET}")
    print(f"  {C.BOLD}🏆  QUIZ RESULTS{C.RESET}")
    print(f"  {C.DIM}{'═' * 50}{C.RESET}")
    print()

    # Score display
    if pct >= 80:
        color = C.GREEN
        emoji = "🌟"
        msg = "Amazing! You really understood your health report!"
    elif pct >= 60:
        color = C.CYAN
        emoji = "👍"
        msg = "Great job! You've got a good understanding!"
    elif pct >= 40:
        color = C.YELLOW
        emoji = "💪"
        msg = "Good effort! Review the cards to strengthen your knowledge."
    else:
        color = C.MAGENTA
        emoji = "📖"
        msg = "No worries! Learning takes time. Try reading the cards again."

    print(f"  {color}{C.BOLD}{emoji}  {score}/{total} correct ({pct}%){C.RESET}")
    print()

    # Score bar
    filled = int(30 * score / total) if total > 0 else 0
    bar = "█" * filled + "░" * (30 - filled)
    print(f"  {color}{bar}{C.RESET}")
    print()
    print(f"  {C.WHITE}{msg}{C.RESET}")

    print(f"\n  {C.DIM}{'═' * 50}{C.RESET}")
    print(f"\n  {C.DIM}Remember: This is for learning, not diagnosis.{C.RESET}")
    print(f"  {C.DIM}Always consult your doctor for medical advice.{C.RESET}")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    clear()
    banner()

    # ── Setup Gemini ─────────────────────────
    print(f"  {C.DIM}Setting up AI...{C.RESET}")
    client = setup_gemini()

    # ── Pick File ────────────────────────────
    file_path = pick_file()

    if not file_path or not Path(file_path).exists():
        error(f"File not found: {file_path}")
        sys.exit(1)

    success(f"Selected: {Path(file_path).name}")

    # ── Read Report ──────────────────────────
    info("Reading your report...")
    report_text = read_file(file_path)

    if not report_text or len(report_text) < 20:
        error("File is empty or too short to be a medical report.")
        sys.exit(1)

    success(f"Report loaded: {len(report_text)} characters")

    # ── Step 1: Extract data ─────────────────
    print(f"\n  {C.BOLD}Step 1/3: Analyzing Report{C.RESET}")
    health_data = extract_health_data(client, report_text)

    # Show a quick summary of what was found
    patient = health_data.get("patient_info", {})
    if patient.get("name"):
        print(f"\n  {C.BOLD}Patient: {patient['name']}{C.RESET}")

    # ── Step 2: Generate Learning Cards ──────
    print(f"\n  {C.BOLD}Step 2/3: Creating Learning Cards{C.RESET}")
    sections = generate_learning_content(client, health_data)

    # ── Step 3: Generate Quiz ────────────────
    print(f"\n  {C.BOLD}Step 3/3: Preparing Quiz{C.RESET}")
    quiz = generate_quiz(client, sections)

    # ── Ready! ───────────────────────────────
    print(f"\n\n  {C.GREEN}{C.BOLD}✨ Your learning map is ready!{C.RESET}")
    print(f"  {C.DIM}You'll go through learning cards first, then take a quiz.{C.RESET}")
    wait_enter("Press Enter to begin your learning journey →")

    # ── Show Learning Cards ──────────────────
    clear()
    display_learning_sections(sections)

    # ── Transition to Quiz ───────────────────
    print(f"\n  {C.BOLD}Now let's see how much you remember!{C.RESET}")
    wait_enter("Press Enter to start the quiz →")
    clear()
    banner()

    # ── Run Quiz ─────────────────────────────
    run_quiz(quiz)

    # ── Offer to retry ───────────────────────
    print()
    retry = input(f"\n  {C.BOLD}Would you like to retry the quiz? (y/n): {C.RESET}").strip().lower()
    if retry in ("y", "yes"):
        clear()
        banner()
        run_quiz(quiz)

    print(f"\n  {C.CYAN}Thanks for learning about your health! Stay healthy! 💚{C.RESET}\n")


if __name__ == "__main__":
    main()
