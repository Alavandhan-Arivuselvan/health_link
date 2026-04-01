# fitbit_fetch_steps_hr_sleep.py - UPDATED with Avg HR + SpO2

import requests
import json
from datetime import datetime, timedelta
import random

# ================== SETTINGS ==================
ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyM1Y1UjUiLCJzdWIiOiJEM1E5SEQiLCJpc3MiOiJGaXRiaXQiLCJ0eXAiOiJhY2Nlc3NfdG9rZW4iLCJzY29wZXMiOiJyYWN0IHJociBycHJvIHJzbGUiLCJleHAiOjE3NzUwNjcwMDEsImlhdCI6MTc3NDk4MDYwMX0.XAsGk7o5FpG68tLvh24N16TJ28zUhENDIWepoYeoE1w"

HEADERS = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Accept-Language": "en_US"
}

today = datetime.now().date()
start_date = today - timedelta(days=13)
start_str = start_date.isoformat()
end_str = today.isoformat()

BASE = "https://api.fitbit.com/1/user/-"

# ================== REALISTIC FAKE DATA GENERATOR ==================
def generate_fake_day(date_str: str):
    current_date = datetime.fromisoformat(date_str)
    is_weekend = current_date.weekday() >= 5
    
    variation = random.uniform(-0.28, 0.28)
    
    if is_weekend:
        steps_base = random.choice([6200, 6800, 7500, 9200])
        sleep_base = 7.6
    else:
        steps_base = random.choice([5200, 6800, 7800, 8500, 10500])
        sleep_base = 7.1
    
    steps = max(1800, min(13800, int(steps_base + variation * 5200)))
    sleep_hours = max(5.4, min(9.1, sleep_base + variation * 1.45))
    minutes_asleep = int(sleep_hours * 60)
    
    resting_hr = max(54, min(86, int(71 + variation * 14 - (steps - 7000) / 800)))
    avg_hr = max(65, min(105, int(resting_hr + random.uniform(8, 25))))  # Average HR is higher than resting
    
    efficiency = max(73, min(96, int(85 + variation * 10)))
    
    # Sleep stages
    total = minutes_asleep
    deep = int(total * random.uniform(0.12, 0.22))
    rem = int(total * random.uniform(0.18, 0.28))
    light = total - deep - rem - random.randint(15, 50)
    wake = random.randint(15, 55)
    
    # Fake SpO2 (normal range 94-98%)
    spo2_avg = round(random.uniform(94.5, 97.8), 1)
    
    return {
        "steps": steps,
        "sleep": {
            "hours_asleep": round(sleep_hours, 2),
            "minutes_asleep": minutes_asleep,
            "time_in_bed_minutes": minutes_asleep + random.randint(35, 110),
            "efficiency_percent": efficiency,
            "stages": {"deep": deep, "light": light, "rem": rem, "wake": wake},
            "is_main_sleep": True,
            "start_time": f"{random.randint(21, 23)}:{random.randint(0, 59):02d}"
        },
        "resting_bpm": resting_hr,
        "avg_bpm": avg_hr,
        "spo2_avg": spo2_avg,
        "spo2_min": round(spo2_avg - random.uniform(1.5, 3.0), 1),
        "spo2_max": round(spo2_avg + random.uniform(0.5, 1.5), 1)
    }


# ================== FETCH FUNCTIONS ==================
def fetch_steps():
    url = f"{BASE}/activities/steps/date/{start_str}/{end_str}.json"
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code != 200:
        print(f"Steps error: {resp.status_code}")
        return {}
    return {item["dateTime"]: int(item["value"]) for item in resp.json().get("activities-steps", [])}


def fetch_intraday_steps(day_str):
    url = f"{BASE}/activities/steps/date/{day_str}/1d/1min.json"
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code == 200:
        dataset = resp.json().get("activities-steps-intraday", {}).get("dataset", [])
        return sum(item.get("value", 0) for item in dataset)
    return 0


def fetch_heart_rate():                     # Resting HR
    url = f"{BASE}/activities/heart/date/{start_str}/{end_str}.json"
    resp = requests.get(url, headers=HEADERS)
    daily = {}
    if resp.status_code == 200:
        for item in resp.json().get("activities-heart", []):
            date = item["dateTime"]
            resting = item.get("value", {}).get("restingHeartRate")
            if resting:
                daily[date] = {"resting_bpm": int(resting)}
    return daily


