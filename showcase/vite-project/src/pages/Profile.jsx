import React, { useState } from 'react'
import { db, hashPassword } from '../App'

function Profile({ user, setUser, triggerToast }) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState(user.avatar);
  const [passForm, setPassForm] = useState({ current: '', newPass: '', confirm: '' });

  const avatarChoices = [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=120&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=120&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=120&auto=format&fit=crop"
  ];

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    let users = db.get("pt_users");

    if (email.toLowerCase() !== user.email.toLowerCase() && users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      triggerToast("Update Error", "This email address is already in use.", "error");
      return;
    }

    users = users.map(u => {
      if (u.email.toLowerCase() === user.email.toLowerCase()) {
        u.username = username;
        u.email = email;
        u.avatar = avatar;
      }
      return u;
    });
    db.set("pt_users", users);

    if (email.toLowerCase() !== user.email.toLowerCase()) {
      let keys = db.get("pt_keys");
      keys = keys.map(k => { if (k.userEmail === user.email) k.userEmail = email; return k; });
      db.set("pt_keys", keys);

      let orders = db.get("pt_orders");
      orders = orders.map(o => { if (o.userEmail === user.email) o.userEmail = email; return o; });
      db.set("pt_orders", orders);
    }

    const updatedUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    db.setCurrentUser(updatedUser);
    setUser(updatedUser);
    triggerToast("Profile Updated", "Account settings saved successfully.", "success");
  };

  const handleChangePass = (e) => {
    e.preventDefault();
    if (hashPassword(passForm.current) !== user.passwordHash) {
      triggerToast("Validation Failed", "Current password entered is incorrect.", "error");
      return;
    }
    if (passForm.newPass !== passForm.confirm) {
      triggerToast("Mismatch Error", "Passwords do not match.", "error");
      return;
    }

    let users = db.get("pt_users");
    users = users.map(u => {
      if (u.email.toLowerCase() === user.email.toLowerCase()) {
        u.passwordHash = hashPassword(passForm.newPass);
      }
      return u;
    });
    db.set("pt_users", users);

    setPassForm({ current: '', newPass: '', confirm: '' });
    const updatedUser = users.find(u => u.email.toLowerCase() === user.email.toLowerCase());
    db.setCurrentUser(updatedUser);
    setUser(updatedUser);
    triggerToast("Password Changed", "Security parameters updated.", "success");
  };

  return (
    <div className="py-12 relative z-10 text-left">
      <div className="max-w-2xl mx-auto px-6">
        <div className="bg-brand-card border border-brand-border p-8 rounded-2xl backdrop-blur-md flex flex-col gap-8">
          <div>
            <h2 className="font-display font-black text-2xl text-white">Profile Settings</h2>
            <p className="text-brand-textMuted text-xs mt-1">Configure your personal credentials and customize security passwords.</p>
          </div>

          <div className="bg-white/2 border border-brand-border p-4 rounded-xl flex items-center gap-6">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-brand-blue shadow-lg shadow-brand-blue/30 flex-shrink-0">
              <img src={avatar} alt="Current profile picture" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-brand-textMuted tracking-wider uppercase">Select Profile Photo</span>
              <div className="flex gap-2">
                {avatarChoices.map((choice, idx) => (
                  <img 
                    key={idx} 
                    src={choice} 
                    onClick={() => setAvatar(choice)} 
                    alt="Photo option" 
                    className={`w-8 h-8 rounded-full object-cover cursor-pointer border hover:scale-105 transition-all ${avatar === choice ? 'border-brand-blue scale-105 shadow-md shadow-brand-blue/20' : 'border-transparent'}`} 
                  />
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength="3" className="bg-white/3 border border-brand-border focus:border-brand-blue focus:bg-brand-blue/3 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/3 border border-brand-border focus:border-brand-blue focus:bg-brand-blue/3 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>
            <button type="submit" className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-md mt-2 scale-btn text-sm font-display tracking-wide text-center">Update Settings</button>
          </form>

          <hr className="border-brand-border/40" />

          <form onSubmit={handleChangePass} className="flex flex-col gap-5">
            <h3 className="font-display font-bold text-base text-white uppercase tracking-wide">Security updates</h3>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Current Password</label>
              <input type="password" value={passForm.current} onChange={(e) => setPassForm({...passForm, current: e.target.value})} required className="bg-white/3 border border-brand-border focus:border-brand-blue focus:bg-brand-blue/3 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">New Password</label>
                <input type="password" value={passForm.newPass} onChange={(e) => setPassForm({...passForm, newPass: e.target.value})} required minLength="8" className="bg-white/3 border border-brand-border focus:border-brand-blue focus:bg-brand-blue/3 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Confirm New Password</label>
                <input type="password" value={passForm.confirm} onChange={(e) => setPassForm({...passForm, confirm: e.target.value})} required className="bg-white/3 border border-brand-border focus:border-brand-blue focus:bg-brand-blue/3 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
              </div>
            </div>
            <button type="submit" className="bg-white/5 hover:bg-white/10 border border-brand-border hover:border-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all mt-2 scale-btn text-sm font-display tracking-wide text-center">Change Password</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Profile
