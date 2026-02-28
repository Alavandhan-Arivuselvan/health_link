# from fastapi import FastAPI, Body, UploadFile, File, Form, HTTPException, BackgroundTasks
# from fastapi.responses import FileResponse, HTMLResponse
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from typing import List, Optional
# import random
# import datetime as dt
# import uuid
# import os
# import sys
# import shutil
# import json
# from utils import process_medical_file, start_interactive_chat
# from twilio.rest import Client
# from supabase import create_client, Client as SupabaseClient
# import bcrypt
# from dotenv import load_dotenv

# # Load environment variables
# basedir = os.path.dirname(os.path.abspath(__file__))
# load_dotenv(os.path.join(basedir, ".env.local"))

# # SSL cert fix for Neo4j AuraDB on Windows
# try:
#     import certifi
#     os.environ.setdefault('SSL_CERT_FILE', certifi.where())
# except ImportError:
#     pass

# import pandas as pd
# import joblib
# import numpy as np

# # ── Add KG module path ──────────────────────────────
# KG_DIR = os.path.normpath(os.path.join(basedir, '..', 'KG', 'Graph_Schema'))
# if KG_DIR not in sys.path:
#     sys.path.insert(0, KG_DIR)

# # Try to connect Neo4j graph database
# _neo4j_available = False
# try:
#     import graph_db
#     import ingest as kg_ingest
#     graph_db.setup_constraints()
#     _neo4j_available = True
#     print("✅ Neo4j Knowledge Graph connected")
# except Exception as e:
#     print(f"⚠️  Neo4j KG not available (non-fatal): {e}")

# app = FastAPI()

# # Allow all origins for development
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Twilio Configuration
# TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
# TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
# TWILIO_PHONE_NUMBER = "+16187013270"

# if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
#     twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
# else:
#     twilio_client = None
#     print("Warning: Twilio credentials not found. SMS will not be sent.")

# # Supabase cloud database
# SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_KEY = os.getenv("SUPABASE_KEY")
# if SUPABASE_URL and SUPABASE_KEY:
#     supabase: SupabaseClient = create_client(SUPABASE_URL, SUPABASE_KEY)
#     print(f"✅ Supabase connected: {SUPABASE_URL}")
# else:
#     supabase = None
#     print("⚠️  Warning: SUPABASE_URL / SUPABASE_KEY not set. DB will not work.")

# # Helper: hash and verify passwords
# def hash_password(password: str) -> str:
#     return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# def verify_password(password: str, hashed: str) -> bool:
#     return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# records_db = []
# stats_db = []

# # Ensure uploads directory exists
# UPLOAD_DIR = "doc"
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
# model = joblib.load('risk_model_multi.pkl')
# features = joblib.load('features_list.pkl')
# UPLOAD_DIR = "uploads"
# os.makedirs(UPLOAD_DIR, exist_ok=True)

# class User(BaseModel):
#     name: str
#     phone: str
#     dob: str
#     gender: str
#     blood_group: str
#     password: str

# class Doctor(BaseModel):
#     name: str
#     phone: str
#     dob: str
#     gender: str
#     license_number: str
#     specialization: str
#     experience: int
#     hospital: str
#     fee: float = 0.0
#     password: str

# class DoctorLoginRequest(BaseModel):
#     license_number: str
#     password: str

# class OTPRequest(BaseModel):
#     phone: str

# class OTPVerify(BaseModel):
#     phone: str
#     otp: str

# class LoginRequest(BaseModel):
#     phone: str
#     password: str

# @app.post("/register")
# def register(user: User):
#     # Check if user already exists
#     existing = supabase.table("users").select("id").eq("phone", user.phone).execute()
#     if existing.data:
#         return {"status": "error", "message": "User already registered"}
    
#     user_data = user.dict()
#     user_data["password"] = hash_password(user_data["password"])
#     result = supabase.table("users").insert(user_data).execute()
    
#     # Return user without password hash
#     safe_user = {k: v for k, v in result.data[0].items() if k != "password"}
#     return {"status": "success", "user": safe_user}

# @app.post("/login")
# def login(request: LoginRequest):
#     result = supabase.table("users").select("*").eq("phone", request.phone).execute()
#     if result.data:
#         user = result.data[0]
#         if verify_password(request.password, user["password"]):
#             safe_user = {k: v for k, v in user.items() if k != "password"}
#             return {"status": "success", "user": safe_user}
#     return {"status": "error", "message": "Invalid credentials"}

# @app.post("/doctor/register")
# def doctor_register(doctor: Doctor):
#     existing = supabase.table("doctors").select("id").eq("license_number", doctor.license_number).execute()
#     if existing.data:
#         return {"status": "error", "message": "Doctor already registered with this license number"}
    
#     doctor_data = doctor.dict()
#     doctor_data["password"] = hash_password(doctor_data["password"])
#     result = supabase.table("doctors").insert(doctor_data).execute()
    
#     safe_doctor = {k: v for k, v in result.data[0].items() if k != "password"}
#     return {"status": "success", "doctor": safe_doctor}

