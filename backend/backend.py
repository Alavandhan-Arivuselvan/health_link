from fastapi import FastAPI, Body, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import random
import datetime as dt
import uuid
import os
import shutil
import json
from utils import process_medical_file, start_interactive_chat

# Add ontology directory to path so we can import ontology.py
ONTOLOGY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ontology")
import sys as _sys
_sys.path.insert(0, ONTOLOGY_DIR)
from ontology import process_medical_report
from twilio.rest import Client
from supabase import create_client, Client as SupabaseClient
import bcrypt
from dotenv import load_dotenv

# Load environment variables
# Load environment variables
basedir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(basedir, ".env.local"))
import pandas as pd
import joblib
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = "+16187013270"

if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
else:
    twilio_client = None
    print("Warning: Twilio credentials not found. SMS will not be sent.")

# Supabase cloud database
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if SUPABASE_URL and SUPABASE_KEY:
    supabase: SupabaseClient = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"✅ Supabase connected: {SUPABASE_URL}")
else:
    supabase = None
    print("⚠️  Warning: SUPABASE_URL / SUPABASE_KEY not set. DB will not work.")

# Helper: hash and verify passwords
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

records_db = []
stats_db = []

# Ensure uploads directory exists
UPLOAD_DIR = "doc"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
model = joblib.load('risk_model_multi.pkl')
features = joblib.load('features_list.pkl')
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class User(BaseModel):
    name: str
    phone: str
    dob: str
    gender: str
    blood_group: str
    password: str

class Doctor(BaseModel):
    name: str
    phone: str
    dob: str
    gender: str
    license_number: str
    specialization: str
    experience: int
    hospital: str
    fee: float = 0.0
    password: str

class DoctorLoginRequest(BaseModel):
    license_number: str
    password: str

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

class LoginRequest(BaseModel):
    phone: str
    password: str

@app.post("/register")
def register(user: User):
    # Check if user already exists
    existing = supabase.table("users").select("id").eq("phone", user.phone).execute()
    if existing.data:
        return {"status": "error", "message": "User already registered"}
    
    user_data = user.dict()
    user_data["password"] = hash_password(user_data["password"])
    result = supabase.table("users").insert(user_data).execute()
    
    # Return user without password hash
    safe_user = {k: v for k, v in result.data[0].items() if k != "password"}
    return {"status": "success", "user": safe_user}

@app.post("/login")
def login(request: LoginRequest):
    result = supabase.table("users").select("*").eq("phone", request.phone).execute()
    if result.data:
        user = result.data[0]
        if verify_password(request.password, user["password"]):
            safe_user = {k: v for k, v in user.items() if k != "password"}
            return {"status": "success", "user": safe_user}
    return {"status": "error", "message": "Invalid credentials"}

@app.post("/doctor/register")
def doctor_register(doctor: Doctor):
    existing = supabase.table("doctors").select("id").eq("license_number", doctor.license_number).execute()
    if existing.data:
        return {"status": "error", "message": "Doctor already registered with this license number"}
    
    doctor_data = doctor.dict()
    doctor_data["password"] = hash_password(doctor_data["password"])
    result = supabase.table("doctors").insert(doctor_data).execute()
    
    safe_doctor = {k: v for k, v in result.data[0].items() if k != "password"}
    return {"status": "success", "doctor": safe_doctor}

@app.post("/doctor/login")
def doctor_login(request: DoctorLoginRequest):
    result = supabase.table("doctors").select("*").eq("license_number", request.license_number).execute()
    if result.data:
        doctor = result.data[0]
        if verify_password(request.password, doctor["password"]):
            safe_doctor = {k: v for k, v in doctor.items() if k != "password"}
            return {"status": "success", "doctor": safe_doctor}
    return {"status": "error", "message": "Invalid license number or password"}

@app.post("/send-otp")
def send_otp(request: OTPRequest):
    # Generate 4-digit OTP
    otp = str(random.randint(1000, 9999))
    
    # Upsert into otps table (replace if phone already has an OTP)
    supabase.table("otps").upsert({"phone": request.phone, "otp": otp}, on_conflict="phone").execute()
    print(f"OTP for {request.phone} is: {otp}")  # Log internally
    
    # Send SMS via Twilio
    if twilio_client:
        try:
            to_number = request.phone
            if not to_number.startswith("+"):
                 to_number = "+91" + to_number
            
            message = twilio_client.messages.create(
                from_=TWILIO_PHONE_NUMBER,
                body=f'OTP IS "{otp}"',
                to=to_number
            )
            print(f"Twilio Message SID: {message.sid}")
        except Exception as e:
            print(f"Failed to send SMS: {e}")
            
    return {"status": "success", "message": "OTP sent successfully"}

