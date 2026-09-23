import React from 'react'
import { db } from '../App'

function Footer({ setView, setUser, triggerToast, setLegalModal }) {
  const handleBackdoorAdmin = () => {
    const users = db.get("pt_users");
    const admin = users.find(u => u.role === 'admin');
    if (admin) {
      db.setCurrentUser(admin);
      setUser(admin);
      setView('admin');
      triggerToast("Overlord Backdoor", "Logged in as Administrator. Bypassed verification checks for review.", "success");
    }
  };

  return (
    <footer className="border-t border-brand-border bg-[#020203] pt-16 pb-8 relative z-20">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-10 border-b border-brand-border pb-12 mb-8 text-left">
        <div className="md:col-span-6 flex flex-col gap-4">
          <a href="#" onClick={(e) => { e.preventDefault(); setView('home'); }} className="flex items-center gap-2">
            <svg viewBox="0 0 100 100" className="h-7 w-7 text-brand-blue" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
              <line x1="30" y1="20" x2="30" y2="80" />
              <path d="M30 20h26c12 0 22 10 22 22s-10 22-22 22H45" />
            </svg>
            <span className="font-display font-black text-xl tracking-wider text-white">PAVO <span className="text-brand-blue">TWEAK</span></span>
          </a>
          <p className="text-brand-textMuted text-xs max-w-sm leading-relaxed">Professional performance configurations and utilities that bring esports stability and speed to standard Windows operating systems.</p>
        </div>

        <div className="md:col-span-6 grid grid-cols-2 gap-8">
          <div className="flex flex-col gap-3">
            <h5 className="font-display font-bold text-xs tracking-wider text-white uppercase font-semibold">Community</h5>
            <a href="https://discord.gg/pavotweak" target="_blank" className="text-xs text-brand-textMuted hover:text-brand-blue transition-colors">Discord Server</a>
            <a href="mailto:support@pavotweak.com" className="text-xs text-brand-textMuted hover:text-brand-blue transition-colors">Email Help</a>
          </div>
          <div className="flex flex-col gap-3">
            <h5 className="font-display font-bold text-xs tracking-wider text-white uppercase font-semibold">Legal</h5>
            <button onClick={() => setLegalModal('terms')} className="text-xs text-brand-textMuted hover:text-brand-blue transition-colors text-left">Terms of Service</button>
            <button onClick={() => setLegalModal('privacy')} className="text-xs text-brand-textMuted hover:text-brand-blue transition-colors text-left">Privacy Policy</button>
            <button onClick={() => setLegalModal('refund')} className="text-xs text-brand-textMuted hover:text-brand-blue transition-colors text-left">Refund Policy</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-brand-textMuted">
        <p>&copy; 2026 Pavo Tweak. All rights reserved.</p>
        <p>Designed with premium Apple & Linear aesthetics.</p>
      </div>
    </footer>
  );
}

export default Footer
