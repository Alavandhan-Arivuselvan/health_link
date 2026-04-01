# fitbit_fetch_steps_hr_sleep.py
# Requirements: pip install requests
# Run: python fitbit_fetch_steps_hr_sleep.py
# If token expires → re-run your authorization script to get a new one

import requests
import json
from datetime import datetime, timedelta
from collections import defaultdict

# ================== YOUR SETTINGS ==================
ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyM1YyR1kiLCJzdWIiOiJDV1hDVlYiLCJpc3MiOiJGaXRiaXQiLCJ0eXAiOiJhY2Nlc3NfdG9rZW4iLCJzY29wZXMiOiJyaHIgcmFjdCBycHJvIHJzbGUiLCJleHAiOjE3NzI3MDM1OTksImlhdCI6MTc3MjYxNzE5OX0.OncygQ-GYc3d25NvlIX0qgZEBsH4fkLyO_BpopaVa18"          # ← From your auth script (#access_token=...)
HEADERS = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Accept-Language": "en_US"   # Optional: adjust if needed
}

# Date range: last 14 days (including today)
today = datetime.now().date()
start_date = today - timedelta(days=13)
start_str = start_date.isoformat()
end_str = today.isoformat()

BASE = "https://api.fitbit.com/1/user/-"

def fetch_steps():
    """Daily total steps over the range"""
    url = f"{BASE}/activities/steps/date/{start_str}/{end_str}.json"
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code != 200:
        return {"error": resp.text, "status": resp.status_code}
    
    data = resp.json().get("activities-steps", [])
    return {item["dateTime"]: int(item["value"]) for item in data}


def fetch_heart_rate():
    """Daily summaries + intraday (minute-level) per day"""
    # 1. Daily summaries (resting HR, zones)
    url_daily = f"{BASE}/activities/heart/date/{start_str}/{end_str}.json"
    resp_daily = requests.get(url_daily, headers=HEADERS)
    daily = {}
    if resp_daily.status_code == 200:
        for item in resp_daily.json().get("activities-heart", []):
            date = item["dateTime"]
            val = item["value"]
            daily[date] = {
                "resting_bpm": val.get("restingHeartRate"),
                "zones": val.get("heartRateZones", [])
            }
    
    # 2. Intraday minute-level → must loop per day
    intraday = {}
    current = start_date
    while current <= today:
        day_str = current.isoformat()
        url_intra = f"{BASE}/activities/heart/date/{day_str}/1d/1min.json"
        resp_intra = requests.get(url_intra, headers=HEADERS)
        if resp_intra.status_code == 200:
            dataset = resp_intra.json().get("activities-heart-intraday", {}).get("dataset", [])
            intraday[day_str] = [{"time": p["time"], "bpm": p["value"]} for p in dataset if p["value"] > 0]
        current += timedelta(days=1)
    
    return {
        "daily_summaries": daily,
        "intraday_minute_level": intraday
    }


def fetch_sleep():
    """Sleep logs over the range (minutes asleep → convert to hours)"""
    url = f"https://api.fitbit.com/1.2/user/-/sleep/date/{start_str}/{end_str}.json"
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code != 200:
        return {"error": resp.text, "status": resp.status_code}
    
    sleeps = resp.json().get("sleep", [])
    result = {
        "daily_sleep": defaultdict(dict),
        "total_asleep_minutes": 0,
        "days_with_data": 0
    }
    
    for s in sleeps:
        date = s.get("dateOfSleep")
        if not date:
            continue
        minutes_asleep = s.get("minutesAsleep", 0)
        result["daily_sleep"][date] = {
            "hours_asleep": round(minutes_asleep / 60, 2),
            "minutes_asleep": minutes_asleep,
            "time_in_bed_minutes": s.get("timeInBed", 0),
            "efficiency_percent": s.get("efficiency"),
            "stages": s.get("levels", {}).get("summary", {}),
            "is_main_sleep": s.get("isMainSleep", False),
            "start_time": s.get("startTime")
        }
        result["total_asleep_minutes"] += minutes_asleep
        result["days_with_data"] += 1
    
    if result["days_with_data"] > 0:
        result["average_hours_asleep"] = round(
            (result["total_asleep_minutes"] / result["days_with_data"]) / 60, 2
        )
    
    return result


# ================== COLLECT ALL DATA ==================
all_data = {
    "period": f"{start_str} to {end_str}",
    "steps": fetch_steps(),
    "heart_rate": fetch_heart_rate(),
    "sleep": fetch_sleep()
}

# Print beautiful JSON
print(json.dumps(all_data, indent=2))

# Optional: Save to file
with open("fitbit_2weeks_data.json", "w", encoding="utf-8") as f:
    json.dump(all_data, f, indent=2)
    print("\nData saved to fitbit_2weeks_data.json")