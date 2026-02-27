from datetime import datetime, timedelta
import json

# Helper: Parse date string to datetime.date
def parse_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except:
        return None

# Feature 1: Body Battery Energy Forecasting
def forecast_body_battery(full_data):
    """
    Input: full Fitbit JSON dict
    Extracts only: yesterday's sleep efficiency, active minutes proxy, resting BPM
    Returns: forecast dict
    """
    today = datetime.now().date()
    yesterday_str = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    yesterday_sleep = full_data.get("sleep", {}).get("daily_sleep", {}).get(yesterday_str, {})
    yesterday_steps = full_data.get("steps", {}).get(yesterday_str, 0)
    yesterday_hr = full_data.get("heart_rate", {}).get("daily_summaries", {}).get(yesterday_str, {})

    sleep_efficiency = yesterday_sleep.get("efficiency_percent", 0)
    steps = yesterday_steps
    active_minutes_proxy = steps // 100  # rough proxy
    resting_bpm = yesterday_hr.get("resting_bpm", 70)

    if sleep_efficiency < 80 and active_minutes_proxy < 60:
        forecast = "Low energy expected tomorrow"
        nudge = "Go to bed earlier tonight to recover"
        energy_level = "low"
    elif sleep_efficiency >= 90:
        forecast = "Good energy expected tomorrow"
        nudge = "Maintain today's activity level"
        energy_level = "high"
    else:
        forecast = "Average energy expected tomorrow"
        nudge = "Aim for 7–8 hours sleep and moderate activity"
        energy_level = "average"

    return {
        "date": yesterday_str,
        "forecast": forecast,
        "nudge": nudge,
        "energy_level": energy_level,
        "sleep_efficiency_used": sleep_efficiency,
        "active_minutes_proxy": active_minutes_proxy,
        "resting_bpm": resting_bpm
    }

# Feature 2: Sleep Consistency Streaks & Nudges
def calculate_sleep_streaks_and_nudges(full_data):
    """
    Input: full Fitbit JSON dict
    Consistency = bedtime ±90 min of average AND ≥7 hours sleep
    Returns: streak & nudge info
    """
    sleep_daily = full_data.get("sleep", {}).get("daily_sleep", {})
    if not sleep_daily:
        return {"current_streak": 0, "max_streak": 0, "nudge": "No sleep data available"}

    sleep_list = []
    total_bedtime_minutes = 0
    total_sleep_minutes = 0
    valid_count = 0

    for date_str, sleep_entry in sleep_daily.items():
        if not sleep_entry.get("is_main_sleep", False):
            continue
        start_time = sleep_entry.get("start_time")
        minutes_asleep = sleep_entry.get("minutes_asleep", 0)
        if not start_time or minutes_asleep == 0:
            continue

        try:
            bedtime_str = start_time[11:16]  # HH:MM
            hour, minute = map(int, bedtime_str.split(":"))
            bedtime_minutes = hour * 60 + minute

            sleep_list.append({
                "date": date_str,
                "bedtime_minutes": bedtime_minutes,
                "bedtime": bedtime_str,
                "minutes_asleep": minutes_asleep,
                "efficiency_percent": sleep_entry.get("efficiency_percent", 0)
            })

            total_bedtime_minutes += bedtime_minutes
            total_sleep_minutes += minutes_asleep
            valid_count += 1
        except:
            continue

    if valid_count == 0:
        return {"current_streak": 0, "max_streak": 0, "nudge": "No valid sleep data"}

    # Average bedtime in minutes
    avg_bedtime_minutes = total_bedtime_minutes / valid_count
    avg_bedtime_str = f"{int(avg_bedtime_minutes // 60):02d}:{int(avg_bedtime_minutes % 60):02d}"

    # Average sleep duration in hours
    avg_sleep_hours = (total_sleep_minutes / valid_count) / 60

    # Sort by date descending
    sorted_sleep = sorted(sleep_list, key=lambda x: parse_date(x["date"]), reverse=True)

    current_streak = 0
    max_streak = 0
    late_nights = 0

    for day in sorted_sleep:
        bedtime_min = day["bedtime_minutes"]
        sleep_min = day["minutes_asleep"]

        # Time difference (handles midnight wrap-around)
        time_diff = min(
            abs(bedtime_min - avg_bedtime_minutes),
            1440 - abs(bedtime_min - avg_bedtime_minutes)
        )

        # Consistent = time within ±90 min AND sleep ≥ 7 hours (420 minutes)
        if time_diff <= 90 and sleep_min >= 420:
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 0

        # Late night: after 1:30 AM (hour >= 25 or hour <= 2)
        hour = bedtime_min // 60
        if hour <= 2:
            late_nights += 1
        else:
            late_nights = 0

    # Nudge logic – encouraging, but honest about sleep duration
    nudge = ""
    if current_streak >= 3:
        nudge = f"Excellent! {current_streak}-day streak of consistent bedtime + ≥7 hours sleep. You're crushing it!"
    elif current_streak >= 1:
        nudge = f"Nice — {current_streak}-day streak of solid sleep timing and duration. Keep going!"
    elif max_streak >= 3:
        nudge = f"You've had strong {max_streak}-day streaks before — aim for ≥7 hours + regular timing to rebuild it."
    elif late_nights >= 3:
        nudge = "Several late nights recently — earlier bedtime + aiming for 7+ hours could make a big difference."
    else:
        nudge = f"Your average bedtime is ~{avg_bedtime_str} with ~{avg_sleep_hours:.1f} hours sleep — fairly stable. Keep pushing for 7+ hours consistently."
   
    return {
        "current_streak": current_streak,
        "max_streak": max_streak,
        "late_nights_in_row": late_nights,
        "average_bedtime": avg_bedtime_str,
        "average_sleep_hours": round(avg_sleep_hours, 1),
        "nudge": nudge
    }

