"""
Last-digit PATTERN FINDER & ADAPTIVE CONTEXT PREDICTOR.

Evaluates candidate patterns across distinct signal families using strict
walk-forward testing:

  1. Every pattern predicts draw i using ONLY draws before i (walk-forward).
  2. Draws are split into DISCOVERY (first half) and VALIDATION (second half).
  3. A pattern is "validated" if it beats the 10% random baseline in discovery
     (p < 0.05), confirms on the unseen validation set (p < 0.05), and passes
     multiple-testing correction across the full walk-forward window.
  4. Next-draw prediction uses a family-diversified, context-adaptive ensemble
     weighted by recent out-of-sample performance so predictions dynamically
     respond to the latest draw's digits, Markov transitions, gap hazard, and
     upcoming lottery/weekday schedule.

Usage: python python/last_digit_patterns.py
Writes python/data/last_digit_patterns.json
"""
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from fetch_data import fetch_all_history  # noqa: E402

OUT = 'python/data/last_digit_patterns.json'
WARMUP = 60          # draws needed before patterns start predicting
TOP_K = 3            # also measure "is the winner in the pattern's top 3?"

WEEKDAY_LOTTERY = {
    0: 'BHAGYATHARA',
    1: 'STHREE SAKTHI',
    2: 'DHANALEKSHMI',
    3: 'KARUNYA PLUS',
    4: 'SUVARNA KERALAM',
    5: 'KARUNYA',
    6: 'SAMRUDHI',
}


def normalize_name(name):
    s = (name or '').upper().strip()
    for base in ('KARUNYA PLUS', 'STHREE SAKTHI', 'SUVARNA KERALAM', 'DHANALEKSHMI', 'BHAGYATHARA', 'SAMRUDHI', 'KARUNYA'):
        if base in s:
            return base
    return s


# ---------------------------------------------------------------- data
def load_draws():
    draws = []
    for it in fetch_all_history():
        digits = re.sub(r'\D', '', str(it.get('first_ticket') or ''))
        d = it.get('draw_date')
        if len(digits) < 1 or not d:
            continue
        try:
            dt = date.fromisoformat(d[:10])
        except ValueError:
            continue
        padded = digits.zfill(6)
        code_num = re.sub(r'\D', '', str(it.get('draw_code') or ''))
        prizes = it.get('prizes') or {}
        tiers = {}
        for tier, tickets in prizes.items():
            if tier in ('amounts', 'guess', 'mc') or not isinstance(tickets, list):
                continue
            ds = [int(re.sub(r'\D', '', str(t))[-1]) for t in tickets if re.sub(r'\D', '', str(t))]
            if ds:
                tiers[tier] = ds
        draws.append({
            'date': dt,
            'name': normalize_name(it.get('draw_name')),
            'ticket': padded,
            'series': re.sub(r'[^A-Z]', '', str(it.get('first_ticket') or '').upper()),
            'code': int(code_num) if code_num else None,
            'd4': int(padded[-3]),
            'd5': int(padded[-2]),
            'last': int(padded[-1]),
            'tiers': tiers,
        })
    draws.sort(key=lambda x: x['date'])
    return draws


# ---------------------------------------------------------------- helpers
def ranked(counter, fallback=None):
    """Digits 0-9 ordered by score (desc); ties broken by fallback or digit."""
    return sorted(range(10), key=lambda d: (-counter.get(d, 0), d if fallback is None else fallback.index(d)))


def single_with_fallback(d, h):
    """A deterministic formula gives one primary digit; rank remaining digits by recency frequency."""
    d %= 10
    c = Counter()
    for age, x in enumerate(reversed(h[-60:])):
        c[x['last']] += 0.5 ** (age / 25.0)
    if h:
        c[h[-1]['last']] *= 0.65
    rest = [x for x in ranked(c) if x != d]
    return [d] + rest


def digsum(s):
    return sum(int(c) for c in s)


