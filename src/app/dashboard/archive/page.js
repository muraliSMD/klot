"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

const PRIZE_ORDER = ["1st", "consolation", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function splitTicket(ticket) {
  const s = String(ticket || "").trim();
  const m = s.match(/^([A-Z]{1,4})\s*-?\s*(\d{3,6})$/i);
  return m ? { series: m[1].toUpperCase(), digits: m[2] } : { series: "", digits: s.replace(/\D/g, "") || s };
}

function TicketBadge({ ticket }) {
  const { series, digits } = splitTicket(ticket);
  const head = digits.slice(0, -1);
  const last = digits.slice(-1);
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#10131c] px-3 py-1.5 shadow-lg">
      {series && (
        <span className="rounded-md border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
          {series}
        </span>
      )}
      <span className="font-mono text-sm font-black tracking-widest text-amber-300 md:text-base">
        {head}
        <span className="rounded bg-emerald-500/25 px-0.5 text-emerald-300">{last}</span>
      </span>
    </span>
  );
}

function PrizeTiers({ prizes }) {
  const amounts = prizes?.amounts || {};
  const tiers = PRIZE_ORDER.filter((k) => Array.isArray(prizes?.[k]) && prizes[k].length);
  if (!tiers.length) return <p className="text-xs text-muted-foreground">Detailed prize tiers are not available for this draw.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((k) => (
        <div key={k} className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-purple-300">{k === "consolation" ? "Consolation" : `${k} prize`}</span>
            {amounts[k] && <span className="text-[11px] font-bold text-amber-300">₹{amounts[k]}</span>}
          </div>
          <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto scrollbar-hide">
            {prizes[k].map((t, i) => (
              <span key={i} className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white/85">{t}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DigitChart({ counts, uniformity, activeDigit, onPick }) {
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  return (
    <div className="glass-card rounded-[2rem] p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-outfit text-xl font-bold text-white">Last-digit distribution</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{total} draws in current filter · click a bar to filter</p>
        </div>
        {uniformity && (
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-black ${
              uniformity.looksRandom ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-amber-500/40 bg-amber-500/15 text-amber-300"
            }`}
            title={`Chi-square ${uniformity.chiSquare} vs critical ${uniformity.critical} (p=0.05)`}
          >
            {uniformity.looksRandom ? "✓ Consistent with random draws" : "⚠ Uneven distribution (statistically significant)"}
          </span>
        )}
      </div>
      <div className="flex h-44 items-end gap-2 sm:gap-3">
        {counts.map((c, d) => {
          const active = String(activeDigit) === String(d);
          return (
            <button
              key={d}
              id={`digit-bar-${d}`}
              type="button"
              onClick={() => onPick(active ? "" : String(d))}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
              aria-pressed={active}
              aria-label={`Last digit ${d}: ${c} draws`}
            >
              <span className="text-[10px] font-bold text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {total ? ((100 * c) / total).toFixed(1) : 0}%
              </span>
              <div
                className={`w-full rounded-t-xl transition-all duration-500 ${
                  active ? "bg-gradient-to-t from-emerald-600 to-emerald-300 shadow-lg shadow-emerald-500/30" : "bg-gradient-to-t from-purple-700/70 to-fuchsia-400/80 group-hover:to-fuchsia-300"
                }`}
                style={{ height: `${Math.max(4, (c / max) * 100)}%` }}
              />
              <span className={`font-mono text-sm font-black ${active ? "text-emerald-300" : "text-white/80"}`}>{d}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        Each digit is expected ~10% of the time. Small differences between bars are normal random variation and do not predict the next draw.
      </p>
    </div>
  );
}

function ModelPerformance() {
  const [data, setData] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/klr/model-performance").then((r) => r.json()).then(setData).catch(() => setData({ available: false }));
  }, []);

  const rerun = async () => {
    setRunning(true);
    setError("");
    try {
      const r = await fetch("/api/klr/model-performance", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Backtest failed");
      setData(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const labels = { random: "Random guess", most_frequent: "Most frequent", repeat_last: "Repeat last", logistic: "Logistic regression", random_forest: "Random forest", context_pattern: "Hybrid context pattern" };

  return (
    <div className="glass-card rounded-[2rem] p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-outfit text-xl font-bold text-white">Model performance — last digit</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Walk-forward backtest vs the 10% random baseline
            {data?.generated_at && ` · updated ${new Date(data.generated_at).toLocaleString()}`}
          </p>
        </div>
        <button
          id="rerun-backtest"
          type="button"
          onClick={rerun}
          disabled={running}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-102 disabled:opacity-50"
        >
          {running ? "Running… (~30s)" : "Re-run backtest"}
        </button>
      </div>

      {error && <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}

      {!data ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : !data.available ? (
        <p className="text-sm text-muted-foreground">{data.message || "No report yet."}</p>
      ) : (
        <>
          <div className="space-y-3">
            {data.results.map((m) => {
              const [lo, hi] = m.ci95_pct;
              const scale = (v) => `${Math.min(100, (v / 30) * 100)}%`;
              return (
                <div key={m.model} className="grid grid-cols-[8.5rem_1fr_4rem] items-center gap-3 sm:grid-cols-[11rem_1fr_5rem]">
                  <span className="truncate text-xs font-bold text-white/85">{labels[m.model] || m.model}</span>
                  <div className="relative h-6 rounded-lg bg-white/5">
                    <div className="absolute inset-y-0 w-px bg-amber-400/80" style={{ left: scale(data.baseline_pct) }} title="10% random baseline" />
                    <div className="absolute inset-y-1.5 rounded bg-purple-500/25" style={{ left: scale(lo), width: `calc(${scale(hi)} - ${scale(lo)})` }} />
                    <div
                      className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${m.beats_random ? "bg-emerald-400" : "bg-fuchsia-300"}`}
                      style={{ left: scale(m.accuracy_pct) }}
                    />
                  </div>
                  <span className="text-right font-mono text-xs font-black text-white">{m.accuracy_pct}%</span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-amber-400" /> 10% baseline</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded bg-purple-500/40" /> 95% range</span>
            <span>{data.draws_tested} draws tested</span>
          </div>
          <p className={`mt-4 rounded-xl border p-3 text-xs font-medium ${data.results.some((r) => r.beats_random) ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5 text-white/75"}`}>
            {data.results.some((r) => r.beats_random)
              ? "A model shows a statistically significant edge in this window. Re-check as more draws arrive — edges that are real persist."
              : "No model beats random guessing. Every range overlaps 10%, so predicted last digits should be treated as entertainment, not a signal."}
          </p>
        </>
      )}
    </div>
  );
}

export default function ArchivePage() {
  const [q, setQ] = useState("");
  const [lottery, setLottery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [digit, setDigit] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const dq = useDebounced(q);

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (dq) p.set("q", dq);
    if (lottery) p.set("lottery", lottery);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (digit) p.set("digit", digit);
    return p.toString();
  }, [dq, lottery, from, to, digit, page]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/klr/archive?${query}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: "Failed to load" }))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(load, [load]);
  useEffect(() => setPage(1), [dq, lottery, from, to, digit]);

  const sync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const r = await fetch("/api/cron/sync-history", { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } });
      const j = await r.json();
      setSyncMsg(j.success ? `Synced ${j.upserted} draws · ${j.stored} stored` : j.error || "Sync failed");
      if (j.success) load();
    } catch {
      setSyncMsg("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const exportCsv = () => {
    const rows = [["date", "draw_name", "draw_code", "first_ticket", "last_digit"], ...(data?.items || []).map((i) => [i.date, i.draw_name, i.draw_code, i.first_ticket, i.lastDigit])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `klot-archive-page${page}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const clearFilters = () => { setQ(""); setLottery(""); setFrom(""); setTo(""); setDigit(""); };
  const hasFilters = q || lottery || from || to || digit;
  const inputCls = "bg-[#121520] border border-white/15 rounded-xl px-4 py-2.5 text-xs font-medium outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-white placeholder:text-muted-foreground";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
            🗄️ Stored in your database
          </div>
          <h1 className="font-outfit text-4xl font-black tracking-tight">Results Archive</h1>
          <p className="font-medium text-muted-foreground">Every Kerala lottery draw we have recorded, with full prize tiers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button id="sync-archive" type="button" onClick={sync} disabled={syncing} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-white/10 disabled:opacity-50">
            {syncing ? "Syncing…" : "↻ Sync now"}
          </button>
          <button id="export-archive" type="button" onClick={exportCsv} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-102">
            ⬇ Export CSV
          </button>
        </div>
      </div>
      {syncMsg && <p className="-mt-4 text-xs font-bold text-emerald-300">{syncMsg}</p>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Draws stored", data?.archive?.count ?? "—", "from-purple-500/20"],
          ["Oldest record", data?.archive?.oldest ?? "—", "from-cyan-500/20"],
          ["Latest record", data?.archive?.newest ?? "—", "from-emerald-500/20"],
          ["Lotteries", data?.lotteries?.length ?? "—", "from-amber-500/20"],
        ].map(([label, value, grad]) => (
          <div key={label} className={`glass-card rounded-2xl bg-gradient-to-br ${grad} to-transparent p-5 transition-transform hover:-translate-y-0.5`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="mt-1 font-outfit text-xl font-black text-white sm:text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DigitChart counts={data?.lastDigitCounts || Array(10).fill(0)} uniformity={data?.uniformity} activeDigit={digit} onPick={setDigit} />
        <ModelPerformance />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden rounded-[2rem]">
        <div className="flex flex-col gap-4 border-b border-white/5 bg-white/[0.02] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-outfit text-xl font-bold text-white">Draw records</h2>
            <span className="text-xs text-muted-foreground">
              {data?.total ?? 0} matches{digit && ` · last digit ${digit}`}
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="ml-3 font-bold text-purple-300 hover:text-purple-200">Clear filters</button>
              )}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input id="archive-search" className={`${inputCls} lg:col-span-2`} placeholder="Search ticket, series, draw code…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select id="archive-lottery" className={`${inputCls} cursor-pointer`} value={lottery} onChange={(e) => setLottery(e.target.value)}>
              <option value="">All lotteries</option>
              {data?.lotteries?.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input id="archive-from" type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <input id="archive-to" type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {loading && !data?.items ? (
            Array.from({ length: 6 }).map((_, i) => <div key={i} className="m-4 h-14 animate-pulse rounded-xl bg-white/5" />)
          ) : data?.error ? (
            <p className="p-16 text-center text-sm font-bold text-rose-300">{data.error}</p>
          ) : data?.items?.length === 0 ? (
            <p className="p-16 text-center text-sm font-bold text-muted-foreground">No draws match these filters.</p>
          ) : (
            data?.items?.map((it) => {
              const open = expanded === it.id;
              return (
                <div key={it.id} className={`transition-colors ${open ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"} ${loading ? "opacity-60" : ""}`}>
                  <button
                    type="button"
                    id={`draw-${it.id}`}
                    onClick={() => setExpanded(open ? null : it.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 py-4 text-left sm:grid-cols-[7rem_1fr_auto_auto] sm:px-8"
                    aria-expanded={open}
                  >
                    <span className="font-mono text-xs font-bold text-white/60 sm:text-sm">{it.date}</span>
                    <span className="order-first col-span-2 sm:order-none sm:col-span-1">
                      <span className="font-outfit text-sm font-bold text-white sm:text-base">{it.draw_name}</span>
                      {it.draw_code && <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{it.draw_code}</span>}
                    </span>
                    <TicketBadge ticket={it.first_ticket} />
                    <span className={`hidden text-white/40 transition-transform sm:inline ${open ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  {open && (
                    <div className="animate-in fade-in px-5 pb-6 sm:px-8">
                      <PrizeTiers prizes={it.prizes} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {data?.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/5 px-6 py-4 sm:px-8">
            <button id="archive-prev" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/5 disabled:opacity-30">
              ← Prev
            </button>
            <span className="text-xs font-bold text-muted-foreground">Page {data.page} of {data.totalPages}</span>
            <button id="archive-next" type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/5 disabled:opacity-30">
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
