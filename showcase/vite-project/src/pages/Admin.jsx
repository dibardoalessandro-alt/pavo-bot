import React, { useState, useEffect } from 'react'
import { X, Shield, ShieldCheck, MessageSquare } from 'lucide-react'
import { db, generateRandomCode, hashPassword } from '../App'

function AdminLoginView({ setAdminUser, triggerToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const users = db.get("pt_users") || [];
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found) {
      triggerToast("Authentication Failed", "Invalid credentials or unauthorized account.", "error");
      return;
    }

    if (found.passwordHash !== hashPassword(password)) {
      triggerToast("Authentication Failed", "Invalid credentials or unauthorized account.", "error");
      return;
    }

    if (found.role !== 'admin') {
      triggerToast("Access Denied", "Only administrators can access the admin panel.", "error");
      return;
    }

    setAdminUser(found);
    triggerToast("Welcome Back Admin", "Logged in successfully to Admin Shell.", "success");
  };

  return (
    <div className="py-20 relative z-10 text-left flex justify-center items-center">
      <div className="max-w-md w-full bg-brand-card border border-brand-border p-8 rounded-3xl shadow-2xl animate-scale-in">
        <div className="text-center flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-red">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="font-display font-black text-2xl text-white">Administrator Shell</h2>
          <p className="text-brand-textMuted text-xs leading-relaxed max-w-xs text-center text-brand-textMuted">
            Enforced security gateway. Standard accounts are not permitted past this point.
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-brand-textMuted uppercase tracking-wider">Admin Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="admin@pavotweak.com" 
              className="bg-black/40 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-blue transition-all font-display" 
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-brand-textMuted uppercase tracking-wider">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••" 
              className="bg-black/40 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-blue transition-all font-display" 
            />
          </div>

          <button 
            type="submit" 
            className="bg-brand-red hover:bg-[#ff3b47] text-white font-semibold py-3 rounded-xl shadow-lg shadow-brand-red/20 transition-all font-display text-xs tracking-wider uppercase text-center mt-2"
          >
            Authenticate Shell
          </button>
        </form>
      </div>
    </div>
  );
}