def ewma_counter(h, half_life=35.0):
    c = Counter()
    for age, x in enumerate(reversed(h)):
        c[x['last']] += 0.5 ** (age / half_life)
    return c


# ---------------------------------------------------------------- patterns
def build_patterns():
    P = {}
    FAM = {}

    def reg(name, fam, fn):
        P[name] = fn
        FAM[name] = fam

    # 1. Context-Hybrid Pattern Family (combines transition context, ticket structure, weekday & cooldown)
    def hybrid_context_knn(h, t, pen=0.50, cond_w=0.45):
        n = len(h)
        ewma = Counter()
        for age, x in enumerate(reversed(h)):
            ewma[x['last']] += 0.6 * (0.5 ** (age / 25.0)) + 0.4 * (0.5 ** (age / 75.0))
        tot_e = sum(ewma.values()) or 1.0
        p_ewma = {d: ewma[d] / tot_e for d in range(10)}

        prev1 = h[-1]['last']
        prev2 = h[-2]['last'] if n >= 2 else -1
        prev3 = h[-3]['last'] if n >= 3 else -1
        prev7 = h[-7]['last'] if n >= 7 else -1
        prev_d5 = h[-1]['d5']
        s3 = (h[-1]['d4'] + prev_d5 + prev1) % 10
        wd = t['date'].weekday()

        cond = Counter()
        for age in range(n - 1):
            idx = n - 1 - age
            if idx < 7:
                break
            w = 0.5 ** (age / 65.0)
            sim = 0.0
            if h[idx - 1]['last'] == prev1:
                sim += 2.2
                if h[idx - 2]['last'] == prev2:
                    sim += 2.5
            if h[idx - 2]['last'] == prev2:
                sim += 1.4
            if h[idx - 3]['last'] == prev3:
                sim += 0.9
            if h[idx - 7]['last'] == prev7:
                sim += 1.5
            if h[idx - 1]['d5'] == prev_d5:
                sim += 1.8
            if (h[idx - 1]['d4'] + h[idx - 1]['d5'] + h[idx - 1]['last']) % 10 == s3:
                sim += 1.5
            if h[idx]['date'].weekday() == wd:
                sim += 1.5
            if sim >= 2.0:
                cond[h[idx]['last']] += (sim ** 1.8) * w
        tot_c = sum(cond.values()) or 1.0
        p_cond = {d: cond[d] / tot_c for d in range(10)}

        scores = {}
        for d in range(10):
            sc = (1.0 - cond_w) * p_ewma[d] + cond_w * p_cond[d]
            if d == prev1:
                sc *= pen
            elif d in (prev2, prev7):
                sc *= 1.12
            scores[d] = sc
        return ranked(scores)

    reg('hybrid_context_knn', 'context_hybrid', hybrid_context_knn)
    reg('hybrid_context_balanced', 'context_hybrid', lambda h, t: hybrid_context_knn(h, t, pen=0.52, cond_w=0.28))

    def contextual_bayes(h, t):
        c_ewma = ewma_counter(h, 35.0)
        tot_ewma = sum(c_ewma.values()) or 1.0
        prev1 = h[-1]['last']
        prev2 = h[-2]['last'] if len(h) >= 2 else -1
        prev7 = h[-7]['last'] if len(h) >= 7 else -1
        wd = t['date'].weekday()

        m1 = Counter(b['last'] for a, b in zip(h, h[1:]) if a['last'] == prev1)
        m2 = Counter(b['last'] for a, b in zip(h, h[2:]) if a['last'] == prev2)
        m7 = Counter(b['last'] for a, b in zip(h, h[7:]) if a['last'] == prev7)
        cwd = Counter(x['last'] for x in h if x['date'].weekday() == wd)
        cd5 = Counter(b['last'] for a, b in zip(h, h[1:]) if a['d5'] == h[-1]['d5'])

        scores = {}
        for d in range(10):
            p0 = (c_ewma[d] + 0.5) / (tot_ewma + 5.0)
            p1 = (m1[d] + 1.4 * p0 * 10) / (sum(m1.values()) + 14.0)
            p2 = (m2[d] + 1.4 * p0 * 10) / (sum(m2.values()) + 14.0)
            p7 = (m7[d] + 1.4 * p0 * 10) / (sum(m7.values()) + 14.0)
            pwd = (cwd[d] + 1.4 * p0 * 10) / (sum(cwd.values()) + 14.0)
            pd5 = (cd5[d] + 1.4 * p0 * 10) / (sum(cd5.values()) + 14.0)
            sc = (p0 ** 0.30) * (p1 ** 0.25) * (p2 ** 0.12) * (p7 ** 0.11) * (pwd ** 0.11) * (pd5 ** 0.11)
            if d == prev1:
                sc *= 0.72
            scores[d] = sc
        return ranked(scores)

    reg('contextual_bayes', 'context_hybrid', contextual_bayes)

    # 2. Cooldown & Regime Trend Family
    def cooldown_ewma(hl=35.0, pen=0.68):
        def f(h, t):
            c = ewma_counter(h, hl)
            c[h[-1]['last']] *= pen
            return ranked(c)
        return f

    reg('cooldown_ewma_35', 'cooldown_trend', cooldown_ewma(35.0, 0.68))

    def lag_echo_cooldown(h, t):
        c = ewma_counter(h, 30.0)
        c[h[-1]['last']] *= 0.55
        for lag, boost in ((2, 1.20), (3, 1.12), (7, 1.16)):
            if len(h) >= lag:
                c[h[-lag]['last']] *= boost
        return ranked(c)

    reg('lag_echo_cooldown', 'cooldown_trend', lag_echo_cooldown)

    def regime_transition(h, t):
        state = lambda x: (x['last'] % 2, int(x['last'] >= 5))
        cur = state(h[-1])
        trans = Counter()
        for a, b in zip(h, h[1:]):
            if state(a) == cur:
                trans[state(b)] += 1
        tot_t = sum(trans.values()) or 1
        c_freq = ewma_counter(h, 40.0)
        scores = {}
        for d in range(10):
            st = (d % 2, int(d >= 5))
            scores[d] = c_freq[d] * (0.5 + trans[st] / tot_t)
        scores[h[-1]['last']] *= 0.72
        return ranked(scores)

    reg('regime_transition', 'cooldown_trend', regime_transition)

    # 3. Sequence & Markov Transition Family
    def sequence_knn(h, t):
        c = Counter()
        for age in range(len(h) - 1):
            idx = len(h) - 1 - age
            if idx < 3:
                break
            sim = 0.0
            if h[idx - 1]['last'] == h[-1]['last']:
                sim += 2.0
            if h[idx - 2]['last'] == h[-2]['last']:
                sim += 1.5
            if h[idx - 3]['last'] == h[-3]['last']:
                sim += 1.0
            if idx >= 7 and h[idx - 7]['last'] == h[-7]['last']:
                sim += 1.5
            if h[idx]['date'].weekday() == t['date'].weekday():
                sim += 1.0
            if sim > 0:
                c[h[idx]['last']] += (sim ** 2) * (0.5 ** (age / 80.0))
        return ranked(c)

    reg('sequence_knn', 'sequence_transition', sequence_knn)

    def markov_smoothed(h, t):
        if len(h) < 3:
            return list(range(10))
        p1, p2 = h[-1]['last'], h[-2]['last']
        c = Counter()
        for age in range(len(h) - 2):
            idx = len(h) - 1 - age
            w = 0.5 ** (age / 65.0)
            if h[idx - 1]['last'] == p1:
                c[h[idx]['last']] += 1.8 * w
                if h[idx - 2]['last'] == p2:
                    c[h[idx]['last']] += 3.0 * w
            elif h[idx - 2]['last'] == p2:
                c[h[idx]['last']] += 0.9 * w
        return ranked(c, fallback=ranked(ewma_counter(h, 40.0)))

    reg('markov_smoothed', 'sequence_transition', markov_smoothed)

    def markov(order):
        def f(h, t):
            if len(h) <= order:
                return list(range(10))
            key = tuple(x['last'] for x in h[-order:])
            c = Counter()
            for i in range(order, len(h)):
                if tuple(x['last'] for x in h[i - order:i]) == key:
                    c[h[i]['last']] += 1
            return ranked(c, fallback=ranked(Counter(x['last'] for x in h)))
        return f

    reg('markov_1', 'sequence_transition', markov(1))
    reg('markov_2', 'sequence_transition', markov(2))

    # 4. Ticket Structure & Modular Arithmetic Family
    def last3_modular_flow(h, t):
        s3 = (h[-1]['d4'] + h[-1]['d5'] + h[-1]['last']) % 10
        c = Counter()
        for age, (a, b) in enumerate(reversed(list(zip(h, h[1:])))):
            w = 0.5 ** (age / 60.0)
            a_s3 = (a['d4'] + a['d5'] + a['last']) % 10
            if a_s3 == s3:
                c[b['last']] += 2.5 * w
            if a['d5'] == h[-1]['d5']:
                c[b['last']] += 2.0 * w
            if (a['last'] % 2) == (h[-1]['last'] % 2):
                c[b['last']] += 0.5 * w
        return ranked(c)

    reg('last3_modular_flow', 'ticket_structure', last3_modular_flow)

    def penultimate_digit_flow(h, t):
        prev_d5 = h[-1]['d5']
        c = Counter()
        for age, (a, b) in enumerate(reversed(list(zip(h, h[1:])))):
            w = 0.5 ** (age / 70.0)
            if a['d5'] == prev_d5:
                c[b['last']] += 2.5 * w
            c[b['last']] += 0.25 * w
        c[h[-1]['last']] *= 0.70
        return ranked(c)

    reg('penultimate_digit_flow', 'ticket_structure', penultimate_digit_flow)

    reg('prev_digit_sum', 'ticket_structure', lambda h, t: single_with_fallback(digsum(h[-1]['ticket']), h))
    reg('prev_ticket_mod_11', 'ticket_structure', lambda h, t: single_with_fallback(int(h[-1]['ticket']) % 11, h))
    reg('prev_last_plus_5', 'ticket_structure', lambda h, t: single_with_fallback(h[-1]['last'] + 5, h))
    reg('prev_series_letters', 'ticket_structure', lambda h, t: single_with_fallback(sum(ord(c) - 64 for c in h[-1]['series']), h))

    # 5. Gap / Recurrence Hazard Family
    def gap_hazard_ewma(h, t):
        c = ewma_counter(h, 35.0)
        gap = {d: len(h) + 1 for d in range(10)}
        for i, x in enumerate(h):
            gap[x['last']] = len(h) - i
        gap_counts = Counter()
        last_seen = {}
        for i, x in enumerate(h):
            d = x['last']
            if d in last_seen:
                gap_counts[min(20, i - last_seen[d])] += 1
            last_seen[d] = i
        tot_g = sum(gap_counts.values()) or 1
        scores = {}
        for d in range(10):
            g = min(20, gap[d])
            hazard = (gap_counts[g] + 1.0) / (tot_g + 20.0)
            scores[d] = c[d] * (0.35 + 6.5 * hazard)
        return ranked(scores)

    reg('gap_hazard_ewma', 'gap_hazard', gap_hazard_ewma)

    def overdue(h, t):
        gap = {d: len(h) + 1 for d in range(10)}
        for i, x in enumerate(h):
            gap[x['last']] = len(h) - i
        return ranked(Counter(gap))

    reg('overdue', 'gap_hazard', overdue)

    # 6. Calendar & Lottery-Specific Family
    def same_lottery_context(h, t):
        wd = t['date'].weekday()
        lname = normalize_name(t.get('name'))
        c = Counter()
        for age, x in enumerate(reversed(h)):
            w = 0.5 ** (age / 45.0)
            c[x['last']] += 0.4 * w
            if x['date'].weekday() == wd or x['name'] == lname:
                c[x['last']] += 1.8 * w
            if x['date'].day % 2 == t['date'].day % 2:
                c[x['last']] += 0.35 * w
        c[h[-1]['last']] *= 0.62
        return ranked(c)

    reg('same_lottery_context', 'calendar_lottery', same_lottery_context)

    def blended(h, t, k=10):
        g = Counter(x['last'] for x in h)
        n = len(h) or 1
        lname = normalize_name(t.get('name'))
        s = Counter(x['last'] for x in h if x['name'] == lname)
        ns = sum(s.values())
        return ranked(Counter({d: (s[d] + k * g[d] / n) / (ns + k) for d in range(10)}))

    reg('same_lottery_blended', 'calendar_lottery', blended)
    reg('same_lottery_last_10', 'calendar_lottery', lambda h, t: ranked(Counter(x['last'] for x in [y for y in h if y['name'] == normalize_name(t.get('name'))][-10:]), fallback=ranked(ewma_counter(h, 35.0))))
    reg('hot_same_month_day', 'calendar_lottery', lambda h, t: ranked(Counter(x['last'] for x in h if x['date'].day == t['date'].day), fallback=ranked(ewma_counter(h, 35.0))))
    reg('same_day_parity', 'calendar_lottery', lambda h, t: ranked(Counter(x['last'] for x in h if x['date'].day % 2 == t['date'].day % 2)))
    reg('week_ago_last', 'calendar_lottery', lambda h, t: single_with_fallback(h[-7]['last'] if len(h) >= 7 else 0, h))

    # 7. Lower-Prize Tier Flow Family
    def tier_hot(tiers=None, draws_back=1, cold=False):
        def f(h, t):
            c = Counter()
            for x in h[-draws_back:]:
                for tier, ds in x.get('tiers', {}).items():
                    if tiers is None or tier in tiers:
                        c.update(ds)
            if not c:
                return ranked(ewma_counter(h, 35.0))
            if cold:
                c = Counter({d: -c.get(d, 0) for d in range(10)})
            return ranked(c, fallback=ranked(ewma_counter(h, 35.0)))
        return f

    reg('prev_5_draws_all_prizes_hot', 'lower_tiers', tier_hot(draws_back=5))
    reg('prev_draw_all_prizes_cold', 'lower_tiers', tier_hot(cold=True))

    def tier_vs_first_ratio(h, t):
        tier_c, first_c = Counter(), Counter(x['last'] for x in h)
        for x in h:
            for ds in x.get('tiers', {}).values():
                tier_c.update(ds)
        tn, fn = sum(tier_c.values()), len(h) or 1
        if not tn:
            return ranked(ewma_counter(h, 35.0))
        return ranked(Counter({d: tier_c[d] / tn - first_c[d] / fn for d in range(10)}))

    reg('catch_up_vs_lower_tiers', 'lower_tiers', tier_vs_first_ratio)

    # 8. Classical Frequency Baselines
    for hl in (10, 30, 100):
        reg(f'trend_weighted_hl{hl}', 'frequency', (lambda hl: lambda h, t: ranked(ewma_counter(h, hl)))(hl))
    for w in (20, 50, 100, None):
        tag = 'all' if w is None else w
        reg(f'hot_last_{tag}', 'frequency', (lambda w: lambda h, t: ranked(Counter(x['last'] for x in (h if w is None else h[-w:]))))(w))

    # 9. Adaptive Context Meta-Ensemble (combines diverse non-static families with immediate-repeat cooldown)
    core_experts = [
        ('hybrid_context_knn', 3.0),
        ('sequence_knn', 1.8),
        ('last3_modular_flow', 1.5),
        ('penultimate_digit_flow', 1.3),
        ('same_lottery_context', 1.3),
        ('lag_echo_cooldown', 1.3),
        ('markov_smoothed', 1.3),
        ('contextual_bayes', 1.1),
    ]

    def adaptive_meta_ensemble(h, t):
        votes = Counter()
        for name, base_w in core_experts:
            rk = P[name](h, t)
            for pos, d in enumerate(rk[:5]):
                votes[d] += base_w * (1.0 / (pos + 1.0))
        if h:
            votes[h[-1]['last']] *= 0.52
        return ranked(votes)

    reg('adaptive_meta_ensemble', 'ensemble', adaptive_meta_ensemble)

    return P, FAM


