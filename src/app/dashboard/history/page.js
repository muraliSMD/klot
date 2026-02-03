"use client";
import { useEffect, useState } from "react";
import API from "@/app/lib/api";

export default function HistoryPage() {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/klr/history")
      .then(res => {
        // Handle various API response shapes
        const data = Array.isArray(res.data) ? res.data : (res.data.items || res.data.results || []);
        setHistory(data);
      })
      .catch(err => {
        console.error("Error fetching history:", err.message);
        setHistory([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black font-outfit tracking-tight">Draw History</h1>
          <p className="text-muted-foreground">Browse historical results and winning numbers.</p>
        </div>
        <div className="glass px-6 py-3 rounded-2xl border border-white/5">
          <span className="text-xs text-muted-foreground uppercase font-bold block">Latest Update</span>
          <span className="text-xl font-black text-white">Just Now</span>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-[2.5rem]">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xl font-bold font-outfit">Historical Records</h3>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Search date..." 
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
             <div className="p-20 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-muted-foreground animate-pulse font-bold">Syncing Records...</p>
             </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5">
                  <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Lottery Name</th>
                  <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Draw Date</th>
                  <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Winning Number</th>
                  <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {history?.map((draw, index) => (
                  <tr key={index} className="border-t border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="p-6">
                      <div className="font-bold font-outfit group-hover:text-primary transition-colors">
                        {draw.name || draw.lottery_name || "Kerala State Lottery"}
                      </div>
                    </td>
                    <td className="p-6 text-muted-foreground font-medium">
                      {draw.date || draw.draw_date || "N/A"}
                    </td>
                    <td className="p-6">
                      <span className="px-4 py-2 bg-primary/10 rounded-xl text-primary font-black border border-primary/20 tracking-widest">
                        {draw.first_ticket || draw.firstprize || "XXXXXX"}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase rounded-full">
                        Official
                      </span>
                    </td>
                  </tr>
                ))}
                {history?.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-20 text-center text-muted-foreground font-bold">
                      No lottery history found in the database.
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
