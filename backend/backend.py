from fastapi import FastAPI, Body
from pydantic import BaseModel
from typing import List

app = FastAPI()

# Simple in-memory storage
db = {"users": {}, "records": [], "stats": []}

class User(BaseModel):
    name: str
    phone: str
    age: int

@app.post("/register")
def register(user: User):
    db["users"][user.phone] = user.dict()
    return {"status": "success", "user": user}

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