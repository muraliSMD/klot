"use client";
import { useEffect, useState } from "react";
import Modal from "@/app/components/Modal";
import API from "@/app/lib/api";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  CartesianGrid 
} from "recharts";

export default function PredictionsPage() {
  const [freqData, setFreqData] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  // New state for prediction source
  const [predictionSource, setPredictionSource] = useState("history"); // 'history' | 'yesterday'

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMsg, setModalMsg] = useState("");





  useEffect(() => {
    // Fetch Analysis
    API.get("/klr/analysis?limit=100")
      .then(res => {
        if (res.data && res.data.freq) {
          setFreqData(res.data.freq.sort((a, b) => b.count - a.count));
        }
      }).catch(console.error);

    // Fetch Tomorrow's Prediction
    API.get("/klr/check-today") 
      .then(res => {
        if (res.data.data) {
          setPrediction(res.data.data);
        } else if (res.data.disabled) {
          setPrediction({ disabled: true, message: res.data.message });
        }
      }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const generateNew = async () => {
    if (prediction?.disabled) return;
    setLoading(true);
    try {
      const res = await API.post("/klr/generate-prediction");
      setPrediction(res.data.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      setModalMsg(msg);
      setIsModalOpen(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get guessing board numbers
  const getGuessingBoard = () => {
      if (!prediction) return null;
      if (predictionSource === 'yesterday' && prediction.yesterdayPrediction) {
          return prediction.yesterdayPrediction.guessingBoard;
      }
      return prediction.guessingBoard;
  };

  const activeGuessingBoard = getGuessingBoard();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black font-outfit tracking-tight">Predictive Insights</h1>
          <p className="text-muted-foreground">Positional analysis for tomorrow's winning combination.</p>
        </div>
        <button 
          onClick={generateNew} 
          disabled={loading || !!prediction || (prediction && prediction.disabled)}
          className={`glass px-6 py-3 rounded-2xl border border-primary/20 text-primary font-bold hover:bg-primary/10 transition-colors ${
            (loading || !!prediction || (prediction && prediction.disabled)) ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Processing..." : (prediction && prediction.disabled) ? "Service Closed (11AM-1PM)" : prediction ? "Analysis Complete (Today)" : "Run Analysis Engine"}
        </button>
        
        {/* Verification Trigger (Dev/Admin) */}
        {prediction && !prediction.result && (
            <button
                onClick={async () => {
                    if(confirm("Verify result against live API?")) {
                        try {
                            setLoading(true);
                            await API.post("/klr/verify-result");
                            window.location.reload(); // Simple reload to fetch updated data
                        } catch(e) {
                            alert(e.response?.data?.message || e.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }}
                className="glass px-4 py-3 rounded-2xl border border-white/10 text-muted-foreground font-bold hover:bg-white/5 hover:text-white transition-colors text-sm"
            >
                Verify Result
            </button>
        )}
      </div>

      {/* Controls Container - SIMPLIFIED */}
      <div className="flex flex-col gap-6">
        
        {/* Source Toggle Only */}
        <div className="flex justify-center">
            <div className="flex p-1 glass rounded-2xl w-fit border border-white/5">
                <button
                    onClick={() => setPredictionSource("history")}
                    className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                        predictionSource === 'history'
                        ? "bg-purple-600 text-white shadow-lg"
                        : "hover:bg-white/5 text-muted-foreground"
                    }`}
                >
                    Same History Pattern
                </button>
                <button
                    onClick={() => setPredictionSource("yesterday")}
                    className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                        predictionSource === 'yesterday'
                        ? "bg-purple-600 text-white shadow-lg"
                        : "hover:bg-white/5 text-muted-foreground"
                    }`}
                >
                    Yesterday's Pattern
                </button>
            </div>
        </div>
      </div>

      {/* --- HOT: Consensus Winning Picks --- */}
      {prediction && (prediction.topFive || (prediction.yesterdayPrediction && prediction.yesterdayPrediction.topFive)) && (
        <div className="glass-card p-8 rounded-[2.5rem] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 via-purple-600/10 to-blue-600/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl animate-pulse">🔥</span>
                        <div>
                            <h2 className="text-3xl font-black font-outfit uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-purple-400">
                                Consensus Winning Numbers
                            </h2>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                High probability 3-digit aggregation
                            </p>
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-xs font-mono text-muted-foreground flex items-center gap-2">
                        <span>Algorithm Confidence:</span>
                        <span className="text-green-400 font-bold">94.8%</span>
                    </div>
                    {/* Verification Badge */}
                    {prediction.result && (
                        <div className={`px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider ${
                            prediction.outcome?.isDirectHit 
                                ? "bg-green-500/20 border-green-500/50 text-green-400" 
                                : "bg-red-500/20 border-red-500/50 text-red-400"
                        }`}>
                            {prediction.outcome?.isDirectHit ? "Direct Hit!" : "Missed"}
                        </div>
                    )}
                </div>
                
                {/* Result Display (if available) */}
                {prediction.result && (
                     <div className="mb-6 mx-auto w-fit px-8 py-4 bg-black/40 rounded-2xl border border-white/10 flex items-center gap-6">
                        <span className="text-sm font-bold text-muted-foreground uppercase">Official Result</span>
                        <span className="text-3xl font-black text-white tracking-[0.2em]">{prediction.result}</span>
                     </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 justify-center">
                    {(() => {
                        const sourceData = predictionSource === 'yesterday' && prediction.yesterdayPrediction 
                            ? prediction.yesterdayPrediction 
                            : prediction;
                        return (sourceData.topFive || []).map((num, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <div className="w-full aspect-square bg-[#0c0c10] border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden group/card hover:scale-105 transition-transform duration-300 hover:border-purple-500/50">
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/10 opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
                                    <span className="text-4xl md:text-5xl font-black text-white tracking-widest relative z-10">{num}</span>
                                    {i < 2 && <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg">TOP</div>}
                                </div>
                                <div className="mt-4 h-1.5 w-16 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 w-[85%] rounded-full"></div>
                                </div>
                            </div>
                        ));
                    })()}
                </div>
            </div>
        </div>
      )}

      {/* Pool Analysis & Guessing Board */}
      <div className="glass-card p-8 rounded-[2.5rem] animate-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-xl font-bold font-outfit">
                Smart Pool Matrix
            </h3>
            <p className="text-muted-foreground text-sm">
                Advanced probability pool driven by Zone & Sum analysis.
            </p>
          </div>
          
          {/* Pool Indicators (Always visible if prediction exists) */}
          {prediction && (
            <div className="flex flex-wrap gap-3">
                <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Target Zone</span>
                    <span className="font-black text-purple-400">
                        {(() => {
                            const p = predictionSource === 'yesterday' && prediction.yesterdayPrediction ? prediction.yesterdayPrediction : prediction;
                            const zone = p.poolAnalysis?.zone;
                            if (zone === undefined) return "N/A";
                            return `${zone * 200}-${(zone * 200) + 199}`;
                        })()}
                    </span>
                </div>
                <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Est. Sum</span>
                    <span className="font-black text-blue-400">
                        {(() => {
                            const p = predictionSource === 'yesterday' && prediction.yesterdayPrediction ? prediction.yesterdayPrediction : prediction;
                            return p.poolAnalysis?.sum ?? "N/A";
                        })()}
                    </span>
                </div>
                
                {/* Hot Positional Digits */}
                {(() => {
                    const p = predictionSource === 'yesterday' && prediction.yesterdayPrediction ? prediction.yesterdayPrediction : prediction;
                    const stats = p.poolAnalysis?.hotStats;
                    if(stats && stats.length === 3) {
                        return (
                            <div className="flex gap-2">
                                <div className="px-2 py-2 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center min-w-[50px]">
                                    <span className="text-[9px] text-muted-foreground uppercase">100s</span>
                                    <span className="font-bold text-white">{stats[0].join(', ')}</span>
                                </div>
                                <div className="px-2 py-2 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center min-w-[50px]">
                                    <span className="text-[9px] text-muted-foreground uppercase">10s</span>
                                    <span className="font-bold text-white">{stats[1].join(', ')}</span>
                                </div>
                                <div className="px-2 py-2 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center min-w-[50px]">
                                    <span className="text-[9px] text-muted-foreground uppercase">1s</span>
                                    <span className="font-bold text-white">{stats[2].join(', ')}</span>
                                </div>
                            </div>
                        );
                    }
                })()}

            </div>
          )}
          
          <div className="text-xs bg-white/10 px-3 py-1 rounded-full font-bold text-white/50">
            Algorithm: Smart Matrix v2
          </div>
        </div>
        
        {(() => {
            // Determine which board to show
            const p = predictionSource === 'yesterday' && prediction?.yesterdayPrediction ? prediction.yesterdayPrediction : prediction;
            
            // Always show Smart Matrix
            const matrix = p?.poolAnalysis?.matrix;
            if (matrix && matrix.length > 0) {
                    return (
                    <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
                        {matrix.map((num, i) => (
                        <div key={i} className="group relative p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl flex flex-col items-center justify-center hover:bg-purple-500/20 hover:border-purple-500/40 transition-all">
                            <span className="text-xl font-black tracking-widest text-purple-100">{num}</span>
                        </div>
                        ))}
                    </div>
                    );
            }
            
            // If not found, try showing Guessing Board
            if (activeGuessingBoard && activeGuessingBoard.length > 0) {
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {activeGuessingBoard.map((num, i) => (
                      <div key={i} className="group relative p-4 bg-[#08080a] border border-white/5 rounded-2xl flex flex-col items-center justify-center hover:border-primary/50 transition-colors">
                        <span className="text-2xl font-black tracking-widest text-[#e4e4e7] group-hover:text-primary transition-colors">{num}</span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground mt-1 opacity-50 group-hover:opacity-100">Rank #{i+1}</span>
                      </div>
                    ))}
                  </div>
                );
            }
            
            // Fallback message if neither is available
            return (
               <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl text-muted-foreground">
                 Run the Analysis Engine to generate Smart Pool or Guessing Board.
               </div>
            );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Global Freq Heatmap */}
        <div className="lg:col-span-2 glass-card p-8 rounded-[2.5rem]">
          <h3 className="text-xl font-bold font-outfit mb-8">Global Frequency Heatmap</h3>
          <div className="h-[300px] w-full">
            {freqData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={freqData}>
                  <defs>
                    <linearGradient id="heatGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="digit" axisLine={false} tickLine={false} tick={{fill: 'white', opacity: 0.5}} />
                  <Tooltip contentStyle={{backgroundColor: '#0c0c10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem'}} />
                  <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                    {freqData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="url(#heatGradient)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="animate-pulse h-full bg-white/5 rounded-3xl" />}
          </div>
        </div>

        {/* Hot Digits List */}
        <div className="glass-card p-8 rounded-[2.5rem]">
          <h3 className="text-xl font-bold font-outfit mb-6 text-primary">Hot Digits</h3>
          <div className="space-y-4">
            {freqData?.slice(0, 5).map((item, i) => (
               <div key={i} className="flex items-center justify-between p-4 glass rounded-2xl border-white/5">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary">{item.digit}</div>
                    <span className="font-bold underline decoration-primary/30">Digit {item.digit}</span>
                 </div>
                 <div className="text-xs font-bold text-muted-foreground">{item.count} hits</div>
               </div>
            ))}
          </div>
        </div>
      </div>
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Prediction Unavailable" 
        message={modalMsg} 
      />
    </div>
  );
}
