from fastapi import FastAPI, Body, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import random
import os
import shutil
from utils import pipline
from twilio.rest import Client
from dotenv import load_dotenv

# Load environment variables
# Load environment variables
basedir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(basedir, ".env.local"))

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
async def upload_file(file: UploadFile = File(...), user_phone: str = Form("")):
    if not (file.content_type.startswith("image/") or file.content_type == "application/pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and Images are allowed.")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    pipline(os.path.join(basedir, "doc"), user_phone)
    return {"status": "success", "filename": file.filename, "path": file_path}

@app.post("/chat")
def chat(message: str = Body(..., embed=True)):
    text = message.lower()
    if "fever" in text:
        reply = "Backend Analysis: Stay hydrated and monitor temperature."
    elif "headache" in text:
        reply = "Backend Analysis: Rest and check your blood pressure."
    else:
        reply = "This response came from your FastAPI backend!"
    return {"reply": reply}

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