# @app.post("/doctor/login")
# def doctor_login(request: DoctorLoginRequest):
#     result = supabase.table("doctors").select("*").eq("license_number", request.license_number).execute()
#     if result.data:
#         doctor = result.data[0]
#         if verify_password(request.password, doctor["password"]):
#             safe_doctor = {k: v for k, v in doctor.items() if k != "password"}
#             return {"status": "success", "doctor": safe_doctor}
#     return {"status": "error", "message": "Invalid license number or password"}

# @app.post("/send-otp")
# def send_otp(request: OTPRequest):
#     # Generate 4-digit OTP
#     otp = str(random.randint(1000, 9999))
    
#     # Upsert into otps table (replace if phone already has an OTP)
#     supabase.table("otps").upsert({"phone": request.phone, "otp": otp}, on_conflict="phone").execute()
#     print(f"OTP for {request.phone} is: {otp}")  # Log internally
    
#     # Send SMS via Twilio
#     if twilio_client:
#         try:
#             to_number = request.phone
#             if not to_number.startswith("+"):
#                  to_number = "+91" + to_number
            
#             message = twilio_client.messages.create(
#                 from_=TWILIO_PHONE_NUMBER,
#                 body=f'OTP IS "{otp}"',
#                 to=to_number
#             )
#             print(f"Twilio Message SID: {message.sid}")
#         except Exception as e:
#             print(f"Failed to send SMS: {e}")
            
#     return {"status": "success", "message": "OTP sent successfully"}

# @app.post("/verify-otp")
# def verify_otp(request: OTPVerify):
#     result = supabase.table("otps").select("otp").eq("phone", request.phone).execute()
#     if result.data and result.data[0]["otp"] == request.otp:
#         # Delete OTP after successful verification
#         supabase.table("otps").delete().eq("phone", request.phone).execute()
#         return {"status": "success", "message": "OTP verified"}
#     return {"status": "error", "message": "Invalid OTP"}

# def _background_process_and_update(report_id: str, user_phone: str, file_path: str):
#     """Background task: runs OCR/AI processing, then updates the Supabase report row."""
#     try:
#         result = process_medical_file(user_phone, file_path)
#         if result and result.get("status") == "success":
#             extracted = result.get("data", {})
#             clinical = extracted.get("clinical_data", {}) or {}
#             lab_count = len(clinical.get("lab_reports", []) or [])
#             vitals_count = len(clinical.get("vitals", []) or [])
#             meds_count = len(clinical.get("medications", []) or [])
#             diag_count = len(clinical.get("diagnosis", []) or [])
#             metrics_count = lab_count + vitals_count
#             metrics_list = [l.get("name", "") for l in (clinical.get("lab_reports", []) or [])]
#             metrics_list += [v.get("name", "") for v in (clinical.get("vitals", []) or [])]
#             patient_info = extracted.get("patient_info", {}) or {}
#             supabase.table("reports").update({
#                 "status": "processed",
#                 "metrics_count": metrics_count,
#                 "metrics_list": metrics_list,
#                 "extracted_data": extracted,
#                 "patient_name": patient_info.get("name"),
#             }).eq("id", report_id).execute()
#             print(f"✅ Report {report_id} updated: {metrics_count} metrics extracted.")
#         else:
#             supabase.table("reports").update({
#                 "status": "failed",
#             }).eq("id", report_id).execute()
#             print(f"❌ Report {report_id} processing failed.")
#     except Exception as e:
#         print(f"❌ Background processing error for report {report_id}: {e}")
#         try:
#             supabase.table("reports").update({"status": "failed"}).eq("id", report_id).execute()
#         except:
#             pass


# def _background_ingest_neo4j(file_path: str):
#     """Background task: ingest uploaded medical report into Neo4j KG."""
#     if not _neo4j_available:
#         return
#     try:
#         today = dt.datetime.now().strftime("%Y-%m-%d")
#         print(f"🔄 KG ingestion starting for {file_path}")
#         kg_ingest.ingest_medical_report(file_path, today)
#         print(f"✅ KG ingestion complete for {file_path}")
#     except Exception as e:
#         print(f"❌ KG ingestion failed (non-fatal): {e}")


# @app.post("/upload")
# async def upload_file(file: UploadFile = File(...), user_phone: str = Form(""), background_tasks: BackgroundTasks = None):
#     """Upload endpoint — saves locally + OCR/AI in background + Neo4j KG ingestion."""
#     if not (file.content_type.startswith("image/") or file.content_type == "application/pdf"):
#         raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and Images are allowed.")
    
#     file_path = os.path.join(UPLOAD_DIR, file.filename)
#     with open(file_path, "wb") as buffer:
#         shutil.copyfileobj(file.file, buffer)
    
#     # Process in background so the response returns immediately
#     background_tasks.add_task(process_medical_file, user_phone, file_path)
#     # Also ingest into Neo4j Knowledge Graph
#     background_tasks.add_task(_background_ingest_neo4j, file_path)
#     return {"status": "processing", "filename": file.filename, "path": file_path, "message": "File uploaded. Processing in background."}


