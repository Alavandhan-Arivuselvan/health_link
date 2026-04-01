# analyser.py
# Risk analysis + Energy forecast using Google Fit data

import json
import pandas as pd
import joblib
import numpy as np
from datetime import datetime, timedelta

# Module-level constants removed — data is passed via function arguments
# when imported. Standalone execution loads data in __main__ block below.

# ────────────────────────────────────────────────────────────────
# Bridge function — reads NEW Google Fit JSON structure
# ────────────────────────────────────────────────────────────────
def create_dataset_from_googlefit(data, user_age, user_name="You"):
    """
    Reads the googlefit_2weeks_data.json structure:
    data["days"]["YYYY-MM-DD"] = { steps, avg_bpm, resting_bpm, sleep, spo2... }
    """
    days = data.get("days", {})
    dates = sorted(days.keys())

    if not dates:
        raise ValueError("No days found in Google Fit data")

    print(f"Data period : {data.get('period', 'unknown')}")
    print(f"Days loaded : {len(dates)}")

    daily_records = []

    for date_str in dates:
        day = days[date_str]

        # Steps
        steps = day.get("steps") or 0

        # Heart rate — prefer resting, fallback to avg
        resting_bpm = day.get("resting_bpm") or day.get("avg_bpm") or 70

        # Sleep
        sleep_obj     = day.get("sleep") or {}
        hours_asleep  = sleep_obj.get("hours_asleep") or 0.0

        # Sleep quality — estimate from hours (no efficiency in Google Fit)
        # Scale: <5h=50, 5-6h=60, 6-7h=70, 7-8h=80, >8h=90
        if hours_asleep >= 8:
            sleep_quality = 9.0
        elif hours_asleep >= 7:
            sleep_quality = 8.0
        elif hours_asleep >= 6:
            sleep_quality = 7.0
        elif hours_asleep >= 5:
            sleep_quality = 6.0
        elif hours_asleep > 0:
            sleep_quality = 5.0
        else:
            sleep_quality = 0.0  # no sleep data

        # SpO2
        spo2 = day.get("spo2_avg")

        record = {
            'Date':             date_str,
            'Age':              user_age,
            'Sleep Duration':   round(hours_asleep, 1),
            'Quality of Sleep': sleep_quality,
            'Heart Rate':       round(float(resting_bpm), 1),
            'Daily Steps':      int(steps),
            'SpO2':             spo2
        }
        daily_records.append(record)

    return {user_name: daily_records}


