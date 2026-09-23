import React, { useState, useEffect, useRef } from 'react'
import { ShoppingCart, ChevronDown, Grid, User, Shield, LogOut, Menu, X } from 'lucide-react'

function Header({ view, setView, user, handleLogout, cartCount, setCartOpen, setAuthState }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerSectionScroll = (id) => {
    setMobileOpen(false);
    if (view !== 'home') {
      setView('home');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
      }, 200);
    } else {
      const el = document.getElementById(id);
      if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 w-full border-b border-brand-border bg-brand-black/70 backdrop-blur-xl z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <a href="#" onClick={(e) => { e.preventDefault(); setView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-2.5 group">
          <svg viewBox="0 0 100 100" className="h-7 w-7 text-brand-blue group-hover:scale-105 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
            <line x1="30" y1="20" x2="30" y2="80" />
            <path d="M30 20h26c12 0 22 10 22 22s-10 22-22 22H45" />
          </svg>
          <span className="font-display font-black text-xl tracking-wider text-white">PAVO <span className="text-brand-blue">TWEAK</span></span>
        </a>

        {/* Desktop Links */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#" onClick={(e) => { e.preventDefault(); setView('home'); window.scrollTo({ top:0, behavior:'smooth' }); }} className={`text-sm font-medium hover:text-white transition-colors duration-200 ${view === 'home' ? 'text-white' : 'text-brand-textMuted'}`}>Home</a>
          <a href="#features" onClick={(e) => { e.preventDefault(); triggerSectionScroll('features'); }} className="text-sm font-medium text-brand-textMuted hover:text-white transition-colors duration-200">Features</a>
          <a href="#store" onClick={(e) => { e.preventDefault(); setView('store'); }} className={`text-sm font-medium hover:text-white transition-colors duration-200 ${view === 'store' ? 'text-white' : 'text-brand-textMuted'}`}>Store</a>
          <a href="#faq" onClick={(e) => { e.preventDefault(); triggerSectionScroll('faq'); }} className="text-sm font-medium text-brand-textMuted hover:text-white transition-colors duration-200">FAQ</a>
          <a href="#contact" onClick={(e) => { e.preventDefault(); triggerSectionScroll('contact'); }} className="text-sm font-medium text-brand-textMuted hover:text-white transition-colors duration-200">Contact</a>
        </nav>

        {/* User / Cart */}
        <div className="flex items-center gap-4">
          <button onClick={() => setCartOpen(true)} className="relative p-2 text-brand-textMuted hover:text-brand-blue transition-colors duration-200 focus:outline-none">
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-blue text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 shadow-lg shadow-brand-blue/30">{cartCount}</span>
            )}
          </button>

          {user ? (
            <div ref={dropRef} className="relative">
              <button onClick={() => setDropOpen(!dropOpen)} className="flex items-center gap-2 p-1 bg-white/5 hover:bg-white/10 border border-brand-border rounded-full pr-3 hover:border-white/20 transition-all duration-200 focus:outline-none">
                <img src={user.avatar} alt="Avatar" className="w-7 h-7 rounded-full object-cover border border-brand-blue/50" />
                <span className="text-xs font-semibold text-white max-w-[90px] truncate">{user.username}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-brand-textMuted transition-transform duration-200 ${dropOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {dropOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-brand-card border border-brand-border rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 z-50">
                  <button onClick={() => { setDropOpen(false); setView('dashboard'); }} className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-brand-textMuted hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left">
                    <Grid className="w-4 h-4" /> Dashboard
                  </button>
                  <button onClick={() => { setDropOpen(false); setView('profile'); }} className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-brand-textMuted hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left">
                    <User className="w-4 h-4" /> User Profile
                  </button>
                  {user.role === 'admin' && (
                    <button onClick={() => { setDropOpen(false); setView('admin'); }} className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-brand-textMuted hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left text-brand-blue">
                      <Shield className="w-4 h-4" /> Admin Panel
                    </button>
                  )}
                  <hr className="border-brand-border my-1" />
                  <button onClick={() => { setDropOpen(false); handleLogout(); }} className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors text-left">
                    <LogOut className="w-4 h-4" /> Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-3">
              <button onClick={() => { setAuthState('login'); setView('auth'); }} className="text-sm font-semibold text-brand-textMuted hover:text-white transition-colors duration-200 px-3 py-1.5">Login</button>
              <button onClick={() => { setAuthState('register'); setView('auth'); }} className="text-sm font-semibold bg-brand-blue hover:bg-brand-blueHover px-4 py-2 rounded-lg transition-all duration-300 shadow-md hover:shadow-brand-blue/30 flex items-center">Register</button>
            </div>
          )}

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-brand-textMuted hover:text-white focus:outline-none">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden w-full bg-brand-card border-b border-brand-border p-6 flex flex-col gap-4">
          <a href="#" onClick={(e) => { e.preventDefault(); setMobileOpen(false); setView('home'); }} className="text-base font-semibold text-brand-textMuted hover:text-white py-1">Home</a>
          <a href="#features" onClick={(e) => { e.preventDefault(); triggerSectionScroll('features'); }} className="text-base font-semibold text-brand-textMuted hover:text-white py-1">Features</a>
          <a href="#store" onClick={(e) => { e.preventDefault(); setMobileOpen(false); setView('store'); }} className="text-base font-semibold text-brand-textMuted hover:text-white py-1">Store</a>
          <a href="#faq" onClick={(e) => { e.preventDefault(); triggerSectionScroll('faq'); }} className="text-base font-semibold text-brand-textMuted hover:text-white py-1">FAQ</a>
          <a href="#contact" onClick={(e) => { e.preventDefault(); triggerSectionScroll('contact'); }} className="text-base font-semibold text-brand-textMuted hover:text-white py-1">Contact</a>
          {!user && (
            <div className="flex flex-col gap-3 mt-2">
              <button onClick={() => { setMobileOpen(false); setAuthState('login'); setView('auth'); }} className="w-full text-center py-2.5 font-semibold text-brand-textMuted hover:text-white hover:bg-white/5 rounded-lg border border-brand-border transition-all">Login</button>
              <button onClick={() => { setMobileOpen(false); setAuthState('register'); setView('auth'); }} className="w-full text-center py-2.5 font-semibold bg-brand-blue hover:bg-brand-blueHover rounded-lg transition-all shadow-md">Register</button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export default Header
