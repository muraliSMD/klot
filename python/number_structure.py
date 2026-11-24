"""
Structure analysis of Kerala 1st-prize winning numbers.

Ticket format: SERIES (2 letters) + 6 digits, e.g. "RA 404595".
Kerala draws each digit position with a separate mechanical draw, so the
question is not "what algorithm generates it" but "is any position biased or
are positions linked?". This script measures exactly that.

Usage: python python/number_structure.py   -> python/data/number_structure.json
"""
import json
import math
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
from fetch_data import fetch_all_history  # noqa: E402

CRIT_9DF = 16.92   # chi-square critical value, 9 df, p = 0.05
OUT = 'python/data/number_structure.json'


def chi_uniform(values, k=10):
    n = len(values)
    if not n:
        return 0.0
    c = Counter(values)
    e = n / k
    return sum((c.get(d, 0) - e) ** 2 / e for d in range(k))


def chi_p(chi, df):
    """Upper-tail p-value for chi-square (Wilson-Hilferty approximation)."""
    if chi <= 0:
        return 1.0
    z = ((chi / df) ** (1 / 3) - (1 - 2 / (9 * df))) / math.sqrt(2 / (9 * df))
    return 0.5 * math.erfc(z / math.sqrt(2))


def independence_chi(a, b):
    """Chi-square test that two digit positions are independent (81 df)."""
    n = len(a)
    ca, cb, cab = Counter(a), Counter(b), Counter(zip(a, b))
    chi = 0.0
    for x in range(10):
        for y in range(10):
            e = ca[x] * cb[y] / n
            if e > 0:
                chi += (cab[(x, y)] - e) ** 2 / e
    return chi


def main():
    tickets = []
    for it in fetch_all_history():
        raw = str(it.get('first_ticket') or '').upper()
        digits = re.sub(r'\D', '', raw)
        if len(digits) == 6:
            tickets.append({'date': it.get('draw_date'), 'name': it.get('draw_name'),
                            'series': re.sub(r'[^A-Z]', '', raw), 'digits': digits})
    tickets.sort(key=lambda t: t['date'])
    n = len(tickets)

    # 1. Per-position digit bias
    positions = []
    for p in range(6):
        vals = [int(t['digits'][p]) for t in tickets]
        chi = chi_uniform(vals)
        c = Counter(vals)
        positions.append({
            'position': p + 1,
            'label': 'last digit' if p == 5 else f'digit {p + 1}',
            'counts': [c.get(d, 0) for d in range(10)],
            'chi_square': round(chi, 2),
            'p_value': round(chi_p(chi, 9), 5),
            'biased': chi > CRIT_9DF,
            'most_common': c.most_common(1)[0][0],
        })

    # 2. Are positions linked? (e.g. does digit 5 influence the last digit?)
    links = []
    for i in range(6):
        for j in range(i + 1, 6):
            a = [int(t['digits'][i]) for t in tickets]
            b = [int(t['digits'][j]) for t in tickets]
            chi = independence_chi(a, b)
            links.append({'pair': f'{i + 1}-{j + 1}', 'chi_square': round(chi, 1),
                          'p_value': round(chi_p(chi, 81), 4)})
    # Bonferroni across 15 pairs
    for l in links:
        l['linked'] = l['p_value'] < 0.05 / len(links)

    # 3. Digit sum and repeated digits inside a ticket
    sums = [sum(int(c) for c in t['digits']) for t in tickets]
    mean_sum = sum(sums) / n
    repeats = sum(1 for t in tickets if len(set(t['digits'])) < 6) / n
    expected_repeats = 1 - (10 * 9 * 8 * 7 * 6 * 5) / 10 ** 6

    # 4. Series letters
    first_letter = Counter(t['series'][:1] for t in tickets if t['series'])
    second_letter = Counter(t['series'][1:2] for t in tickets if len(t['series']) > 1)

    # 5. Last digit vs series / lottery (known before the draw? lottery yes, series no)
    by_lottery = {}
    for t in tickets:
        by_lottery.setdefault(t['name'], []).append(int(t['digits'][5]))
    lottery_bias = {k: {'draws': len(v), 'most_common': Counter(v).most_common(1)[0][0],
                        'chi_square': round(chi_uniform(v), 1)} for k, v in by_lottery.items()}

    # 6. Does the last-digit skew persist over time? (thirds)
    thirds = []
    for k in range(3):
        part = tickets[k * n // 3:(k + 1) * n // 3]
        c = Counter(int(t['digits'][5]) for t in part)
        thirds.append({'from': part[0]['date'], 'to': part[-1]['date'],
                       'counts': [c.get(d, 0) for d in range(10)],
                       'top3': [d for d, _ in c.most_common(3)]})

    report = {
        'tickets': n,
        'date_range': [tickets[0]['date'], tickets[-1]['date']],
        'positions': positions,
        'position_links': sorted(links, key=lambda l: l['p_value'])[:5],
        'any_positions_linked': any(l['linked'] for l in links),
        'digit_sum': {'mean': round(mean_sum, 2), 'expected': 27.0},
        'tickets_with_repeated_digit_pct': round(100 * repeats, 1),
        'expected_repeated_digit_pct': round(100 * expected_repeats, 1),
        'series_first_letter': dict(first_letter.most_common()),
        'series_second_letter': dict(second_letter.most_common()),
        'last_digit_by_lottery': lottery_bias,
        'last_digit_over_time': thirds,
    }
    os.makedirs('python/data', exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
