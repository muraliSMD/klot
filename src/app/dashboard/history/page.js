"use client";
import { useEffect, useState } from "react";
import API from "@/app/lib/api";

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState("performance"); // "performance" | "official"
  
  const [performanceHistory, setPerformanceHistory] = useState([]);
  const [officialHistory, setOfficialHistory] = useState([]);
  
  const [loading, setLoading] = useState(true);
  
  // Filtering states
  const [filterName, setFilterName] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setLoading(true);
    
    // Fetch both datasets concurrently
    Promise.all([
        fetch("/api/klr/performance").then(res => res.json()).catch(() => ({ results: [] })),
        fetch("/api/klr/history").then(res => res.json()).catch(() => ({ items: [] }))
    ])
    .then(([perfData, historyData]) => {
        setPerformanceHistory(perfData.results || []);
        
        const offItems = Array.isArray(historyData) ? historyData : (historyData.items || historyData.results || []);
        setOfficialHistory(offItems);
    })
    .catch(err => {
        console.error("Error fetching history data:", err);
    })
    .finally(() => setLoading(false));
  }, []);

  // Determine which dataset to use based on active tab
  const currentData = activeTab === "performance" ? performanceHistory : officialHistory;

  // Extract unique names for filter
  const uniqueNames = currentData 
    ? ["All", ...new Set(currentData.map(item => {
        return activeTab === "performance" ? (item.lotteryName || "Unknown") : (item.name || item.draw_name || "Unknown");
    }))]
    : ["All"];

  // Filter Data
  const filteredData = currentData?.filter(item => {
    const name = activeTab === "performance" ? (item.lotteryName || "Unknown") : (item.name || item.draw_name || "Unknown");
    const date = activeTab === "performance" ? (item.date || "") : (item.date || item.draw_date || "");
    
    const matchesName = filterName === "All" || name === filterName;
    const matchesSearch = date.includes(searchTerm) || name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesName && matchesSearch;
  });

  // Helper to parse & render winning ticket number cleanly with A-B-C pool breakdown
  const renderWinningNumber = (raw) => {
    if (!raw) return <span className="text-white/40 font-mono text-xs italic">Pending Draw</span>;
    
    const cleaned = String(raw).trim();
    const match = cleaned.match(/^([A-Z0-9-]{2,7})\s+([0-9]{3,6})$/i) || cleaned.match(/^([A-Z]{2,4})\s*-\s*([0-9]+)\s+([0-9]{3,6})$/i);
    
    let series = "";
    let digits = "";

    if (match) {
      series = match[1];
      digits = match[2] || match[3];
    } else {
      digits = cleaned.replace(/\D/g, "");
      series = cleaned.replace(/[^A-Z]/gi, "").slice(0, 4) || "KL";
    }

    if (digits.length >= 3) {
      const win3D = digits.slice(-3);
      const winA = win3D[0];
      const winB = win3D[1];
      const winC = win3D[2];

      return (
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 bg-[#10131c] border border-white/10 px-3 py-1.5 rounded-xl shadow-lg">
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
              {series}
            </span>
            <span className="font-mono font-black text-amber-300 tracking-widest text-sm md:text-base">
              {digits}
            </span>
          </div>

          {/* Explicit A, B, C Positional Pool Breakdown */}
          <div className="flex items-center gap-1 text-[10px] font-mono font-black">
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" title="A-Board (100s Position)">
              A: {winA}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30" title="B-Board (10s Position)">
              B: {winB}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm flex items-center gap-1" title="C-Board (1s Position / Small Prize Digit)">
              <span>C: {winC}</span>
              <span className="text-[9px]">🏆</span>
            </span>
          </div>
        </div>
      );
    }

    return (
      <span className="font-mono font-black text-amber-300 tracking-widest text-sm px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl">
        {cleaned}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold mb-2">
            <span>🕒</span> Historical Results & Performance Tracker
          </div>
          <h1 className="text-4xl font-black font-outfit tracking-tight">History & Performance</h1>
          <p className="text-muted-foreground font-medium">Verify your prediction accuracy against official lottery draw records.</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/10 self-start sm:self-auto">
            <button
                type="button"
                onClick={() => setActiveTab("performance")}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${
                    activeTab === "performance" 
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" 
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
            >
                My Performance
            </button>
            <button
                type="button"
                onClick={() => setActiveTab("official")}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${
                    activeTab === "official" 
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" 
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
            >
                Official Draw Records
            </button>
        </div>
      </div>

      {/* Main Table Card Container */}
      <div className="glass-card overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
        
        {/* Filter Controls Header */}
        <div className="p-6 sm:p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02]">
          <div>
            <h3 className="text-xl font-bold font-outfit text-white">
              {activeTab === "performance" ? "Prediction Accuracy Ledger" : "Official Kerala Draw History"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Showing {filteredData?.length || 0} historical entries
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Controls */}
            <select
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="bg-[#121520] border border-white/15 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-purple-500 transition-colors text-white cursor-pointer"
            >
                {uniqueNames.map(name => (
                    <option key={name} value={name} className="bg-[#0d0f15] text-white">{name}</option>
                ))}
            </select>

            <input 
              type="text" 
              placeholder="Search date or lottery..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#121520] border border-white/15 rounded-xl px-4 py-2.5 text-xs font-medium outline-none focus:border-purple-500 transition-colors text-white placeholder:text-muted-foreground w-full sm:w-auto"
            />
          </div>
        </div>
        
        {/* Table Content */}
        <div className="overflow-x-auto scrollbar-hide">
          {loading ? (
             <div className="p-20 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                <p className="text-muted-foreground animate-pulse font-bold text-sm">Loading historical ledger...</p>
             </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="p-5 sm:p-6 text-xs font-black uppercase tracking-widest text-muted-foreground">Date</th>
                  <th className="p-5 sm:p-6 text-xs font-black uppercase tracking-widest text-muted-foreground">Lottery Name</th>
                  
                  {activeTab === "performance" && (
                    <th className="p-5 sm:p-6 text-xs font-black uppercase tracking-widest text-muted-foreground">Predicted Tickets & Master 3D</th>
                  )}

                  {activeTab === "performance" && (
                     <th className="p-5 sm:p-6 text-xs font-black uppercase tracking-widest text-muted-foreground">3D Patterns & ABC</th>
                  )}
                  
                  <th className="p-5 sm:p-6 text-xs font-black uppercase tracking-widest text-muted-foreground">Winning Ticket</th>
                  
                  {activeTab === "performance" && (
                      <th className="p-5 sm:p-6 text-xs font-black uppercase tracking-widest text-muted-foreground">Accuracy % & Match Analysis</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredData?.map((item, index) => (
                  <tr key={index} className="hover:bg-white/[0.03] transition-colors group">
                     {/* Date */}
                     <td className="p-5 sm:p-6 text-xs sm:text-sm font-bold text-white/70 font-mono">
                      {activeTab === "performance" ? item.date : (item.date || item.draw_date || "N/A")}
                    </td>
                    
                    {/* Lottery Name */}
                    <td className="p-5 sm:p-6">
                      <div className="font-bold font-outfit text-sm sm:text-base text-white group-hover:text-purple-300 transition-colors">
                        {activeTab === "performance" ? item.lotteryName : (item.name || item.draw_name || "Kerala Draw")}
                      </div>
                    </td>

                    {/* Prediction (Only for Performance Tab) */}
                    {activeTab === "performance" && (
                        <td className="p-5 sm:p-6">
                            <div className="space-y-1.5">
                                {item.masterWinner && (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-500/20 border border-purple-500/40 text-purple-200 rounded-md text-xs font-mono font-black shadow-sm">
                                    <span className="text-[10px] text-purple-400 font-bold">#1 MASTER:</span> {item.masterWinner}
                                  </div>
                                )}
                                
                                {item.fullTickets && item.fullTickets.length > 0 && (
                                  <div className="text-[11px] font-mono font-bold text-amber-300 flex items-center gap-1">
                                    <span>🎟️</span> {item.fullTickets[0]}
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-1 max-w-xs">
                                    {(item.topFive || item.predictedNumbers?.slice(0, 3) || []).map((num, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-white/5 border border-white/10 text-white/90 rounded text-[11px] font-mono font-bold">
                                            {num}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </td>
                    )}

                    {/* 3-Digit Patterns & ABC (Only for Performance Tab) */}
                     {activeTab === "performance" && (
                        <td className="p-5 sm:p-6">
                            <div className="space-y-1 max-w-[200px]">
                                <div className="flex flex-wrap gap-1">
                                    {item.threeDigit ? Object.entries(item.threeDigit).slice(0, 3).map(([key, val], i) => (
                                         <span key={i} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded text-[10px] font-mono font-bold border border-blue-500/20" title={key}>
                                             {key.slice(0,6)}: {val}
                                         </span>
                                    )) : <span className="text-muted-foreground text-xs">-</span>}
                                </div>
                                {item.abcBoard?.singleDigit && (
                                  <div className="text-[10px] text-cyan-300 font-bold">
                                    ABC Target: <span className="text-white font-mono">{item.abcBoard.singleDigit}</span>
                                  </div>
                                )}
                            </div>
                        </td>
                     )}

                    {/* Winning Number */}
                    <td className="p-5 sm:p-6">
                      {renderWinningNumber(
                        activeTab === "performance" 
                          ? item.winningNumber 
                          : (item.first_ticket || item.firstprize || "XXXXXX")
                      )}
                    </td>

                    {/* Result Status & Accuracy % (Only for Performance Tab) */}
                    {activeTab === "performance" && (
                        <td className="p-5 sm:p-6">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2.5 py-1 text-xs font-black uppercase rounded-full border shadow-sm ${
                                  item.accuracyPercent === 100 
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                                    : item.accuracyPercent >= 80 
                                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                      : item.accuracyPercent >= 60 
                                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                        : item.accuracyPercent >= 40 
                                          ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                                          : item.accuracyPercent >= 25 
                                            ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                            : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                }`}>
                                  {item.accuracyPercent ?? 0}% {item.status}
                                </span>
                              </div>

                              {item.matchSummary && (
                                <div className="text-[10px] text-muted-foreground font-medium max-w-[220px] leading-tight">
                                  {item.matchSummary}
                                </div>
                              )}
                            </div>
                        </td>
                    )}
                  </tr>
                ))}
                
                {filteredData?.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === "performance" ? 6 : 3} className="p-16 text-center text-muted-foreground font-bold text-sm">
                      No matching records found in ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