@app.post("/verify-otp")
def verify_otp(request: OTPVerify):
    result = supabase.table("otps").select("otp").eq("phone", request.phone).execute()
    if result.data and result.data[0]["otp"] == request.otp:
        # Delete OTP after successful verification
        supabase.table("otps").delete().eq("phone", request.phone).execute()
        return {"status": "success", "message": "OTP verified"}
    return {"status": "error", "message": "Invalid OTP"}

def _ocr_extract_text(file_path: str) -> str:
    """Run OCR on a PDF or image and return the raw text."""
    import tempfile
    ext = os.path.splitext(file_path)[1].lower()
    text = ""
    if ext == ".pdf":
        try:
            from pdf2image import convert_from_path
            import pytesseract
            POPPLER_PATH = os.environ.get("POPPLER_PATH", r"C:\poppler\poppler-24.08.0\Library\bin")
            images = convert_from_path(file_path, dpi=500, poppler_path=POPPLER_PATH)
            for i, img in enumerate(images):
                page_text = pytesseract.image_to_string(img, config=r'--psm 6')
                text += f"\n--- Page {i+1} ---\n{page_text}"
        except Exception as e:
            print(f"❌ OCR Error: {e}")
    elif ext in [".jpg", ".jpeg", ".png"]:
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img, config=r'--psm 6')
        except Exception as e:
            print(f"❌ Image OCR Error: {e}")
    return text


def _background_process_and_update(report_id: str, user_phone: str, file_path: str):
    """Background task: runs OCR + ontology processing, then updates the Supabase report row."""
    try:
        # Step 1: Run existing LLM pipeline (for MongoDB/Graph/RAG)
        result = process_medical_file(user_phone, file_path)

        # Step 2: Run ontology processor on the raw OCR text
        raw_text = _ocr_extract_text(file_path)
        ontology_result = None
        if raw_text.strip():
            try:
                ontology_result = process_medical_report(raw_text)
                print(f"🧬 Ontology: extracted {len(ontology_result.get('lab_results', []))} lab results")
            except Exception as oe:
                print(f"⚠️ Ontology processing error: {oe}")

        # Step 3: Build metrics from ontology lab_results
        metrics_count = 0
        metrics_list = []
        patient_name = None

        if ontology_result:
            lab_results = ontology_result.get("lab_results", []) or []
            metrics_count = len(lab_results)
            metrics_list = [r.get("test_name", "") for r in lab_results]
            patient_info = ontology_result.get("patient", {}) or {}
            patient_name = patient_info.get("name")

        # Fallback to LLM data if ontology didn't find anything
        if metrics_count == 0 and result and result.get("status") == "success":
            extracted = result.get("data", {})
            clinical = extracted.get("clinical_data", {}) or {}
            lab_count = len(clinical.get("lab_reports", []) or [])
            vitals_count = len(clinical.get("vitals", []) or [])
            metrics_count = lab_count + vitals_count
            metrics_list = [l.get("name", "") for l in (clinical.get("lab_reports", []) or [])]
            metrics_list += [v.get("name", "") for v in (clinical.get("vitals", []) or [])]
            patient_info = extracted.get("patient_info", {}) or {}
            patient_name = patient_name or patient_info.get("name")

        # Step 4: Update Supabase
        if ontology_result or (result and result.get("status") == "success"):
            update_data = {
                "status": "processed",
                "metrics_count": metrics_count,
                "metrics_list": metrics_list,
                "patient_name": patient_name,
            }
            if ontology_result:
                update_data["ontology_data"] = ontology_result
            if result and result.get("status") == "success":
                update_data["extracted_data"] = result.get("data", {})
            supabase.table("reports").update(update_data).eq("id", report_id).execute()
            print(f"✅ Report {report_id} updated: {metrics_count} metrics extracted.")
        else:
            supabase.table("reports").update({"status": "failed"}).eq("id", report_id).execute()
            print(f"❌ Report {report_id} processing failed.")
    except Exception as e:
        print(f"❌ Background processing error for report {report_id}: {e}")
        try:
            supabase.table("reports").update({"status": "failed"}).eq("id", report_id).execute()
        except:
            pass


