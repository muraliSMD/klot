"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    
    // Fetch real user profile
    fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      if (res.ok) return res.json();
      throw new Error("Failed to fetch profile");
    })
    .then(data => {
      setUser(data);
      setLoading(false);
    })
    .catch(() => {
      // If fetch fails (invalid token), logout
      localStorage.removeItem("token");
      router.push("/login");
    });
  }, [router]);

  // Close mobile menu on path change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    router.push("/login");
  };

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: "📊" },
    { name: "Predict", href: "/dashboard/predict", icon: "✨" },
    { name: "AI Predictor", href: "/dashboard/ai-predictor", icon: "🧠" },
    { name: "History", href: "/dashboard/history", icon: "🕒" },
    { name: "Profile", href: "/dashboard/profile", icon: "👤" },
  ];

  if (user?.role === "admin") {
    navItems.push({ name: "Users", href: "/dashboard/users", icon: "👥" });
  }

  if (loading) return (
    <div className="min-h-screen bg-[#08080a] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#08080a] text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      
      {/* Mobile Sticky Top Header Bar */}
      <header className="md:hidden sticky top-0 z-40 glass border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black font-outfit tracking-tighter flex items-center gap-1.5">
          <span className="bg-primary px-2 py-0.5 rounded-lg text-primary-foreground text-lg shadow-md shadow-primary/30">K</span>
          LOT
        </Link>

        <div className="flex items-center gap-3">
          <Link 
            href="/dashboard/profile" 
            className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary/40 border border-primary/20 flex items-center justify-center font-black text-white text-sm"
          >
            {user?.name?.[0]?.toUpperCase() || "U"}
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl glass border border-white/10 text-white focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Nav Slide-out Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/80 backdrop-blur-md flex flex-col pt-16 p-6 animate-in fade-in duration-300">
          <nav className="space-y-3 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl font-bold text-base transition-all ${
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-white/10 space-y-3">
            {user?.role !== "admin" && (
              <div className="p-4 glass-card rounded-2xl border-primary/20 mb-2 bg-gradient-to-b from-primary/5 to-transparent">
                <p className="text-[10px] font-bold text-primary mb-1 uppercase tracking-widest">Subscription Plan</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-white">Free Standard</span>
                  <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded-md font-bold text-white/70">Active</span>
                </div>
                <button className="w-full py-2.5 bg-primary text-primary-foreground hover:scale-102 rounded-xl font-bold text-xs shadow-md transition-all">
                  Upgrade to Pro Plan
                </button>
              </div>
            )}

            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl font-bold text-red-400 bg-red-500/10 border border-red-500/20"
            >
              <span className="text-xl">🚪</span>
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-72 lg:w-80 glass border-r border-white/5 p-6 lg:p-8 flex-col z-20 shrink-0 h-screen sticky top-0">
        <div className="mb-10">
          <Link href="/" className="text-3xl font-black font-outfit tracking-tighter flex items-center gap-2">
            <span className="bg-primary px-2.5 py-1 rounded-xl text-primary-foreground shadow-lg shadow-primary/30">K</span>
            LOT
          </Link>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-5 py-3.5 lg:px-6 lg:py-4 rounded-2xl font-bold transition-all duration-300 ${
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-102" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
          {user?.role !== "admin" && (
            <div className="p-5 glass-card rounded-2xl border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
              <p className="text-[10px] font-bold text-primary mb-1 uppercase tracking-widest">Subscription Plan</p>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-bold text-white">Free Standard</span>
                <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/70 rounded-md font-bold">Active</span>
              </div>
              <button className="w-full py-2.5 bg-primary text-primary-foreground hover:scale-102 rounded-xl font-bold text-xs shadow-lg shadow-primary/20 transition-all">
                Upgrade to Pro Plan
              </button>
            </div>
          )}

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl font-bold text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <span className="text-xl">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area (Fluid for all screen widths) */}
      <main className="flex-1 p-4 sm:p-6 md:p-10 lg:p-14 max-w-full w-full relative min-h-screen overflow-x-hidden">
        {/* Desktop Header */}
        <header className="hidden md:flex justify-between items-center mb-8 lg:mb-12">
          <div>
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Dashboard</span>
            <div className="text-sm text-muted-foreground mt-0.5">Welcome back, <span className="text-white font-bold">{user?.name}</span></div>
          </div>
          <div className="flex gap-3 items-center">
             <div className="w-11 h-11 rounded-2xl glass flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors border border-white/10 text-lg">
               🔔
             </div>
             <Link href="/dashboard/profile" className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-primary/40 border border-primary/20 flex items-center justify-center font-black text-white cursor-pointer hover:scale-105 transition-transform shadow-lg shadow-primary/20">
               {user?.name?.[0]?.toUpperCase() || "U"}
             </Link>
          </div>
        </header>

        {children}
      </main>

    </div>
  );
}