# @app.post("/upload-report")
# async def upload_report(
#     file: UploadFile = File(...),
#     user_phone: str = Form(""),
#     background_tasks: BackgroundTasks = None,
# ):
#     """Report upload — saves locally, creates Supabase report row, processes in background."""
#     if not (file.content_type.startswith("image/") or file.content_type == "application/pdf"):
#         raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and Images are allowed.")

#     # Save file locally
#     file_path = os.path.join(UPLOAD_DIR, file.filename)
#     with open(file_path, "wb") as buffer:
#         shutil.copyfileobj(file.file, buffer)

#     # Create a report record in Supabase with status 'processing'
#     report_id = str(uuid.uuid4())
#     now_iso = dt.datetime.now(dt.timezone.utc).isoformat()
#     file_type = "pdf" if file.content_type == "application/pdf" else "image"

#     report_row = {
#         "id": report_id,
#         "user_phone": user_phone,
#         "filename": file.filename,
#         "file_type": file_type,
#         "status": "processing",
#         "metrics_count": 0,
#         "metrics_list": [],
#         "uploaded_at": now_iso,
#     }

#     if supabase:
#         supabase.table("reports").insert(report_row).execute()
#         print(f"📋 Report record created: {report_id}")

#     # Process in background — will update the Supabase row when done
#     background_tasks.add_task(_background_process_and_update, report_id, user_phone, file_path)

#     return {
#         "status": "processing",
#         "report_id": report_id,
#         "filename": file.filename,
#         "message": "Report uploaded. Processing in background.",
#     }

# health_records = {
#     "past": [
#         {'Date': '2026-02-05', 'Age': 19, 'Sleep Duration': 7.8, 'Quality of Sleep': 8.0, 'Heart Rate': 72, 'Daily Steps': 11452},
#         {'Date': '2026-02-06', 'Age': 19, 'Sleep Duration': 8.2, 'Quality of Sleep': 8.5, 'Heart Rate': 70, 'Daily Steps': 12123},
#         {'Date': '2026-02-07', 'Age': 19, 'Sleep Duration': 7.5, 'Quality of Sleep': 7.5, 'Heart Rate': 75, 'Daily Steps': 10895},
#         {'Date': '2026-02-08', 'Age': 19, 'Sleep Duration': 8.0, 'Quality of Sleep': 8.0, 'Heart Rate': 71, 'Daily Steps': 13000},
#         {'Date': '2026-02-09', 'Age': 19, 'Sleep Duration': 7.9, 'Quality of Sleep': 8.2, 'Heart Rate': 73, 'Daily Steps': 11562},
#         {'Date': '2026-02-10', 'Age': 19, 'Sleep Duration': 8.4, 'Quality of Sleep': 9.0, 'Heart Rate': 70, 'Daily Steps': 14223},
#         {'Date': '2026-02-11', 'Age': 19, 'Sleep Duration': 7.7, 'Quality of Sleep': 7.8, 'Heart Rate': 74, 'Daily Steps': 10705}, 
#     ],
#     "current": [
#         {'Date': '2026-02-12', 'Age': 19, 'Sleep Duration': 4.2, 'Quality of Sleep': 3.0, 'Heart Rate': 88, 'Daily Steps': 1202},
#         {'Date': '2026-02-13', 'Age': 19, 'Sleep Duration': 3.5, 'Quality of Sleep': 2.5, 'Heart Rate': 90, 'Daily Steps': 853},
#         {'Date': '2026-02-14', 'Age': 19, 'Sleep Duration': 10.5, 'Quality of Sleep': 4.0, 'Heart Rate': 85, 'Daily Steps': 1505},
#         {'Date': '2026-02-15', 'Age': 19, 'Sleep Duration': 4.0, 'Quality of Sleep': 2.0, 'Heart Rate': 89, 'Daily Steps': 2130},
#         {'Date': '2026-02-16', 'Age': 19, 'Sleep Duration': 5.1, 'Quality of Sleep': 3.5, 'Heart Rate': 87, 'Daily Steps': 1102},
#         {'Date': '2026-02-17', 'Age': 19, 'Sleep Duration': 3.8, 'Quality of Sleep': 2.5, 'Heart Rate': 90, 'Daily Steps': 943},
#         {'Date': '2026-02-18', 'Age': 19, 'Sleep Duration': 9.8, 'Quality of Sleep': 4.5, 'Heart Rate': 84, 'Daily Steps': 1305}
#     ]
# }

# def calculate_weekly_risk(week_data):
#     df = pd.DataFrame(week_data)
    
#     # Fill missing RF features (Stress/Activity) with 0
#     for feat in features:
#         if feat not in df.columns:
#             df[feat] = 0
            
#     # Get probabilities from RF Model
#     # probs shape: [target][row][class]
#     probs = model.predict_proba(df[features])
    
#     # Calculate Mean Probabilities for the week
#     heart_p = np.mean([p[1] for p in probs[0]])
#     obesity_p = np.mean([p[1] for p in probs[1]])
#     resp_p = np.mean([p[1] for p in probs[2]])
    