@app.post("/upload")
async def upload_file(file: UploadFile = File(...), user_phone: str = Form(""), background_tasks: BackgroundTasks = None):
    """Original upload endpoint — saves locally + OCR/AI in background (no Supabase tracking)."""
    if not (file.content_type.startswith("image/") or file.content_type == "application/pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and Images are allowed.")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Process in background so the response returns immediately
    background_tasks.add_task(process_medical_file, user_phone, file_path)
    return {"status": "processing", "filename": file.filename, "path": file_path, "message": "File uploaded. Processing in background."}


@app.post("/upload-report")
async def upload_report(
    file: UploadFile = File(...),
    user_phone: str = Form(""),
    background_tasks: BackgroundTasks = None,
):
    """Report upload — saves locally, creates Supabase report row, processes in background."""
    if not (file.content_type.startswith("image/") or file.content_type == "application/pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and Images are allowed.")

    # Save file locally
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create a report record in Supabase with status 'processing'
    report_id = str(uuid.uuid4())
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat()
    file_type = "pdf" if file.content_type == "application/pdf" else "image"

    report_row = {
        "id": report_id,
        "user_phone": user_phone,
        "filename": file.filename,
        "file_type": file_type,
        "status": "processing",
        "metrics_count": 0,
        "metrics_list": [],
        "uploaded_at": now_iso,
    }

    if supabase:
        supabase.table("reports").insert(report_row).execute()
        print(f"📋 Report record created: {report_id}")

    # Process in background — will update the Supabase row when done
    background_tasks.add_task(_background_process_and_update, report_id, user_phone, file_path)

    return {
        "status": "processing",
        "report_id": report_id,
        "filename": file.filename,
        "message": "Report uploaded. Processing in background.",
    }

health_records = {
    "past": [
        {'Date': '2026-02-05', 'Age': 19, 'Sleep Duration': 7.8, 'Quality of Sleep': 8.0, 'Heart Rate': 72, 'Daily Steps': 11452},
        {'Date': '2026-02-06', 'Age': 19, 'Sleep Duration': 8.2, 'Quality of Sleep': 8.5, 'Heart Rate': 70, 'Daily Steps': 12123},
        {'Date': '2026-02-07', 'Age': 19, 'Sleep Duration': 7.5, 'Quality of Sleep': 7.5, 'Heart Rate': 75, 'Daily Steps': 10895},
        {'Date': '2026-02-08', 'Age': 19, 'Sleep Duration': 8.0, 'Quality of Sleep': 8.0, 'Heart Rate': 71, 'Daily Steps': 13000},
        {'Date': '2026-02-09', 'Age': 19, 'Sleep Duration': 7.9, 'Quality of Sleep': 8.2, 'Heart Rate': 73, 'Daily Steps': 11562},
        {'Date': '2026-02-10', 'Age': 19, 'Sleep Duration': 8.4, 'Quality of Sleep': 9.0, 'Heart Rate': 70, 'Daily Steps': 14223},
        {'Date': '2026-02-11', 'Age': 19, 'Sleep Duration': 7.7, 'Quality of Sleep': 7.8, 'Heart Rate': 74, 'Daily Steps': 10705}, 
    ],
    "current": [
        {'Date': '2026-02-12', 'Age': 19, 'Sleep Duration': 4.2, 'Quality of Sleep': 3.0, 'Heart Rate': 88, 'Daily Steps': 1202},
        {'Date': '2026-02-13', 'Age': 19, 'Sleep Duration': 3.5, 'Quality of Sleep': 2.5, 'Heart Rate': 90, 'Daily Steps': 853},
        {'Date': '2026-02-14', 'Age': 19, 'Sleep Duration': 10.5, 'Quality of Sleep': 4.0, 'Heart Rate': 85, 'Daily Steps': 1505},
        {'Date': '2026-02-15', 'Age': 19, 'Sleep Duration': 4.0, 'Quality of Sleep': 2.0, 'Heart Rate': 89, 'Daily Steps': 2130},
        {'Date': '2026-02-16', 'Age': 19, 'Sleep Duration': 5.1, 'Quality of Sleep': 3.5, 'Heart Rate': 87, 'Daily Steps': 1102},
        {'Date': '2026-02-17', 'Age': 19, 'Sleep Duration': 3.8, 'Quality of Sleep': 2.5, 'Heart Rate': 90, 'Daily Steps': 943},
        {'Date': '2026-02-18', 'Age': 19, 'Sleep Duration': 9.8, 'Quality of Sleep': 4.5, 'Heart Rate': 84, 'Daily Steps': 1305}
    ]
}

