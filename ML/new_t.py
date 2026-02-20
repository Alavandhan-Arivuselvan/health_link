import time
import pandas as pd
import joblib
def risk(raw_data):
    # 1. Load the model and feature order
    model = joblib.load('risk_model_multi.pkl')
    features = joblib.load('features_list.pkl')



    # 3. Prepare DataFrame
    rows = []
    for name, records in raw_data.items():
        for record in records:
            entry = record.copy()
            entry['Name'] = name
            rows.append(entry)

    df_full = pd.DataFrame(rows)

    # 4. Handle missing features
    for feat in features:
        if feat not in df_full.columns:
            df_full[feat] = 0 

    # 5. Predict
    test_data_prepared = df_full[features]
    probs = model.predict_proba(test_data_prepared)

    # 6. Weekly Calculation Logic
    # probs[TargetIndex][RowIndex][ClassIndex]
    heart_probs = [p[1] for p in probs[0]]
    obesity_probs = [p[1] for p in probs[1]]
    resp_probs = [p[1] for p in probs[2]]

    # Add probabilities to our dataframe to calculate averages
    df_full['Heart_Prob'] = heart_probs
    df_full['Obesity_Prob'] = obesity_probs
    df_full['Resp_Prob'] = resp_probs

    # Calculate Weekly Averages
    weekly_summary = df_full.groupby('Name').agg({
        'Heart_Prob': 'mean',
        'Obesity_Prob': 'mean',
        'Resp_Prob': 'mean',
        'Daily Steps': 'mean',
        'Heart Rate': 'mean'
    }).reset_index()

    # 7. Print Weekly Report
    print("\n" + "="*40)
    print("      WEEKLY RISK ACCURACY REPORT      ")
    print("="*40)

    THRESHOLD = 0.70

    for i, row in weekly_summary.iterrows():
        print(f"User: {row['Name']}")
        print(f"Avg Steps/Day: {row['Daily Steps']:.0f}")
        print(f"Avg Heart Rate: {row['Heart Rate']:.1f} BPM")
        print("-" * 25)
        
        # Calculate "Risk Accuracy" (Model confidence over the week)
        print(f"Weekly Risk Probabilities:")
        print(f" → Heart Risk:      {row['Heart_Prob']*100:.2f}%")
        print(f" → Obesity Risk:    {row['Obesity_Prob']*100:.2f}%")
        print(f" → Respiratory Risk: {row['Resp_Prob']*100:.2f}%")
        
        # Determine Final Verdict
        final_risks = []
        if row['Heart_Prob'] >= THRESHOLD: final_risks.append("Heart")
        if row['Obesity_Prob'] >= THRESHOLD: final_risks.append("Obesity")
        if row['Resp_Prob'] >= THRESHOLD: final_risks.append("Respiratory")
        
        verdict = "LOW RISK" if not final_risks else f"HIGH RISK ({', '.join(final_risks)})"
        print(f"\nFINAL WEEKLY VERDICT: {verdict}")
    print("="*40)

raw_data = {
    "Agiless": [
        # Normal Week
        {'Date': '2026-02-06', 'Age': 19, 'Sleep Duration': 7.8, 'Quality of Sleep': 8.0, 'Heart Rate': 72, 'Daily Steps': 11452},
        {'Date': '2026-02-06', 'Age': 19, 'Sleep Duration': 8.2, 'Quality of Sleep': 8.5, 'Heart Rate': 70, 'Daily Steps': 12123},
        {'Date': '2026-02-07', 'Age': 19, 'Sleep Duration': 7.5, 'Quality of Sleep': 7.5, 'Heart Rate': 75, 'Daily Steps': 10895},
        {'Date': '2026-02-08', 'Age': 19, 'Sleep Duration': 8.0, 'Quality of Sleep': 8.0, 'Heart Rate': 71, 'Daily Steps': 13000},
        {'Date': '2026-02-09', 'Age': 19, 'Sleep Duration': 7.9, 'Quality of Sleep': 8.2, 'Heart Rate': 73, 'Daily Steps': 11562},
        {'Date': '2026-02-10', 'Age': 19, 'Sleep Duration': 8.4, 'Quality of Sleep': 9.0, 'Heart Rate': 70, 'Daily Steps': 14223},
        {'Date': '2026-02-11', 'Age': 19, 'Sleep Duration': 7.7, 'Quality of Sleep': 7.8, 'Heart Rate': 74, 'Daily Steps': 10705}, 
    ]
}
risk(raw_data)
time.sleep(5)
raw_data={
    "Agiless":[
        {'Date': '2026-02-12', 'Age': 19, 'Sleep Duration': 4.2, 'Quality of Sleep': 3.0, 'Heart Rate': 88, 'Daily Steps': 1202},
        {'Date': '2026-02-13', 'Age': 19, 'Sleep Duration': 3.5, 'Quality of Sleep': 2.5, 'Heart Rate': 90, 'Daily Steps': 853},
        {'Date': '2026-02-14', 'Age': 19, 'Sleep Duration': 10.5, 'Quality of Sleep': 4.0, 'Heart Rate': 85, 'Daily Steps': 1505},
        {'Date': '2026-02-15', 'Age': 19, 'Sleep Duration': 4.0, 'Quality of Sleep': 2.0, 'Heart Rate': 89, 'Daily Steps': 2130},
        {'Date': '2026-02-16', 'Age': 19, 'Sleep Duration': 5.1, 'Quality of Sleep': 3.5, 'Heart Rate': 87, 'Daily Steps': 1102},
        {'Date': '2026-02-17', 'Age': 19, 'Sleep Duration': 3.8, 'Quality of Sleep': 2.5, 'Heart Rate': 90, 'Daily Steps': 943},
        {'Date': '2026-02-18', 'Age': 19, 'Sleep Duration': 9.8, 'Quality of Sleep': 4.5, 'Heart Rate': 84, 'Daily Steps': 1305}
    ]
}
risk(raw_data)