#     # Final Verdict Logic
#     risks = []
#     if heart_p > 0.7: risks.append("Heart")
#     if obesity_p > 0.7: risks.append("Obesity")
#     if resp_p > 0.7: risks.append("Respiratory")
#     print(heart_p)
#     print(obesity_p)
#     print(resp_p)
#     return {
#         "heartProb": round(heart_p * 100, 2),
#         "obesityProb": round(obesity_p * 100, 2),
#         "respProb": round(resp_p * 100, 2),
#         "verdict": "HIGH RISK" if risks else "LOW RISK",
#         "riskFactors": risks
#     }

# # class User(BaseModel):
# #     name: str
# #     phone: str
# #     dob: str
# #     gender: str
# #     blood_group: str
# #     password: str

# # class OTPRequest(BaseModel):
# #     phone: str

# # class OTPVerify(BaseModel):
# #     phone: str
# #     otp: str

# # class LoginRequest(BaseModel):
# #     phone: str
# #     password: str



# @app.post("/chat")
# def chat(payload: dict = Body(...)):
#     user_phone = payload.get("user_phone", "")
#     message = payload.get("message", "")
#     text = message.lower()
#     ans = start_interactive_chat(user_phone, text)
#     return {"reply": ans}

# @app.post("/save-stats")
# def save_stats(stats: dict):
#     stats_db.append(stats)
#     return {"status": "saved"}

# @app.get("/")
# def read_root():
#     return {"Hello": "World"}

# @app.get("/graph")
# def get_graph():
#     html_path = os.path.join(basedir, "healthlink_interactive.html")
#     return FileResponse(html_path, media_type="text/html")

# @app.get("/api/health-stats/{week_type}")
# async def get_stats(week_type: str):
#     data = health_records.get(week_type, [])
#     risk_analysis = calculate_weekly_risk(data)
#     print("called")
#     return {
#         "raw_data": data,
#         "analysis": risk_analysis
#     }

# @app.post("/qr")
# def get_qr(payload: dict = Body(...)):
#     user_phone = payload.get("user_phone", "")
#     # Generate a URL pointing to this user's health profile
#     qr_url = f"http://{os.environ.get('HOST_IP', '192.168.1.100')}:9000/profile/{user_phone}"
#     return {"url": qr_url, "user_phone": user_phone}

# @app.get("/profile/{phone}")
# def get_profile(phone: str):
#     return {"message": f"Health profile for {phone}", "phone": phone}


# # ──────────────────────────────────────────────────────────
# # REPORTS ENDPOINTS (Supabase)
# # ──────────────────────────────────────────────────────────

# @app.get("/reports/{user_phone}")
# def list_reports(user_phone: str):
#     """Return all reports for a user, newest first."""
#     if not supabase:
#         raise HTTPException(status_code=500, detail="Database not configured")
#     result = (
#         supabase.table("reports")
#         .select("id, filename, file_type, status, metrics_count, metrics_list, uploaded_at, patient_name")
#         .eq("user_phone", user_phone)
#         .order("uploaded_at", desc=True)
#         .execute()
#     )
#     return {"status": "success", "reports": result.data}


# @app.get("/reports/detail/{report_id}")
# def get_report_detail(report_id: str):
#     """Return full report including extracted data."""
#     if not supabase:
#         raise HTTPException(status_code=500, detail="Database not configured")
#     result = supabase.table("reports").select("*").eq("id", report_id).execute()
#     if not result.data:
#         raise HTTPException(status_code=404, detail="Report not found")
#     return {"status": "success", "report": result.data[0]}


# # ──────────────────────────────────────────────────────────
# # FITBIT INSIGHTS ENDPOINTS (uses ML/wear.py functions)
# # ──────────────────────────────────────────────────────────
# import sys
# import subprocess

# # Add ML directory to path so we can import wear.py functions
# ML_DIR = os.path.join(os.path.dirname(basedir), "ML")
# sys.path.insert(0, ML_DIR)
# from wear import forecast_body_battery, calculate_sleep_streaks_and_nudges, generate_personalized_nudges

# FITBIT_JSON_PATH = os.path.join(ML_DIR, "fitbit_2weeks_data.json")


# @app.get("/api/fitbit-insights")
# def get_fitbit_insights():
#     """
#     Read the Fitbit JSON data file and compute all 3 wellness insights:
#       1. Body Battery Energy Forecast
#       2. Sleep Consistency Streaks & Nudges
#       3. Personalized Nudges
#     """
#     if not os.path.exists(FITBIT_JSON_PATH):
#         raise HTTPException(status_code=404, detail="Fitbit data not found. Run data fetch first.")

#     try:
#         with open(FITBIT_JSON_PATH, "r", encoding="utf-8") as f:
#             full_data = json.load(f)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to read Fitbit data: {str(e)}")

#     # Run all 3 insight functions from wear.py
#     energy_forecast = forecast_body_battery(full_data)
#     sleep_consistency = calculate_sleep_streaks_and_nudges(full_data)
#     nudges = generate_personalized_nudges(full_data)