def calculate_weekly_risk(week_data):
    df = pd.DataFrame(week_data)
    
    # Fill missing RF features (Stress/Activity) with 0
    for feat in features:
        if feat not in df.columns:
            df[feat] = 0
            
    # Get probabilities from RF Model
    # probs shape: [target][row][class]
    probs = model.predict_proba(df[features])
    
    # Calculate Mean Probabilities for the week
    heart_p = np.mean([p[1] for p in probs[0]])
    obesity_p = np.mean([p[1] for p in probs[1]])
    resp_p = np.mean([p[1] for p in probs[2]])
    
    # Final Verdict Logic
    risks = []
    if heart_p > 0.7: risks.append("Heart")
    if obesity_p > 0.7: risks.append("Obesity")
    if resp_p > 0.7: risks.append("Respiratory")
    print(heart_p)
    print(obesity_p)
    print(resp_p)
    return {
        "heartProb": round(heart_p * 100, 2),
        "obesityProb": round(obesity_p * 100, 2),
        "respProb": round(resp_p * 100, 2),
        "verdict": "HIGH RISK" if risks else "LOW RISK",
        "riskFactors": risks
    }

# class User(BaseModel):
#     name: str
#     phone: str
#     dob: str
#     gender: str
#     blood_group: str
#     password: str

# class OTPRequest(BaseModel):
#     phone: str

# class OTPVerify(BaseModel):
#     phone: str
#     otp: str

# class LoginRequest(BaseModel):
#     phone: str
#     password: str



@app.post("/chat")
def chat(payload: dict = Body(...)):
    user_phone = payload.get("user_phone", "")
    message = payload.get("message", "")
    text = message.lower()
    ans = start_interactive_chat(user_phone, text)
    return {"reply": ans}

@app.post("/save-stats")
def save_stats(stats: dict):
    stats_db.append(stats)
    return {"status": "saved"}

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/graph")
def get_graph():
    html_path = os.path.join(basedir, "healthlink_interactive.html")
    return FileResponse(html_path, media_type="text/html")

@app.get("/api/health-stats/{week_type}")
async def get_stats(week_type: str):
    data = health_records.get(week_type, [])
    risk_analysis = calculate_weekly_risk(data)
    print("called")
    return {
        "raw_data": data,
        "analysis": risk_analysis
    }

@app.post("/qr")
def get_qr(payload: dict = Body(...)):
    user_phone = payload.get("user_phone", "")
    # Generate a URL pointing to this user's health profile
    qr_url = f"http://{os.environ.get('HOST_IP', '192.168.1.100')}:9000/profile/{user_phone}"
    return {"url": qr_url, "user_phone": user_phone}

@app.get("/profile/{phone}")
def get_profile(phone: str):
    return {"message": f"Health profile for {phone}", "phone": phone}


# ──────────────────────────────────────────────────────────
# REPORTS ENDPOINTS (Supabase)
# ──────────────────────────────────────────────────────────

@app.get("/reports/{user_phone}")
def list_reports(user_phone: str):
    """Return all reports for a user, newest first."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    result = (
        supabase.table("reports")
        .select("id, filename, file_type, status, metrics_count, metrics_list, uploaded_at, patient_name")
        .eq("user_phone", user_phone)
        .order("uploaded_at", desc=True)
        .execute()
    )
    return {"status": "success", "reports": result.data}


@app.get("/reports/detail/{report_id}")
def get_report_detail(report_id: str):
    """Return full report including extracted data."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    result = supabase.table("reports").select("*").eq("id", report_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"status": "success", "report": result.data[0]}