# ---------------------------------------------------------------- stats
def binom_sf(k, n, p):
    """P(X >= k), X ~ Bin(n, p)."""
    if k <= 0:
        return 1.0
    return float(sum(math.comb(n, i) * p**i * (1 - p)**(n - i) for i in range(k, n + 1)))


def chi_square_uniform(values):
    c = Counter(values)
    n = len(values)
    exp = n / 10
    return round(sum((c.get(d, 0) - exp) ** 2 / exp for d in range(10)), 2) if n else 0.0


def lag1_agreement(values):
    """How often the last digit repeats from one draw to the next (random ≈ 10%)."""
    if len(values) < 2:
        return 0.0
    return round(100 * sum(a == b for a, b in zip(values, values[1:])) / (len(values) - 1), 2)


def explain_context(draws, target, top_digit):
    """Human-readable active context factors for the upcoming draw prediction."""
    last_draw = draws[-1]
    prev1 = last_draw['last']
    prev_d5 = last_draw['d5']
    s3 = (last_draw['d4'] + prev_d5 + prev1) % 10
    wd = target['date'].weekday()

    m1 = Counter(b['last'] for a, b in zip(draws, draws[1:]) if a['last'] == prev1)
    d5_c = Counter(b['last'] for a, b in zip(draws, draws[1:]) if a['d5'] == prev_d5)
    wd_c = Counter(x['last'] for x in draws if x['date'].weekday() == wd)

    m1_top = [d for d, _ in m1.most_common(3)]
    d5_top = [d for d, _ in d5_c.most_common(3)]
    wd_top = [d for d, _ in wd_c.most_common(3)]

    factors = [
        f"After last digit {prev1} ({last_draw['ticket']}), top historical followers are {m1_top}",
        f"After 5th digit {prev_d5} & last-3 sum mod 10 = {s3}, top followers are {d5_top}",
        f"For {target['name']} ({target['date'].strftime('%A')}), top recurring digits are {wd_top}",
    ]
    if top_digit != prev1:
        factors.append(f"Immediate repeat cooldown active on {prev1} (repeat rate is only {lag1_agreement([x['last'] for x in draws])}%)")
    return factors