#     # Get file modification time as "last sync"
#     mod_time = os.path.getmtime(FITBIT_JSON_PATH)
#     last_sync = dt.datetime.fromtimestamp(mod_time).isoformat()
#     print(energy_forecast)
#     print(sleep_consistency)
#     print(nudges)
#     return {
#         "status": "success",
#         "last_sync": last_sync,
#         "energy_forecast": energy_forecast,
#         "sleep_consistency": sleep_consistency,
#         "nudges": nudges,
#     }


# @app.post("/api/fitbit-refresh")#hi
# def refresh_fitbit_data():
#     """
#     Re-run final_fetch.py to pull fresh data from Fitbit API
#     and overwrite fitbit_2weeks_data.json.
#     """
#     fetch_script = os.path.join(ML_DIR, "final_fetch.py")
#     if not os.path.exists(fetch_script):
#         raise HTTPException(status_code=404, detail="Fetch script not found")

#     try:
#         result = subprocess.run(
#             [sys.executable, fetch_script],
#             cwd=ML_DIR,
#             capture_output=True,
#             text=True,
#             timeout=60,
#         )
#         if result.returncode != 0:
#             raise HTTPException(status_code=500, detail=f"Fetch failed: {result.stderr}")
#         return {"status": "success", "message": "Fitbit data refreshed"}
#     except subprocess.TimeoutExpired:
#         raise HTTPException(status_code=504, detail="Fetch timed out")
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Fetch error: {str(e)}")


# # ─────────────────────────────────────────────────────
# # NEO4J GRAPH API ENDPOINTS
# # ─────────────────────────────────────────────────────

# @app.get("/api/graph-data")
# def get_graph_data():
#     """Return all Neo4j nodes and relationships as JSON for visualization."""
#     if not _neo4j_available:
#         raise HTTPException(status_code=503, detail="Neo4j is not connected")

#     with graph_db.driver.session() as session:
#         # Fetch all nodes
#         nodes_result = session.run("""
#             MATCH (n)
#             RETURN id(n) AS id, labels(n) AS labels, properties(n) AS props
#         """)
#         nodes = []
#         for r in nodes_result:
#             label = r["labels"][0] if r["labels"] else "Unknown"
#             props = dict(r["props"])
#             # Build a display label
#             display = props.get("display_name") or props.get("name") or props.get("drug") or props.get("description") or props.get("date") or props.get("canonical_id") or label
#             nodes.append({
#                 "id": r["id"],
#                 "label": str(display),
#                 "group": label,
#                 "properties": {k: str(v) for k, v in props.items()},
#             })

#         # Fetch all relationships
#         rels_result = session.run("""
#             MATCH (a)-[r]->(b)
#             RETURN id(a) AS source, id(b) AS target, type(r) AS type
#         """)
#         edges = []
#         for r in rels_result:
#             edges.append({
#                 "from": r["source"],
#                 "to": r["target"],
#                 "label": r["type"],
#             })

#     return {"nodes": nodes, "edges": edges}


# @app.get("/api/graph-html", response_class=HTMLResponse)
# def get_graph_html():
#     """Return a self-contained interactive vis.js graph page."""
#     if not _neo4j_available:
#         return HTMLResponse(content="<html><body style='background:#0B1120;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif'><h2>Neo4j is not connected</h2></body></html>")

#     return HTMLResponse(content="""
# <!DOCTYPE html>
# <html lang="en">
# <head>
# <meta charset="UTF-8">
# <meta name="viewport" content="width=device-width, initial-scale=1.0">
# <title>HealthLink Knowledge Graph</title>
# <script src="https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js"></script>
# <style>
#   * { margin: 0; padding: 0; box-sizing: border-box; }
#   body { background: #0B1120; color: #E2E8F0; font-family: 'Inter', system-ui, sans-serif; }
#   #graph { width: 100vw; height: 100vh; }
#   #loading {
#     position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
#     font-size: 16px; color: #94A3B8;
#   }
#   #legend {
#     position: absolute; top: 12px; left: 12px;
#     background: rgba(15,23,42,0.9); border: 1px solid #1E293B;
#     border-radius: 12px; padding: 12px 16px; font-size: 12px;
#     max-height: 90vh; overflow-y: auto;
#   }
#   .legend-item { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
#   .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
#   #stats {
#     position: absolute; bottom: 12px; left: 12px;
#     background: rgba(15,23,42,0.9); border: 1px solid #1E293B;
#     border-radius: 12px; padding: 10px 16px; font-size: 12px; color: #64748B;
#   }
# </style>
# </head>
# <body>
# <div id="graph"></div>
# <div id="loading">Loading graph data...</div>
# <div id="legend"></div>
# <div id="stats"></div>
# <script>
# const COLORS = {
#   PatientProfile: '#4FC3F7', Visit: '#81C784', MedicalData: '#FFB74D',
#   LabResult: '#EF5350', Prescription: '#BA68C8', Diagnosis: '#F06292',
#   TestType: '#4DD0E1', DrugType: '#AED581', DiagnosisType: '#FF8A65',
#   Scan: '#FFD54F', Finding: '#E57373', WearableLog: '#64B5F6',
#   Metric: '#4DB6AC', MetricType: '#7986CB', Unknown: '#90A4AE'
# };

