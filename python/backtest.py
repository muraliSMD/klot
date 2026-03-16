import pandas as pd
import numpy as np
import joblib
import os
import json
from sklearn.ensemble import RandomForestClassifier
from sklearn.multioutput import MultiOutputClassifier
from xgboost import XGBClassifier

def run_backtest(model_type='rf', window_size=200, test_size=50):
    """
    Simulates historical predictions one-by-one.
    window_size: Number of previous days to use for training.
    test_size: Number of latest days to backtest.
    """
    csv_path = 'python/data/history.csv'
    if not os.path.exists(csv_path):
        return {"error": "History data not found"}

    df = pd.read_csv(csv_path)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)

    features = ['day_of_week', 'day', 'month']
    for i in range(1, 6):
        features.extend([f'lag_d1_{i}', f'lag_d2_{i}', f'lag_d3_{i}'])
    for i in range(1, 4):
        features.extend([f'delta_d1_{i}', f'delta_d2_{i}', f'delta_d3_{i}'])
    features.extend(['roll_d1', 'roll_d2', 'roll_d3'])
    features.extend(['dist_d1', 'dist_d2', 'dist_d3'])
    features.extend(['is_even_d1', 'is_even_d2', 'is_even_d3'])

    results = []
    total_hits = 0
    total_digits_correct = 0

    # We start backtesting from (len - test_size)
    start_idx = len(df) - test_size
    
    for i in range(start_idx, len(df)):
        # 1. Training data: all rows BEFORE current index i
        # We use a sliding window of previous draws to train
        train_df = df.iloc[max(0, i - window_size):i]
        
        X_train = train_df[features]
        y_train = train_df[['digit_1', 'digit_2', 'digit_3']]
        
        # 2. Initialize and Train Model
        if model_type == 'rf':
            model = MultiOutputClassifier(RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42))
        elif model_type == 'xgb':
            model = MultiOutputClassifier(XGBClassifier(n_estimators=50, max_depth=5, use_label_encoder=False, eval_metric='mlogloss'))
        else:
            continue

        model.fit(X_train, y_train)
        
        # 3. Predict for current index i (Today)
        X_test = df.iloc[[i]][features]
        actual = df.iloc[i][['digit_1', 'digit_2', 'digit_3']].values
        
        prediction = model.predict(X_test)[0]
        pred_digits = [int(round(d)) for d in prediction]
        
        is_hit = all(p == a for p, a in zip(pred_digits, actual))
        digits_matched = sum(1 for p, a in zip(pred_digits, actual) if p == a)
        
        if is_hit: total_hits += 1
        total_digits_correct += digits_matched
        
        results.append({
            "date": df.iloc[i]['date'].strftime('%Y-%m-%d'),
            "actual": "".join(map(str, actual.astype(int))),
            "predicted": "".join(map(str, pred_digits)),
            "is_hit": is_hit,
            "digits_matched": digits_matched
        })

    return {
        "model": model_type,
        "total_tests": test_size,
        "hits": total_hits,
        "accuracy_pct": (total_hits / test_size) * 100,
        "avg_digits_matched": total_digits_correct / test_size,
        "history": results
    }

if __name__ == "__main__":
    import sys
    m_type = sys.argv[1] if len(sys.argv) > 1 else 'rf'
    print(json.dumps(run_backtest(m_type)))
