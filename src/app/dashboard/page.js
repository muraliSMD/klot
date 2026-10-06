"use client";
import { useEffect, useState } from "react";
import API from "@/app/lib/api";
import { useRouter } from "next/navigation";
import TicketStub from "@/app/components/TicketStub";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";

// --- Running Digital Countdown Timer Component (3:30 PM IST Release) ---
function DrawCountdownTimer({ targetTimestamp, onExpire }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, total: 0 });

  useEffect(() => {
    if (!targetTimestamp) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, targetTimestamp - now);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, total: diff });

      if (diff <= 0 && onExpire) {
        onExpire();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp, onExpire]);

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="flex items-center gap-1 font-mono select-none shrink-0">
      <div className="bg-[#0b0e14] border border-amber-500/40 px-2 py-1 rounded-xl flex flex-col items-center shadow-inner min-w-[32px] sm:min-w-[36px]">
        <span className="text-xs sm:text-sm font-black text-amber-300 drop-shadow-[0_0_8px_rgba(245,197,66,0.3)]">{pad(timeLeft.hours)}</span>
        <span className="text-[7px] font-bold text-white/50 uppercase tracking-wider">HRS</span>
      </div>
      <span className="text-amber-400 font-bold text-xs animate-pulse">:</span>
      <div className="bg-[#0b0e14] border border-amber-500/40 px-2 py-1 rounded-xl flex flex-col items-center shadow-inner min-w-[32px] sm:min-w-[36px]">
        <span className="text-xs sm:text-sm font-black text-amber-300 drop-shadow-[0_0_8px_rgba(245,197,66,0.3)]">{pad(timeLeft.minutes)}</span>
        <span className="text-[7px] font-bold text-white/50 uppercase tracking-wider">MIN</span>
      </div>
      <span className="text-amber-400 font-bold text-xs animate-pulse">:</span>
      <div className="bg-[#0b0e14] border border-amber-500/40 px-2 py-1 rounded-xl flex flex-col items-center shadow-inner min-w-[32px] sm:min-w-[36px]">
        <span className="text-xs sm:text-sm font-black text-amber-300 drop-shadow-[0_0_8px_rgba(245,197,66,0.3)]">{pad(timeLeft.seconds)}</span>
        <span className="text-[7px] font-bold text-white/50 uppercase tracking-wider">SEC</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [freqData, setFreqData] = useState(null);
  const [stats, setStats] = useState({ total: 0, topDigit: null });
  const [prediction, setPrediction] = useState(null);
  const [latestWin, setLatestWin] = useState(null);
  const [syncingWin, setSyncingWin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchLatestWin = async () => {
    setSyncingWin(true);
    try {
      const res = await API.get("/klr/latest");
      if (res.data) {
        setLatestWin(res.data);
      }
    } catch (err) {
      console.error("Error fetching latest win:", err.message);
    } finally {
      setSyncingWin(false);
    }
  };

  useEffect(() => {
    // 1. Fetch Today's Official Winning Number
    fetchLatestWin();

    // 2. Fetch Pattern Analysis
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

    // 3. Fetch Prediction
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

  // Helper to parse win ticket info
  const parseTicketInfo = (item) => {
    if (!item) {
      return {
        prizeTitle: "TODAY TARGET",
        drawCode: "TODAY LOTTERY",
        prizeAmount: "₹1,00,00,000 (1 Crore)",
        series: "KL",
        seriesLabel: "SERIES",
        number: "??????",
        name: "Today's Draw",
        todayLottery: "Today's Draw",
        todayFormatted: "",
        isTodayReleased: false,
        status: "DRAW_PENDING_330PM_IST",
        targetTimestamp: Date.now() + (3 * 60 * 60 * 1000),
        tomorrowLottery: "Tomorrow's Draw",
        tomorrowFormatted: "",
        tomorrowTargetTimestamp: Date.now() + (24 * 60 * 60 * 1000),
        previousDraw: null
      };
    }

    const isTodayReleased = item.isTodayReleased ?? false;
    const rawTicket = isTodayReleased 
      ? (item.first_ticket || item.result?.first_ticket || item.result?.firstprize || "")
      : null;

    let series = "KL";
    let formattedNumber = "??????";

    if (isTodayReleased && rawTicket) {
      const ticketStr = String(rawTicket);
      const numericPart = ticketStr.replace(/\D/g, "") || "000000";
      formattedNumber = numericPart.length >= 6 ? numericPart.slice(-6) : numericPart.padStart(6, "0");
      const seriesMatch = ticketStr.match(/([A-Z]{2})/i);
      series = seriesMatch ? seriesMatch[1].toUpperCase() : "KL";
    } else {
      const name = item.todayLottery || item.draw_name || "KL";
      const words = name.split(/\s+/);
      if (words.length >= 2) {
        series = (words[0][0] + words[1][0]).toUpperCase();
      } else {
        series = name.slice(0, 2).toUpperCase();
      }
    }

    // Previous Draw Parsing (Yesterday's Won Number)
    let prevSeries = "KL";
    let prevNumber = "XXXXXX";
    let prevName = item.previousDraw?.draw_name || "Yesterday's Draw";
    let prevDate = item.previousDraw?.date || "";

    if (item.previousDraw && item.previousDraw.first_ticket) {
      const prevTicketStr = String(item.previousDraw.first_ticket);
      const prevNumeric = prevTicketStr.replace(/\D/g, "");
      if (prevNumeric) {
        prevNumber = prevNumeric.length >= 6 ? prevNumeric.slice(-6) : prevNumeric.padStart(6, "0");
      }
      const prevMatch = prevTicketStr.match(/([A-Z]{2})/i);
      if (prevMatch) {
        prevSeries = prevMatch[1].toUpperCase();
      }
    }

    const drawCode = isTodayReleased ? (item.draw_name || item.todayLottery) : (item.todayLottery || "Today's Draw");
    const prizeAmount = isTodayReleased ? (item.prize_amount || "₹1,00,00,000 (1 Crore)") : "₹1,00,00,000 (1 Crore)";

    return {
      prizeTitle: isTodayReleased ? "OFFICIAL WINNER" : "TODAY TARGET",
      drawCode: drawCode,
      prizeAmount: prizeAmount,
      series: series,
      seriesLabel: "SERIES",
      number: formattedNumber,
      name: drawCode,
      todayLottery: item.todayLottery || "Today's Draw",
      todayFormatted: item.todayFormatted || "",
      isTodayReleased: isTodayReleased,
      status: item.status || "DRAW_PENDING_330PM_IST",
      targetTimestamp: item.targetTimestamp || (Date.now() + 3600000),
      tomorrowLottery: item.tomorrowLottery || "Tomorrow's Draw",
      tomorrowFormatted: item.tomorrowFormatted || "",
      tomorrowTargetTimestamp: item.tomorrowTargetTimestamp || (item.targetTimestamp || Date.now() + 86400000),
      previousDraw: item.previousDraw ? {
        draw_name: prevName,
        date: prevDate,
        series: prevSeries,
        number: prevNumber,
        first_ticket: item.previousDraw.first_ticket
      } : null
    };
  };

  const winTicket = parseTicketInfo(latestWin);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Top Welcome & Stats Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-2">
            <span>🎟️</span> Daily Official Results & Predictive Intelligence
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-outfit tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">Real-time winning ticket results updated daily for users & admins.</p>
        </div>
        <div className="flex gap-3 sm:gap-4">
          <div className="glass px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl border border-white/5">
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold block">Total Analyzed</span>
            <span className="text-lg sm:text-xl font-black text-white">{stats.total} Digits</span>
          </div>
          <div className="glass px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl border border-primary/20">
            <span className="text-[10px] sm:text-xs text-primary uppercase font-bold block">Hottest Digit</span>
            <span className="text-lg sm:text-xl font-black text-primary">{stats.topDigit || "-"}</span>
          </div>
        </div>
      </div>

      {/* TODAY & TOMORROW / YESTERDAY & TODAY LOTTERY HERO SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {winTicket.isTodayReleased ? (
          <>
            {/* CARD 1: TODAY'S DRAWN WINNER */}
            <div className="glass-card p-5 sm:p-7 md:p-8 rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden bg-gradient-to-br from-[#121520]/95 via-[#0d0f15]/95 to-[#181c28]/95 border border-emerald-500/30 shadow-2xl flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative z-10 space-y-4">
                
                {/* Responsive Header Row */}
                <div className="space-y-3 border-b border-white/10 pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Today's Official Result
                    </div>
                    <button
                      type="button"
                      onClick={fetchLatestWin}
                      disabled={syncingWin}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1 disabled:opacity-50 shrink-0"
                      title="Sync latest draw from official API"
                    >
                      <span className={syncingWin ? "animate-spin" : ""}>🔄</span>
                      {syncingWin ? "Syncing..." : "Sync"}
                    </button>
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-outfit text-white tracking-tight truncate">
                      {winTicket.todayLottery}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
                      {winTicket.todayFormatted} • Drawn & Verified at 3:30 PM IST
                    </p>
                  </div>
                </div>

                {/* Ticket Component Presentation */}
                <div className="py-1">
                  <TicketStub
                    prizeTitle="TODAY WINNER"
                    drawCode={winTicket.name}
                    prizeAmount={winTicket.prizeAmount}
                    series={winTicket.series}
                    seriesLabel="SERIES"
                    number={winTicket.number}
                    subtext="Official 1st Prize winning ticket for today"
                    badgeColor="gold"
                  />
                </div>

                <div className="pt-2 text-[11px] text-emerald-400/80 font-medium flex items-center gap-1.5">
                  <span>✓ Today's winning result is saved & displayed continuously on dashboard.</span>
                </div>
              </div>
            </div>

            {/* CARD 2: TOMORROW'S SCHEDULED DRAW & COUNTDOWN TIMER */}
            <div className="glass-card p-5 sm:p-7 md:p-8 rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden bg-gradient-to-br from-[#1b1726]/95 via-[#0f0c18]/95 to-[#241c33]/95 border border-amber-500/30 shadow-2xl flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative z-10 space-y-4">
                
                {/* Responsive Header Row with Full-Width Timer Alignment */}
                <div className="space-y-3 border-b border-white/10 pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Tomorrow's Next Draw
                    </div>
                    <span className="text-[10px] font-mono font-bold text-white/60 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                      {winTicket.tomorrowFormatted}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-outfit text-white tracking-tight truncate">
                        {winTicket.tomorrowLottery}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
                        Draw releases at 3:30 PM IST tomorrow
                      </p>
                    </div>

                    {/* Countdown Box */}
                    <div className="flex items-center gap-2 bg-black/60 border border-amber-500/40 px-3 py-1.5 rounded-2xl shadow-lg shrink-0 self-start sm:self-auto">
                      <div className="flex flex-col pr-1.5 border-r border-amber-500/20">
                        <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest leading-none">3:30 PM</span>
                        <span className="text-[7px] font-bold text-white/40 uppercase tracking-wider leading-none mt-0.5">DRAW IN</span>
                      </div>
                      <DrawCountdownTimer 
                        targetTimestamp={winTicket.tomorrowTargetTimestamp} 
                        onExpire={fetchLatestWin} 
                      />
                    </div>
                  </div>
                </div>

                {/* Ticket Component Presentation */}
                <div className="py-1">
                  <TicketStub
                    prizeTitle="TOMORROW TARGET"
                    drawCode={winTicket.tomorrowLottery}
                    prizeAmount="₹1,00,00,000 (1 Crore)"
                    series="KL"
                    seriesLabel="SCHEDULED"
                    number="??????"
                    subtext="Waiting until tomorrow 3:30 PM IST to obtain draw result"
                    badgeColor="emerald"
                  />
                </div>

                <div className="pt-2 text-[11px] text-amber-300/80 font-medium flex items-center justify-between">
                  <span>⏳ Draw status: Scheduled for Tomorrow 3:30 PM IST</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* CARD 1: YESTERDAY'S WON NUMBER (FROM HISTORY) */}
            <div className="glass-card p-5 sm:p-7 md:p-8 rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden bg-gradient-to-br from-[#121520]/95 via-[#0d0f15]/95 to-[#181c28]/95 border border-purple-500/30 shadow-2xl flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative z-10 space-y-4">
                
                {/* Responsive Header Row */}
                <div className="space-y-3 border-b border-white/10 pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider">
                      <span>📜</span> Yesterday's Official Winner
                    </div>
                    <button
                      type="button"
                      onClick={fetchLatestWin}
                      disabled={syncingWin}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1 disabled:opacity-50 shrink-0"
                      title="Sync latest draw from official API"
                    >
                      <span className={syncingWin ? "animate-spin" : ""}>🔄</span>
                      {syncingWin ? "Syncing..." : "Sync"}
                    </button>
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-outfit text-white tracking-tight truncate">
                      {winTicket.previousDraw?.draw_name || "Yesterday's Draw"}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
                      {winTicket.previousDraw?.date ? `${winTicket.previousDraw.date} • ` : ""}Official Past Winner from History
                    </p>
                  </div>
                </div>

                {/* Ticket Component Presentation */}
                <div className="py-1">
                  <TicketStub
                    prizeTitle="YESTERDAY WINNER"
                    drawCode={winTicket.previousDraw?.draw_name || "YESTERDAY"}
                    prizeAmount="₹1,00,00,000 (1 Crore)"
                    series={winTicket.previousDraw?.series || "KL"}
                    seriesLabel="SERIES"
                    number={winTicket.previousDraw?.number || "XXXXXX"}
                    subtext="Official 1st Prize winning ticket from history"
                    badgeColor="gold"
                  />
                </div>

                <div className="pt-2 text-[11px] text-purple-300/80 font-medium flex items-center gap-1.5">
                  <span>✓ Verified historical 1st Prize winning number</span>
                </div>
              </div>
            </div>

            {/* CARD 2: TODAY'S SCHEDULED DRAW & COUNTDOWN TIMER */}
            <div className="glass-card p-5 sm:p-7 md:p-8 rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden bg-gradient-to-br from-[#1b1726]/95 via-[#0f0c18]/95 to-[#241c33]/95 border border-amber-500/30 shadow-2xl flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative z-10 space-y-4">
                
                {/* Responsive Header Row with Full-Width Timer Alignment */}
                <div className="space-y-3 border-b border-white/10 pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Today's Scheduled Draw
                    </div>
                    <span className="text-[10px] font-mono font-bold text-white/60 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                      {winTicket.todayFormatted}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-outfit text-white tracking-tight truncate">
                        {winTicket.todayLottery}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
                        Draw releases today at 3:30 PM IST
                      </p>
                    </div>

                    {/* Countdown Box */}
                    <div className="flex items-center gap-2 bg-black/60 border border-amber-500/40 px-3 py-1.5 rounded-2xl shadow-lg shrink-0 self-start sm:self-auto">
                      <div className="flex flex-col pr-1.5 border-r border-amber-500/20">
                        <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest leading-none">3:30 PM</span>
                        <span className="text-[7px] font-bold text-white/40 uppercase tracking-wider leading-none mt-0.5">DRAW IN</span>
                      </div>
                      <DrawCountdownTimer 
                        targetTimestamp={winTicket.targetTimestamp} 
                        onExpire={fetchLatestWin} 
                      />
                    </div>
                  </div>
                </div>

                {/* Ticket Component Presentation */}
                <div className="py-1">
                  <TicketStub
                    prizeTitle="TODAY TARGET"
                    drawCode={winTicket.todayLottery}
                    prizeAmount="₹1,00,00,000 (1 Crore)"
                    series={winTicket.series}
                    seriesLabel="SCHEDULED"
                    number="??????"
                    subtext="Waiting until today 3:30 PM IST to obtain draw result"
                    badgeColor="emerald"
                  />
                </div>

                <div className="pt-2 text-[11px] text-amber-300/80 font-medium flex items-center justify-between">
                  <span>⏳ Draw status: Scheduled for Today 3:30 PM IST</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Analytics & Prediction Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Frequency Distribution Chart */}
        <div className="lg:col-span-2 glass-card p-6 sm:p-8 rounded-[2.5rem] relative overflow-hidden">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-outfit">Frequency Distribution</h2>
              <p className="text-xs text-muted-foreground">Historical occurrence probability per digit position</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-white/5 px-4 py-2 rounded-full">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
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

        {/* Prediction Preview Ticket Stub Card */}
        <div className="glass-card p-6 sm:p-8 rounded-[2.5rem] bg-gradient-to-b from-purple-900/10 via-black/30 to-purple-950/20 border-purple-500/20 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-outfit text-purple-300 flex items-center gap-2">
                <span>✨</span> AI Prediction Ticket
              </h3>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-black ${
                prediction?.disabled ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse"
              }`}>
                {prediction?.disabled ? "CLOSED" : "ACTIVE"}
              </span>
            </div>
            
            {prediction ? (
              prediction.disabled ? (
                <div className="text-center py-8 space-y-2">
                  <div className="text-3xl">⏳</div>
                  <p className="text-xs text-muted-foreground font-medium">Service available 10:00 AM - 1:00 PM IST</p>
                </div>
              ) : (
                <div className="space-y-4 my-4">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">
                    Top Predicted Ticket Stub
                  </div>

                  {/* Render Prediction in Ticket Stub Format */}
                  <TicketStub
                    prizeTitle="PREDICTED PICK"
                    drawCode="3D ENSEMBLE"
                    prizeAmount=""
                    series="AI"
                    seriesLabel="MODEL"
                    number={prediction.topFive?.[0] || prediction.predictedNumbers?.[0]?.slice(-3) || "895"}
                    subtext="Target 3-digit winning combination"
                    badgeColor="purple"
                  />

                  {(prediction.aiPredictions?.lstm?.predictedNumber || prediction.aiPredictions?.rf?.predictedNumber) && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🤖</span>
                        <span className="text-xs font-bold text-purple-300">Neural Network Fit</span>
                      </div>
                      <span className="text-base font-black tracking-widest text-purple-200">
                        {prediction.aiPredictions?.lstm?.predictedNumber || prediction.aiPredictions?.rf?.predictedNumber}
                      </span>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">Generating new ensemble...</div>
            )}
          </div>

          <button 
            disabled={prediction?.disabled}
            onClick={() => router.push("/dashboard/predict")}
            className={`w-full mt-6 py-4 rounded-2xl font-bold text-sm transition-transform shadow-xl ${
              prediction?.disabled 
                ? "bg-white/5 text-muted-foreground cursor-not-allowed" 
                : "bg-purple-600 text-white hover:bg-purple-500 hover:scale-[1.02] shadow-purple-600/30"
            }`}
          >
            {prediction?.disabled ? "Service Closed" : "Open Predict Ticket Center →"}
          </button>
        </div>

      </div>

      {/* Bottom Pattern Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-6 sm:p-8 rounded-[2rem]">
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

        <div className="glass-card p-6 sm:p-8 rounded-[2rem] bg-primary/5 border-primary/10 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold mb-4 font-outfit text-primary">AI Insight</h3>
            <p className="text-sm text-balance leading-relaxed text-muted-foreground mb-6">
              Based on current digit frequencies, we're seeing high density around digit <span className="text-primary font-bold">{stats.topDigit}</span>. This trend often precedes a shift in ticket number distribution patterns.
            </p>
          </div>
          <button 
            disabled={prediction?.disabled}
            onClick={() => router.push("/dashboard/predict")}
            className={`w-full py-4 rounded-2xl font-bold text-sm transition-transform shadow-xl ${
              prediction?.disabled 
                ? "bg-white/5 text-muted-foreground cursor-not-allowed" 
                : "bg-primary text-primary-foreground hover:scale-102 shadow-primary/20"
            }`}
          >
            {prediction?.disabled ? "Service Closed" : "Generate New Ticket Prediction"}
          </button>
        </div>
      </div>

    </div>
  );
}
