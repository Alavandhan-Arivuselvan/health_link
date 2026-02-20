from fastapi import FastAPI, Body, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import random
import os
import shutil
from utils import process_medical_file,start_interactive_chat
from twilio.rest import Client
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

# Simple in-memory storage
users_db = {}      # Phone -> User Dict
otps_db = {}       # Phone -> OTP
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
    if user.phone in users_db:
         return {"status": "error", "message": "User already registered"}
    users_db[user.phone] = user.dict()
    return {"status": "success", "user": user}

@app.post("/login")
def login(request: LoginRequest):
    user = users_db.get(request.phone)
    if user and user["password"] == request.password:
        return {"status": "success", "user": user}
    return {"status": "error", "message": "Invalid credentials"}

@app.post("/send-otp")
def send_otp(request: OTPRequest):
    # Generate 4-digit OTP
    otp = str(random.randint(1000, 9999))
    otps_db[request.phone] = otp
    print(f"OTP for {request.phone} is: {otp}") # Log internally
    
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

            # We might want to return an error, but for now let's allow it to 'succeed' 
            # so the flow continues even if SMS fails (e.g. for testing with invalid numbers)
            
    return {"status": "success", "message": "OTP sent successfully"}

@app.post("/verify-otp")
def verify_otp(request: OTPVerify):
    stored_otp = otps_db.get(request.phone)
    if stored_otp and stored_otp == request.otp:
        return {"status": "success", "message": "OTP verified"}
    return {"status": "error", "message": "Invalid OTP"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), user_phone: str = Form(""), background_tasks: BackgroundTasks = None):
    if not (file.content_type.startswith("image/") or file.content_type == "application/pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and Images are allowed.")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Process in background so the response returns immediately
    background_tasks.add_task(process_medical_file, user_phone, file_path)
    return {"status": "processing", "filename": file.filename, "path": file_path, "message": "File uploaded. Processing in background."}

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