# Feature 3: Personalized Nudge Engine
def generate_personalized_nudges(full_data):
    """
    Input: full Fitbit JSON dict
    Extracts only: yesterday's sleep efficiency, steps, resting BPM
    Returns: list of nudge strings
    """
    today = datetime.now().date()
    yesterday_str = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    yesterday_sleep = full_data.get("sleep", {}).get("daily_sleep", {}).get(yesterday_str, {})
    yesterday_steps = full_data.get("steps", {}).get(yesterday_str, 0)
    yesterday_hr = full_data.get("heart_rate", {}).get("daily_summaries", {}).get(yesterday_str, {})

    sleep_efficiency = yesterday_sleep.get("efficiency_percent", 0)
    steps = yesterday_steps
    resting_bpm = yesterday_hr.get("resting_bpm", 70)

    nudges = []

    readiness_proxy = sleep_efficiency * 0.6 + (steps / 100) * 0.4
    readiness_proxy = min(100, max(0, readiness_proxy))

    stress_proxy = resting_bpm
    stress_level = "high" if stress_proxy > 80 else "moderate" if stress_proxy > 70 else "normal"

    if readiness_proxy < 40:
        nudges.append("Low readiness today — recommend light activity or rest")

    if stress_level == "high" and sleep_efficiency < 80:
        nudges.append("High stress + poor sleep detected → try 10 min breathing exercise")

    if steps < 6000:
        nudges.append("Missed step goal yesterday — short walk today could help")

    if not nudges:
        nudges.append("You're doing well — keep up the consistent habits!")

    return nudges

# Main execution: Load JSON once, then call functions
if __name__ == "__main__":
    # Load your JSON file (change path if needed)
    with open("fitbit_2weeks_data.json", "r") as f:
        full_data = json.load(f)

    print("=== Body Battery Forecast ===")
    forecast = forecast_body_battery(full_data)
    # print(json.dumps(forecast, indent=2))
    print("----------")
    print(forecast)
    print("forecast: ",forecast["forecast"])
    print("suggestion: ",forecast["nudge"])
    print("----------")

    print("\n=== Sleep Consistency Streaks & Nudges ===")
    streaks = calculate_sleep_streaks_and_nudges(full_data)
    # print(json.dumps(streaks, indent=2))
    print("----------")
    print(streaks)
    print("current streak: ",streaks["current_streak"])
    print("suggestion: ",streaks["nudge"])
    print("----------")

    print("\n=== Personalized Nudges ===")
    nudges = generate_personalized_nudges(full_data)
    for n in nudges:
        print("•", n)