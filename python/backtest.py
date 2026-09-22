import pandas as pd
import numpy as np
import joblib
import os
import json
from sklearn.ensemble import RandomForestClassifier
from sklearn.multioutput import MultiOutputClassifier

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
        
        actual = df.iloc[i][['digit_1', 'digit_2', 'digit_3']].values.astype(int)
        X_train = train_df[features]
        y_train = train_df[['digit_1', 'digit_2', 'digit_3']]
        
        # 2. Initialize and Train Model
        if model_type == 'rf':
            model = MultiOutputClassifier(RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42))
            model.fit(X_train, y_train)
            X_test = df.iloc[[i]][features]
            prediction = model.predict(X_test)[0]
            pred_digits = [int(round(d)) for d in prediction]
        elif model_type == 'xgb':
            try:
                from xgboost import XGBClassifier
                model = MultiOutputClassifier(XGBClassifier(n_estimators=50, max_depth=5, use_label_encoder=False, eval_metric='mlogloss'))
                model.fit(X_train, y_train)
                X_test = df.iloc[[i]][features]
                prediction = model.predict(X_test)[0]
                pred_digits = [int(round(d)) for d in prediction]
            except Exception as e:
                return {"error": f"XGBoost library error: {str(e)}"}
        elif model_type == 'lstm':
            import tensorflow as tf
            from tensorflow.keras.models import Model
            from tensorflow.keras.layers import Input, LSTM, Dense, Dropout
            from sklearn.preprocessing import MinMaxScaler
            
            seq_length = 10
            lstm_features = ['digit_1', 'digit_2', 'digit_3', 'roll_d1', 'roll_d2', 'roll_d3', 'dist_d1', 'dist_d2', 'dist_d3', 'is_even_d1', 'is_even_d2', 'is_even_d3']
            
            data = train_df[lstm_features].values
            if len(data) <= seq_length:
                continue
                
            scaler = MinMaxScaler(feature_range=(0, 1))
            data_scaled = scaler.fit_transform(data)
            
            xs, y1, y2, y3 = [], [], [], []
            for k in range(len(data_scaled) - seq_length):
                xs.append(data_scaled[k:(k + seq_length), :])
                target_idx = k + seq_length
                y1.append(int(train_df.iloc[target_idx]['digit_1']))
                y2.append(int(train_df.iloc[target_idx]['digit_2']))
                y3.append(int(train_df.iloc[target_idx]['digit_3']))
                
            if len(xs) == 0:
                continue
                
            xs = np.array(xs)
            y_dict = {
                'digit_1': np.array(y1, dtype=int),
                'digit_2': np.array(y2, dtype=int),
                'digit_3': np.array(y3, dtype=int)
            }
            
            inputs = Input(shape=(seq_length, len(lstm_features)))
            x = LSTM(32, activation='relu')(inputs)
            x = Dropout(0.1)(x)
            out1 = Dense(10, activation='softmax', name='digit_1')(x)
            out2 = Dense(10, activation='softmax', name='digit_2')(x)
            out3 = Dense(10, activation='softmax', name='digit_3')(x)
            
            m = Model(inputs=inputs, outputs=[out1, out2, out3])
            m.compile(optimizer='adam', loss='sparse_categorical_crossentropy')
            m.fit(xs, y_dict, epochs=15, batch_size=32, verbose=0)
            
            last_draws = df[lstm_features].iloc[i-seq_length:i].values
            last_draws_scaled = scaler.transform(last_draws)
            X_lstm = np.array([last_draws_scaled])
            
            preds = m.predict(X_lstm, verbose=0)
            pred_digits = [int(np.argmax(preds[0][0])), int(np.argmax(preds[1][0])), int(np.argmax(preds[2][0]))]
        else:
            continue
        
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