function Admin({ setView, triggerToast }) {
  const [adminUser, setAdminUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [keys, setKeys] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ users: 0, sales: 0, revenue: 0, keys: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [keyOutput, setKeyOutput] = useState('PAVO-XXXX-XXXX-XXXX');
  const [releaseForm, setReleaseForm] = useState({ version: '', date: '', notes: '' });

  useEffect(() => {
    if (adminUser) {
      loadData();
    }
  }, [adminUser]);

  const loadData = () => {
    const uList = db.get("pt_users") || [];
    const kList = db.get("pt_keys") || [];
    const oList = db.get("pt_orders") || [];

    setUsers(uList);
    setKeys(kList);
    setOrders(oList);

    let rev = oList.reduce((sum, ord) => sum + ord.price, 0);
    let activeKeysCount = kList.filter(k => k.status === 'active').length;

    setStats({
      users: uList.length,
      sales: oList.length,
      revenue: rev,
      keys: activeKeysCount
    });
  };

  const handleToggleBan = (email) => {
    if (email.toLowerCase() === adminUser.email.toLowerCase()) {
      triggerToast("Banning Blocked", "You cannot ban your own admin account.", "error");
      return;
    }

    let uList = db.get("pt_users") || [];
    uList = uList.map(u => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        u.banned = !u.banned;
      }
      return u;
    });
    db.set("pt_users", uList);
    loadData();
    triggerToast("User Status Updated", "Banned status has been toggled.", "info");

    if (selectedUser && selectedUser.email.toLowerCase() === email.toLowerCase()) {
      const freshUser = uList.find(u => u.email.toLowerCase() === email.toLowerCase());
      setSelectedUser(freshUser);
    }
  };

  const handleDeleteUser = (email) => {
    if (email.toLowerCase() === adminUser.email.toLowerCase()) {
      triggerToast("Deletion Blocked", "You cannot delete your own admin account.", "error");
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete the account for ${email}? This action is irreversible.`)) {
      return;
    }

    let uList = db.get("pt_users") || [];
    uList = uList.filter(u => u.email.toLowerCase() !== email.toLowerCase());
    db.set("pt_users", uList);
    loadData();
    triggerToast("User Deleted", "The account has been removed from the database.", "info");
    setSelectedUser(null);
  };

  const handleGenerateKey = () => {
    const freshKey = "PAVO-" + generateRandomCode(4).toUpperCase() + "-" + generateRandomCode(4).toUpperCase() + "-" + generateRandomCode(4).toUpperCase();
    let kList = db.get("pt_keys") || [];
    kList.push({ key: freshKey, status: 'active', userEmail: null });
    db.set("pt_keys", kList);
    setKeyOutput(freshKey);
    loadData();
    triggerToast("Key Compiled", "New license key written to data tables.", "success");
  };

  const handleDeleteKey = (keyStr) => {
    let kList = db.get("pt_keys") || [];
    kList = kList.filter(k => k.key !== keyStr);
    db.set("pt_keys", kList);
    loadData();
    triggerToast("Key Deleted", "Key removed from database.", "info");
  };

  const handleToggleKeyStatus = (keyStr, newStatus) => {
    let kList = db.get("pt_keys") || [];
    kList = kList.map(k => {
      if (k.key === keyStr) k.status = newStatus;
      return k;
    });
    db.set("pt_keys", kList);
    loadData();
    triggerToast("Key Status Modified", `Key status updated to ${newStatus}.`, "info");
  };

  const handleAddRelease = (e) => {
    e.preventDefault();
    let releases = db.get("pt_releases") || [];
    releases.unshift(releaseForm);
    db.set("pt_releases", releases);
    setReleaseForm({ version: '', date: '', notes: '' });
    loadData();
    triggerToast("Version logs compiled", `Published log files for release v${releaseForm.version}.`, "success");
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    setView('home');
    window.location.hash = '#/home';
    triggerToast("Admin Logged Out", "Administrative session ended.", "info");
  };

  if (!adminUser) {
    return <AdminLoginView setAdminUser={setAdminUser} triggerToast={triggerToast} />;
  }

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getUserOrders = (email) => {
    return orders.filter(o => o.userEmail.toLowerCase() === email.toLowerCase());
  };

  return (
    <div className="py-12 relative z-10 text-left">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-brand-border pb-6 mb-8 gap-4">
          <div>
            <h2 className="font-display font-black text-3xl text-white">Admin Operations Panel</h2>
            <p className="text-brand-textMuted text-sm mt-1">Manage database records, compile system licenses, and publish updates log files.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleAdminLogout}
              className="bg-white/5 hover:bg-white/10 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all border border-brand-border animate-scale-in"
            >
              Exit Shell
            </button>
            <div className="bg-brand-red/10 border border-brand-red/25 text-brand-red text-[10px] font-bold rounded-xl px-4 py-2 tracking-wider uppercase flex items-center justify-center">
              SYSTEM OVERLORD SHELL
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider">Total Users</span>
            <span className="font-display font-black text-3xl text-white">{stats.users}</span>
          </div>
          <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider">Licenses Sold</span>
            <span className="font-display font-black text-3xl text-white">{stats.sales}</span>
          </div>
          <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider">Gross Income</span>
            <span className="font-display font-black text-3xl text-brand-blue">${stats.revenue.toFixed(2)}</span>
          </div>
          <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider">Active Keys</span>
            <span className="font-display font-black text-3xl text-white">{stats.keys}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 flex flex-col gap-8">
            {/* Users manager */}
            <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-display font-bold text-sm tracking-widest text-brand-blue uppercase border-l-2 border-brand-blue pl-3">Registered Users</h3>
                <div className="relative w-full sm:w-64">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search username or email..." 
                    className="bg-black/30 border border-brand-border rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-brand-blue w-full placeholder:text-brand-textMuted font-display"
                  />
                </div>
              </div>
              
              <div className="overflow-x-auto border border-brand-border rounded-xl bg-black/30">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-white/3 border-b border-brand-border text-brand-textMuted font-display font-bold">
                      <th className="px-4 py-3 font-bold">Username</th>
                      <th className="px-4 py-3 font-bold">Email</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold">Purchases</th>
                      <th className="px-4 py-3 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-6 text-center text-brand-textMuted italic">No matching users found.</td>
                      </tr>
                    ) : (
                      filteredUsers.map((u, idx) => {
                        const userOrders = getUserOrders(u.email);
                        return (
                          <tr key={idx} className="border-b border-brand-border/40 hover:bg-white/1">
                            <td className="px-4 py-3 font-semibold text-white">{u.username}</td>
                            <td className="px-4 py-3 text-brand-textMuted">{u.email}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5">
                                <span className={`font-bold px-2 py-0.5 rounded text-[9px] ${u.banned ? 'bg-brand-red/10 text-brand-red' : 'bg-brand-green/10 text-brand-green'}`}>
                                  {u.banned ? 'BANNED' : 'ACTIVE'}
                                </span>
                                <span className={`font-bold px-2 py-0.5 rounded text-[9px] ${u.verified ? 'bg-brand-blue/10 text-brand-blue' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                  {u.verified ? 'VERIFIED' : 'UNVERIFIED'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-white font-bold">{userOrders.length}</td>
                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                              <button 
                                onClick={() => setSelectedUser(u)} 
                                className="bg-white/5 hover:bg-brand-blue/10 hover:text-brand-blue border border-brand-border px-2.5 py-1 rounded transition-colors"
                              >
                                Profile
                              </button>
                              <button 
                                onClick={() => handleToggleBan(u.email)} 
                                className={`border px-2.5 py-1 rounded transition-colors ${u.banned ? 'bg-brand-green/10 text-brand-green border-brand-green/20 hover:bg-brand-green hover:text-white' : 'bg-brand-red/10 text-brand-red border-brand-red/20 hover:bg-brand-red hover:text-white'}`}
                              >
                                {u.banned ? 'Unban' : 'Ban'}
                              </button>
                              {u.role !== 'admin' && (
                                <button 
                                  onClick={() => handleDeleteUser(u.email)} 
                                  className="bg-black/40 hover:bg-brand-red/20 text-brand-textMuted hover:text-brand-red border border-brand-border px-2.5 py-1 rounded transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Key Registry Controller */}
            <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-4">
              <h3 className="font-display font-bold text-sm tracking-widest text-brand-blue uppercase border-l-2 border-brand-blue pl-3">Key Registry Controller</h3>
              
              <div className="bg-white/3 border border-brand-border rounded-xl p-4 flex items-center justify-between gap-4">
                <button onClick={handleGenerateKey} className="bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-md transition-all font-display">Compile Key</button>
                <code className="font-display font-bold text-sm text-brand-blue tracking-wide">{keyOutput}</code>
              </div>

              <div className="overflow-x-auto border border-brand-border rounded-xl bg-black/30">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-white/3 border-b border-brand-border text-brand-textMuted font-display font-bold">
                      <th className="px-4 py-3 font-bold">Key Reference</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold">Assigned User</th>
                      <th className="px-4 py-3 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k, idx) => (
                      <tr key={idx} className="border-b border-brand-border/40 hover:bg-white/1">
                        <td className="px-4 py-3 font-mono font-bold text-brand-blue">{k.key}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold px-2 py-0.5 rounded text-[9px] ${k.status === 'active' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red'}`}>
                            {k.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-brand-textMuted">{k.userEmail ? k.userEmail : 'Unassigned'}</td>
                        <td className="px-4 py-3 text-right flex justify-end gap-2">
                          <button onClick={() => handleDeleteKey(k.key)} className="bg-white/5 hover:bg-brand-red/10 hover:text-brand-red border border-brand-border px-2 py-1 rounded transition-colors">Delete</button>
                          {k.status === 'active' ? (
                            <button onClick={() => handleToggleKeyStatus(k.key, 'banned')} className="bg-white/5 border border-brand-border px-2 py-1 rounded transition-colors">Ban</button>
                          ) : (
                            k.status === 'banned' && (
                              <button onClick={() => handleToggleKeyStatus(k.key, 'active')} className="bg-white/5 border border-brand-border px-2 py-1 rounded transition-colors text-brand-green">Unban</button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-8">
            <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-4">
              <h3 className="font-display font-bold text-sm tracking-widest text-brand-blue uppercase border-l-2 border-brand-blue pl-3 font-semibold">Release Notes compiler</h3>
              <form onSubmit={handleAddRelease} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-brand-textMuted uppercase">Version Number</label>
                  <input type="text" value={releaseForm.version} onChange={(e) => setReleaseForm({...releaseForm, version: e.target.value})} placeholder="e.g. 1.2.5" required className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-brand-textMuted uppercase">Release Date</label>
                  <input type="date" value={releaseForm.date} onChange={(e) => setReleaseForm({...releaseForm, date: e.target.value})} required className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-brand-textMuted uppercase">Changelog description</label>
                  <textarea rows="4" value={releaseForm.notes} onChange={(e) => setReleaseForm({...releaseForm, notes: e.target.value})} placeholder="Notes of changes compiled..." required className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all resize-none" />
                </div>
                <button type="submit" className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold py-2.5 rounded-xl shadow-md transition-all text-xs font-display">Publish Version Log</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {selectedUser && (() => {
        const userOrders = getUserOrders(selectedUser.email);
        return (
          <div className="fixed top-0 left-0 w-full h-full bg-black/80 backdrop-blur-sm z-[1500] flex justify-center items-center p-6" onClick={() => setSelectedUser(null)}>
            <div className="bg-brand-card border border-brand-border p-8 rounded-3xl w-full max-w-[650px] max-h-[90%] overflow-y-auto flex flex-col gap-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center border-b border-brand-border pb-4">
                <h3 className="font-display font-black text-xl text-white">User Profile Details</h3>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-white/5 border border-transparent hover:border-brand-border rounded-lg text-brand-textMuted hover:text-white focus:outline-none">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4 bg-white/2 border border-brand-border/60 p-4 rounded-xl text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-textMuted uppercase font-semibold">Username</span>
                    <span className="text-white font-semibold text-sm">{selectedUser.username}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-textMuted uppercase font-semibold">Email Address</span>
                    <span className="text-white font-semibold text-sm">{selectedUser.email}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-textMuted uppercase font-semibold">Account Created</span>
                    <span className="text-white font-semibold text-sm">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-textMuted uppercase font-semibold">Account Verification Status</span>
                    <span className={`font-semibold text-xs ${selectedUser.verified ? 'text-brand-blue' : 'text-yellow-500'}`}>{selectedUser.verified ? 'Verified Account' : 'Unverified'}</span>
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <span className="text-[10px] text-brand-textMuted uppercase font-semibold">Account Banned Status</span>
                    <span className={`font-semibold text-xs ${selectedUser.banned ? 'text-brand-red' : 'text-brand-green'}`}>{selectedUser.banned ? 'Banned from Access' : 'Active / Allowed'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <h4 className="font-display font-bold text-xs text-brand-blue uppercase tracking-wider">Purchase History ({userOrders.length})</h4>
                  {userOrders.length === 0 ? (
                    <div className="bg-white/2 border border-brand-border p-4 rounded-xl text-center text-xs text-brand-textMuted italic text-white font-display">
                      No products purchased yet.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {userOrders.map((ord, idx) => (
                        <div key={idx} className="bg-white/2 border border-brand-border p-4 rounded-xl flex flex-col gap-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white">{ord.productName}</span>
                            <span className="text-brand-blue font-bold">${ord.price.toFixed(2)} USD</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-brand-textMuted">
                            <div>Order ID: <span className="text-white">{ord.orderId}</span></div>
                            <div>Date: <span className="text-white">{new Date(ord.date).toLocaleDateString()}</span></div>
                          </div>
                          <div className="text-[10px] text-brand-textMuted mt-1">
                            License Key: <span className="font-mono text-brand-blue select-all">{ord.licenseKey}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end mt-2 pt-4 border-t border-brand-border/60">
                  <button 
                    onClick={() => handleToggleBan(selectedUser.email)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${selectedUser.banned ? 'bg-brand-green/10 text-brand-green border-brand-green/20 hover:bg-brand-green hover:text-white' : 'bg-brand-red/10 text-brand-red border-brand-red/20 hover:bg-brand-red hover:text-white'}`}
                  >
                    {selectedUser.banned ? 'Unban Account' : 'Ban Account'}
                  </button>
                  {selectedUser.role !== 'admin' && (
                    <button 
                      onClick={() => handleDeleteUser(selectedUser.email)}
                      className="bg-brand-red hover:bg-brand-red/80 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                    >
                      Delete Account
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default Admin
