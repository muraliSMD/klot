"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setUser(data);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading profile...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black font-outfit tracking-tight">Account Profile</h1>
          <p className="text-muted-foreground">Manage your credentials and subscription preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="glass-card p-10 rounded-[2.5rem] relative overflow-hidden flex flex-col items-center text-center">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/20 to-transparent"></div>
          <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-primary to-primary/40 p-1 relative z-10 mb-6 shadow-2xl shadow-primary/20">
            <div className="w-full h-full rounded-full bg-[#08080a] flex items-center justify-center text-4xl font-black text-white">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
          <h2 className="text-2xl font-black font-outfit mb-1 relative z-10">{user?.name}</h2>
          <p className="text-primary font-bold text-xs uppercase tracking-widest mb-6 relative z-10">{user?.role || "Member"}</p>
          <p className="text-muted-foreground text-sm mb-6">{user?.email}</p>
          
          <div className="w-full grid grid-cols-2 gap-4 mb-8">
            <div className="glass p-4 rounded-2xl">
              <span className="block text-[10px] font-bold text-muted-foreground uppercase opacity-50 mb-1">Joined</span>
              <span className="text-lg font-black">{new Date(user?.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="glass p-4 rounded-2xl">
              <span className="block text-[10px] font-bold text-muted-foreground uppercase opacity-50 mb-1">Status</span>
              <span className="text-lg font-black font-outfit text-green-500">Active</span>
            </div>
          </div>

          <button className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-sm hover:scale-105 transition-transform flex items-center justify-center gap-2 opacity-50 cursor-not-allowed" disabled>
            Edit Information (Coming Soon)
          </button>
        </div>

        {/* Settings Area */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-8 rounded-[2rem]">
            <h3 className="text-xl font-bold font-outfit mb-6">Security Settings</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-6 glass rounded-2xl border-white/5 hover:border-primary/20 transition-colors">
                <div>
                  <div className="font-bold">Password</div>
                  <div className="text-xs text-muted-foreground">Securely encrypted</div>
                </div>
                <button className="px-6 py-2 glass rounded-xl text-xs font-bold hover:bg-white/10 opacity-50 cursor-not-allowed" disabled>Update</button>
              </div>
              <div className="flex items-center justify-between p-6 glass rounded-2xl border-white/5 hover:border-primary/20 transition-colors">
                <div>
                  <div className="font-bold">Two-Factor Authentication</div>
                  <div className="text-xs text-muted-foreground">Status: <span className="text-red-500 font-bold">DEACTIVATED</span></div>
                </div>
                <button className="px-6 py-2 bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold opacity-50 cursor-not-allowed" disabled>Enable Now</button>
              </div>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[2rem] border-red-500/10 bg-red-500/5">
            <h3 className="text-lg font-bold font-outfit mb-4 text-red-500">Danger Zone</h3>
            <p className="text-xs text-muted-foreground mb-6">Once you delete your account, there is no going back. Please be certain.</p>
            <button className="px-8 py-3 glass border-red-500/20 text-red-500 rounded-xl font-bold text-xs hover:bg-red-500/10 transition-colors cursor-not-allowed" disabled>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
