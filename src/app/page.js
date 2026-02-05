"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import API from "@/app/lib/api";

export default function LandingPage() {
  const [latestResult, setLatestResult] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check login status
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);

    // Fetch Data
    // Fetch Data
    API.get("/klr/latest").then(res => {
      // Handle if API returns an array or object
      let data = Array.isArray(res.data) ? res.data[0] : res.data;
      
      // Data normalization for robustness
      if (data) {
        // Extract date from name if needed "Day (DD.MM.YYYY)"
        if (!data.date && data.name) {
           const match = data.name.match(/\((\d{2}\.\d{2}\.\d{4})\)/);
           if (match) data.date = match[1];
        }
        setLatestResult(data);
      }
    }).catch(console.error);

    API.get("/klr/history").then(res => {
      // The API returns { items: [...] } or just [...]
      const list = res.data.items || res.data;
      if (Array.isArray(list)) {
        setHistory(list);
      }
    }).catch(console.error);
    
    API.get("/klr/check-today").then(res => {
      if (res.data.data) setPrediction(res.data.data);
    }).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-mesh">
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/5 px-8 py-4 flex justify-between items-center">
        <div className="text-2xl font-black font-outfit tracking-tighter">
          <span className="bg-primary px-2 py-0.5 rounded-lg text-primary-foreground mr-1">K</span>
          LOT
        </div>
        <div className="flex gap-6 items-center">
          {/* <Link href="/dashboard" className="text-sm font-bold text-muted-foreground hover:text-white transition-colors">Analytics</Link> */}
          {!isLoggedIn && (
             <Link href="/login" className="px-5 py-2 glass rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-colors">Sign In</Link>
          )}
          <Link href={isLoggedIn ? "/dashboard" : "/register"} className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform">
            {isLoggedIn ? "Dashboard" : "Get Started"}
          </Link>
        </div>
      </nav>

      <div className="flex flex-col items-center justify-center flex-1 px-6 pt-32 pb-20 overflow-hidden w-full max-w-7xl">
      {/* Hero Section */}
      <div className="relative max-w-5xl w-full text-center mb-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 font-outfit bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
          WIN THE <br /> FUTURE.
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Advanced statistical analysis and AI-driven predictions for Kerala Lottery. High precision, real-time data.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href={isLoggedIn ? "/dashboard" : "/register"}
            className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold text-lg hover:scale-105 transition-transform animate-glow"
          >
            {isLoggedIn ? "Go to Dashboard" : "Start Winning"}
          </Link>
          {!isLoggedIn && (
            <Link 
              href="/login" 
              className="px-8 py-4 glass text-white rounded-full font-bold text-lg hover:bg-white/10 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        
        {/* Left Col: Result & Prediction Teaser */}
        <div className="space-y-8">
            {/* Latest Result */}
            <div className="glass-card p-8 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <h3 className="text-2xl font-bold mb-4 font-outfit">Latest Predicted Result</h3>
              {latestResult ? (
                <div>
                  <div className="text-4xl font-black text-primary mb-2 tracking-widest">{latestResult.first_ticket || latestResult.firstprize}</div>
                  <p className="text-muted-foreground">{latestResult.date || "Today"}</p>
                </div>
              ) : (
                <p className="text-muted-foreground animate-pulse">Fetching live result...</p>
              )}
            </div>

            {/* Prediction Area (Public/Private Toggle) */}
            <div className={`glass-card p-8 rounded-3xl relative overflow-hidden group border-primary/20 ${!isLoggedIn && "bg-primary/5"}`}>
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex justify-between items-start mb-4">
                 <h3 className="text-2xl font-bold font-outfit">Today's Prediction</h3>
                 {!isLoggedIn && <span className="text-[10px] bg-primary text-white px-2 py-1 rounded font-bold">PREMIUM</span>}
              </div>

              {isLoggedIn ? (
                // Logged In: Show Full Prediction
                prediction ? (
                   <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Your member-only super ensemble:</p>
                    <div className="flex flex-wrap gap-2">
                       {prediction.predictedNumbers.map((num, i) => (
                         <span key={i} className="px-4 py-2 bg-primary text-white rounded-xl font-black border border-white/10 text-xl shadow-lg shadow-primary/20">{num}</span>
                       ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Generating personalized prediction...</p>
                )
              ) : (
                // Public: Show "2 Combination" Teaser
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Top Repeating Pairs (Public Preview):</p>
                  <div className="flex gap-4">
                      {/* Fake stylized pairs for public view based on prediction if avail, or static */}
                      {prediction ? (
                        prediction.predictedNumbers.slice(0, 2).map((num, i) => (
                          <div key={i} className="flex flex-col items-center">
                             <span className="text-2xl font-black text-white">{num.slice(0,2)}, {num.slice(2,4)}</span>
                             <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Hot Pair</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex gap-4 opacity-50">
                           <span className="text-2xl font-black">23, 45</span>
                           <span className="text-2xl font-black">88, 12</span>
                        </div>
                      )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5">
                     <Link href="/login" className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                        Login to view full 3-digit predictions →
                     </Link>
                  </div>
                </div>
              )}
              <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground font-bold">Updated Live</div>
            </div>
        </div>

        {/* Right Col: History List (Public) */}
        <div className="glass-card p-8 rounded-3xl h-[500px] overflow-hidden flex flex-col">
          <h3 className="text-2xl font-bold mb-6 font-outfit flex items-center gap-2">
            <span>Past Results</span>
            <span className="text-xs bg-white/10 px-2 py-1 rounded text-muted-foreground font-normal">Full History</span>
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3">
            {history.length > 0 ? (
              history.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 glass rounded-2xl hover:bg-white/5 transition-colors">
                  <div>
                    <div className="font-bold text-white">{item.firstprize || item.first_ticket || "Wait..."}</div>
                    <div className="text-xs text-muted-foreground">{item.date}</div>
                  </div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wider">{item.name || "Draw"}</div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-10">Loading history...</div>
            )}
          </div>
        </div>

      </div>

      <footer className="mt-20 text-muted-foreground text-sm opacity-50">
        © 2026 K-LOT Advanced Prediction Systems. All rights reserved.
      </footer>
      </div>
    </div>
  );
}
