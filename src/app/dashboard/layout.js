"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    router.push("/login");
  };

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: "📊" },
    { name: "Predict", href: "/dashboard/predict", icon: "✨" },
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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#08080a]">
      {/* Sidebar */}
      <aside className="w-full md:w-80 glass border-r border-white/5 p-8 flex flex-col z-20">
        <div className="mb-12">
          <Link href="/" className="text-3xl font-black font-outfit tracking-tighter flex items-center gap-2">
            <span className="bg-primary p-2 rounded-xl text-primary-foreground shadow-lg shadow-primary/30">K</span>
            LOT
          </Link>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all duration-300 ${
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-105" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 pt-8 border-t border-white/5">
           <button 
             onClick={handleLogout}
             className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-red-500 hover:bg-red-500/10 transition-colors"
           >
             <span className="text-xl">🚪</span>
             Sign Out
           </button>
        </div>

        <div className="mt-8 p-6 glass-card rounded-3xl border-primary/20">
          <p className="text-xs font-bold text-primary mb-2 uppercase tracking-widest">Premium Status</p>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xl font-bold">Standard</span>
            <span className="text-xs px-2 py-1 bg-white/10 rounded-md">Free</span>
          </div>
          <button className="w-full py-3 glass hover:bg-white/5 text-white rounded-xl font-bold text-xs border border-white/10 transition-colors">
            Upgrade Now
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-16 max-w-full mx-auto w-full relative h-[100vh] overflow-y-scroll scrollbar-hide">
        <header className="flex justify-between items-center mb-12">
          <div>
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Dashboard</span>
            <div className="text-sm text-muted-foreground mt-1">Welcome back, <span className="text-white font-bold">{user?.name}</span></div>
          </div>
          <div className="flex gap-4">
             <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors border border-white/10">
               🔔
             </div>
             <Link href="/dashboard/profile" className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-primary/40 border border-primary/20 flex items-center justify-center font-black text-white cursor-pointer hover:scale-105 transition-transform shadow-lg shadow-primary/20">
               {user?.name?.[0]?.toUpperCase() || "U"}
             </Link>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
