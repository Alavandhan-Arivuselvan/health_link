import requests
import json
from datetime import date

ACCESS_TOKEN = ""  # From above

HEADERS = {"Authorization": f"Bearer {ACCESS_TOKEN}"}
BASE = "https://api.fitbit.com/1/user/-/"

def get_data(target_date=date.today().isoformat()):
    result = {"date": target_date}

    # Steps
    steps_resp = requests.get(f"{BASE}activities/steps/date/{target_date}/1d.json", headers=HEADERS)
    if steps_resp.status_code == 200:
        result["steps_total"] = int(steps_resp.json()["activities-steps"][0]["value"])

    # Heart rate
    hr_resp = requests.get(f"{BASE}activities/heart/date/{target_date}/1d/1min.json", headers=HEADERS)
    if hr_resp.status_code == 200:
        hr_data = hr_resp.json()
        intraday = hr_data.get("activities-heart-intraday", {}).get("dataset", [])
        values = [p["value"] for p in intraday]
        result["heart_rate_avg"] = round(sum(values) / len(values), 1) if values else None
        result["heart_rate_resting"] = hr_data["activities-heart"][0]["value"].get("restingHeartRate")

    # Sleep (1.2 endpoint)
    sleep_resp = requests.get(f"https://api.fitbit.com/1.2/user/-/sleep/date/{target_date}.json", headers=HEADERS)
    if sleep_resp.status_code == 200:
        sleep = sleep_resp.json()
        if sleep.get("sleep"):
            main = sleep["sleep"][0]
            result["sleep_asleep_minutes"] = main.get("minutesAsleep")
            result["sleep_efficiency"] = main.get("efficiency")

    return result

data = get_data()
print(json.dumps(data, indent=2))