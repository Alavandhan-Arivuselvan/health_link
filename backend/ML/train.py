import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.multioutput import MultiOutputClassifier
import joblib

# Load and prepare data (same as before)
df = pd.read_csv('Sleep_health_and_lifestyle_dataset.csv')
df['Systolic_BP'] = df['Blood Pressure'].str.split('/').str[0].astype(int)
df = df.dropna()

# Create binary targets
df['heart_risk'] = ((df['Heart Rate'] > 85) | (df['Systolic_BP'] > 130)).astype(int)
df['obesity_risk'] = ((df['Daily Steps'] < 5000) | (df['BMI Category'].isin(['Overweight', 'Obese']))).astype(int)
df['respiratory_risk'] = (df['Sleep Disorder'] == 'Sleep Apnea').astype(int)

# Features
features = ['Age', 'Sleep Duration', 'Quality of Sleep', 'Physical Activity Level',
            'Stress Level', 'Heart Rate', 'Daily Steps']
X = df[features]
y_multi = df[['heart_risk', 'obesity_risk', 'respiratory_risk']]

# Train multi-output model (best one from your results)
print("Training model...")
model = MultiOutputClassifier(RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1
))

model.fit(X, y_multi)   # ← train on ALL data (no split needed for final model)

# Save
joblib.dump(model, 'risk_model_multi.pkl')
joblib.dump(features, 'features_list.pkl')  # save feature names too

print("Model saved successfully! You can now use 'risk_model_multi.pkl'")