"use client";
import { useEffect, useState } from "react";
import API from "@/app/lib/api";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";

export default function DashboardPage() {
  const [freqData, setFreqData] = useState(null);
  const [stats, setStats] = useState({ total: 0, topDigit: null });
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    API.get("/klr/analysis?limit=100")
      .then(res => {
        if (res.data && res.data.freq) {
          const d = res.data.freq.map(item => ({ 
            digit: item.digit.toString(), 
            count: item.count 
          }));
          setFreqData(d);
          
          const max = [...d].sort((a,b) => b.count - a.count)[0];
          setStats({
            total: res.data.totalDigits,
            topDigit: max ? max.digit : null
          });
        } else {
          setFreqData([]);
        }
      })
      .catch(err => {
        console.error("Error fetching analysis:", err.message);
        setFreqData([]);
      });

    API.get("/klr/check-today")
      .then(res => {
        if (res.data.data) {
          setPrediction({ ...res.data.data, trend: res.data.trend });
        } else if (res.data.disabled) {
          setPrediction({ disabled: true, message: res.data.message });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass p-4 rounded-2xl border border-white/10 shadow-2xl">
          <p className="text-muted-foreground text-xs uppercase tracking-widest font-bold mb-1">Digit {payload[0].payload.digit}</p>
          <p className="text-2xl font-black text-primary">{payload[0].value} <span className="text-sm font-normal text-white/50">occurrences</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black font-outfit tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Deep dive into lottery patterns and digit frequencies.</p>
        </div>
        <div className="flex gap-4">
          <div className="glass px-6 py-3 rounded-2xl border border-white/5">
            <span className="text-xs text-muted-foreground uppercase font-bold block">Total Analyzed</span>
            <span className="text-xl font-black text-white">{stats.total} Digits</span>
          </div>
          <div className="glass px-6 py-3 rounded-2xl border border-primary/20">
            <span className="text-xs text-primary uppercase font-bold block">Hottest Digit</span>
            <span className="text-xl font-black text-primary">{stats.topDigit || "-"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8 rounded-[2.5rem] relative overflow-hidden">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-xl font-bold font-outfit">Frequency Distribution</h2>
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-white/5 px-4 py-2 rounded-full">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              LIVE DATA
            </div>
          </div>

          <div className="h-[300px] w-full">
            {freqData ? (
              freqData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={freqData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="digit" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700 }}
                    />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                      {freqData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.digit === stats.topDigit ? "hsl(var(--primary))" : "url(#barGradient)"} 
                          className="transition-all duration-300 hover:opacity-100 opacity-80"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground glass rounded-3xl">
                  No recent data available for analysis
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        {/* Prediction Preview Card */}
        <div className="glass-card p-8 rounded-[2rem] bg-primary/5 border-primary/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-outfit text-primary">Live Prediction</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${prediction?.disabled ? "bg-red-500/20 text-red-500" : "bg-primary/20 text-primary animate-pulse"}`}>
                {prediction?.disabled ? "CLOSED" : "ACTIVE"}
              </span>
            </div>
            {prediction ? (
              prediction.disabled ? (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">Service available 11AM - 1PM IST</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2 justify-center">
                    {prediction.predictedNumbers[0].split("").map((d, i) => (
                      <div key={i} className="w-8 h-10 bg-[#08080a] border border-white/5 rounded-lg flex items-center justify-center text-lg font-black">{d}</div>
                    ))}
                  </div>
                  <div className="text-center text-xs text-muted-foreground italic">Strategy: Hot-Positional</div>
                </div>
              )
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">Generating new ensemble...</div>
            )}
          </div>
          <button 
            disabled={prediction?.disabled}
            onClick={() => router.push("/dashboard/predict")}
            className={`w-full mt-6 py-3 rounded-xl font-bold text-sm transition-transform shadow-xl ${
              prediction?.disabled 
                ? "bg-white/5 text-muted-foreground cursor-not-allowed" 
                : "bg-primary text-primary-foreground hover:scale-[1.02] shadow-primary/20"
            }`}
          >
            {prediction?.disabled ? "Service Closed" : "Go to Predict Center"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-8 rounded-[2rem]">
          <h3 className="text-lg font-bold mb-4 font-outfit">Recent Patterns (Live Trend)</h3>
          <div className="space-y-4">
            {prediction && prediction.trend ? (
               prediction.trend.map((shift, i) => (
                  <div key={i} className="flex items-center justify-between p-4 glass rounded-2xl border-white/5 group hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center font-bold text-xs text-muted-foreground">Pos {i+1}</div>
                      <div>
                        <div className="font-bold">Digit Shift</div>
                        <div className="text-xs text-muted-foreground">Historical movement</div>
                      </div>
                    </div>
                    <div className={`font-black text-xl ${shift === 0 ? "text-muted-foreground" : "text-primary"}`}>
                       {shift > 0 ? `+${shift}` : shift}
                    </div>
                  </div>
               ))
            ) : (
                <div className="text-center text-muted-foreground py-10">
                   {loading ? "Analyzing trends..." : "No trend data available."}
                </div>
            )}
          </div>
        </div>
        <div className="glass-card p-8 rounded-[2rem] bg-primary/5 border-primary/10">
          <h3 className="text-lg font-bold mb-4 font-outfit text-primary">AI Insight</h3>
          <p className="text-sm text-balance leading-relaxed text-muted-foreground mb-6">
            Based on current digit frequencies, we're seeing an unusual clustering around the digit <span className="text-primary font-bold">{stats.topDigit}</span>. This trend often precedes a shift in number distribution patterns.
          </p>
          <button 
            disabled={prediction?.disabled}
            onClick={() => router.push("/dashboard/predict")}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-transform shadow-xl ${
              prediction?.disabled 
                ? "bg-white/5 text-muted-foreground cursor-not-allowed" 
                : "bg-primary text-primary-foreground hover:scale-102 shadow-primary/20"
            }`}
          >
            {prediction?.disabled ? "Service Closed" : "Generate New Prediction"}
          </button>
        </div>
      </div>
    </div>
  );
}
