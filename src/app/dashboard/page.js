"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import LastDigitPatterns from "@/app/components/LastDigitPatterns";

function lastDigit(ticket) {
  const d = String(ticket || "").replace(/\D/g, "");
  return d ? d[d.length - 1] : "–";
}

export default function DashboardOverview() {
  const [recent, setRecent] = useState(null);

  useEffect(() => {
    fetch("/api/klr/archive?pageSize=10")
      .then((r) => r.json())
      .then((d) => setRecent(d.items || []))
      .catch(() => setRecent([]));
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
          🎯 Last digit only
        </div>
        <h1 className="font-outfit text-4xl font-black tracking-tight">Last-Digit Prediction</h1>
        <p className="font-medium text-muted-foreground">The final digit of the 1st-prize ticket, analysed across every stored draw.</p>
      </div>

      <LastDigitPatterns />

      <section className="glass-card rounded-[2rem] p-6 sm:p-8" aria-labelledby="recent-title">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="recent-title" className="font-outfit text-xl font-bold text-white">Recent winning last digits</h2>
          <Link href="/dashboard/archive" className="text-xs font-bold text-purple-300 hover:text-purple-200">Full archive →</Link>
        </div>
        {!recent ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {recent.map((it) => (
              <div key={it.id} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center transition-transform hover:-translate-y-0.5">
                <div className="font-outfit text-4xl font-black text-emerald-300">{lastDigit(it.first_ticket)}</div>
                <div className="mt-1 truncate text-[11px] font-bold text-white/80">{it.draw_name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{it.date}</div>
                <div className="mt-1 font-mono text-[10px] text-white/40">{it.first_ticket}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
