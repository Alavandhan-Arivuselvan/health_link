from datetime import datetime, timedelta
import json

# Helper: Parse date string to datetime.date
def parse_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except:
        return None


# ────────────────────────────────────────────────────────────────
#  Google Fit JSON structure (used by ALL functions below):
#
#  full_data["days"]["YYYY-MM-DD"] = {
#      "date", "steps", "resting_bpm", "avg_bpm", "min_bpm", "max_bpm",
#      "spo2_avg", "spo2_min", "spo2_max",
#      "sleep": { "hours_asleep", "minutes_asleep", "start_time",
#                 "end_time", "stages": { "deep", "light", "rem", "wake" } }
#  }
# ────────────────────────────────────────────────────────────────


# Feature 1: Body Battery Energy Forecasting
def forecast_body_battery(full_data):
    """
    Predicts tomorrow's energy level (0–10 → scaled to 0–100) based on:
      - Sleep duration  (60%)  → optimal range 7–9h
      - Resting HR      (25%)  → lower = fitter = more energy
      - SpO2            (15%)  → blood oxygen saturation

    Matches the scoring logic in analyse.py → forecast_energy().
    Returns: forecast dict with energy_score, level, nudge, and metrics used.
    """
    days = full_data.get("days", {})
    today = datetime.now().date().isoformat()

    # Collect the 2 most recent days with data
    sorted_dates = sorted(days.keys(), reverse=True)
    recent_days = []
    for date_str in sorted_dates:
        d = days[date_str]
        if d.get("sleep") and (d["sleep"].get("hours_asleep") or 0) > 0:
            recent_days.append((date_str, d))
            if len(recent_days) >= 2:
                break

    if not recent_days:
        return {
            "date": today,
            "forecast": "No sleep data available",
            "nudge": "Sync your Google Fit data to get energy forecasts",
            "energy_level": "average",
            "energy_score": 50,
            "factors": {}
        }

    # ── Average over last 2 days ─────────────────────────────────
    sleep_vals = []
    hr_vals = []
    spo2_vals = []
    steps_total = 0

    for date_str, d in recent_days:
        sleep_obj = d.get("sleep") or {}
        h = sleep_obj.get("hours_asleep") or 0
        if h > 0:
            sleep_vals.append(h)

        hr = d.get("latest_bpm") or d.get("avg_bpm") or d.get("resting_bpm")
        if hr:
            hr_vals.append(hr)

        sp = d.get("spo2_avg")
        if sp:
            spo2_vals.append(sp)

        steps_total += d.get("steps") or 0

    hours_asleep = round(sum(sleep_vals) / len(sleep_vals), 1) if sleep_vals else 0
    current_hr = round(sum(hr_vals) / len(hr_vals), 1) if hr_vals else 70
    spo2 = round(sum(spo2_vals) / len(spo2_vals), 1) if spo2_vals else 97
    steps = steps_total
    used_date = recent_days[0][0]  # most recent date

    # ── Sleep score (0–10) ──
    if 7 <= hours_asleep <= 9:
        sleep_score = 10
    elif 6 <= hours_asleep < 7:
        sleep_score = 7.5
    elif 9 < hours_asleep <= 10:
        sleep_score = 8
    elif 5 <= hours_asleep < 6:
        sleep_score = 5
    elif hours_asleep > 10:
        sleep_score = 6
    else:
        sleep_score = 3

    # ── HR score (0–10) — based on current/avg BPM ──
    if current_hr < 60:
        hr_score = 10
    elif current_hr < 70:
        hr_score = 8
    elif current_hr < 80:
        hr_score = 6
    elif current_hr < 90:
        hr_score = 4
    else:
        hr_score = 2

    # ── SpO2 score (0–10) ──
    if spo2 is None:
        spo2_score = 7
    elif spo2 >= 97:
        spo2_score = 10
    elif spo2 >= 95:
        spo2_score = 7
    elif spo2 >= 93:
        spo2_score = 4
    else:
        spo2_score = 2

    # ── Weighted energy score (0–10) ──
    energy_raw = (
        sleep_score * 0.60 +
        hr_score    * 0.25 +
        spo2_score  * 0.15
    )
    energy_raw = round(min(max(energy_raw, 0), 10), 1)

    # Scale to 0–100 for the UI
    energy_score = round(energy_raw * 10)

    # ── Energy label ──
    if energy_raw >= 8.5:
        energy_level = "high"
        forecast = "Very high energy expected tomorrow ⚡⚡"
    elif energy_raw >= 7:
        energy_level = "high"
        forecast = "Good energy expected tomorrow ⚡"
    elif energy_raw >= 5.5:
        energy_level = "average"
        forecast = "Moderate energy expected tomorrow"
    elif energy_raw >= 4:
        energy_level = "low"
        forecast = "Low energy expected tomorrow"
    else:
        energy_level = "low"
        forecast = "Very low energy expected tomorrow"

    # ── Smart nudge ──
    tips = []
    if hours_asleep < 7:
        tips.append(f"You slept {hours_asleep:.1f}h — aim for 7–8 hours tonight")
    if current_hr > 80:
        tips.append(f"Heart rate is {current_hr} bpm — try relaxation or breathing exercises")
    if spo2 and spo2 < 95:
        tips.append(f"SpO2 is {spo2}% — ensure good ventilation while sleeping")
    if energy_raw >= 7:
        tips.append("You're set for a good day tomorrow! 🎯")

    nudge = tips[0] if tips else "Aim for 7–8 hours sleep and stay active"

    return {
        "date": used_date,
        "forecast": forecast,
        "nudge": nudge,
        "energy_level": energy_level,
        "energy_score": energy_score,
        "factors": {
            "sleep_duration": {"value": round(hours_asleep, 1), "unit": "hrs", "score": round(sleep_score * 10)},
            "resting_hr": {"value": current_hr, "unit": "bpm", "score": round(hr_score * 10)},
            "spo2": {"value": spo2, "unit": "%", "score": round(spo2_score * 10)},
            "steps": {"value": steps, "unit": "steps", "score": 0},
            "deep_sleep": {"value": 0, "unit": "%", "score": 0},
            "sleep_efficiency": {"value": round(sleep_score * 10), "unit": "%", "score": round(sleep_score * 10)},
            "active_zone_min": {"value": 0, "unit": "min", "score": 0},
            "calories": {"value": 0, "unit": "kcal", "score": 0},
        }
    }


