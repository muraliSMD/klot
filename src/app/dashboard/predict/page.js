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

  const [activeTab, setActiveTab] = useState("Linear Trend");
  const [viewMode, setViewMode] = useState("standard"); // 'standard' | '3digit'

  const STANDARD_TABS = ["Linear Trend", "Average Velocity", "Mirror Pattern", "Date Flow", "Delta Pattern-A"];
  const THREE_DIGIT_TABS = ["Direct", "Reverse", "Complement", "Shift +1", "Shift -1"];

  const TABS = viewMode === "3digit" ? THREE_DIGIT_TABS : STANDARD_TABS;

  // Reset active tab when mode changes
  useEffect(() => {
    setActiveTab(TABS[0]);
  }, [viewMode]);

  // New state for prediction source
  const [predictionSource, setPredictionSource] = useState("history"); // 'history' | 'yesterday'

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMsg, setModalMsg] = useState("");

  // Helper to generate variations on client-side to keep the rich UI
  const getDisplayVariations = () => {
    if (!prediction) return [];
    
    // Select data based on source
    let currentData = prediction;
    if (predictionSource === 'yesterday' && prediction.yesterdayPrediction) {
        currentData = prediction.yesterdayPrediction;
    }

    // Handle 3-Digit Mode
    if (viewMode === "3digit") {
        const threeDigitData = currentData.threeDigit || {};
        const base = threeDigitData[activeTab];
        
        if (!base) return [];

        return [
            { name: activeTab, num: base, icon: "🎯", prob: "98%" },
            { name: "Variation (+1)", num: base.split('').map(d => (parseInt(d)+1)%10).join(''), icon: "🔼", prob: "88%" },
            { name: "Variation (-1)", num: base.split('').map(d => (parseInt(d)+9)%10).join(''), icon: "🔽", prob: "82%" }
        ];
    }

    // Standard Mode
    // Get the base number for the selected algorithm
    // Fallback to first predicted number if specific algo not found (backward compat)
    const base = currentData.algorithms && currentData.algorithms[activeTab] 
      ? currentData.algorithms[activeTab] 
      : currentData.predictedNumbers?.[0];

    if (!base) return [];

    return [
      { name: activeTab, num: base, icon: "🎯", prob: "96%" },
      { name: "Variation (+1)", num: base.split('').map(d => (parseInt(d)+1)%10).join(''), icon: "🔼", prob: "85%" },
      { name: "Variation (-1)", num: base.split('').map(d => (parseInt(d)+9)%10).join(''), icon: "🔽", prob: "78%" }
    ];
  };

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
      </div>

      {/* Controls Container */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        {/* Source Toggle */}
        <div className="flex p-1 glass rounded-2xl w-fit border border-white/5">
            <button
                onClick={() => setPredictionSource("history")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    predictionSource === 'history'
                    ? "bg-primary text-white shadow-lg"
                    : "hover:bg-white/5 text-muted-foreground"
                }`}
            >
                Same History
            </button>
            <button
                onClick={() => setPredictionSource("yesterday")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    predictionSource === 'yesterday'
                    ? "bg-primary text-white shadow-lg"
                    : "hover:bg-white/5 text-muted-foreground"
                }`}
            >
                Yesterday's Pattern
            </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex p-1 glass rounded-2xl w-fit border border-white/5">
            <button
                onClick={() => setViewMode("standard")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    viewMode === 'standard'
                    ? "bg-purple-600 text-white shadow-lg"
                    : "hover:bg-white/5 text-muted-foreground"
                }`}
            >
                Standard
            </button>
            <button
                onClick={() => setViewMode("3digit")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    viewMode === '3digit'
                    ? "bg-purple-600 text-white shadow-lg"
                    : "hover:bg-white/5 text-muted-foreground"
                }`}
            >
                3-Digit Focus
            </button>
        </div>

        {/* Algorithm Tabs */}
        <div className="flex flex-wrap gap-2 p-1 glass rounded-2xl w-fit border border-white/5">
            {TABS.map(tab => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab 
                    ? "bg-primary text-white shadow-lg" 
                    : "hover:bg-white/5 text-muted-foreground"
                }`}
            >
                {tab}
            </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {getDisplayVariations().map((item, idx) => (
            <div key={idx} className="glass-card p-8 rounded-[2rem] border-primary/10 bg-primary/5 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
              <div className="w-12 h-12 rounded-full glass mb-4 flex items-center justify-center text-2xl shadow-xl border border-white/5">
                {item.icon}
              </div>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">Strategy: {item.name}</span>
              <div className="flex gap-1.5 mb-5">
                {item.num.split("").map((digit, i) => (
                  <div key={i} className="w-9 h-11 bg-[#08080a] border border-white/5 rounded-lg flex items-center justify-center text-lg font-black text-white relative group">
                    <span className="relative z-10">{digit}</span>
                  </div>
                ))}
              </div>
              <div className="w-full flex justify-between items-center mb-3">
                 <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">Win Probability</span>
                 <span className="text-xs font-black text-primary">{item.prob}</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary" 
                  style={{ width: item.prob }}
                ></div>
              </div>
            </div>
        ))}
      </div>

      {/* Pool Analysis & Guessing Board */}
      <div className="glass-card p-8 rounded-[2.5rem] animate-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-xl font-bold font-outfit">
                {viewMode === '3digit' ? "Architectural Pool Matrix" : "Ending Number Matrix"}
            </h3>
            <p className="text-muted-foreground text-sm">
                {viewMode === '3digit' 
                    ? "Advanced probability pool driven by Zone & Sum analysis." 
                    : `High-probability 4-digit permutations based on ${predictionSource === 'yesterday' ? "Yesterday's Result" : "Historical Patterns"}.`
                }
            </p>
          </div>
          
          {/* Pool Indicators (Only in 3-Digit Mode) */}
          {viewMode === '3digit' && prediction && (
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
            Algorithm: {viewMode === '3digit' ? "Smart Matrix v2" : "Permutation-X"}
          </div>
        </div>
        
        {(() => {
            // Determine which board to show
            const p = predictionSource === 'yesterday' && prediction?.yesterdayPrediction ? prediction.yesterdayPrediction : prediction;
            
            // If 3-digit mode, try to show the Smart Matrix
            if (viewMode === '3digit') {
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
            }
            
            // Fallback / Standard Mode
            const activeGuessingBoard = p?.guessingBoard; // Re-calculate locally vs using state to ensure sync
            
            if (activeGuessingBoard) {
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
            
            return (
               <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl text-muted-foreground">
                 Run the Analysis Engine to generate {viewMode === '3digit' ? "Smart Pool" : "Ending Permutations"}.
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
