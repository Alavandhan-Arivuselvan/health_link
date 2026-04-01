# googlefit_fetch.py
# Fetches Steps, Heart Rate, Sleep, SpO2 from Google Fit API
# Includes auto token refresh - just run it anytime, no manual token needed!

import requests
import json
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Load credentials from .env.local in the backend directory
basedir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(basedir, ".env.local"))

CLIENT_ID     = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("REFRESH_TOKEN")


# ================== AUTO TOKEN REFRESH ==================
def refresh_access_token():
    """Gets a fresh access token automatically using refresh token"""
    if not all([CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN]):
        raise Exception("❌ Missing credentials in .env.local: CLIENT_ID, CLIENT_SECRET, or REFRESH_TOKEN")

    print("🔄 Refreshing access token...")
    resp = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
        "grant_type":    "refresh_token"
    })
    if resp.status_code != 200:
        print(f"❌ Token refresh failed: {resp.status_code} - {resp.text}")
        raise Exception("Could not refresh access token. Check your CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN.")
    token = resp.json().get("access_token")
    print("✅ Access token refreshed successfully!")
    return token

# Get fresh token on every run
ACCESS_TOKEN = refresh_access_token()

HEADERS = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json"
}

BASE = "https://www.googleapis.com/fitness/v1/users/me"

# ================== DATE RANGE ==================
IST = timezone(timedelta(hours=5, minutes=30))
today      = datetime.now(IST).date()
start_date = today - timedelta(days=13)  # 14 days including today

def to_millis(date_obj, end_of_day=False):
    if end_of_day:
        dt = datetime(date_obj.year, date_obj.month, date_obj.day, 23, 59, 59, tzinfo=IST)
    else:
        dt = datetime(date_obj.year, date_obj.month, date_obj.day, 0, 0, 0, tzinfo=IST)
    return int(dt.timestamp() * 1000)

# ================== FETCH FUNCTIONS ==================

def fetch_steps_daily():
    """Fetch daily step counts"""
    url  = f"{BASE}/dataset:aggregate"
    body = {
        "aggregateBy": [{"dataTypeName": "com.google.step_count.delta"}],
        "bucketByTime": {"durationMillis": 86400000},
        "startTimeMillis": to_millis(start_date),
        "endTimeMillis":   to_millis(today, end_of_day=True)
    }
    resp = requests.post(url, headers=HEADERS, json=body)
    if resp.status_code != 200:
        print(f"❌ Steps error: {resp.status_code} - {resp.text}")
        return {}
    daily = {}
    for bucket in resp.json().get("bucket", []):
        date_str = datetime.fromtimestamp(int(bucket["startTimeMillis"]) / 1000, tz=IST).strftime("%Y-%m-%d")
        steps = 0
        for dataset in bucket.get("dataset", []):
            for point in dataset.get("point", []):
                steps += point.get("value", [{}])[0].get("intVal", 0)
        daily[date_str] = steps
    return daily


def fetch_heart_rate_daily():
    """Fetch avg, min, max, resting heart rate per day"""
    url  = f"{BASE}/dataset:aggregate"
    body = {
        "aggregateBy": [{"dataTypeName": "com.google.heart_rate.bpm"}],
        "bucketByTime": {"durationMillis": 86400000},
        "startTimeMillis": to_millis(start_date),
        "endTimeMillis":   to_millis(today, end_of_day=True)
    }
    resp = requests.post(url, headers=HEADERS, json=body)
    if resp.status_code != 200:
        print(f"❌ Heart rate error: {resp.status_code} - {resp.text}")
        return {}
    daily = {}
    for bucket in resp.json().get("bucket", []):
        date_str   = datetime.fromtimestamp(int(bucket["startTimeMillis"]) / 1000, tz=IST).strftime("%Y-%m-%d")
        bpm_values = []
        latest_bpm = None
        latest_ts  = 0
        for dataset in bucket.get("dataset", []):
            for point in dataset.get("point", []):
                point_ts = int(point.get("startTimeNanos", 0))
                for val in point.get("value", []):
                    v = val.get("fpVal")
                    if v and v > 30:
                        bpm_values.append(v)
                        if point_ts >= latest_ts:
                            latest_ts  = point_ts
                            latest_bpm = v
        if bpm_values:
            daily[date_str] = {
                "avg_bpm":     round(sum(bpm_values) / len(bpm_values), 1),
                "min_bpm":     round(min(bpm_values), 1),
                "max_bpm":     round(max(bpm_values), 1),
                "resting_bpm": round(sorted(bpm_values)[int(len(bpm_values) * 0.1)], 1),
                "latest_bpm":  round(latest_bpm, 1) if latest_bpm else None,
            }
    return daily


