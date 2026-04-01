import time
import json
import pandas as pd
import joblib
import numpy as np
from datetime import datetime

user_age = 35               # ← change to your real age

# Load your real Fitbit data (from the API fetch script)
with open('fitbit_2weeks_data.json', 'r') as f:
    fitbit_data = json.load(f)

# ────────────────────────────────────────────────────────────────
# Function to create weekly-style dataset from real Fitbit data
# ────────────────────────────────────────────────────────────────
def create_weekly_dataset_from_fitbit(fitbit_data_dict, user_age, user_name="You"):
    """
    Creates data in the same format as your raw_data example:
    { "Name": [ list of daily dicts ] }
    """
    period = fitbit_data_dict.get("period", "unknown")
    print(f"Data period: {period}")

    # Collect dates from steps (most reliable source)
    dates = sorted(fitbit_data_dict.get("steps", {}).keys())
    if not dates:
        dates = sorted(fitbit_data_dict.get("sleep", {}).get("daily_sleep", {}).keys())
    if not dates:
        dates = sorted(fitbit_data_dict.get("heart_rate", {}).get("daily_summaries", {}).keys())

    if not dates:
        raise ValueError("No date keys found in Fitbit data")

    daily_records = []
    sleep_hours_sum = 0
    sleep_count = 0

    for date_str in dates:
        # Steps
        daily_steps = fitbit_data_dict["steps"].get(date_str, 7000)

        # Resting heart rate
        resting_hr = 70
        if "heart_rate" in fitbit_data_dict:
            daily_hr = fitbit_data_dict["heart_rate"].get("daily_summaries", {}).get(date_str, {})
            resting_hr = daily_hr.get("resting_bpm") or 70

        # Sleep duration & quality
        hours_asleep = 7.0
        efficiency = 75.0
        if "sleep" in fitbit_data_dict and "daily_sleep" in fitbit_data_dict["sleep"]:
            sleep_day = fitbit_data_dict["sleep"]["daily_sleep"].get(date_str)
            if sleep_day:
                hours_asleep = sleep_day.get("hours_asleep") or 7.0
                efficiency = sleep_day.get("efficiency_percent") or 75.0

        # Track for average sleep
        sleep_hours_sum += hours_asleep
        sleep_count += 1

        record = {
            'Date': date_str,
            'Age': user_age,
            'Sleep Duration': round(hours_asleep, 1),
            'Quality of Sleep': round(efficiency / 10, 1),
            'Heart Rate': round(resting_hr, 1),
            'Daily Steps': round(daily_steps)
        }

        daily_records.append(record)

    # Calculate average sleep hours across the period
    avg_sleep_hours = round(sleep_hours_sum / sleep_count, 1) if sleep_count > 0 else 7.0

    # print(f"\nAverage sleep hours over the period: {avg_sleep_hours} hours")

    return {
        user_name: daily_records
    }


# ────────────────────────────────────────────────────────────────
# Generate dataset
# ────────────────────────────────────────────────────────────────
raw_data = create_weekly_dataset_from_fitbit(fitbit_data, user_age, user_name="You")

# Preview of first few days
print("\nGenerated 2 weeks dataset:")
print(json.dumps(raw_data["You"], indent=2))


# ────────────────────────────────────────────────────────────────
# Updated risk function – now includes average sleep hours in report
# ────────────────────────────────────────────────────────────────
def risk(raw_data):
    model = joblib.load('risk_model_multi.pkl')
    features = joblib.load('features_list.pkl')

    rows = []
    for name, records in raw_data.items():
        for record in records:
            entry = record.copy()
            entry['Name'] = name
            rows.append(entry)

    df_full = pd.DataFrame(rows)

    # Handle missing features
    for feat in features:
        if feat not in df_full.columns:
            df_full[feat] = 0 

    # Predict
    test_data_prepared = df_full[features]
    probs = model.predict_proba(test_data_prepared)

    heart_probs = [p[1] for p in probs[0]]
    obesity_probs = [p[1] for p in probs[1]]
    resp_probs = [p[1] for p in probs[2]]

    df_full['Heart_Prob'] = heart_probs
    df_full['Obesity_Prob'] = obesity_probs
    df_full['Resp_Prob'] = resp_probs

    # Weekly Averages – added Sleep Duration average
    weekly_summary = df_full.groupby('Name').agg({
        'Heart_Prob': 'mean',
        'Obesity_Prob': 'mean',
        'Resp_Prob': 'mean',
        'Daily Steps': 'mean',
        'Heart Rate': 'mean',
        'Sleep Duration': 'mean'   # ← NEW: average sleep hours
    }).reset_index()

    # Print Weekly Report
    print("\n" + "="*50)
    print("          WEEKLY RISK & HEALTH SUMMARY          ")
    print("="*50)

    THRESHOLD = 0.70

    for i, row in weekly_summary.iterrows():
        print(f"User: {row['Name']}")
        print(f"Avg Sleep Duration: {row['Sleep Duration']:.1f} hours")
        print(f"Avg Steps/Day:      {row['Daily Steps']:.0f}")
        print(f"Avg Heart Rate:     {row['Heart Rate']:.1f} BPM")
        print("-" * 40)
        
        print("Weekly Risk Probabilities:")
        print(f" → Heart Risk:        {row['Heart_Prob']*100:.2f}%")
        print(f" → Obesity Risk:      {row['Obesity_Prob']*100:.2f}%")
        print(f" → Respiratory Risk:  {row['Resp_Prob']*100:.2f}%")
        
        final_risks = []
        if row['Heart_Prob'] >= THRESHOLD: final_risks.append("Heart")
        if row['Obesity_Prob'] >= THRESHOLD: final_risks.append("Obesity")
        if row['Resp_Prob'] >= THRESHOLD: final_risks.append("Respiratory")
        
        verdict = "LOW RISK" if not final_risks else f"HIGH RISK ({', '.join(final_risks)})"
        print(f"\nFINAL WEEKLY VERDICT: {verdict}")
        print("-" * 40)

    print("="*50)


# ────────────────────────────────────────────────────────────────
# Run everything
# ────────────────────────────────────────────────────────────────
risk(raw_data)