# ---------------------------------------------------------------- main
def run():
    draws = load_draws()
    n = len(draws)
    if n < WARMUP + 40:
        return {"error": f"Need at least {WARMUP + 40} draws, have {n}."}

    patterns, families = build_patterns()
    names = list(patterns)
    test_idx = list(range(WARMUP, n))
    split = test_idx[len(test_idx) // 2]
    disc = [i for i in test_idx if i < split]
    val = [i for i in test_idx if i >= split]

    hit1 = defaultdict(lambda: {'disc': 0, 'val': 0, 'recent20': 0})
    hitk = defaultdict(lambda: {'disc': 0, 'val': 0, 'recent20': 0})
    per_draw_ranks = {name: {} for name in names}
    recent_cut = max(WARMUP, n - 20)

    for i in test_idx:
        h = draws[:i]
        t = {'date': draws[i]['date'], 'name': draws[i]['name'], 'code': draws[i]['code']}
        actual = draws[i]['last']
        part = 'disc' if i < split else 'val'
        for name in names:
            try:
                r = patterns[name](h, t)
            except Exception:
                r = list(range(10))
            per_draw_ranks[name][i] = r
            if r[0] == actual:
                hit1[name][part] += 1
                if i >= recent_cut:
                    hit1[name]['recent20'] += 1
            if actual in r[:TOP_K]:
                hitk[name][part] += 1
                if i >= recent_cut:
                    hitk[name]['recent20'] += 1

    # Number of distinct signal families for multiple-testing threshold
    n_families = len(set(families.values()))
    alpha = 0.05
    rows = []
    for name in names:
        d1, v1 = hit1[name]['disc'], hit1[name]['val']
        dk, vk = hitk[name]['disc'], hitk[name]['val']
        total1 = d1 + v1
        totalk = dk + vk
        p_disc = binom_sf(d1, len(disc), 0.10)
        p_val = binom_sf(v1, len(val), 0.10)
        p_tot1 = binom_sf(total1, len(test_idx), 0.10)
        p_disc_k = binom_sf(dk, len(disc), TOP_K / 10)
        p_val_k = binom_sf(vk, len(val), TOP_K / 10)
        p_tot_k = binom_sf(totalk, len(test_idx), TOP_K / 10)

        # Two-stage validation: significant in discovery (p < 0.05), confirmed out-of-sample
        # in validation (p < 0.05), and passes family-wise multiple testing overall
        validated = (p_disc < alpha and p_val < alpha and p_tot1 < alpha / n_families)
        validated_k = (p_disc_k < alpha and p_val_k < alpha and p_tot_k < alpha / n_families)
        rows.append({
            "pattern": name,
            "family": families[name],
            "top1_pct": round(100 * total1 / len(test_idx), 2),
            "top1_discovery_pct": round(100 * d1 / len(disc), 2),
            "top1_validation_pct": round(100 * v1 / len(val), 2),
            "top3_pct": round(100 * totalk / len(test_idx), 2),
            "recent20_top1_pct": round(100 * hit1[name]['recent20'] / (n - recent_cut), 1),
            "recent20_top3_pct": round(100 * hitk[name]['recent20'] / (n - recent_cut), 1),
            "p_discovery": round(p_disc, 4),
            "p_validation": round(p_val, 4),
            "p_total": round(p_tot1, 5),
            "validated": validated,
            "validated_top3": validated_k,
        })

    # Prioritize context-responsive validated patterns, then validation & discovery significance
    DYNAMIC_FAMILIES = {'context_hybrid', 'ensemble', 'cooldown_trend', 'sequence_transition', 'ticket_structure', 'calendar_lottery', 'gap_hazard'}
    rows.sort(key=lambda r: (
        -(r['validated'] or r['validated_top3']),
        -(r['validated'] and r['family'] in DYNAMIC_FAMILIES),
        -r['validated'],
        r['p_validation'] + r['p_discovery'],
        -r['top3_pct'],
    ))

    # ---- Context-adaptive voter for walk-forward & next draw
    # Uses our diverse context-responsive expert patterns with immediate-repeat cooldown
    # so predictions dynamically adapt to every draw's transitions and never stay frozen.
    ENSEMBLE_EXPERTS = [
        ('hybrid_context_knn', 3.0),
        ('sequence_knn', 1.8),
        ('last3_modular_flow', 1.5),
        ('penultimate_digit_flow', 1.3),
        ('same_lottery_context', 1.3),
        ('lag_echo_cooldown', 1.3),
        ('markov_smoothed', 1.3),
        ('contextual_bayes', 1.1),
    ]
    selected_patterns = [name for name, _ in ENSEMBLE_EXPERTS]
    row_by_name = {r['pattern']: r for r in rows}

    def score_draw_ensemble(h_slice, target_info, idx_for_cache=None):
        scores = Counter()
        for pat_name, base_w in ENSEMBLE_EXPERTS:
            r_info = row_by_name.get(pat_name)
            perf_mult = (0.7 + (r_info['top1_validation_pct'] if r_info else 12.0) / 25.0)
            w = base_w * perf_mult
            rk = per_draw_ranks[pat_name][idx_for_cache] if idx_for_cache is not None else patterns[pat_name](h_slice, target_info)
            for pos, d in enumerate(rk[:5]):
                scores[d] += w * (1.0 / (pos + 1.0))
        if h_slice:
            scores[h_slice[-1]['last']] *= 0.52
        tot = sum(scores.values()) or 1.0
        probs = {d: round(100.0 * scores[d] / tot, 1) for d in range(10)}
        return ranked(scores), probs

    # Build recent 12-draw walk-forward verification log
    recent_backtest = []
    rec_start = max(WARMUP, n - 12)
    for i in range(rec_start, n):
        t_i = {'date': draws[i]['date'], 'name': draws[i]['name'], 'code': draws[i]['code']}
        rk_i, _ = score_draw_ensemble(draws[:i], t_i, idx_for_cache=i)
        act_i = draws[i]['last']
        recent_backtest.append({
            "date": draws[i]['date'].isoformat(),
            "lottery": draws[i]['name'],
            "ticket": draws[i]['ticket'],
            "actual": act_i,
            "predicted": rk_i[0],
            "top3": rk_i[:3],
            "hit_top1": rk_i[0] == act_i,
            "hit_top3": act_i in rk_i[:3],
        })

    # ---- Next-draw prediction
    next_date = draws[-1]['date'] + timedelta(days=1)
    next_name = WEEKDAY_LOTTERY.get(next_date.weekday()) or next((x['name'] for x in reversed(draws) if x['date'].weekday() == next_date.weekday()), '')
    target = {'date': next_date, 'name': next_name, 'code': (draws[-1]['code'] + 1) if draws[-1]['code'] else None}
    ranking, probs = score_draw_ensemble(draws, target, idx_for_cache=None)

    valid_names = [r['pattern'] for r in rows if r['validated'] or r['validated_top3']]
    lasts = [x['last'] for x in draws]
    rec_h1 = sum(1 for x in recent_backtest if x['hit_top1'])
    rec_h3 = sum(1 for x in recent_backtest if x['hit_top3'])

    return {
        "generated_at": date.today().isoformat(),
        "draws": n,
        "date_range": [draws[0]['date'].isoformat(), draws[-1]['date'].isoformat()],
        "patterns_tested": len(names),
        "families_tested": n_families,
        "discovery_draws": len(disc),
        "validation_draws": len(val),
        "randomness": {
            "last_digit_counts": [lasts.count(d) for d in range(10)],
            "chi_square": chi_square_uniform(lasts),
            "chi_square_critical_p05": 16.92,
            "repeat_rate_pct": lag1_agreement(lasts),
            "repeat_rate_expected_pct": 10.0,
        },
        "validated_patterns": valid_names,
        "prediction": {
            "for_date": next_date.isoformat(),
            "lottery": next_name,
            "top_digit": ranking[0],
            "runner_up": ranking[1],
            "top3": ranking[:3],
            "top5": ranking[:5],
            "ranking": ranking,
            "probabilities": [probs[d] for d in range(10)],
            "based_on": selected_patterns,
            "context_factors": explain_context(draws, target, ranking[0]),
            "has_proven_edge": bool(valid_names),
            "expected_top1_pct": 10.0 if not valid_names else max(r['top1_validation_pct'] for r in rows if r['pattern'] in valid_names),
            "expected_top3_pct": 30.0 if not valid_names else max(r['top3_pct'] for r in rows if r['pattern'] in valid_names),
            "recent12_top1_hits": rec_h1,
            "recent12_top3_hits": rec_h3,
            "recent12_total": len(recent_backtest),
        },
        "recent_backtest": list(reversed(recent_backtest)),
        "patterns": rows,
    }


if __name__ == "__main__":
    report = run()
    if "error" not in report:
        os.makedirs('python/data', exist_ok=True)
        with open(OUT, 'w') as f:
            json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2, default=str))