def fetch_sleep_daily():
    """Fetch sleep sessions"""
    url    = f"{BASE}/sessions"
    params = {
        "startTime":    datetime(start_date.year, start_date.month, start_date.day, tzinfo=IST).isoformat(),
        "endTime":      datetime(today.year, today.month, today.day, 23, 59, 59, tzinfo=IST).isoformat(),
        "activityType": 72
    }
    resp = requests.get(url, headers=HEADERS, params=params)
    if resp.status_code != 200:
        print(f"❌ Sleep error: {resp.status_code} - {resp.text}")
        return {}
    daily = {}
    for session in resp.json().get("session", []):
        start_ms     = int(session["startTimeMillis"])
        end_ms       = int(session["endTimeMillis"])
        duration_min = (end_ms - start_ms) / 60000
        if duration_min < 180:
            continue
        date_str = datetime.fromtimestamp(start_ms / 1000, tz=IST).strftime("%Y-%m-%d")
        daily[date_str] = {
            "hours_asleep":   round(duration_min / 60, 2),
            "minutes_asleep": int(duration_min),
            "start_time":     datetime.fromtimestamp(start_ms / 1000, tz=IST).strftime("%H:%M"),
            "end_time":       datetime.fromtimestamp(end_ms   / 1000, tz=IST).strftime("%H:%M"),
        }
    return daily


def fetch_sleep_stages_daily():
    """Fetch deep, light, REM, awake minutes"""
    url  = f"{BASE}/dataset:aggregate"
    body = {
        "aggregateBy": [{"dataTypeName": "com.google.sleep.segment"}],
        "bucketByTime": {"durationMillis": 86400000},
        "startTimeMillis": to_millis(start_date),
        "endTimeMillis":   to_millis(today, end_of_day=True)
    }
    resp = requests.post(url, headers=HEADERS, json=body)
    if resp.status_code != 200:
        print(f"❌ Sleep stages error: {resp.status_code}")
        return {}
    stage_map = {1: "wake", 2: "light", 4: "light", 5: "deep", 6: "rem"}
    daily = {}
    for bucket in resp.json().get("bucket", []):
        date_str = datetime.fromtimestamp(int(bucket["startTimeMillis"]) / 1000, tz=IST).strftime("%Y-%m-%d")
        stages   = {"deep": 0, "light": 0, "rem": 0, "wake": 0}
        for dataset in bucket.get("dataset", []):
            for point in dataset.get("point", []):
                stage_val    = point.get("value", [{}])[0].get("intVal", 0)
                start_ns     = int(point.get("startTimeNanos", 0))
                end_ns       = int(point.get("endTimeNanos", 0))
                duration_min = (end_ns - start_ns) / 60e9
                stage_name   = stage_map.get(stage_val)
                if stage_name:
                    stages[stage_name] += duration_min
        if any(v > 0 for v in stages.values()):
            daily[date_str] = {k: round(v) for k, v in stages.items()}
    return daily


