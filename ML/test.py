import pandas as pd
import joblib

# Load the saved model and feature order
model = joblib.load('risk_model_multi.pkl')
features = joblib.load('features_list.pkl')

print("Model loaded — ready to predict")

# ────────────────────────────────────────────────
# Example: your test samples (change values as needed)
# ────────────────────────────────────────────────

test_data = pd.DataFrame([
    {'Age': 22, 'Sleep Duration': 7.5, 'Quality of Sleep': 8.0, 'Heart Rate': 62, 'Daily Steps': 10500},
    {'Age': 31, 'Sleep Duration': 6.0, 'Quality of Sleep': 5.0, 'Heart Rate': 74, 'Daily Steps': 8200},
    {'Age': 58, 'Sleep Duration': 6.5, 'Quality of Sleep': 6.0, 'Heart Rate': 68, 'Daily Steps': 4100},
    {'Age': 20, 'Sleep Duration': 4.0, 'Quality of Sleep': 3.0, 'Heart Rate': 85, 'Daily Steps': 2100},
    {'Age': 35, 'Sleep Duration': 8.0, 'Quality of Sleep': 9.0, 'Heart Rate': 58, 'Daily Steps': 12000},
    {'Age': 42, 'Sleep Duration': 5.0, 'Quality of Sleep': 4.5, 'Heart Rate': 80, 'Daily Steps': 3800},
    {'Age': 27, 'Sleep Duration': 7.0, 'Quality of Sleep': 7.0, 'Heart Rate': 72, 'Daily Steps': 9000},
    {'Age': 65, 'Sleep Duration': 7.5, 'Quality of Sleep': 8.5, 'Heart Rate': 64, 'Daily Steps': 5500},
    {'Age': 18, 'Sleep Duration': 9.0, 'Quality of Sleep': 9.5, 'Heart Rate': 55, 'Daily Steps': 15000},
    {'Age': 50, 'Sleep Duration': 4.5, 'Quality of Sleep': 2.0, 'Heart Rate': 88, 'Daily Steps': 1500},
    {'Age': 29, 'Sleep Duration': 6.5, 'Quality of Sleep': 6.0, 'Heart Rate': 76, 'Daily Steps': 7400},
    {'Age': 38, 'Sleep Duration': 7.2, 'Quality of Sleep': 7.5, 'Heart Rate': 70, 'Daily Steps': 11000},
    {'Age': 47, 'Sleep Duration': 5.8, 'Quality of Sleep': 4.0, 'Heart Rate': 82, 'Daily Steps': 4500},
    {'Age': 24, 'Sleep Duration': 3.5, 'Quality of Sleep': 2.5, 'Heart Rate': 90, 'Daily Steps': 3200},
    {'Age': 33, 'Sleep Duration': 8.2, 'Quality of Sleep': 8.0, 'Heart Rate': 60, 'Daily Steps': 13500}
], columns=features)   # ← important: match exact column order

# Predict
predictions = model.predict(test_data)
probs = model.predict_proba(test_data)

print("\nPredictions (0 = no risk, 1 = risk): [Heart, Obesity, Respiratory]")
for i, row in test_data.iterrows():
    print(f"\nInput: Age {row['Age']}, Steps {row['Daily Steps']}, HR {row['Heart Rate']}, Sleep {row['Sleep Duration']}h")
    print(f" → {predictions[i]}")
    print(f" → Probabilities: Heart {probs[0][i][1]:.3f} | Obesity {probs[1][i][1]:.3f} | Resp {probs[2][i][1]:.3f}")

# Optional: add threshold filtering
THRESHOLD = 0.70
for i, row in test_data.iterrows():
    risks = []
    if probs[0][i][1] >= THRESHOLD: risks.append("Heart")
    if probs[1][i][1] >= THRESHOLD: risks.append("Obesity")
    if probs[2][i][1] >= THRESHOLD: risks.append("Respiratory")
    
    msg = "No significant risk" if not risks else f"Risks: {', '.join(risks)}"
    print(f" → Filtered result (>{THRESHOLD*100}%): {msg}")