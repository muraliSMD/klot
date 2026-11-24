"use client";
import { useCallback, useEffect, useState } from "react";

const LABELS = {
  adaptive_meta_ensemble: "Adaptive Context Meta-Ensemble",
  hybrid_context_knn: "Hybrid Context k-NN + Cooldown",
  hybrid_context_balanced: "Hybrid Context Balanced (k-NN + EWMA)",
  contextual_bayes: "Contextual Naïve Bayes (Multi-Lag + Weekday)",
  cooldown_ewma_35: "Cooldown-Adjusted EWMA (hl=35)",
  lag_echo_cooldown: "Lag-2/3/7 Echo + Repeat Cooldown",
  regime_transition: "Parity & High/Low Regime Transition",
  sequence_knn: "Multi-Lag Sequence Similarity (k-NN)",
  markov_smoothed: "Smoothed Order-1/2 Markov Transition",
  last3_modular_flow: "Last-3 Digits Modular Sum & 5th-Digit Flow",
  penultimate_digit_flow: "Penultimate (5th) Digit Transition Flow",
  gap_hazard_ewma: "Recurrence Gap Hazard + EWMA",
  same_lottery_context: "Same-Lottery & Weekday Context Flow",
  hot_last_all: "Most frequent digit (all history)",
  hot_last_50: "Most frequent (last 50)",
  hot_last_20: "Most frequent (last 20)",
  hot_last_100: "Most frequent (last 100)",
  hot_same_month_day: "Most frequent on same day-of-month",
  hot_same_weekday: "Most frequent on same weekday",
  hot_same_lottery: "Most frequent for same lottery",
  overdue: "Overdue digit",
  markov_1: "Follows previous digit (Markov-1)",
  markov_2: "Follows previous 2 digits (Markov-2)",
  prev_digit_sum: "Sum of previous ticket digits",
  prev_ticket_mod_11: "Previous ticket modulo 11",
  prev_last_plus_5: "Previous last digit + 5 (mirror step)",
  prev_series_letters: "Previous series letters value",
  trend_weighted_hl10: "Trend-weighted frequency (fast)",
  trend_weighted_hl30: "Trend-weighted frequency (medium)",
  trend_weighted_hl100: "Trend-weighted frequency (slow)",
  same_lottery_blended: "Same lottery (smoothed)",
  same_lottery_last_10: "Same lottery (last 10 draws)",
  same_day_parity: "Same odd/even date",
  week_ago_last: "Same weekday last week (Lag-7)",
  combined_frequency_vote: "Combined frequency vote",
  prev_5_draws_all_prizes_hot: "Hot in last 5 draws' lower prizes",
  prev_draw_all_prizes_hot: "Hot in previous draw's lower prizes",
  prev_draw_all_prizes_cold: "Cold in previous draw's lower prizes",
  catch_up_vs_lower_tiers: "Catch-up vs lower prizes",
};

const FAMILY_LABELS = {
  ensemble: "Meta-Ensemble",
  context_hybrid: "Context Hybrid",
  cooldown_trend: "Cooldown & Regime",
  sequence_transition: "Markov / Sequence",
  ticket_structure: "Ticket Structure",
  gap_hazard: "Gap Hazard",
  calendar_lottery: "Lottery & Calendar",
  lower_tiers: "Prize Tiers",
  frequency: "Base Frequency",
};

const label = (p) => LABELS[p] || p.replace(/_/g, " ");
const familyLabel = (f) => FAMILY_LABELS[f] || f || "Pattern";

const STALE_MS = 6 * 60 * 60 * 1000; // auto re-scan if the report is older than 6h