def fetch_spo2_daily():
    """Fetch blood oxygen saturation"""
    url  = f"{BASE}/dataset:aggregate"
    body = {
        "aggregateBy": [{"dataTypeName": "com.google.oxygen_saturation"}],
        "bucketByTime": {"durationMillis": 86400000},
        "startTimeMillis": to_millis(start_date),
        "endTimeMillis":   to_millis(today, end_of_day=True)
    }
    resp = requests.post(url, headers=HEADERS, json=body)
    if resp.status_code != 200:
        print(f"❌ SpO2 error: {resp.status_code}")
        return {}
    daily = {}
    for bucket in resp.json().get("bucket", []):
        date_str    = datetime.fromtimestamp(int(bucket["startTimeMillis"]) / 1000, tz=IST).strftime("%Y-%m-%d")
        spo2_values = []
        for dataset in bucket.get("dataset", []):
            for point in dataset.get("point", []):
                for val in point.get("value", []):
                    v = val.get("fpVal")
                    if v and 80 <= v <= 100:
                        spo2_values.append(v)
        if spo2_values:
            daily[date_str] = {
                "spo2_avg": round(sum(spo2_values) / len(spo2_values), 1),
                "spo2_min": round(min(spo2_values), 1),
                "spo2_max": round(max(spo2_values), 1)
            }
    return daily


# ================== BUILD FINAL DATA ==================
print("\n📡 Fetching from Google Fit API...")
print(f"   Period: {start_date} to {today}\n")

steps_data  = fetch_steps_daily()
hr_data     = fetch_heart_rate_daily()
sleep_data  = fetch_sleep_daily()
stages_data = fetch_sleep_stages_daily()
spo2_data   = fetch_spo2_daily()

print(f"\n✅ Steps fetched:      {len(steps_data)} days")
print(f"✅ Heart rate fetched: {len(hr_data)} days")
print(f"✅ Sleep fetched:      {len(sleep_data)} days")
print(f"✅ SpO2 fetched:       {len(spo2_data)} days")

all_data = {
    "period":     f"{start_date.isoformat()} to {today.isoformat()}",
    "fetched_at": datetime.now().isoformat(),
    "source":     "Google Fit API",
    "days":       {}
}

current = start_date
while current <= today:
    date_str = current.isoformat()
    day = {
        "date":        date_str,
        "steps":       steps_data.get(date_str, 0),
        "resting_bpm": hr_data.get(date_str, {}).get("resting_bpm"),
        "avg_bpm":     hr_data.get(date_str, {}).get("avg_bpm"),
        "min_bpm":     hr_data.get(date_str, {}).get("min_bpm"),
        "max_bpm":     hr_data.get(date_str, {}).get("max_bpm"),
        "spo2_avg":    spo2_data.get(date_str, {}).get("spo2_avg"),
        "spo2_min":    spo2_data.get(date_str, {}).get("spo2_min"),
        "spo2_max":    spo2_data.get(date_str, {}).get("spo2_max"),
        "sleep":       sleep_data.get(date_str)
    }
    if day["sleep"] and date_str in stages_data:
        day["sleep"]["stages"] = stages_data[date_str]
    all_data["days"][date_str] = day
    current += timedelta(days=1)

# ================== FILL MISSING VALUES WITH REALISTIC FAKES ==================
import random
random.seed(42)  # reproducible

days_dict = all_data["days"]

# Compute baselines from real data only
real_hr    = [d["avg_bpm"]              for d in days_dict.values() if d.get("avg_bpm")]
real_sleep = [d["sleep"]["hours_asleep"] for d in days_dict.values() if d.get("sleep") and d["sleep"].get("hours_asleep", 0) > 0]
real_spo2  = [d["spo2_avg"]             for d in days_dict.values() if d.get("spo2_avg")]

base_hr    = round(sum(real_hr)    / len(real_hr),    1) if real_hr    else 78.0
base_sleep = round(sum(real_sleep) / len(real_sleep),  1) if real_sleep else 6.5
base_spo2  = round(sum(real_spo2)  / len(real_spo2),  1) if real_spo2  else 97.0