# fetch('./graph-data')
#   .then(r => r.json())
#   .then(data => {
#     document.getElementById('loading').style.display = 'none';

#     const nodes = new vis.DataSet(data.nodes.map(n => ({
#       id: n.id, label: n.label,
#       color: { background: COLORS[n.group] || COLORS.Unknown, border: '#1E293B',
#                highlight: { background: '#fff', border: COLORS[n.group] || '#fff' }},
#       font: { color: '#E2E8F0', size: 12, face: 'Inter, system-ui' },
#       shape: n.group === 'PatientProfile' ? 'diamond' :
#              n.group === 'Visit' ? 'dot' :
#              ['TestType','DrugType','DiagnosisType','MetricType'].includes(n.group) ? 'triangle' : 'dot',
#       size: n.group === 'PatientProfile' ? 30 :
#             ['TestType','DrugType','DiagnosisType','Visit'].includes(n.group) ? 20 : 14,
#       title: Object.entries(n.properties).map(([k,v]) => k+': '+v).join('\\n'),
#     })));

#     const edges = new vis.DataSet(data.edges.map(e => ({
#       from: e.from, to: e.to, label: e.label,
#       color: { color: '#334155', highlight: '#94A3B8' },
#       font: { color: '#475569', size: 9, strokeWidth: 0 },
#       arrows: 'to', smooth: { type: 'curvedCW', roundness: 0.15 },
#     })));

#     const container = document.getElementById('graph');
#     const network = new vis.Network(container, { nodes, edges }, {
#       physics: { solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -60, springLength: 120 }},
#       interaction: { hover: true, tooltipDelay: 100, zoomView: true },
#       layout: { improvedLayout: data.nodes.length < 200 },
#     });

#     // Legend
#     const groups = [...new Set(data.nodes.map(n => n.group))];
#     document.getElementById('legend').innerHTML = '<b style="color:#94A3B8">Node Types</b>' +
#       groups.map(g => '<div class="legend-item"><div class="legend-dot" style="background:' +
#         (COLORS[g]||COLORS.Unknown) + '"></div>' + g + '</div>').join('');

#     document.getElementById('stats').textContent =
#       data.nodes.length + ' nodes · ' + data.edges.length + ' relationships';
#   })
#   .catch(err => {
#     document.getElementById('loading').textContent = 'Failed to load graph: ' + err.message;
#   });
# </script>
# </body>
# </html>
# """)

from fastapi import FastAPI, Body, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, HTMLResponse
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

# ── GraphSchema / Neo4j (non-fatal — server works even if Neo4j is down) ──────
try:
    from neo4j_bridge import ingest_report_to_neo4j, ingest_scan_to_neo4j, get_graph_data
    _NEO4J_BRIDGE = True
    print("✅ neo4j_bridge loaded.")
except Exception as _ne:
    _NEO4J_BRIDGE = False
    print(f"⚠️  neo4j_bridge not loaded: {_ne}")
# ──────────────────────────────────────────────────────────────────────────────

# ── GraphRag chatbot (non-fatal — falls back to error if unavailable) ─────────
_GRAPHRAG_AVAILABLE = False
try:
    GRAPHRAG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "KG", "GraphRag")
    import sys as _sys2
    _sys2.path.insert(0, GRAPHRAG_DIR)
    from query_engine import query as graphrag_query, ConversationHistory
    _GRAPHRAG_AVAILABLE = True
    _user_conversations: dict[str, ConversationHistory] = {}  # per-user chat history
    print("✅ GraphRag query engine loaded.")
except Exception as _gre:
    _GRAPHRAG_AVAILABLE = False
    print(f"⚠️  GraphRag not loaded: {_gre}")
    import traceback; traceback.print_exc()
# ──────────────────────────────────────────────────────────────────────────────
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

            # ── Write to Neo4j knowledge graph (non-fatal) ────────────────────
            if _NEO4J_BRIDGE:
                try:
                    ext = os.path.splitext(file_path)[1].lower()
                    if ext in [".jpg", ".jpeg", ".png"]:
                        ingest_scan_to_neo4j(file_path)
                    else:
                        ingest_report_to_neo4j(file_path)
                except Exception as _neo_err:
                    print(f"⚠️  Neo4j write failed (non-fatal): {_neo_err}")
            # ──────────────────────────────────────────────────────────────────
        else:
            supabase.table("reports").update({
                "status": "failed",
            }).eq("id", report_id).execute()
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

    # Also ingest into Neo4j Knowledge Graph (non-fatal)
    if _NEO4J_BRIDGE:
        ext = os.path.splitext(file_path)[1].lower()
        if ext in [".jpg", ".jpeg", ".png"]:
            background_tasks.add_task(ingest_scan_to_neo4j, file_path)
        else:
            background_tasks.add_task(ingest_report_to_neo4j, file_path)

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

    if not _GRAPHRAG_AVAILABLE:
        return {"reply": "Chat is temporarily unavailable. GraphRag engine not loaded.", "mode": "error"}

    # Get or create per-user conversation history
    if user_phone not in _user_conversations:
        _user_conversations[user_phone] = ConversationHistory()
    history = _user_conversations[user_phone]

    try:
        result = graphrag_query(message, history)
        return {
            "reply": result["answer"],
            "mode": result.get("mode", ""),
            "entities": result.get("entities_matched", {}),
            "graph_stats": result.get("graph_stats", {}),
        }
    except Exception as e:
        print(f"❌ GraphRag error: {e}")
        import traceback; traceback.print_exc()
        return {"reply": f"Sorry, I encountered an error processing your question. Please try again.", "mode": "error"}

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
    # QR encodes just the patient phone — session token is created at scan time
    return {"url": user_phone, "user_phone": user_phone}

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