export default function LastDigitPatterns() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const scan = useCallback(async ({ auto = false } = {}) => {
    setBusy(true);
    setError("");
    setNotice(auto ? "Report was out of date — running a fresh scan automatically…" : "");
    setElapsed(0);
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    try {
      const r = await fetch(`/api/klr/last-digit-patterns?t=${t0}`, { method: "POST", cache: "no-store" });
      const text = await r.text();
      let j;
      try {
        j = JSON.parse(text);
      } catch {
        throw new Error(`Server returned an unexpected response (HTTP ${r.status}). Check the dev server terminal.`);
      }
      if (!r.ok || !j.available) throw new Error(j.error || "Scan failed");
      setData((prev) => {
        const before = prev?.prediction?.top_digit;
        const after = j.prediction?.top_digit;
        const synced = j.scan?.synced?.upserted;
        setNotice(
          `✓ Scan complete in ${Math.round((j.scan?.ms || Date.now() - t0) / 1000)}s · ${j.draws} draws analysed` +
            (synced != null ? ` · ${synced} results synced` : "") +
            (before != null && before !== after ? ` · prediction updated ${before} → ${after}` : " · prediction confirmed")
        );
        return j;
      });
      setFlash(true);
      setTimeout(() => setFlash(false), 1600);
    } catch (e) {
      setNotice("");
      setError(e.message);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/klr/last-digit-patterns?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setData(d);
        const age = d.scanned_at ? Date.now() - new Date(d.scanned_at).getTime() : Infinity;
        if (!d.available || age > STALE_MS) scan({ auto: true });
      })
      .catch(() => !cancelled && scan({ auto: true }));
    return () => {
      cancelled = true;
    };
  }, [scan]);

  const pred = data?.prediction;
  const rows = data?.patterns || [];
  const shown = showAll ? rows : rows.slice(0, 10);
  const recentBacktest = data?.recent_backtest || [];
  const probs = pred?.probabilities || [];
  const maxProb = Math.max(1, ...probs);

  return (
    <section className="glass-card rounded-[2rem] p-6 sm:p-8" aria-labelledby="ldp-title">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ldp-title" className="font-outfit text-xl font-bold text-white">Adaptive Context Pattern Engine</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data?.available
              ? `${data.patterns_tested} patterns across ${data.families_tested || 9} signal families tested walk-forward on ${data.draws} draws (${data.date_range?.[0]} → ${data.date_range?.[1]})`
              : "Combines multi-lag Markov transitions, 5th-digit & last-3 modular structure, recurrence gap hazard, and repeat cooldown"}
          </p>
          {data?.scanned_at && (
            <p className="mt-0.5 text-[11px] font-bold text-white/50">Last scanned: {new Date(data.scanned_at).toLocaleString()}</p>
          )}
        </div>
        <button id="scan-patterns" type="button" onClick={() => scan()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-102 disabled:opacity-60">
          {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          {busy ? `Scanning… ${elapsed}s` : "Scan patterns"}
        </button>
      </div>

      {notice && (
        <p role="status" className={`mb-4 rounded-xl border p-3 text-xs font-bold ${busy ? "border-purple-500/30 bg-purple-500/10 text-purple-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>{notice}</p>
      )}
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}

      {!data ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
      ) : !data.available ? (
        <p className="text-sm text-muted-foreground">{busy ? "Running the first scan…" : data.message}</p>
      ) : (
        <div className={`space-y-6 transition-opacity ${busy ? "opacity-50" : ""}`}>
          <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
            {/* Prediction card */}
            <div className={`flex flex-col justify-between rounded-3xl border bg-gradient-to-br from-emerald-500/15 via-transparent to-purple-500/15 p-6 text-center transition-all duration-500 ${flash ? "scale-102 border-emerald-400/70 shadow-[0_0_40px_rgba(16,185,129,0.35)]" : "border-white/10"}`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Next draw · {pred.for_date}{pred.lottery ? ` · ${pred.lottery}` : ""}</p>
                <div className="my-3 font-outfit text-7xl font-black text-emerald-300 drop-shadow-[0_0_25px_rgba(16,185,129,0.35)]">{pred.top_digit}</div>
                <div className="mb-2 flex justify-center gap-2">
                  {pred.top3.map((d, i) => (
                    <span key={d} className={`flex h-10 w-10 flex-col items-center justify-center rounded-xl border font-mono text-sm font-black ${i === 0 ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200" : "border-white/15 bg-white/5 text-white/85"}`}>
                      <span>{d}</span>
                      {probs[d] != null && <span className="text-[9px] font-normal text-white/60">{probs[d]}%</span>}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Top 3 shortlist{pred.top5 ? ` · Backup: ${pred.top5.slice(3).join(", ")}` : ""}
                </p>

                {/* Active context signals */}
                {pred.context_factors?.length > 0 && (
                  <div className="mt-4 space-y-1.5 rounded-2xl border border-white/10 bg-black/30 p-3 text-left">
                    <p className="text-[10px] font-black uppercase tracking-wider text-purple-300">Active draw context</p>
                    {pred.context_factors.map((cf, idx) => (
                      <p key={idx} className="text-[11px] leading-snug text-white/75">• {cf}</p>
                    ))}
                  </div>
                )}

                {/* Per-digit confidence bars */}
                {probs.length === 10 && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
                    <p className="mb-2 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">Digit confidence weights (0–9)</p>
                    <div className="flex h-16 items-end gap-1">
                      {probs.map((p, d) => {
                        const isTop1 = d === pred.top_digit;
                        const isTop3 = pred.top3.includes(d);
                        return (
                          <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Digit ${d}: ${p}% ensemble weight`}>
                            <div
                              className={`w-full rounded-t ${isTop1 ? "bg-emerald-400" : isTop3 ? "bg-purple-400" : "bg-white/20"}`}
                              style={{ height: `${Math.max(6, (p / maxProb) * 100)}%` }}
                            />
                            <span className={`font-mono text-[10px] font-black ${isTop1 ? "text-emerald-300" : isTop3 ? "text-purple-200" : "text-white/50"}`}>{d}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className={`mt-4 rounded-xl border p-3 text-[11px] font-medium leading-relaxed ${pred.has_proven_edge ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
                {pred.has_proven_edge
                  ? `Context-adaptive ensemble backed by ${data.validated_patterns.length} validated patterns. Out-of-sample hit rate: ~${pred.expected_top1_pct}% (Top 1), ~${pred.expected_top3_pct}% (Top 3).`
                  : "No pattern passed validation yet — this is the best-ranked context estimate (~10% Top 1 / ~30% Top 3 baseline)."}
              </div>
            </div>

            {/* Patterns table */}
            <div className="min-w-0">
              <div className="mb-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Validated</p>
                  <p className="font-outfit text-2xl font-black text-emerald-300">{data.validated_patterns.length}</p>
                  <p className="text-[10px] text-muted-foreground">across {data.families_tested || 9} families</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Last 12 Draws</p>
                  <p className="font-outfit text-2xl font-black text-white">
                    {pred.recent12_top1_hits ?? 0}/{pred.recent12_total ?? 12}
                  </p>
                  <p className="text-[10px] text-emerald-300">Exact · {pred.recent12_top3_hits ?? 0}/{pred.recent12_total ?? 12} Top-3</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Repeat rate</p>
                  <p className="font-outfit text-2xl font-black text-white">{data.randomness.repeat_rate_pct}%</p>
                  <p className="text-[10px] text-muted-foreground">cooldown active (&lt;10%)</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Digit skew χ²</p>
                  <p className={`font-outfit text-2xl font-black ${data.randomness.chi_square > data.randomness.chi_square_critical_p05 ? "text-amber-300" : "text-white"}`}>{data.randomness.chi_square}</p>
                  <p className="text-[10px] text-muted-foreground">random &lt; {data.randomness.chi_square_critical_p05}</p>
                </div>
              </div>

              <div className="overflow-x-auto scrollbar-hide rounded-2xl border border-white/5">
                <table className="w-full min-w-[580px] text-left text-xs">
                  <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="p-3">Pattern</th>
                      <th className="p-3">Family</th>
                      <th className="p-3 text-right" title="First half of tested draws">Discovery</th>
                      <th className="p-3 text-right" title="Second half — unseen while discovering">Validation</th>
                      <th className="p-3 text-right">Top-3</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {shown.map((r) => {
                      const consistent = r.top1_discovery_pct > 12 && r.top1_validation_pct > 12;
                      return (
                        <tr key={r.pattern} className="transition-colors hover:bg-white/[0.03]">
                          <td className="p-3 font-bold text-white/85">{label(r.pattern)}</td>
                          <td className="p-3">
                            <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-purple-200">
                              {familyLabel(r.family)}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-mono ${r.top1_discovery_pct > 10 ? "text-emerald-300" : "text-white/60"}`}>{r.top1_discovery_pct}%</td>
                          <td className={`p-3 text-right font-mono ${r.top1_validation_pct > 10 ? "text-emerald-300" : "text-white/60"}`}>{r.top1_validation_pct}%</td>
                          <td className="p-3 text-right font-mono text-white/70">{r.top3_pct}%</td>
                          <td className="p-3 text-center">
                            {r.validated || r.validated_top3 ? (
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">✓ Proven</span>
                            ) : consistent ? (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-300">Promising</span>
                            ) : (
                              <span className="text-[10px] font-bold text-white/30">Chance</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 && (
                <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-3 text-xs font-bold text-purple-300 hover:text-purple-200">
                  {showAll ? "Show fewer" : `Show all ${rows.length} patterns`}
                </button>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                Random guessing scores 10% (Top-1) / 30% (Top-3). Our ensemble combines context-responsive patterns across distinct signal families so predictions adapt dynamically after every draw instead of locking onto a single static frequent digit.
              </p>
            </div>
          </div>

          {/* Walk-forward recent draw verification */}
          {recentBacktest.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-outfit text-sm font-bold text-white">Walk-Forward Verification (Last {recentBacktest.length} Draws)</h3>
                  <p className="text-[11px] text-muted-foreground">What the context algorithm predicted before each draw vs actual winning last digit</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] text-emerald-300">
                    {pred.recent12_top1_hits}/{pred.recent12_total} Exact Top-1 ({Math.round((100 * (pred.recent12_top1_hits || 0)) / (pred.recent12_total || 1))}%)
                  </span>
                  <span className="rounded-full border border-purple-500/40 bg-purple-500/15 px-2.5 py-0.5 text-[11px] text-purple-200">
                    {pred.recent12_top3_hits}/{pred.recent12_total} in Top-3 ({Math.round((100 * (pred.recent12_top3_hits || 0)) / (pred.recent12_total || 1))}%)
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                {recentBacktest.map((item) => (
                  <div
                    key={item.date}
                    className={`rounded-xl border p-3 text-xs transition-all ${
                      item.hit_top1
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : item.hit_top3
                        ? "border-purple-500/35 bg-purple-500/10"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-mono">{item.date}</span>
                      {item.hit_top1 ? (
                        <span className="font-black text-emerald-300">✓ EXACT</span>
                      ) : item.hit_top3 ? (
                        <span className="font-black text-purple-300">✓ TOP-3</span>
                      ) : (
                        <span className="text-white/30">miss</span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-[11px] font-bold text-white/85">{item.lottery}</div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-muted-foreground">Pred: </span>
                        <span className="font-mono text-base font-black text-white">{item.predicted}</span>
                        <span className="ml-1 font-mono text-[10px] text-white/50">[{item.top3.join(",")}]</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground">Won: </span>
                        <span className={`font-mono text-base font-black ${item.hit_top1 ? "text-emerald-300" : item.hit_top3 ? "text-purple-200" : "text-amber-300"}`}>
                          {item.actual}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
