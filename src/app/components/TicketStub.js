"use client";
import { useState } from "react";

export default function TicketStub({
  prizeTitle = "1ST PRIZE",
  drawCode = "BT-72",
  prizeAmount = "₹1,00,00,000 (1 Crore)",
  series = "BV",
  seriesLabel = "SERIES",
  number = "635205",
  subtext = "Tap the number to copy it",
  badgeColor = "gold", // 'gold' | 'emerald' | 'purple'
  onCopy = null
}) {
  const [copied, setCopied] = useState(false);

  // Normalize number string or array
  const digits = typeof number === "string" 
    ? number.replace(/\s+/g, "").split("") 
    : Array.isArray(number) 
      ? number 
      : ["0", "0", "0", "0", "0", "0"];

  const handleCopy = () => {
    const fullNumber = digits.join("");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullNumber);
    }
    setCopied(true);
    if (onCopy) onCopy(fullNumber);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBadgeStyle = () => {
    switch (badgeColor) {
      case "emerald":
        return "border-emerald-500/60 text-emerald-400 bg-emerald-500/10";
      case "purple":
        return "border-purple-500/60 text-purple-300 bg-purple-500/10";
      default:
        return "border-[#d4af37]/70 text-[#f5c542] bg-[#d4af37]/10";
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-2 select-none animate-in fade-in zoom-in-95 duration-500">
      {/* Top Ticket Header Details */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 text-xs">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm shrink-0 ${getBadgeStyle()}`}>
            <span>🎟️</span> {prizeTitle}
          </span>
          {drawCode && (
            <span className="text-white/70 font-mono font-bold text-[10px] uppercase tracking-wider truncate max-w-[140px]">
              {drawCode}
            </span>
          )}
        </div>
        {prizeAmount && (
          <div className="text-right shrink-0">
            <span className="text-[#f5c542] font-black text-xs sm:text-base md:text-lg font-outfit drop-shadow-[0_2px_10px_rgba(245,197,66,0.3)]">
              {prizeAmount}
            </span>
          </div>
        )}
      </div>

      {/* Main Ticket Stub Container */}
      <div 
        onClick={handleCopy}
        className="relative group cursor-pointer bg-gradient-to-r from-[#0d0f15] via-[#121622] to-[#0d0f15] border border-white/10 hover:border-primary/40 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xl transition-all duration-300 overflow-hidden"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)`,
          backgroundSize: '16px 16px'
        }}
      >
        {/* Holographic / Shimmer overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />

        <div className="flex items-center gap-2 sm:gap-4 relative z-10 min-w-0">
          
          {/* Left Ticket Stub Section (Series Code with Torn Divider) */}
          <div className="relative flex flex-col items-center justify-center shrink-0 pr-2.5 sm:pr-4 border-r-2 border-dashed border-white/20 my-0.5">
            {/* Top & Bottom Perforation Notches anchored to torn divider line */}
            <div className="absolute -top-[19px] sm:-top-[25px] -right-[9px] w-4 h-4 rounded-full bg-[#08080a] border-b border-white/15 z-20" />
            <div className="absolute -bottom-[19px] sm:-bottom-[25px] -right-[9px] w-4 h-4 rounded-full bg-[#08080a] border-t border-white/15 z-20" />

            <div className="w-7 h-7 sm:w-10 sm:h-10 border border-rose-400/80 rounded-lg sm:rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-300 font-black text-xs sm:text-sm shadow-md">
              {series}
            </div>
            <span className="text-[7px] sm:text-[9px] font-black text-white/50 uppercase tracking-widest mt-1">
              {seriesLabel}
            </span>
          </div>

          {/* Right Section: Digits and Copy Action */}
          <div className="flex-1 min-w-0 flex items-center justify-between gap-1 sm:gap-2">
            {/* Number Digits Row */}
            <div className="flex-1 flex items-center justify-center gap-1 sm:gap-2 min-w-0">
              {digits.map((digit, idx) => (
                <div
                  key={idx}
                  className="flex-1 max-w-[44px] min-w-[22px] h-9 sm:h-12 md:h-14 bg-[#161a24] border border-white/15 rounded-md sm:rounded-xl flex items-center justify-center text-sm sm:text-xl md:text-2xl font-black text-white shadow-inner group-hover:border-primary/40 group-hover:scale-105 transition-all duration-200"
                >
                  {digit}
                </div>
              ))}
            </div>

            {/* Copy Action Icon */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className={`w-7 h-9 sm:w-10 sm:h-12 rounded-md sm:rounded-xl border flex items-center justify-center transition-all ${
                  copied
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 scale-105"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                title="Copy Ticket Number"
              >
                {copied ? (
                  <span className="text-xs font-bold animate-bounce">✓</span>
                ) : (
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 012-2v-8a2 2 0 01-2-2h-8a2 2 0 01-2 2v8a2 2 0 012 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Subtext info */}
      <div className="flex items-center justify-center text-[10px] text-white/40 px-1 font-medium text-center truncate">
        <span>
          {copied ? (
            <span className="text-emerald-400 font-bold animate-pulse">Copied to clipboard!</span>
          ) : (
            subtext
          )}
        </span>
      </div>
    </div>
  );
}
