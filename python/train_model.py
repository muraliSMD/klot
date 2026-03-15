import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.multioutput import MultiOutputClassifier
import joblib
import os
import sys

def train_model(csv_path='python/data/history.csv'):
    if not os.path.exists(csv_path):
        return

    df = pd.read_csv(csv_path)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')

    # Feature Engineering
    df['day_of_week'] = df['date'].dt.dayofweek
    df['day'] = df['date'].dt.day
    df['month'] = df['date'].dt.month

    # Features: date info + lag features + delta features
    features = ['day_of_week', 'day', 'month']
    for i in range(1, 6):
        features.extend([f'lag_d1_{i}', f'lag_d2_{i}', f'lag_d3_{i}'])
    for i in range(1, 4):
        features.extend([f'delta_d1_{i}', f'delta_d2_{i}', f'delta_d3_{i}'])
    features.extend(['roll_d1', 'roll_d2', 'roll_d3'])
    
    X = df[features]
    # Targets are discrete digits (0-9)
    y = df[['digit_1', 'digit_2', 'digit_3']]

    # Model: MultiOutputClassifier wrapped around RandomForest
    model = MultiOutputClassifier(RandomForestClassifier(n_estimators=300, max_depth=12, random_state=42))
    model.fit(X, y)

    os.makedirs('python/models', exist_ok=True)
    joblib.dump(model, 'python/models/lottery_model.pkl')

if __name__ == "__main__":
    train_model()
