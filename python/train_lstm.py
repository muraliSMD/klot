import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from sklearn.preprocessing import MinMaxScaler
import joblib
import os

def create_sequences(data, seq_length):
    xs, ys = [], []
    for i in range(len(data) - seq_length):
        x = data[i:(i + seq_length), :]
        y = data[i + seq_length, :3] # The 3 digits are targets
        xs.append(x)
        ys.append(y)
    return np.array(xs), np.array(ys)

def train_lstm(csv_path='python/data/history.csv', seq_length=10):
    if not os.path.exists(csv_path):
        print(f"File {csv_path} not found.")
        return

    df = pd.read_csv(csv_path)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')

    # Selected features (Digit history + Refined features)
    features = ['digit_1', 'digit_2', 'digit_3', 'roll_d1', 'roll_d2', 'roll_d3', 'dist_d1', 'dist_d2', 'dist_d3', 'is_even_d1', 'is_even_d2', 'is_even_d3']
    data = df[features].values
    
    # Scale data (important for LSTMs)
    scaler = MinMaxScaler(feature_range=(0, 1))
    data_scaled = scaler.fit_transform(data)

    X, y = create_sequences(data_scaled, seq_length)

    if len(X) < 10:
        print("Not enough data for LSTM sequence.")
        return

    model = Sequential([
        LSTM(64, activation='relu', input_shape=(seq_length, len(features)), return_sequences=True),
        Dropout(0.2),
        LSTM(32, activation='relu'),
        Dropout(0.2),
        Dense(3) # One output per digit
    ])
    
    model.compile(optimizer='adam', loss='mse')
    
    # Train
    model.fit(X, y, epochs=50, batch_size=16, verbose=0)

    # Save
    os.makedirs('python/models', exist_ok=True)
    model.save('python/models/lottery_model_lstm.h5')
    joblib.dump(scaler, 'python/models/lottery_scaler.pkl')
    print("LSTM model trained and saved to python/models/lottery_model_lstm.h5")

if __name__ == "__main__":
    train_lstm()
