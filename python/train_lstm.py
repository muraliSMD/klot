import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, LSTM, Dense, Dropout
from sklearn.preprocessing import MinMaxScaler
import joblib
import os

def create_sequences(data_scaled, df, seq_length):
    xs = []
    y1, y2, y3 = [], [], []
    for i in range(len(data_scaled) - seq_length):
        xs.append(data_scaled[i:(i + seq_length), :])
        target_idx = i + seq_length
        y1.append(int(df.iloc[target_idx]['digit_1']))
        y2.append(int(df.iloc[target_idx]['digit_2']))
        y3.append(int(df.iloc[target_idx]['digit_3']))
    
    return np.array(xs), {
        'digit_1': np.array(y1, dtype=int),
        'digit_2': np.array(y2, dtype=int),
        'digit_3': np.array(y3, dtype=int)
    }

def train_lstm(csv_path='python/data/history.csv', seq_length=10):
    if not os.path.exists(csv_path):
        print(f"File {csv_path} not found.")
        return

    df = pd.read_csv(csv_path)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)

    # Features for LSTM
    features = ['digit_1', 'digit_2', 'digit_3', 'roll_d1', 'roll_d2', 'roll_d3', 'dist_d1', 'dist_d2', 'dist_d3', 'is_even_d1', 'is_even_d2', 'is_even_d3']
    data = df[features].values
    
    # Scale feature values
    scaler = MinMaxScaler(feature_range=(0, 1))
    data_scaled = scaler.fit_transform(data)

    X, y = create_sequences(data_scaled, df, seq_length)

    if len(X) < 10:
        print("Not enough data for LSTM sequence.")
        return

    # Multi-head Softmax Classification Network Architecture
    inputs = Input(shape=(seq_length, len(features)))
    x = LSTM(64, activation='relu', return_sequences=True)(inputs)
    x = Dropout(0.2)(x)
    x = LSTM(32, activation='relu')(x)
    x = Dropout(0.2)(x)

    out1 = Dense(10, activation='softmax', name='digit_1')(x)
    out2 = Dense(10, activation='softmax', name='digit_2')(x)
    out3 = Dense(10, activation='softmax', name='digit_3')(x)

    model = Model(inputs=inputs, outputs=[out1, out2, out3])
    model.compile(
        optimizer='adam',
        loss={
            'digit_1': 'sparse_categorical_crossentropy',
            'digit_2': 'sparse_categorical_crossentropy',
            'digit_3': 'sparse_categorical_crossentropy'
        },
        metrics={
            'digit_1': 'accuracy',
            'digit_2': 'accuracy',
            'digit_3': 'accuracy'
        }
    )
    
    # Train multi-head model
    model.fit(X, y, epochs=50, batch_size=16, verbose=0)

    # Save trained model and scaler
    os.makedirs('python/models', exist_ok=True)
    model.save('python/models/lottery_model_lstm.keras')
    try:
        model.save('python/models/lottery_model_lstm.h5')
    except Exception:
        pass
    joblib.dump(scaler, 'python/models/lottery_scaler.pkl')
    print("LSTM Multi-Head Softmax Neural Network trained and saved successfully.")

if __name__ == "__main__":
    train_lstm()

