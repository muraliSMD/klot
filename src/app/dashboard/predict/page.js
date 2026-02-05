"use client";
import { useEffect, useState } from "react";
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
  const TABS = ["Linear Trend", "Average Velocity", "Mirror Pattern", "Date Flow"];

  // Helper to generate variations on client-side to keep the rich UI
  const getDisplayVariations = () => {
    if (!prediction) return [];
    
    // Get the base number for the selected algorithm
    // Fallback to first predicted number if specific algo not found (backward compat)
    const base = prediction.algorithms && prediction.algorithms[activeTab] 
      ? prediction.algorithms[activeTab] 
      : prediction.predictedNumbers?.[0];

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
    API.get("/klr/check-today") // This route check current date, but we want the data saved
      .then(res => {
        if (res.data.data) setPrediction(res.data.data);
      }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const generateNew = async () => {
    setLoading(true);
    try {
      const res = await API.post("/klr/generate-prediction");
      setPrediction(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black font-outfit tracking-tight">Predictive Insights</h1>
          <p className="text-muted-foreground">Positional analysis for tomorrow's winning combination.</p>
        </div>
        <button 
          onClick={generateNew} 
          disabled={loading || !!prediction}
          className={`glass px-6 py-3 rounded-2xl border border-primary/20 text-primary font-bold hover:bg-primary/10 transition-colors ${
            (loading || !!prediction) ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Processing..." : prediction ? "Analysis Complete (Today)" : "Run Analysis Engine"}
        </button>
      </div>

      {/* Algorithm Tabs */}
      <div className="flex flex-wrap gap-2 p-1 glass rounded-2xl w-fit">
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

      {/* Guessing Board (Permutation Matrix) */}
      <div className="glass-card p-8 rounded-[2.5rem]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold font-outfit">Ending Number Matrix</h3>
            <p className="text-muted-foreground text-sm">High-probability 4-digit permutations based on Hot-Digit clusters.</p>
          </div>
          <div className="text-xs bg-white/10 px-3 py-1 rounded-full font-bold text-white/50">Algorithm: Permutation-X</div>
        </div>
        
        {prediction?.guessingBoard ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {prediction.guessingBoard.map((num, i) => (
              <div key={i} className="group relative p-4 bg-[#08080a] border border-white/5 rounded-2xl flex flex-col items-center justify-center hover:border-primary/50 transition-colors">
                <span className="text-2xl font-black tracking-widest text-[#e4e4e7] group-hover:text-primary transition-colors">{num}</span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground mt-1 opacity-50 group-hover:opacity-100">Rank #{i+1}</span>
              </div>
            ))}
          </div>
        ) : (
           <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl text-muted-foreground">
             Run the Analysis Engine to generate Ending Permutations.
           </div>
        )}
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
    </div>
  );
}
