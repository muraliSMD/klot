"use client";
import { useEffect, useState } from "react";
import API from "@/app/lib/api";
import { toast, Toaster } from "react-hot-toast";

export default function UsersManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get("/users");
        setUsers(res.data);
      } catch (err) {
        toast.error(err.response?.data?.error || "Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Toaster position="bottom-center" />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black font-outfit tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Monitor and manage all application members.</p>
        </div>
        <div className="glass px-6 py-3 rounded-2xl border border-primary/20">
          <span className="text-xs text-primary font-bold uppercase block tracking-widest">Total Members</span>
          <span className="text-xl font-black">{users.length} Active</span>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-[2.5rem]">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xl font-bold font-outfit">Member Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5">
                <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">User</th>
                <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</th>
                <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Role</th>
                <th className="p-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-t border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary border border-primary/10">
                        {user.name[0]}
                      </div>
                      <span className="font-bold font-outfit">{user.name}</span>
                    </div>
                  </td>
                  <td className="p-6 text-muted-foreground">{user.email}</td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      user.role === "admin" ? "bg-primary/20 text-primary border border-primary/20" : "bg-white/5 text-muted-foreground"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-6 text-xs text-muted-foreground font-medium">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-20 text-center text-muted-foreground">No users found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