# ─────────────────────────────────────────────────────
# NEO4J GRAPH API ENDPOINTS
# ─────────────────────────────────────────────────────

@app.get("/api/graph-data")
def api_graph_data():
    """Return all Neo4j nodes and relationships as JSON."""
    if not _NEO4J_BRIDGE:
        raise HTTPException(status_code=503, detail="Neo4j is not connected")
    data = get_graph_data()
    return data


@app.get("/api/graph-html", response_class=HTMLResponse)
def api_graph_html():
    """Return a self-contained interactive vis.js graph page."""
    if not _NEO4J_BRIDGE:
        return HTMLResponse(content="<html><body style='background:#0B1120;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif'><h2>Neo4j is not connected</h2></body></html>")

    return HTMLResponse(content="""
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HealthLink Knowledge Graph</title>
<script src="https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0B1120; color: #E2E8F0; font-family: 'Inter', system-ui, sans-serif; }
  #graph { width: 100vw; height: 100vh; }
  #loading {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-size: 16px; color: #94A3B8;
  }
  #legend {
    position: absolute; top: 12px; left: 12px;
    background: rgba(15,23,42,0.9); border: 1px solid #1E293B;
    border-radius: 12px; padding: 12px 16px; font-size: 12px;
    max-height: 90vh; overflow-y: auto;
  }
  .legend-item { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
  #stats {
    position: absolute; bottom: 12px; left: 12px;
    background: rgba(15,23,42,0.9); border: 1px solid #1E293B;
    border-radius: 12px; padding: 10px 16px; font-size: 12px; color: #64748B;
  }
</style>
</head>
<body>
<div id="graph"></div>
<div id="loading">Loading graph data...</div>
<div id="legend"></div>
<div id="stats"></div>
<script>
const COLORS = {
  PatientProfile: '#4FC3F7', Visit: '#81C784', MedicalData: '#FFB74D',
  LabResult: '#EF5350', Prescription: '#BA68C8', Diagnosis: '#F06292',
  TestType: '#4DD0E1', DrugType: '#AED581', DiagnosisType: '#FF8A65',
  Scan: '#FFD54F', Finding: '#E57373', WearableLog: '#64B5F6',
  Metric: '#4DB6AC', MetricType: '#7986CB', Unknown: '#90A4AE'
};

fetch('./graph-data')
  .then(r => r.json())
  .then(data => {
    document.getElementById('loading').style.display = 'none';

    const nodes = new vis.DataSet(data.nodes.map(n => ({
      id: n.id, label: n.label,
      color: { background: COLORS[n.group] || COLORS.Unknown, border: '#1E293B',
               highlight: { background: '#fff', border: COLORS[n.group] || '#fff' }},
      font: { color: '#E2E8F0', size: 12, face: 'Inter, system-ui' },
      shape: n.group === 'PatientProfile' ? 'diamond' :
             n.group === 'Visit' ? 'dot' :
             ['TestType','DrugType','DiagnosisType','MetricType'].includes(n.group) ? 'triangle' : 'dot',
      size: n.group === 'PatientProfile' ? 30 :
            ['TestType','DrugType','DiagnosisType','Visit'].includes(n.group) ? 20 : 14,
      title: Object.entries(n.properties).map(([k,v]) => k+': '+v).join('\\n'),
    })));

    const edges = new vis.DataSet(data.edges.map(e => ({
      from: e.from, to: e.to, label: e.label,
      color: { color: '#334155', highlight: '#94A3B8' },
      font: { color: '#475569', size: 9, strokeWidth: 0 },
      arrows: 'to', smooth: { type: 'curvedCW', roundness: 0.15 },
    })));

    const container = document.getElementById('graph');
    const network = new vis.Network(container, { nodes, edges }, {
      physics: { solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -60, springLength: 120 }},
      interaction: { hover: true, tooltipDelay: 100, zoomView: true },
      layout: { improvedLayout: data.nodes.length < 200 },
    });

    // Legend
    const groups = [...new Set(data.nodes.map(n => n.group))];
    document.getElementById('legend').innerHTML = '<b style="color:#94A3B8">Node Types</b>' +
      groups.map(g => '<div class="legend-item"><div class="legend-dot" style="background:' +
        (COLORS[g]||COLORS.Unknown) + '"></div>' + g + '</div>').join('');

    document.getElementById('stats').textContent =
      data.nodes.length + ' nodes \u00b7 ' + data.edges.length + ' relationships';
  })
  .catch(err => {
    document.getElementById('loading').textContent = 'Failed to load graph: ' + err.message;
  });
</script>
</body>
</html>
""")