# Feature 2: Sleep Consistency Streaks & Nudges
def calculate_sleep_streaks_and_nudges(full_data):
    """
    Input: Google Fit JSON dict (days-based)
    Consistency = bedtime ±90 min of average AND ≥7 hours sleep
    Returns: streak & nudge info
    """
    days = full_data.get("days", {})
    if not days:
        return {"current_streak": 0, "max_streak": 0, "nudge": "No sleep data available"}

    sleep_list = []
    total_bedtime_minutes = 0
    total_sleep_minutes = 0
    valid_count = 0

    for date_str in sorted(days.keys()):
        day = days[date_str]
        sleep_obj = day.get("sleep")
        if not sleep_obj:
            continue

        minutes_asleep = sleep_obj.get("minutes_asleep", 0) or 0
        start_time = sleep_obj.get("start_time")  # "HH:MM" format in Google Fit JSON
        if not start_time or minutes_asleep == 0:
            continue

        try:
            hour, minute = map(int, start_time.split(":"))
            bedtime_minutes = hour * 60 + minute

            sleep_list.append({
                "date": date_str,
                "bedtime_minutes": bedtime_minutes,
                "bedtime": start_time,
                "minutes_asleep": minutes_asleep,
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

        # Late night: after 1:30 AM
        hour = bedtime_min // 60
        if hour <= 2:
            late_nights += 1
        else:
            late_nights = 0

    # Nudge logic
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
    Input: Google Fit JSON dict (days-based)
    Extracts: yesterday's sleep, steps, resting BPM
    Returns: list of nudge strings
    """
    days = full_data.get("days", {})
    today = datetime.now().date()
    yesterday_str = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    yesterday = days.get(yesterday_str, {})
    steps = yesterday.get("steps", 0)
    resting_bpm = yesterday.get("resting_bpm") or yesterday.get("avg_bpm") or 70
    sleep_obj = yesterday.get("sleep") or {}
    hours_asleep = sleep_obj.get("hours_asleep", 0)

    nudges = []

    # Simple readiness proxy from sleep + steps
    sleep_score = min(hours_asleep / 8 * 100, 100)
    readiness_proxy = sleep_score * 0.6 + (steps / 100) * 0.4
    readiness_proxy = min(100, max(0, readiness_proxy))

    stress_proxy = resting_bpm
    stress_level = "high" if stress_proxy > 80 else "moderate" if stress_proxy > 70 else "normal"

    if readiness_proxy < 40:
        nudges.append("Low readiness today — recommend light activity or rest")

    if stress_level == "high" and hours_asleep < 7:
        nudges.append("High stress + poor sleep detected → try 10 min breathing exercise")

    if steps < 6000:
        nudges.append("Missed step goal yesterday — short walk today could help")

    if not nudges:
        nudges.append("You're doing well — keep up the consistent habits!")

    return nudges


# Feature 4: Step Consistency & Nudges
def calculate_step_consistency(full_data):
    """
    Input: Google Fit JSON dict (days-based)
    Calculates:
      - Average daily steps over all available days
      - Current streak of days meeting step goal (10000 steps)
      - Best streak (longest run of goal-meeting days)
      - Best and worst step days
      - 1–3 step-based nudges
    Returns: dict with stats and nudge list
    """
    days = full_data.get("days", {})

    if not days:
        return {
            "average_steps": 0,
            "total_days": 0,
            "current_streak": 0,
            "best_streak": 0,
            "best_day": {"date": "N/A", "steps": 0},
            "worst_day": {"date": "N/A", "steps": 0},
            "days_at_goal": 0,
            "goal": 10000,
            "nudges": ["No step data available yet"]
        }

    STEP_GOAL = 10000

    # Build sorted list of (date, steps)
    day_list = []
    for date_str, day_data in days.items():
        step_count = day_data.get("steps", 0) or 0
        if isinstance(step_count, (int, float)):
            day_list.append({"date": date_str, "steps": int(step_count)})

    if not day_list:
        return {
            "average_steps": 0,
            "total_days": 0,
            "current_streak": 0,
            "best_streak": 0,
            "best_day": {"date": "N/A", "steps": 0},
            "worst_day": {"date": "N/A", "steps": 0},
            "days_at_goal": 0,
            "goal": STEP_GOAL,
            "nudges": ["No step data available yet"]
        }

    # Sort by date ascending
    day_list.sort(key=lambda x: x["date"])

    total_steps = sum(d["steps"] for d in day_list)
    total_days = len(day_list)
    average_steps = round(total_steps / total_days)

    # Best and worst days
    best_day = max(day_list, key=lambda x: x["steps"])
    worst_day = min(day_list, key=lambda x: x["steps"])

    # Days at goal
    days_at_goal = sum(1 for d in day_list if d["steps"] >= STEP_GOAL)

    # Streak calculation
    current_streak = 0
    for d in reversed(day_list):
        if d["steps"] >= STEP_GOAL:
            current_streak += 1
        else:
            break

    best_streak = 0
    streak = 0
    for d in day_list:
        if d["steps"] >= STEP_GOAL:
            streak += 1
            best_streak = max(best_streak, streak)
        else:
            streak = 0

    # Step-based nudges
    nudges = []

    if current_streak >= 5:
        nudges.append(f"🔥 {current_streak}-day streak of hitting {STEP_GOAL:,} steps — amazing consistency!")
    elif current_streak >= 2:
        nudges.append(f"👏 {current_streak}-day step streak going — keep it alive today!")

    if average_steps < 5000:
        nudges.append("🚶 Your average is under 5,000 steps — try a short walk after meals")
    elif average_steps < STEP_GOAL:
        nudges.append(f"📈 You're averaging {average_steps:,} steps — just {STEP_GOAL - average_steps:,} more to hit your goal!")

    if days_at_goal == 0:
        nudges.append(f"🎯 No days at {STEP_GOAL:,} yet — start with a 20-min walk today")
    elif days_at_goal == total_days:
        nudges.append("🏆 You hit your step goal every single day — incredible!")

    if not nudges:
        nudges.append("✨ Your step count is looking good — keep moving!")

    return {
        "average_steps": average_steps,
        "total_days": total_days,
        "current_streak": current_streak,
        "best_streak": best_streak,
        "best_day": best_day,
        "worst_day": worst_day,
        "days_at_goal": days_at_goal,
        "goal": STEP_GOAL,
        "nudges": nudges[:3]
    }


# Main execution: Load JSON once, then call functions
if __name__ == "__main__":
    with open("googlefit_2weeks_data.json", "r") as f:
        full_data = json.load(f)

    print("=== Body Battery Forecast ===")
    forecast = forecast_body_battery(full_data)
    print(forecast)
    print("forecast: ", forecast["forecast"])
    print("suggestion: ", forecast["nudge"])
    print("----------")

    print("\n=== Sleep Consistency Streaks & Nudges ===")
    streaks = calculate_sleep_streaks_and_nudges(full_data)
    print(streaks)
    print("current streak: ", streaks["current_streak"])
    print("suggestion: ", streaks["nudge"])
    print("----------")

    print("\n=== Personalized Nudges ===")
    nudges = generate_personalized_nudges(full_data)
    for n in nudges:
        print("•", n)

    print("\n=== Step Consistency ===")
    step_data = calculate_step_consistency(full_data)
    print(step_data)