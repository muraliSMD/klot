import sys
import pandas as pd
import joblib
import json
import datetime
import os

def predict_lottery(model_path='python/models/lottery_model.pkl'):
    if not os.path.exists(model_path):
        return {"error": f"Model file {model_path} not found. Please train the model first."}

    try:
        model = joblib.load(model_path)
        
        # We need the latest history to build lag features
        from fetch_data import fetch_history, process_data
        history_items = fetch_history(50) # Get recent draws
        df = process_data(history_items)
        if df.empty:
            return {"error": "Insufficient history to generate features"}
            
        latest_row = df.iloc[-1]
        
        # Determine the target date features
        now = datetime.datetime.now()
        target_date = now # Predicting for current/next draw
        
        day_of_week = target_date.weekday()
        day = target_date.day
        month = target_date.month

        # Prepare input features matching training
        feat_dict = {
            'day_of_week': [day_of_week],
            'day': [day],
            'month': [month],
            'roll_d1': [df['digit_1'].tail(10).mean()],
            'roll_d2': [df['digit_2'].tail(10).mean()],
            'roll_d3': [df['digit_3'].tail(10).mean()]
        }
        for i in range(1, 6):
            feat_dict[f'lag_d1_{i}'] = [df.iloc[-i]['digit_1']]
            feat_dict[f'lag_d2_{i}'] = [df.iloc[-i]['digit_2']]
            feat_dict[f'lag_d3_{i}'] = [df.iloc[-i]['digit_3']]
        
        for i in range(1, 4):
            # Delta is (current - prev)
            feat_dict[f'delta_d1_{i}'] = [df.iloc[-i]['digit_1'] - df.iloc[-(i+1)]['digit_1']]
            feat_dict[f'delta_d2_{i}'] = [df.iloc[-i]['digit_2'] - df.iloc[-(i+1)]['digit_2']]
            feat_dict[f'delta_d3_{i}'] = [df.iloc[-i]['digit_3'] - df.iloc[-(i+1)]['digit_3']]

        X_pred = pd.DataFrame(feat_dict)
        
        # Ensure column order matches training
        features = ['day_of_week', 'day', 'month']
        for i in range(1, 6):
            features.extend([f'lag_d1_{i}', f'lag_d2_{i}', f'lag_d3_{i}'])
        for i in range(1, 4):
            features.extend([f'delta_d1_{i}', f'delta_d2_{i}', f'delta_d3_{i}'])
        features.extend(['roll_d1', 'roll_d2', 'roll_d3'])
        
        X_pred = X_pred[features]
        
        # Predict (Class labels directly 0-9)
        prediction = model.predict(X_pred)
        
        predicted_digits = [int(round(d)) for d in prediction[0]]
        predicted_number = "".join(map(str, predicted_digits))

        return {
            "predicted_number": predicted_number,
            "target_date": target_date.strftime("%Y-%m-%d"),
            "features": {
                "day_of_week": day_of_week,
                "day": day,
                "month": month
            }
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    result = predict_lottery()
    print(json.dumps(result))
