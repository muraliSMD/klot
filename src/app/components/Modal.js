"use client";

export default function Modal({ isOpen, onClose, title, message }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* Modal Container */}
      <div className="relative w-full max-w-md glass-card p-8 rounded-[2.5rem] border-primary/20 bg-[#0c0c10]/95 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-6 border border-primary/20">
            ⚠️
          </div>
          
          <h2 className="text-2xl font-black font-outfit text-white mb-3 tracking-tight">
            {title || "Notice"}
          </h2>
          
          <p className="text-muted-foreground leading-relaxed mb-8">
            {message}
          </p>
          
          <button
            onClick={onClose}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:scale-[1.02] transition-transform shadow-xl shadow-primary/20"
          >
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
}