# ══════════════════════════════════════════════════════════════════════════════
# DOCTOR SESSION MANAGEMENT — QR-based temporary access (1 hour)
# ══════════════════════════════════════════════════════════════════════════════

import uuid
from datetime import datetime as _dt, timedelta as _td

# In-memory session store: { token: { patient_phone, doctor_license, expires_at } }
_doctor_sessions: dict[str, dict] = {}
DOCTOR_SESSION_TTL = _td(hours=1)


def _cleanup_sessions():
    """Remove expired sessions."""
    now = _dt.utcnow()
    expired = [t for t, s in _doctor_sessions.items() if s["expires_at"] < now]
    for t in expired:
        del _doctor_sessions[t]


def _validate_session(token: str) -> dict:
    """Validate a session token. Returns session dict or raises 401/403."""
    _cleanup_sessions()
    session = _doctor_sessions.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please scan the QR code again.")
    if session["expires_at"] < _dt.utcnow():
        del _doctor_sessions[token]
        raise HTTPException(status_code=401, detail="Session expired. Please scan the QR code again.")
    return session


@app.post("/api/doctor/scan")
def doctor_scan(payload: dict = Body(...)):
    """
    Doctor scans patient QR code.
    Expects: { patient_phone, doctor_license }
    Returns: { token, patient_phone, expires_at, ttl_seconds }
    """
    patient_phone = payload.get("patient_phone", "").strip()
    doctor_license = payload.get("doctor_license", "").strip()

    if not patient_phone or not doctor_license:
        raise HTTPException(status_code=400, detail="patient_phone and doctor_license are required")

    # Verify patient exists in Supabase
    try:
        result = supabase.table("users").select("phone").eq("phone", patient_phone).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Patient not found")
    except HTTPException:
        raise
    except Exception:
        pass  # If Supabase is down, still allow (graceful)

    # Create session token
    token = str(uuid.uuid4())
    expires_at = _dt.utcnow() + DOCTOR_SESSION_TTL

    _doctor_sessions[token] = {
        "patient_phone": patient_phone,
        "doctor_license": doctor_license,
        "expires_at": expires_at,
        "created_at": _dt.utcnow(),
    }

    print(f"✅ Doctor session created: {doctor_license} → patient {patient_phone} (expires {expires_at})")

    return {
        "token": token,
        "patient_phone": patient_phone,
        "expires_at": expires_at.isoformat(),
        "ttl_seconds": int(DOCTOR_SESSION_TTL.total_seconds()),
    }


@app.post("/api/doctor/patient-graph")
def doctor_patient_graph(payload: dict = Body(...)):
    """
    Returns the patient's Neo4j graph data for the doctor.
    Expects: { token }
    """
    token = payload.get("token", "")
    session = _validate_session(token)

    if not _NEO4J_BRIDGE:
        raise HTTPException(status_code=503, detail="Neo4j is not connected")

    data = get_graph_data()
    remaining = int((session["expires_at"] - _dt.utcnow()).total_seconds())
    return {"graph": data, "patient_phone": session["patient_phone"], "remaining_seconds": remaining}


@app.post("/api/doctor/patient-chat")
def doctor_patient_chat(payload: dict = Body(...)):
    """
    Doctor chats about a patient's health data using GraphRag.
    Expects: { token, message }
    """
    token = payload.get("token", "")
    message = payload.get("message", "")
    session = _validate_session(token)

    if not _GRAPHRAG_AVAILABLE:
        return {"reply": "Chat is temporarily unavailable.", "mode": "error"}

    # Use a doctor-specific conversation key so histories don't clash with patient's own chat
    conv_key = f"doc_{session['doctor_license']}_{session['patient_phone']}"
    if conv_key not in _user_conversations:
        _user_conversations[conv_key] = ConversationHistory()
    history = _user_conversations[conv_key]

    try:
        result = graphrag_query(message, history, role="doctor")
        remaining = int((session["expires_at"] - _dt.utcnow()).total_seconds())
        return {
            "reply": result["answer"],
            "mode": result.get("mode", ""),
            "entities": result.get("entities_matched", {}),
            "remaining_seconds": remaining,
        }
    except Exception as e:
        print(f"❌ Doctor chat error: {e}")
        import traceback; traceback.print_exc()
        return {"reply": "Sorry, I encountered an error. Please try again.", "mode": "error"}


@app.post("/api/doctor/session-status")
def doctor_session_status(payload: dict = Body(...)):
    """
    Check if a doctor session is still valid.
    Expects: { token }
    Returns: { valid, remaining_seconds, patient_phone }
    """
    token = payload.get("token", "")
    _cleanup_sessions()
    session = _doctor_sessions.get(token)

    if not session or session["expires_at"] < _dt.utcnow():
        return {"valid": False, "remaining_seconds": 0, "patient_phone": ""}

    remaining = int((session["expires_at"] - _dt.utcnow()).total_seconds())
    return {
        "valid": True,
        "remaining_seconds": remaining,
        "patient_phone": session["patient_phone"],
    }

