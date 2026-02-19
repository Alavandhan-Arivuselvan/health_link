from fastapi import FastAPI, Body, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List
import random
import os
import shutil

app = FastAPI()

# Simple in-memory storage
db = {
    "users": {},      # Phone -> User Dict
    "otps": {},       # Phone -> OTP
    "records": [], 
    "stats": []
}

# Ensure uploads directory exists
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
    if user.phone in db["users"]:
         return {"status": "error", "message": "User already registered"}
    db["users"][user.phone] = user.dict()
    return {"status": "success", "user": user}

@app.post("/login")
def login(request: LoginRequest):
    user = db["users"].get(request.phone)
    if user and user["password"] == request.password:
        return {"status": "success", "user": user}
    return {"status": "error", "message": "Invalid credentials"}

@app.post("/send-otp")
def send_otp(request: OTPRequest):
    # Generate 4-digit OTP
    otp = str(random.randint(1000, 9999))
    db["otps"][request.phone] = otp
    print(f"OTP for {request.phone} is: {otp}") # Simulate sending
    return {"status": "success", "message": "OTP sent successfully"}

@app.post("/verify-otp")
def verify_otp(request: OTPVerify):
    stored_otp = db["otps"].get(request.phone)
    if stored_otp and stored_otp == request.otp:
        return {"status": "success", "message": "OTP verified"}
    return {"status": "error", "message": "Invalid OTP"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"status": "success", "filename": file.filename}

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
    db["stats"].append(stats)
    return {"status": "saved"}
