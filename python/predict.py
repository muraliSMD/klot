import sys
import pandas as pd
import joblib
import json
import datetime
import os
import numpy as np

def predict_lottery(model_type='rf'):
    """
    model_type: 'rf' (Random Forest), 'xgb' (XGBoost), 'lstm' (LSTM)
    """
    model_paths = {
        'rf': 'python/models/lottery_model.pkl',
        'xgb': 'python/models/lottery_model_xgb.pkl',
        'lstm': 'python/models/lottery_model_lstm.h5'
    }
    
    model_path = model_paths.get(model_type)
    if not model_path or not os.path.exists(model_path):
        return {"error": f"Model file for {model_type} ({model_path}) not found. Please train it first."}

    try:
        # We need the latest history to build features
        from fetch_data import fetch_history, process_data
        history_items = fetch_history(50) 
        df = process_data(history_items)
        if df.empty:
            return {"error": "Insufficient history to generate features"}
            
        now = datetime.datetime.now()
        target_date = now
        day_of_week = target_date.weekday()
        day = target_date.day
        month = target_date.month

        if model_type in ['rf', 'xgb']:
            model = joblib.load(model_path)
            
            # Feature extraction matching training
            features = ['day_of_week', 'day', 'month']
            for i in range(1, 6):
                features.extend([f'lag_d1_{i}', f'lag_d2_{i}', f'lag_d3_{i}'])
            for i in range(1, 4):
                features.extend([f'delta_d1_{i}', f'delta_d2_{i}', f'delta_d3_{i}'])
            features.extend(['roll_d1', 'roll_d2', 'roll_d3'])
            features.extend(['dist_d1', 'dist_d2', 'dist_d3'])
            features.extend(['is_even_d1', 'is_even_d2', 'is_even_d3'])

            # Prepare current features (The latest row in processed df matches Draw N-1)
            latest = df.iloc[-1]
            
            feat_dict = {
                'day_of_week': [day_of_week],
                'day': [day],
                'month': [month],
                'roll_d1': [df['digit_1'].tail(10).mean()],
                'roll_d2': [df['digit_2'].tail(10).mean()],
                'roll_d3': [df['digit_3'].tail(10).mean()],
                'dist_d1': [df.iloc[-1]['digit_1'] - df['digit_1'].tail(10).mean()],
                'dist_d2': [df.iloc[-1]['digit_2'] - df['digit_2'].tail(10).mean()],
                'dist_d3': [df.iloc[-1]['digit_3'] - df['digit_3'].tail(10).mean()],
                'is_even_d1': [int(df.iloc[-1]['digit_1'] % 2 == 0)],
                'is_even_d2': [int(df.iloc[-1]['digit_2'] % 2 == 0)],
                'is_even_d3': [int(df.iloc[-1]['digit_3'] % 2 == 0)]
            }
            
            for i in range(1, 6):
                feat_dict[f'lag_d1_{i}'] = [df.iloc[-i]['digit_1']]
                feat_dict[f'lag_d2_{i}'] = [df.iloc[-i]['digit_2']]
                feat_dict[f'lag_d3_{i}'] = [df.iloc[-i]['digit_3']]
            
            for i in range(1, 4):
                # (Draw N-i - Draw N-i-1)
                feat_dict[f'delta_d1_{i}'] = [df.iloc[-i]['digit_1'] - df.iloc[-(i+1)]['digit_1']]
                feat_dict[f'delta_d2_{i}'] = [df.iloc[-i]['digit_2'] - df.iloc[-(i+1)]['digit_2']]
                feat_dict[f'delta_d3_{i}'] = [df.iloc[-i]['digit_3'] - df.iloc[-(i+1)]['digit_3']]

            X_pred = pd.DataFrame(feat_dict)
            X_pred = X_pred[features]
            
            prediction = model.predict(X_pred)
            predicted_digits = [int(round(d)) for d in prediction[0]]

        elif model_type == 'lstm':
            import tensorflow as tf
            model = tf.keras.models.load_model(model_path, compile=False)
            scaler = joblib.load('python/models/lottery_scaler.pkl')
            
            # Features for LSTM: sequence of last 10 draws (all 12 features)
            seq_length = 10
            features = ['digit_1', 'digit_2', 'digit_3', 'roll_d1', 'roll_d2', 'roll_d3', 'dist_d1', 'dist_d2', 'dist_d3', 'is_even_d1', 'is_even_d2', 'is_even_d3']
            last_draws = df[features].tail(seq_length).values
            last_draws_scaled = scaler.transform(last_draws)
            
            X_lstm = np.array([last_draws_scaled]) 
            prediction_scaled = model.predict(X_lstm, verbose=0) # Output shape (1, 3)
            
            # Inverse transform: create a dummy array with same number of features
            # as the scaler was trained on (12)
            dummy = np.zeros((1, len(features)))
            dummy[0, :3] = prediction_scaled[0]
            prediction = scaler.inverse_transform(dummy)
            predicted_digits = [int(round(np.clip(d, 0, 9))) for d in prediction[0][:3]]

        predicted_number = "".join(map(str, predicted_digits))

        return {
            "model": model_type,
            "predicted_number": predicted_number,
            "target_date": target_date.strftime("%Y-%m-%d")
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    model_arg = sys.argv[1] if len(sys.argv) > 1 else 'rf'
    result = predict_lottery(model_arg)
    print(json.dumps(result))
