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
        
        // Handle various API response shapes for official history
        const offItems = Array.isArray(historyData) ? historyData : (historyData.items || historyData.results || []);
        setOfficialHistory(offItems);
    })
    .catch(err => {
        console.error("Error fetching data:", err);
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black font-outfit tracking-tight">History & Performance</h1>
          <p className="text-muted-foreground">View your prediction accuracy and official lottery results.</p>
        </div>
        
        {/* Tabs */}
        <div className="bg-white/5 p-1 rounded-xl flex gap-1 border border-white/10">
            <button
                onClick={() => setActiveTab("performance")}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all duration-300 ${
                    activeTab === "performance" 
                    ? "bg-purple-600 text-primary-foreground shadow-lg" 
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
            >
                My Performance
            </button>
            <button
                onClick={() => setActiveTab("official")}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all duration-300 ${
                    activeTab === "official" 
                    ? "bg-purple-600 text-primary-foreground shadow-lg" 
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
            >
                Official History
            </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-[2.5rem]">
        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xl font-bold font-outfit">
            {activeTab === "performance" ? "Prediction Records" : "Official Draw Results"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {/* Filter Controls */}
            <select
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/50 transition-colors text-white [&>option]:text-black"
            >
                {uniqueNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                ))}
            </select>

            <input 
              type="text" 
              placeholder="Search date or name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/50 transition-colors text-white placeholder:text-muted-foreground"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
             <div className="p-20 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-muted-foreground animate-pulse font-bold">Loading Data...</p>
             </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5">
                  <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                  <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Lottery</th>
                  
                  {activeTab === "performance" && (
                    <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Your Prediction</th>
                  )}

                  {activeTab === "performance" && (
                     <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">3-Digit Patterns</th>
                  )}
                  
                  <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Winning Number</th>
                  
                  {activeTab === "performance" && (
                      <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Result</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredData?.map((item, index) => (
                  <tr key={index} className="border-t border-white/5 hover:bg-white/5 transition-colors group">
                     {/* Date */}
                     <td className="p-6 text-muted-foreground font-medium">
                      {activeTab === "performance" ? item.date : (item.date || item.draw_date)}
                    </td>
                    
                    {/* Lottery Name */}
                    <td className="p-6">
                      <div className="font-bold font-outfit group-hover:text-primary transition-colors">
                        {activeTab === "performance" ? item.lotteryName : (item.name || item.draw_name)}
                      </div>
                    </td>

                    {/* Prediction (Only for Performance Tab) */}
                    {activeTab === "performance" && (
                        <td className="p-6">
                            <div className="flex flex-wrap gap-2">
                                {item.predictedNumbers?.map((num, i) => {
                                    // Find which algorithm generated this number
                                    // algorithms is a Map: { "Positional": "123,456", "Matrix": "789" }
                                    // We need to reverse lookup or check inclusion
                                    let algoName = "Unknown";
                                    if (item.algorithms) {
                                        for (const [algo, numbers] of Object.entries(item.algorithms)) {
                                            if (numbers && numbers.includes(num)) {
                                                algoName = algo;
                                                break;
                                            }
                                        }
                                    }
                                    
                                    return (
                                        <div key={i} className="group relative">
                                            <span className="px-2 py-1 bg-white/5 rounded text-xs font-mono border border-white/10 cursor-help">
                                                {num}
                                            </span>
                                            {/* Tooltip for Algorithm */}
                                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                {algoName}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </td>
                    )}

                    {/* 3-Digit Patterns (Only for Performance Tab) */}
                     {activeTab === "performance" && (
                        <td className="p-6">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                                {item.threeDigit ? Object.entries(item.threeDigit).map(([key, val], i) => (
                                     <div key={i} className="group relative">
                                        <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px] font-mono border border-blue-500/20 cursor-help">
                                            {val}
                                        </span>
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                            {key}
                                        </span>
                                     </div>
                                )) : <span className="text-muted-foreground text-xs">-</span>}
                            </div>
                        </td>
                     )}

                    {/* Winning Number */}
                    <td className="p-6">
                      <span className="px-4 py-2 bg-primary/10 rounded-xl text-primary font-black border border-primary/20 tracking-widest">
                        {activeTab === "performance" 
                            ? item.winningNumber 
                            : (item.first_ticket || item.firstprize || "XXXXXX")}
                      </span>
                    </td>

                    {/* Result Status (Only for Performance Tab) */}
                    {activeTab === "performance" && (
                        <td className="p-6">
                            {item.status === "Win" ? (
                                <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase rounded-full border border-green-500/20">
                                    WIN 🎉
                                </span>
                            ) : item.status === "Loss" ? (
                                <span className="px-3 py-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-full border border-red-500/20">
                                    MISS
                                </span>
                            ) : (
                                <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 text-[10px] font-black uppercase rounded-full border border-yellow-500/20">
                                    PENDING
                                </span>
                            )}
                        </td>
                    )}
                  </tr>
                ))}
                
                {filteredData?.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === "performance" ? 5 : 3} className="p-20 text-center text-muted-foreground font-bold">
                      No records found.
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
