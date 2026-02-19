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
    # Change these numbers to your real watch averages or new test cases
    {'Age': 19, 'Sleep Duration': 1.5, 'Quality of Sleep': 1.5,
     'Heart Rate': 90, 'Daily Steps': 1200},
     
    # Add more rows if you want
    {'Age': 30, 'Sleep Duration': 8, 'Quality of Sleep': 8,
     'Heart Rate': 75, 'Daily Steps': 12500},
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