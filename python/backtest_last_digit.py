"""
Honest walk-forward backtest for the LAST digit (digit_3).

For every draw after a warm-up period, each model is trained only on earlier
draws and predicts the next last digit. Results are compared to the 10%
random baseline with a 95% confidence interval and a binomial p-value.

Usage: python python/backtest_last_digit.py [min_train=200] [refit_every=10]
"""
import json
import math
import os
import sys
from collections import Counter

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

CSV_PATH = 'python/data/history.csv'
TARGET = 'digit_3'
BASELINE = 0.10


def feature_list():
    f = ['day_of_week', 'day', 'month']
    for i in range(1, 6):
        f += [f'lag_d1_{i}', f'lag_d2_{i}', f'lag_d3_{i}']
    for i in range(1, 4):
        f += [f'delta_d1_{i}', f'delta_d2_{i}', f'delta_d3_{i}']
    f += ['roll_d1', 'roll_d2', 'roll_d3', 'dist_d1', 'dist_d2', 'dist_d3',
          'is_even_d1', 'is_even_d2', 'is_even_d3']
    return f


def wilson_ci(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def binom_p_greater(k, n, p=BASELINE):
    """P(X >= k) for X ~ Binomial(n, p): chance of doing this well by luck."""
    return float(sum(math.comb(n, i) * p**i * (1 - p)**(n - i) for i in range(k, n + 1)))


def run(min_train=200, refit_every=10):
    if not os.path.exists(CSV_PATH):
        return {"error": "History data not found. Run fetch_data.py first."}

    df = pd.read_csv(CSV_PATH)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    feats = feature_list()
    X = df[feats].values
    y = df[TARGET].astype(int).values
    n = len(df)
    if n <= min_train + 20:
        return {"error": f"Need more than {min_train + 20} draws, have {n}."}

    rng = np.random.default_rng(42)
    names = ['random', 'most_frequent', 'repeat_last', 'logistic', 'random_forest', 'context_pattern']
    hits = {m: 0 for m in names}
    rf = lr = None
    d1_arr = df['digit_1'].astype(int).values
    d2_arr = df['digit_2'].astype(int).values
    wd_arr = df['day_of_week'].astype(int).values

    for step, i in enumerate(range(min_train, n)):
        past = y[:i]
        if step % refit_every == 0:  # retrain on everything before draw i
            rf = RandomForestClassifier(n_estimators=150, max_depth=8,
                                        random_state=42, n_jobs=-1).fit(X[:i], past)
            lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)).fit(X[:i], past)

        # Context-aware cooldown EWMA + k-NN transition score
        c_ctx = Counter()
        for age, val in enumerate(past[::-1]):
            c_ctx[int(val)] += 0.6 * (0.5 ** (age / 25.0)) + 0.4 * (0.5 ** (age / 75.0))
        prev1, prev2, prev7 = int(past[-1]), int(past[-2]), int(past[-7])
        prev_d5 = int(d2_arr[i - 1])
        s3 = (int(d1_arr[i - 1]) + prev_d5 + prev1) % 10
        wd = int(wd_arr[i])
        cond = Counter()
        for idx in range(7, i):
            age = i - 1 - idx
            w = 0.5 ** (age / 65.0)
            sim = 0.0
            if past[idx - 1] == prev1:
                sim += 2.2
                if past[idx - 2] == prev2:
                    sim += 2.5
            if past[idx - 2] == prev2:
                sim += 1.4
            if past[idx - 7] == prev7:
                sim += 1.5
            if d2_arr[idx - 1] == prev_d5:
                sim += 1.8
            if (d1_arr[idx - 1] + d2_arr[idx - 1] + past[idx - 1]) % 10 == s3:
                sim += 1.5
            if wd_arr[idx] == wd:
                sim += 1.5
            if sim >= 2.0:
                cond[int(past[idx])] += (sim ** 1.8) * w
        tot_e = sum(c_ctx.values()) or 1.0
        tot_c = sum(cond.values()) or 1.0
        sc_ctx = {}
        for d in range(10):
            sc = 0.72 * (c_ctx[d] / tot_e) + 0.28 * (cond[d] / tot_c)
            if d == prev1:
                sc *= 0.55
            elif d in (prev2, prev7):
                sc *= 1.12
            sc_ctx[d] = sc
        ctx_pred = max(range(10), key=lambda d: sc_ctx[d])

        preds = {
            'random': int(rng.integers(0, 10)),
            'most_frequent': Counter(past[-100:]).most_common(1)[0][0],
            'repeat_last': int(past[-1]),
            'logistic': int(lr.predict(X[[i]])[0]),
            'random_forest': int(rf.predict(X[[i]])[0]),
            'context_pattern': int(ctx_pred),
        }
        for m, p in preds.items():
            hits[m] += int(p == y[i])

    tested = n - min_train
    report = []
    for m in names:
        k = hits[m]
        lo, hi = wilson_ci(k, tested)
        pval = binom_p_greater(k, tested)
        report.append({
            "model": m,
            "hits": k,
            "tested": tested,
            "accuracy_pct": round(100 * k / tested, 2),
            "ci95_pct": [round(100 * lo, 2), round(100 * hi, 2)],
            "p_value_vs_random": round(pval, 4),
            "beats_random": bool(pval < 0.05 / len(names)),  # Bonferroni
        })

    return {
        "target": "last digit",
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "baseline_pct": 100 * BASELINE,
        "draws_tested": tested,
        "results": report,
        "note": "A model only beats chance if beats_random is true. "
                "Otherwise its accuracy is consistent with random guessing.",
    }


if __name__ == "__main__":
    mt = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    re = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    report = run(mt, re)
    if "error" not in report:
        os.makedirs('python/data', exist_ok=True)
        with open('python/data/last_digit_backtest.json', 'w') as f:
            json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))
