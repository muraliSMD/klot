import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.multioutput import MultiOutputClassifier
import joblib
import os
import sys

def train_xgboost(csv_path='python/data/history.csv'):
    if not os.path.exists(csv_path):
        print(f"File {csv_path} not found.")
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
    features.extend(['dist_d1', 'dist_d2', 'dist_d3'])
    features.extend(['is_even_d1', 'is_even_d2', 'is_even_d3'])
    
    X = df[features]
    # Targets are discrete digits (0-9)
    y = df[['digit_1', 'digit_2', 'digit_3']]

    # Model: MultiOutputClassifier wrapped around XGBClassifier
    # XGBoost is often better than RandomForest but requires more tuning
    model = MultiOutputClassifier(XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        random_state=42,
        use_label_encoder=False,
        eval_metric='mlogloss'
    ))
    
    model.fit(X, y)

    os.makedirs('python/models', exist_ok=True)
    joblib.dump(model, 'python/models/lottery_model_xgb.pkl')
    print("XGBoost model trained and saved to python/models/lottery_model_xgb.pkl")

if __name__ == "__main__":
    train_xgboost()