# ────────────────────────────────────────────────────────────────
# Energy forecast for tomorrow
# ────────────────────────────────────────────────────────────────
def forecast_energy(data):
    """
    Predicts tomorrow's energy level (0-10) based on:
    - Today's sleep duration & quality
    - Today's steps (activity)
    - Today's resting HR
    - SpO2 if available
    Uses a weighted heuristic model.
    """
    days  = data.get("days", {})
    today = datetime.now().date().isoformat()

    # Find today or most recent day with sleep data
    day_data = None
    for date_str in sorted(days.keys(), reverse=True):
        d = days[date_str]
        if d.get("sleep") and d["sleep"].get("hours_asleep", 0) > 0:
            day_data = d
            used_date = date_str
            break

    if not day_data:
        print("\n⚠️  No sleep data found for energy forecast.")
        return None

    sleep_obj    = day_data.get("sleep", {})
    hours_asleep = sleep_obj.get("hours_asleep", 0)
    resting_hr   = day_data.get("resting_bpm") or day_data.get("avg_bpm") or 70
    steps        = day_data.get("steps", 0)
    spo2         = day_data.get("spo2_avg", 97)

    # ── Sleep score (0-10) ──
    # Optimal = 7-9 hrs
    if 7 <= hours_asleep <= 9:
        sleep_score = 10
    elif 6 <= hours_asleep < 7:
        sleep_score = 7.5
    elif 9 < hours_asleep <= 10:
        sleep_score = 8
    elif 5 <= hours_asleep < 6:
        sleep_score = 5
    elif hours_asleep > 10:
        sleep_score = 6  # oversleeping also reduces energy
    else:
        sleep_score = 3

    # ── HR score (0-10) ──
    # Lower resting HR = better cardiovascular fitness = more energy
    if resting_hr < 60:
        hr_score = 10
    elif resting_hr < 70:
        hr_score = 8
    elif resting_hr < 80:
        hr_score = 6
    elif resting_hr < 90:
        hr_score = 4
    else:
        hr_score = 2

    # ── Activity score (0-10) ──
    # Steps indicate how active you were (moderate activity = better recovery)
    if 7000 <= steps <= 12000:
        activity_score = 9
    elif 5000 <= steps < 7000:
        activity_score = 7
    elif 12000 < steps <= 15000:
        activity_score = 7  # high activity may need more recovery
    elif steps > 15000:
        activity_score = 5  # very high — may feel tired tomorrow
    elif 3000 <= steps < 5000:
        activity_score = 5
    else:
        activity_score = 3

    # ── SpO2 score (0-10) ──
    if spo2 is None:
        spo2_score = 7  # neutral if no data
    elif spo2 >= 97:
        spo2_score = 10
    elif spo2 >= 95:
        spo2_score = 7
    elif spo2 >= 93:
        spo2_score = 4
    else:
        spo2_score = 2

    # ── Weighted energy score ──
    # Steps excluded — Google Fit today's steps are delayed/unreliable
    # Sleep is the dominant factor for next-day energy
    energy = (
        sleep_score * 0.60 +
        hr_score    * 0.25 +
        spo2_score  * 0.15
    )
    energy = round(min(max(energy, 0), 10), 1)

    # ── Energy label ──
    if energy >= 8.5:
        label, emoji = "Very High", "⚡⚡"
    elif energy >= 7:
        label, emoji = "High", "⚡"
    elif energy >= 5.5:
        label, emoji = "Moderate", "😐"
    elif energy >= 4:
        label, emoji = "Low", "😴"
    else:
        label, emoji = "Very Low", "🪫"

    tomorrow = (datetime.strptime(used_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")

    print("\n" + "="*50)
    print("        TOMORROW'S ENERGY FORECAST              ")
    print("="*50)
    print(f"Based on sleep data from : {used_date}")
    print(f"Forecast for             : {tomorrow}")
    print("-"*40)
    print(f"Sleep last night : {hours_asleep:.1f} hrs  (score: {sleep_score}/10)")
    print(f"Resting HR       : {resting_hr} BPM  (score: {hr_score}/10)")
    print(f"SpO2             : {spo2 or 'N/A'}%        (score: {spo2_score}/10)")
    print("-"*40)
    print(f"Predicted Energy : {energy}/10  {emoji} {label}")
    print("="*50)

    # Tips based on score
    print("\n💡 Tips for tomorrow:")
    if hours_asleep < 7:
        print("  • Try to sleep 7-8 hours tonight to boost energy")
    if resting_hr > 80:
        print("  • High resting HR detected — consider light activity or rest")
    if spo2 and spo2 < 95:
        print("  • Low SpO2 detected — ensure good ventilation while sleeping")
    if energy >= 7:
        print("  • You're set for a good day tomorrow! 🎯")

    return energy


# ────────────────────────────────────────────────────────────────
# Risk analysis
# ────────────────────────────────────────────────────────────────
def risk(raw_data):
    model    = joblib.load('risk_model_multi.pkl')
    features = joblib.load('features_list.pkl')

    rows = []
    for name, records in raw_data.items():
        for record in records:
            entry = record.copy()
            entry['Name'] = name
            rows.append(entry)

    df_full = pd.DataFrame(rows)

    # Only use days with actual data (skip days with 0 steps AND 0 sleep)
    df_full = df_full[~((df_full['Daily Steps'] == 0) & (df_full['Sleep Duration'] == 0))]

    # Handle missing features
    for feat in features:
        if feat not in df_full.columns:
            df_full[feat] = 0

    # Predict
    test_data_prepared = df_full[features]
    probs = model.predict_proba(test_data_prepared)

    heart_probs   = [p[1] for p in probs[0]]
    obesity_probs = [p[1] for p in probs[1]]
    resp_probs    = [p[1] for p in probs[2]]

    df_full['Heart_Prob']   = heart_probs
    df_full['Obesity_Prob'] = obesity_probs
    df_full['Resp_Prob']    = resp_probs

    # Summary
    weekly_summary = df_full.groupby('Name').agg({
        'Heart_Prob':     'mean',
        'Obesity_Prob':   'mean',
        'Resp_Prob':      'mean',
        'Daily Steps':    'mean',
        'Heart Rate':     'mean',
        'Sleep Duration': 'mean'
    }).reset_index()

    print("\n" + "="*50)
    print("       WEEKLY RISK & HEALTH SUMMARY             ")
    print("="*50)

    THRESHOLD = 0.70

    for i, row in weekly_summary.iterrows():
        print(f"User            : {row['Name']}")
        print(f"Avg Sleep       : {row['Sleep Duration']:.1f} hrs")
        print(f"Avg Steps/Day   : {row['Daily Steps']:.0f}")
        print(f"Avg Heart Rate  : {row['Heart Rate']:.1f} BPM")
        print("-"*40)
        print("Risk Probabilities:")
        print(f"  → Heart        : {row['Heart_Prob']*100:.2f}%")
        print(f"  → Obesity      : {row['Obesity_Prob']*100:.2f}%")
        print(f"  → Respiratory  : {row['Resp_Prob']*100:.2f}%")

        final_risks = []
        if row['Heart_Prob']   >= THRESHOLD: final_risks.append("Heart")
        if row['Obesity_Prob'] >= THRESHOLD: final_risks.append("Obesity")
        if row['Resp_Prob']    >= THRESHOLD: final_risks.append("Respiratory")

        verdict = "LOW RISK ✅" if not final_risks else f"HIGH RISK ⚠️  ({', '.join(final_risks)})"
        print(f"\nFINAL VERDICT   : {verdict}")
        print("-"*40)

    print("="*50)


# ────────────────────────────────────────────────────────────────
# Run (standalone only)
# ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    user_age = 35  # ← change to your real age

    with open('googlefit_2weeks_data.json', 'r') as f:
        fitbit_data = json.load(f)

    raw_data = create_dataset_from_googlefit(fitbit_data, user_age, user_name="You")

    print("\nSample of generated dataset (last 3 days):")
    print(json.dumps(raw_data["You"][-3:], indent=2))

    risk(raw_data)
    forecast_energy(fitbit_data)