@app.get("/api/report/{report_id}/analysis")
def get_report_analysis(report_id: str):
    """Return the ontology + LLM extracted data for a report."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    result = supabase.table("reports").select("*").eq("id", report_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found")
    report = result.data[0]
    if report["status"] == "processing":
        return {"status": "processing", "message": "Report is still being processed"}
    # Debug: print what data exists
    has_ontology = bool(report.get("ontology_data"))
    has_extracted = bool(report.get("extracted_data"))
    ext_keys = list((report.get("extracted_data") or {}).keys())
    cd_keys = list((report.get("extracted_data") or {}).get("clinical_data", {}).keys()) if has_extracted else []
    lab_count = len((report.get("extracted_data") or {}).get("clinical_data", {}).get("lab_reports", []) or [])
    print(f"📊 Analysis debug: ontology={has_ontology}, extracted={has_extracted}, ext_keys={ext_keys}, clinical_keys={cd_keys}, lab_reports={lab_count}")
    return {
        "status": "success",
        "report_id": report_id,
        "ontology": report.get("ontology_data"),
        "extracted_data": report.get("extracted_data"),
        "metrics_count": report.get("metrics_count", 0),
        "metrics_list": report.get("metrics_list", []),
        "patient_name": report.get("patient_name"),
    }


@app.get("/api/lab-history/{user_phone}")
def get_lab_history(user_phone: str):
    """
    Aggregate lab results across ALL processed reports for a user.
    Returns { test_name_lower: [ { date, value, unit }, ... ] } sorted by date ascending.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    result = (
        supabase.table("reports")
        .select("uploaded_at, ontology_data, extracted_data, status")
        .eq("user_phone", user_phone)
        .eq("status", "processed")
        .order("uploaded_at", desc=False)
        .execute()
    )

    history: dict[str, list] = {}

    for report in result.data:
        report_date = report.get("uploaded_at", "")

        # Try ontology lab results first
        ontology = report.get("ontology_data") or {}
        lab_results = ontology.get("lab_results") or []

        # Fallback to extracted_data if ontology has nothing
        if not lab_results:
            extracted = report.get("extracted_data") or {}
            clinical = extracted.get("clinical_data") or {}
            lab_results = clinical.get("lab_reports") or []

        for lab in lab_results:
            name = (lab.get("test_name") or lab.get("name") or "").strip()
            if not name:
                continue
            raw_value = lab.get("value") or lab.get("result") or ""
            try:
                numeric_value = float(str(raw_value))
            except (ValueError, TypeError):
                continue  # skip non-numeric

            key = name.lower()
            if key not in history:
                history[key] = []
            history[key].append({
                "date": report_date,
                "value": numeric_value,
                "unit": lab.get("unit") or "",
            })

    return {"status": "success", "history": history}


# ──────────────────────────────────────────────────────────
# FITBIT INSIGHTS ENDPOINTS (uses ML/wear.py functions)
# ──────────────────────────────────────────────────────────
import sys
import subprocess

# Add ML directory to path so we can import wear.py functions
ML_DIR = os.path.join(os.path.dirname(basedir), "ML")
sys.path.insert(0, ML_DIR)
from wear import forecast_body_battery, calculate_sleep_streaks_and_nudges, generate_personalized_nudges, calculate_step_consistency

FITBIT_JSON_PATH = os.path.join(ML_DIR, "fitbit_2weeks_data.json")


@app.get("/api/fitbit-insights")
def get_fitbit_insights():
    """
    Read the Fitbit JSON data file and compute all 4 wellness insights:
      1. Body Battery Energy Forecast
      2. Sleep Consistency Streaks & Nudges
      3. Personalized Nudges
      4. Step Consistency & Nudges
    """
    if not os.path.exists(FITBIT_JSON_PATH):
        raise HTTPException(status_code=404, detail="Fitbit data not found. Run data fetch first.")

    try:
        with open(FITBIT_JSON_PATH, "r", encoding="utf-8") as f:
            full_data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read Fitbit data: {str(e)}")

    # Run all 4 insight functions from wear.py
    energy_forecast = forecast_body_battery(full_data)
    sleep_consistency = calculate_sleep_streaks_and_nudges(full_data)
    nudges = generate_personalized_nudges(full_data)
    step_consistency = calculate_step_consistency(full_data)

    # Get file modification time as "last sync"
    mod_time = os.path.getmtime(FITBIT_JSON_PATH)
    last_sync = dt.datetime.fromtimestamp(mod_time).isoformat()
    print(energy_forecast)
    print(sleep_consistency)
    print(nudges)
    return {
        "status": "success",
        "last_sync": last_sync,
        "energy_forecast": energy_forecast,
        "sleep_consistency": sleep_consistency,
        "nudges": nudges,
        "step_consistency": step_consistency,
    }


@app.post("/api/fitbit-refresh")#hi
def refresh_fitbit_data():
    """
    Re-run final_fetch.py to pull fresh data from Fitbit API
    and overwrite fitbit_2weeks_data.json.
    """
    fetch_script = os.path.join(ML_DIR, "final_fetch.py")
    if not os.path.exists(fetch_script):
        raise HTTPException(status_code=404, detail="Fetch script not found")

    try:
        result = subprocess.run(
            [sys.executable, fetch_script],
            cwd=ML_DIR,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Fetch failed: {result.stderr}")
        return {"status": "success", "message": "Fitbit data refreshed"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Fetch timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fetch error: {str(e)}")
