"use client";
import { useState } from "react";
import API from "@/app/lib/api";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post("/auth/register", form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      toast.success("Account created successfully!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#08080a] p-6 relative">
      <Link href="/" className="absolute top-10 left-10 glass p-3 rounded-2xl hover:bg-white/5 transition-colors text-xl" title="Back to Home">
        🏠
      </Link>
      <Toaster position="bottom-center" />
      <div className="glass-card p-10 rounded-[2.5rem] w-full max-w-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none rotate-12">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>

        <div className="text-center mb-10">
          <Link href="/" className="text-3xl font-black font-outfit tracking-tighter mb-4 inline-block">
            <span className="bg-primary px-3 py-1 rounded-xl text-primary-foreground">K</span> LOT
          </Link>
          <h2 className="text-2xl font-bold font-outfit">Create Account</h2>
          <p className="text-muted-foreground text-sm mt-1">Join the elite prediction platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Full Name</label>
            <input
              name="name"
              type="text"
              required
              placeholder="John Doe"
              onChange={handleChange}
              className="w-full px-6 py-4 glass rounded-2xl border-white/5 focus:border-primary/50 transition-colors outline-none text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Email Address</label>
            <input
              name="email"
              type="email"
              required
              placeholder="name@example.com"
              onChange={handleChange}
              className="w-full px-6 py-4 glass rounded-2xl border-white/5 focus:border-primary/50 transition-colors outline-none text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Password</label>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
              onChange={handleChange}
              className="w-full px-6 py-4 glass rounded-2xl border-white/5 focus:border-primary/50 transition-colors outline-none text-white"
            />
          </div>
          
          <button 
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg hover:scale-[1.02] transition-transform animate-glow disabled:opacity-50 disabled:scale-100"
          >
            {loading ? "Creating Account..." : "Register Now"}
          </button>
        </form>

        <p className="text-sm text-center mt-8 text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