print(f"\n📊 Baselines from real data:")
print(f"   HR={base_hr} bpm | Sleep={base_sleep} hrs | SpO2={base_spo2}%")

fake_count = {"hr": 0, "sleep": 0, "spo2": 0}

today_str = today.isoformat()

for date_str, day in days_dict.items():

    # Never fill today with fake data — only show actual measured values
    if date_str == today_str:
        continue
    # Fill missing HR
    if not day.get("avg_bpm"):
        fake_hr    = round(base_hr + random.uniform(-3, 3), 1)
        fake_rest  = round(fake_hr - random.uniform(1, 4), 1)
        day["avg_bpm"]     = fake_hr
        day["resting_bpm"] = fake_rest
        day["min_bpm"]     = round(fake_rest - random.uniform(1, 3), 1)
        day["max_bpm"]     = round(fake_hr   + random.uniform(2, 8), 1)
        day["_hr_fake"]    = True
        fake_count["hr"] += 1

    # Fill missing sleep
    if not day.get("sleep") or day["sleep"].get("hours_asleep", 0) == 0:
        fake_hours = round(max(5.0, min(9.0, base_sleep + random.uniform(-0.8, 0.8))), 1)
        fake_mins  = int(fake_hours * 60)
        day["sleep"] = {
            "hours_asleep":   fake_hours,
            "minutes_asleep": fake_mins,
            "start_time":     f"{random.randint(22,23):02d}:{random.randint(0,59):02d}",
            "end_time":       f"{random.randint(5,7):02d}:{random.randint(0,59):02d}",
            "stages": {
                "deep":  int(fake_mins * random.uniform(0.12, 0.20)),
                "rem":   int(fake_mins * random.uniform(0.18, 0.25)),
                "light": int(fake_mins * random.uniform(0.45, 0.55)),
                "wake":  random.randint(10, 30)
            },
            "_fake": True
        }
        fake_count["sleep"] += 1

    # Fill missing SpO2
    if not day.get("spo2_avg"):
        fake_avg = round(max(95.0, min(99.0, base_spo2 + random.uniform(-0.5, 0.5))), 1)
        day["spo2_avg"]  = fake_avg
        day["spo2_min"]  = round(fake_avg - random.uniform(0.5, 1.5), 1)
        day["spo2_max"]  = round(fake_avg + random.uniform(0.2, 1.0), 1)
        day["_spo2_fake"] = True
        fake_count["spo2"] += 1

print(f"   Fake filled → HR: {fake_count['hr']} days | Sleep: {fake_count['sleep']} days | SpO2: {fake_count['spo2']} days")

# ================== SUMMARY ==================
valid_steps = [d["steps"] for d in days_dict.values() if d["steps"] > 0]
valid_hr    = [d["avg_bpm"] for d in days_dict.values() if d["avg_bpm"]]
valid_sleep = [d["sleep"]["hours_asleep"] for d in days_dict.values() if d.get("sleep")]

all_data["summary"] = {
    "avg_daily_steps": round(sum(valid_steps) / len(valid_steps)) if valid_steps else 0,
    "avg_heart_rate":  round(sum(valid_hr)    / len(valid_hr),    1) if valid_hr    else None,
    "avg_sleep_hours": round(sum(valid_sleep) / len(valid_sleep), 2) if valid_sleep else None,
    "today_steps":     all_data["days"][today.isoformat()]["steps"]
}

# ================== SAVE ==================
output_file = "googlefit_2weeks_data.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(all_data, f, indent=2)

print(json.dumps(all_data, indent=2))
print(f"\n✅ Data saved to {output_file}")
print(f"   Today's steps : {all_data['summary']['today_steps']}")
print(f"   Avg HR        : {all_data['summary']['avg_heart_rate']} bpm")
print(f"   Avg sleep     : {all_data['summary']['avg_sleep_hours']} hrs")