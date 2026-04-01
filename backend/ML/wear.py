from datetime import datetime, timedelta
import json

# Helper: Parse date string to datetime.date
def parse_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except:
        return None

# Feature 1: Body Battery Energy Forecasting (Multi-Attribute Weighted Score)
def forecast_body_battery(full_data):
    """
    Automatically extracts ALL relevant attributes from the Fitbit JSON
    and computes a weighted 0–100 energy score to predict tomorrow's energy.

    Attributes used (with weights):
      - Sleep Efficiency %       (25%)  → higher = more energy recovered
      - Sleep Duration hours     (20%)  → optimal range 7–9h
      - Deep Sleep %             (10%)  → more deep sleep = better recovery
      - Steps                    (15%)  → moderate activity helps recovery
      - Resting Heart Rate       (15%)  → lower = fitter, better recovery
      - Active Zone Minutes      (10%)  → Fat Burn + Cardio + Peak minutes
      - Total Calories Burned     (5%)  → overall metabolic activity

    Returns: forecast dict with energy_score, level, nudge, and all metrics used
    """
    today = datetime.now().date()
    today_str = today.strftime("%Y-%m-%d")

    # ── Extract all available data for today ─────────────────────
    sleep_data = full_data.get("sleep", {}).get("daily_sleep", {}).get(today_str, {})
    steps = full_data.get("steps", {}).get(today_str, 0)
    hr_data = full_data.get("heart_rate", {}).get("daily_summaries", {}).get(today_str, {})

    # Sleep metrics
    sleep_efficiency = sleep_data.get("efficiency_percent", 0) or 0
    minutes_asleep = sleep_data.get("minutes_asleep", 0) or 0
    sleep_hours = round(minutes_asleep / 60, 1) if minutes_asleep else 0
    time_in_bed = sleep_data.get("time_in_bed_minutes", 0) or 0

    # Deep sleep from stages (if available)
    stages = sleep_data.get("stages", {})
    deep_minutes = stages.get("deep", {}).get("minutes", 0) if isinstance(stages.get("deep"), dict) else 0
    total_sleep_stage_mins = sum(
        s.get("minutes", 0) if isinstance(s, dict) else 0
        for s in stages.values()
    ) or 1  # avoid division by zero
    deep_sleep_pct = round((deep_minutes / total_sleep_stage_mins) * 100) if deep_minutes else 0

    # Heart rate metrics
    resting_bpm = hr_data.get("resting_bpm", 0) or 0
    zones = hr_data.get("zones", [])

    # Active zone minutes (Fat Burn + Cardio + Peak)
    active_zone_minutes = 0
    total_calories = 0
    for zone in zones:
        zone_name = zone.get("name", "")
        mins = zone.get("minutes", 0)
        cals = zone.get("caloriesOut", 0)
        total_calories += cals
        if zone_name in ("Fat Burn", "Cardio", "Peak"):
            active_zone_minutes += mins

    # ── Score each factor (0–100 scale) ──────────────────────────

    # 1. Sleep Efficiency (25%) — direct percentage
    score_sleep_eff = min(sleep_efficiency, 100)

    # 2. Sleep Duration (20%) — 7–9h optimal, <5h or >10h penalized
    if sleep_hours == 0:
        score_sleep_dur = 0
    elif 7 <= sleep_hours <= 9:
        score_sleep_dur = 100
    elif 6 <= sleep_hours < 7:
        score_sleep_dur = 70
    elif 5 <= sleep_hours < 6:
        score_sleep_dur = 40
    elif sleep_hours > 9:
        score_sleep_dur = 80  # oversleeping slightly lowers score
    else:
        score_sleep_dur = 20  # <5h

    # 3. Deep Sleep % (10%) — 15–25% optimal
    if deep_sleep_pct >= 20:
        score_deep = 100
    elif deep_sleep_pct >= 15:
        score_deep = 80
    elif deep_sleep_pct >= 10:
        score_deep = 50
    else:
        score_deep = 20 if deep_sleep_pct > 0 else 0

    # 4. Steps (15%) — 7500 target, diminishing returns above 12000
    score_steps = min((steps / 7500) * 100, 100) if steps else 0

    # 5. Resting HR (15%) — lower is better (50–60 excellent, >80 poor)
    if resting_bpm == 0:
        score_rhr = 50  # no data = neutral
    elif resting_bpm <= 60:
        score_rhr = 100
    elif resting_bpm <= 70:
        score_rhr = 80
    elif resting_bpm <= 80:
        score_rhr = 60
    else:
        score_rhr = max(30, 100 - resting_bpm)  # penalize heavily

    # 6. Active Zone Minutes (10%) — 22 min/day recommended (CDC)
    score_azm = min((active_zone_minutes / 22) * 100, 100)

    # 7. Total Calories (5%) — 2000–3500 range is healthy/active
    if total_calories >= 2500:
        score_cal = 100
    elif total_calories >= 2000:
        score_cal = 80
    elif total_calories >= 1500:
        score_cal = 50
    else:
        score_cal = 30 if total_calories > 0 else 0

    # ── Weighted energy score ────────────────────────────────────
    energy_score = round(
        score_sleep_eff * 0.25 +
        score_sleep_dur * 0.20 +
        score_deep * 0.10 +
        score_steps * 0.15 +
        score_rhr * 0.15 +
        score_azm * 0.10 +
        score_cal * 0.05
    )

    # ── Determine energy level and forecast message ──────────────
    if energy_score >= 75:
        energy_level = "high"
        forecast = "Good energy expected tomorrow"
    elif energy_score >= 45:
        energy_level = "average"
        forecast = "Average energy expected tomorrow"
    else:
        energy_level = "low"
        forecast = "Low energy expected tomorrow"

    # ── Smart nudge: identify the weakest factor ─────────────────
    factor_scores = {
        "sleep quality": score_sleep_eff,
        "sleep duration": score_sleep_dur,
        "deep sleep": score_deep,
        "activity (steps)": score_steps,
        "resting heart rate": score_rhr,
        "active zone minutes": score_azm,
    }
    weakest_factor = min(factor_scores, key=factor_scores.get)
    weakest_score = factor_scores[weakest_factor]

    nudge_map = {
        "sleep quality": "Try to reduce screen time before bed for deeper sleep",
        "sleep duration": f"You slept {sleep_hours}h — aim for 7–8 hours tonight",
        "deep sleep": "Light exercise during the day can boost deep sleep",
        "activity (steps)": f"Only {steps:,} steps today — a short walk can help",
        "resting heart rate": f"RHR is {resting_bpm} bpm — try relaxation or breathing exercises",
        "active zone minutes": "Try to include some moderate-intensity activity today",
    }

    if energy_level == "high":
        nudge = "You're doing everything right — keep it up! 💪"
    elif weakest_score < 40:
        nudge = nudge_map.get(weakest_factor, "Focus on sleep and moderate activity")
    else:
        nudge = "Aim for 7–8 hours sleep and moderate activity"

    return {
        "date": today_str,
        "forecast": forecast,
        "nudge": nudge,
        "energy_level": energy_level,
        "energy_score": energy_score,
        "factors": {
            "sleep_efficiency": {"value": sleep_efficiency, "unit": "%", "score": score_sleep_eff},
            "sleep_duration": {"value": sleep_hours, "unit": "hrs", "score": score_sleep_dur},
            "deep_sleep": {"value": deep_sleep_pct, "unit": "%", "score": score_deep},
            "steps": {"value": steps, "unit": "steps", "score": score_steps},
            "resting_hr": {"value": resting_bpm, "unit": "bpm", "score": score_rhr},
            "active_zone_min": {"value": active_zone_minutes, "unit": "min", "score": score_azm},
            "calories": {"value": round(total_calories), "unit": "kcal", "score": score_cal},
        }
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


# Feature 4: Step Consistency & Nudges
def calculate_step_consistency(full_data):
    """
    Input: full Fitbit JSON dict
    Calculates:
      - Average daily steps over all available days
      - Current streak of days meeting step goal (10000 steps)
      - Best streak (longest run of goal-meeting days)
      - Best and worst step days
      - 1–3 step-based nudges
    Returns: dict with stats and nudge list
    """
    steps_data = full_data.get("steps", {})

    if not steps_data or isinstance(steps_data, dict) and "error" in steps_data:
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
    for date_str, step_count in steps_data.items():
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

    # Streak calculation (from most recent backwards for current, full scan for best)
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