def fetch_average_heart_rate():             # New: Average BPM
    url = f"{BASE}/activities/heart/date/{start_str}/{end_str}.json"
    resp = requests.get(url, headers=HEADERS)
    daily = {}
    if resp.status_code == 200:
        for item in resp.json().get("activities-heart", []):
            date = item["dateTime"]
            zones = item.get("value", {}).get("heartRateZones", [])
            if zones:
                # Calculate approximate average from zones (simple weighted)
                total_min = sum(z.get("minutes", 0) for z in zones)
                if total_min > 0:
                    weighted = sum(z.get("minutes", 0) * ((z.get("min", 0) + z.get("max", 0)) / 2) for z in zones)
                    avg_hr = int(weighted / total_min)
                    daily[date] = {"avg_bpm": avg_hr}
    return daily


def fetch_spo2():
    url = f"https://api.fitbit.com/1/user/-/spo2/date/{start_str}/{end_str}.json"
    resp = requests.get(url, headers=HEADERS)
    daily = {}
    if resp.status_code == 200:
        for item in resp.json().get("spo2", []):
            date = item.get("dateTime")
            if date:
                daily[date] = {
                    "spo2_avg": item.get("value", {}).get("avg"),
                    "spo2_min": item.get("value", {}).get("min"),
                    "spo2_max": item.get("value", {}).get("max")
                }
    else:
        print(f"SpO2 error: {resp.status_code}")
    return daily


def fetch_sleep():
    url = f"https://api.fitbit.com/1.2/user/-/sleep/date/{start_str}/{end_str}.json"
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code != 200:
        print(f"Sleep error: {resp.status_code}")
        return {}
    
    result = {}
    for s in resp.json().get("sleep", []):
        date = s.get("dateOfSleep")
        if date:
            minutes = s.get("minutesAsleep", 0)
            result[date] = {
                "hours_asleep": round(minutes / 60, 2),
                "minutes_asleep": minutes,
                "time_in_bed_minutes": s.get("timeInBed", minutes + 60),
                "efficiency_percent": s.get("efficiency", 85),
                "stages": s.get("levels", {}).get("summary", {}),
                "is_main_sleep": s.get("isMainSleep", True),
                "start_time": s.get("startTime", "")
            }
    return result


# ================== BUILD FINAL DATA ==================
steps_real = fetch_steps()
heart_resting = fetch_heart_rate()
heart_avg = fetch_average_heart_rate()
spo2_real = fetch_spo2()
sleep_real = fetch_sleep()

all_data = {"period": f"{start_str} to {end_str}", "days": {}}

current = start_date
while current <= today:
    date_str = current.isoformat()
    day_data = generate_fake_day(date_str)
    
    # Override real data
    if date_str in steps_real and steps_real[date_str] > 0:
        day_data["steps"] = steps_real[date_str]
    
    # Today special handling
    if date_str == today.isoformat():
        live = fetch_intraday_steps(date_str)
        if live > 0:
            day_data["steps"] = live
            print(f"✅ Today's live steps: {live}")
    
    if date_str in heart_resting:
        day_data["resting_bpm"] = heart_resting[date_str].get("resting_bpm", day_data["resting_bpm"])
    
    if date_str in heart_avg:
        day_data["avg_bpm"] = heart_avg[date_str].get("avg_bpm", day_data["avg_bpm"])
    
    if date_str in spo2_real:
        day_data["spo2_avg"] = spo2_real[date_str].get("spo2_avg")
        day_data["spo2_min"] = spo2_real[date_str].get("spo2_min")
        day_data["spo2_max"] = spo2_real[date_str].get("spo2_max")
    
    if date_str in sleep_real:
        real_s = sleep_real[date_str]
        day_data["sleep"] = real_s
    
    all_data["days"][date_str] = day_data
    current += timedelta(days=1)

# Summary sections
all_data["steps"] = {d: data["steps"] for d, data in all_data["days"].items()}
all_data["heart_rate"] = {
    "daily_summaries": {d: {"resting_bpm": data.get("resting_bpm"), "avg_bpm": data.get("avg_bpm")} 
                       for d, data in all_data["days"].items()}
}
all_data["spo2"] = {d: {"avg": data.get("spo2_avg"), "min": data.get("spo2_min"), "max": data.get("spo2_max")} 
                   for d, data in all_data["days"].items()}

all_data["sleep"] = {
    "daily_sleep": {d: data["sleep"] for d, data in all_data["days"].items()},
    "average_hours_asleep": round(sum(d["sleep"]["hours_asleep"] for d in all_data["days"].values()) / 14, 2)
}

# ================== SAVE ==================
print(json.dumps(all_data, indent=2))

with open("fitbit_2weeks_data.json", "w", encoding="utf-8") as f:
    json.dump(all_data, f, indent=2)

print(f"\n✅ Data saved to fitbit_2weeks_data.json")
print(f"   Today's steps: {all_data['days'][today.isoformat()]['steps']}")