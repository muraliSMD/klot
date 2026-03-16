import requests
import json
import pandas as pd
import os
import sys

BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1"

def fetch_history(limit=1000):
    try:
        response = requests.get(f"{BASE_URL}/history?limit={limit}")
        response.raise_for_status()
        data = response.json()
        items = data.get('items', [])
        return items
    except Exception as e:
        return []

def process_data(items):
    processed = []
    for item in items:
        draw_date = item.get('draw_date')
        draw_name = item.get('draw_name')
        first_ticket = item.get('first_ticket', '')
        mc = item.get('mc', [])
        
        # Extract winning number (numeric part of last 3 or 4 digits)
        winning_number = None
        if first_ticket and any(char.isdigit() for char in first_ticket):
            winning_number = ''.join(filter(str.isdigit, first_ticket))
        elif mc and len(mc) > 0:
            winning_number = ''.join(filter(str.isdigit, str(mc[0])))
            
        if winning_number and len(winning_number) >= 3:
            # We focus on the last 3 digits as they are the primary target
            last_3 = winning_number[-3:]
            processed.append({
                'date': draw_date,
                'lottery': draw_name,
                'full_number': winning_number,
                'last_3': last_3,
                'digit_1': int(last_3[0]),
                'digit_2': int(last_3[1]),
                'digit_3': int(last_3[2])
            })
    
    df = pd.DataFrame(processed)
    # Convert date to datetime and sort
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')
    
    # NEW: Date Features
    df['day_of_week'] = df['date'].dt.dayofweek
    df['day'] = df['date'].dt.day
    df['month'] = df['date'].dt.month
    
    # Feature Engineering: Lag features (Previous winners)
    for i in range(1, 6): # Last 5 winners
        df[f'lag_d1_{i}'] = df['digit_1'].shift(i)
        df[f'lag_d2_{i}'] = df['digit_2'].shift(i)
        df[f'lag_d3_{i}'] = df['digit_3'].shift(i)
    
    # Delta features: change between draws
    for i in range(1, 4):
        df[f'delta_d1_{i}'] = (df['digit_1'].shift(i) - df['digit_1'].shift(i+1)).fillna(0)
        df[f'delta_d2_{i}'] = (df['digit_2'].shift(i) - df['digit_2'].shift(i+1)).fillna(0)
        df[f'delta_d3_{i}'] = (df['digit_3'].shift(i) - df['digit_3'].shift(i+1)).fillna(0)

    # Rolling averages/frequencies (last 10 draws)
    df['roll_d1'] = df['digit_1'].rolling(window=10).mean().shift(1)
    df['roll_d2'] = df['digit_2'].rolling(window=10).mean().shift(1)
    df['roll_d3'] = df['digit_3'].rolling(window=10).mean().shift(1)

    # NEW: Distance from rolling mean (helps detect Reversion to Mean)
    df['dist_d1'] = (df['digit_1'].shift(1) - df['roll_d1']).fillna(0)
    df['dist_d2'] = (df['digit_2'].shift(1) - df['roll_d2']).fillna(0)
    df['dist_d3'] = (df['digit_3'].shift(1) - df['roll_d3']).fillna(0)
    
    # NEW: Sequential Odd/Even pattern
    df['is_even_d1'] = (df['digit_1'].shift(1) % 2 == 0).astype(int)
    df['is_even_d2'] = (df['digit_2'].shift(1) % 2 == 0).astype(int)
    df['is_even_d3'] = (df['digit_3'].shift(1) % 2 == 0).astype(int)
    
    # Drop rows with NaN from shifting
    df = df.dropna()
    
    return df

if __name__ == "__main__":
    os.makedirs('python/data', exist_ok=True)
    history_items = fetch_history(1000)
    if history_items:
        df = process_data(history_items)
        df.to_csv('python/data/history.csv', index=False)
    else:
        pass
