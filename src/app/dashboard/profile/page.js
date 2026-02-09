"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState("");

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  // Delete Confirmation State
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = () => {
    const token = localStorage.getItem("token");
    if (!token) {
        router.push("/login");
        return;
    }

    fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to fetch profile");
        return res.json();
    })
    .then(data => {
      setUser(data);
      setNewName(data.name);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
      // specific error handling could go here
    });
  };

  const handleUpdateProfile = async () => {
    setFeedback({ type: "", message: "" });
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ name: newName })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      setUser(data);
      setIsEditing(false);
      setFeedback({ type: "success", message: "Profile updated successfully!" });
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setFeedback({ type: "", message: "" });
    const token = localStorage.getItem("token");
    
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(passwords)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");

      setShowPasswordModal(false);
      setPasswords({ currentPassword: "", newPassword: "" });
      setFeedback({ type: "success", message: "Password changed successfully!" });
    } catch (err) {
        // Show error inside modal if possible, or general feedback
        setFeedback({ type: "error", message: err.message });
    }
  };

  const confirmDeleteAccount = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/users/me", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete account");
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user"); // clear any other user data
      router.push("/login");
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
      setShowDeleteModal(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading profile...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
        {/* Feedback Toast */}
        {feedback.message && (
            <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 ${
                feedback.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
            }`}>
                {feedback.message}
                <button onClick={() => setFeedback({ type: "", message: "" })} className="ml-4 opacity-70 hover:opacity-100">
                    ✕
                </button>
            </div>
        )}

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
          
          {isEditing ? (
            <div className="w-full mb-4 relative z-10">
                <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-center text-xl font-bold font-outfit focus:outline-none focus:border-primary/50"
                />
                <div className="flex gap-2 mt-4 justify-center">
                    <button onClick={handleUpdateProfile} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold">Save</button>
                    <button onClick={() => { setIsEditing(false); setNewName(user.name); }} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold">Cancel</button>
                </div>
            </div>
          ) : (
            <>
                <h2 className="text-2xl font-black font-outfit mb-1 relative z-10">{user?.name}</h2>
                <p className="text-primary font-bold text-xs uppercase tracking-widest mb-6 relative z-10">{user?.role || "Member"}</p>
            </>
          )}

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

          {!isEditing && (
            <button 
                onClick={() => setIsEditing(true)}
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-sm hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
            >
                Edit Information
            </button>
          )}
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
                <button 
                    onClick={() => setShowPasswordModal(true)}
                    className="px-6 py-2 glass rounded-xl text-xs font-bold hover:bg-white/10 transition-colors"
                >
                    Update
                </button>
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
            <button 
                onClick={() => setShowDeleteModal(true)}
                className="px-8 py-3 glass border-red-500/20 text-red-500 rounded-xl font-bold text-xs hover:bg-red-500/10 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)}></div>
            <div className="relative w-full max-w-md glass-card p-8 rounded-[2rem] animate-in zoom-in-95 duration-200">
                <h3 className="text-2xl font-black font-outfit mb-6">Change Password</h3>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Current Password</label>
                        <input 
                            type="password" 
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors"
                            value={passwords.currentPassword}
                            onChange={(e) => setPasswords({...passwords, currentPassword: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">New Password</label>
                        <input 
                            type="password" 
                            required
                            minLength={6}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors"
                            value={passwords.newPassword}
                            onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                        />
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors">Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">Update Password</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
            <div className="relative w-full max-w-md glass-card p-8 rounded-[2rem] animate-in zoom-in-95 duration-200 border-red-500/20">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-3xl mb-6 border border-red-500/20 text-red-500">
                        ⚠️
                    </div>
                    <h3 className="text-2xl font-black font-outfit mb-3">Delete Account?</h3>
                    <p className="text-muted-foreground mb-8">
                        This action cannot be undone. All your data will be permanently removed.
                    </p>
                    <div className="flex w-full gap-4">
                        <button 
                            onClick={() => setShowDeleteModal(false)} 
                            className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDeleteAccount} 
                            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 hover:scale-[1.02] transition-transform"
                        >
                            Yes, Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
