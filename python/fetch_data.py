import requests
import json
import pandas as pd
import os
import sys

BASE_URL = os.getenv("KLR_API_BASE_URL") or os.getenv("API") or "https://indialotteryapi.com/wp-json/klr/v1"

def fetch_history(limit=1000):
    try:
        response = requests.get(f"{BASE_URL}/history?limit={limit}", timeout=10)
        response.raise_for_status()
        data = response.json()
        items = data.get('items', [])
        return items
    except Exception as e:
        return []

def _load_env():
    """Minimal .env reader so MONGO_URI works without extra deps."""
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

def fetch_history_from_db():
    """All stored draws from MongoDB (drawhistories collection)."""
    _load_env()
    uri = os.getenv("MONGO_URI")
    if not uri:
        return []
    try:
        from pymongo import MongoClient
        client = MongoClient(uri, serverSelectionTimeoutMS=8000)
        db = client.get_default_database()
        rows = list(db.drawhistories.find({}, {'_id': 0, 'date': 1, 'draw_name': 1, 'first_ticket': 1, 'draw_code': 1, 'prizes': 1}))
        client.close()
        return [{'draw_date': r['date'], 'draw_name': r['draw_name'], 'first_ticket': r['first_ticket'],
                 'draw_code': r.get('draw_code', ''), 'prizes': r.get('prizes') or {}} for r in rows]
    except Exception as e:
        print(f"MongoDB load failed: {e}", file=sys.stderr)
        return []

def _normalize_lottery_name(name):
    s = str(name or '').upper().strip()
    for base in ('KARUNYA PLUS', 'STHREE SAKTHI', 'SUVARNA KERALAM', 'DHANALEKSHMI', 'BHAGYATHARA', 'SAMRUDHI', 'KARUNYA', 'WIN WIN', 'FIFTY FIFTY', 'AKSHAYA', 'NIRMAL'):
        if base in s:
            return base
    return s

def fetch_all_history():
    """DB history + latest API items, de-duplicated on normalized date."""
    merged = {}
    for it in fetch_history_from_db() + fetch_history(1000):
        d = str(it.get('draw_date') or '')[:10]
        name = _normalize_lottery_name(it.get('draw_name'))
        if d and (it.get('first_ticket') or it.get('mc')):
            prev = merged.get(d)
            # Prefer record that has prizes breakdown
            if not prev or (it.get('prizes') and not prev.get('prizes')):
                merged[d] = {**it, 'draw_date': d, 'draw_name': name or it.get('draw_name')}
    if not merged:
        csv_path = os.path.join(os.path.dirname(__file__), 'data', 'history.csv')
        if os.path.exists(csv_path):
            try:
                cdf = pd.read_csv(csv_path)
                for _, r in cdf.iterrows():
                    d = str(r['date'])[:10]
                    merged[d] = {
                        'draw_date': d,
                        'draw_name': _normalize_lottery_name(r.get('lottery', '')),
                        'first_ticket': str(int(r['full_number'])).zfill(6),
                        'draw_code': '',
                        'prizes': {},
                    }
            except Exception:
                pass
    return list(merged.values())

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
    history_items = fetch_all_history()
    if history_items:
        df = process_data(history_items)
        df.to_csv('python/data/history.csv', index=False)
    else:
        pass
