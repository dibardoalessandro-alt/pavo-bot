import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import ParticleBackground from './components/ParticleBackground'
import CartDrawer from './components/CartDrawer'
import CheckoutModal from './components/CheckoutModal'
import EmailClient from './components/EmailClient'
import LegalModal from './components/LegalModal'
import ToastList from './components/ToastList'

// Import Pages
import Home from './pages/Home'
import Store from './pages/Store'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import Auth from './pages/Auth'

// Database helpers
export const db = {
  get: (table) => {
    try {
      return JSON.parse(localStorage.getItem(table) || "[]");
    } catch (e) {
      console.error("Failed to parse localStorage table: " + table, e);
      return [];
    }
  },
  set: (table, data) => {
    try {
      localStorage.setItem(table, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to set localStorage table: " + table, e);
    }
  },
  getCurrentUser: () => {
    try {
      const u = sessionStorage.getItem("pt_current_user") || localStorage.getItem("pt_current_user");
      return u ? JSON.parse(u) : null;
    } catch (e) {
      console.error("Failed to get current user", e);
      return null;
    }
  },
  setCurrentUser: (user, remember = false) => {
    try {
      const uStr = JSON.stringify(user);
      if (remember) {
        localStorage.setItem("pt_current_user", uStr);
      } else {
        sessionStorage.setItem("pt_current_user", uStr);
      }
    } catch (e) {
      console.error("Failed to set current user", e);
    }
  },
  clearCurrentUser: () => {
    localStorage.removeItem("pt_current_user");
    sessionStorage.removeItem("pt_current_user");
  }
};

export function hashPassword(password) {
  let hash = 0;
  if (password.length === 0) return hash.toString();
  for (let i = 0; i < password.length; i++) {
    const chr = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return "SHA256Mock_" + Math.abs(hash).toString(16);
}

export function generateRandomCode(length = 6) {
  let result = '';
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function App() {
  const [view, setView] = useState('home');
  const [authState, setAuthState] = useState('login');
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [unreadMail, setUnreadMail] = useState(0);
  const [mailList, setMailList] = useState([]);
  const [activeMail, setActiveMail] = useState(null);
  const [mailOpen, setMailOpen] = useState(false);
  const [verifyEmailTarget, setVerifyEmailTarget] = useState('');
  const [verificationCodes, setVerificationCodes] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [legalModal, setLegalModal] = useState(null);

  // Captchas
  const [captcha, setCaptcha] = useState({ a: 0, b: 0, ans: 0 });
  const [showCaptcha, setShowCaptcha] = useState(false);

  useEffect(() => {
    // Database check
    const initTable = (key, defaultData) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(defaultData));
      }
    };

    const seedUsers = [
      {
        username: "admin",
        email: "admin@pavotweak.com",
        passwordHash: hashPassword("admin123"),
        role: "admin",
        verified: true,
        banned: false,
        createdAt: new Date().toISOString(),
        avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=120&auto=format&fit=crop"
      },
      {
        username: "john_doe",
        email: "user@domain.com",
        passwordHash: hashPassword("user123"),
        role: "user",
        verified: true,
        banned: false,
        createdAt: new Date().toISOString(),
        avatar: "https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120&auto=format&fit=crop"
      }
    ];

    const seedKeys = [
      { key: "PAVO-ABCD-EFGH-IJKL", status: "active", userEmail: null },
      { key: "PAVO-1234-5678-90AB", status: "used", userEmail: "user@domain.com" }
    ];

    const seedOrders = [
      {
        orderId: "ORD-9874-2391",
        userEmail: "user@domain.com",
        productName: "Pavo Tweak Lifetime",
        price: 8.00,
        date: "2026-07-10T12:00:00Z",
        licenseKey: "PAVO-1234-5678-90AB"
      }
    ];

    const defaultReleases = [
      {
        version: "1.2.0",
        date: "2026-07-12",
        notes: "Optimized CPU thread priority algorithms, enhanced TRIM performance checks, and integrated direct GPU hardware diagnostic utilities."
      },
      {
        version: "1.1.5",
        date: "2026-07-01",
        notes: "Added custom context menu editor toggles and resolved telemetry registry block exceptions on Windows 11 Build 22631."
      }
    ];

    initTable("pt_users", seedUsers);
    initTable("pt_keys", seedKeys);
    initTable("pt_orders", seedOrders);
    initTable("pt_releases", defaultReleases);
    initTable("pt_failed_logins", {});

    if (!sessionStorage.getItem("pt_csrf_token")) {
      sessionStorage.setItem("pt_csrf_token", generateRandomCode(16));
    }

    const curr = db.getCurrentUser();
    if (curr) setUser(curr);

    setCart(db.get("pt_cart") || []);
    setMailList(db.get("pt_mails") || []);

    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setView('admin');
        window.location.hash = '#/admin';
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleHashChange = () => {
      if (window.location.hash === '#/admin') {
        setView('admin');
      } else if (window.location.hash === '#/home' || window.location.hash === '') {
        setView('home');
      }
    };
    window.addEventListener('hashchange', handleHashChange);

    if (window.location.hash === '#/admin') {
      setView('admin');
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Sync unread mail counter
  useEffect(() => {
    if (Array.isArray(mailList)) {
      const count = mailList.filter(m => m.unread).length;
      setUnreadMail(count);
    }
  }, [mailList]);

  const updateUnreadCount = (list) => {
    if (Array.isArray(list)) {
      const count = list.filter(m => m.unread).length;
      setUnreadMail(count);
    }
  };

  const triggerToast = (title, message, type = "info") => {
    const id = Date.now();
    setToasts(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return [...current, { id, title, message, type }];
    });
    setTimeout(() => {
      setToasts(prev => {
        const current = Array.isArray(prev) ? prev : [];
        return current.filter(t => t.id !== id);
      });
    }, 5000);
  };

  const sendMockMail = (to, subject, bodyMarkup) => {
    const timeStr = new Date().toLocaleTimeString();
    const newMail = {
      from: "licensing@pavotweak.com",
      to,
      subject,
      body: bodyMarkup,
      time: timeStr,
      unread: true
    };
    setMailList(prev => {
      const current = Array.isArray(prev) ? prev : [];
      const updated = [newMail, ...current];
      db.set("pt_mails", updated);
      return updated;
    });
    triggerToast("New Email Received", `Instructions sent to ${to}. Open PavoMail overlay at the bottom right.`, "success");
    setMailOpen(true);
  };

  const handleLogout = () => {
    db.clearCurrentUser();
    setUser(null);
    setView('home');
    triggerToast("Logged Out", "You have been securely logged out.", "info");
  };

  const processOrderCompletion = (email) => {
    let keys = db.get("pt_keys");
    let orders = db.get("pt_orders");
    const freshKey = "PAVO-" + generateRandomCode(4).toUpperCase() + "-" + generateRandomCode(4).toUpperCase() + "-" + generateRandomCode(4).toUpperCase();
    
    keys.push({ key: freshKey, status: "used", userEmail: email });
    db.set("pt_keys", keys);

    orders.push({
      orderId: "ORD-" + Math.floor(1000 + Math.random() * 9000) + "-" + Math.floor(1000 + Math.random() * 9000),
      userEmail: email,
      productName: "Pavo Tweak Lifetime",
      price: 8.00,
      date: new Date().toISOString(),
      licenseKey: freshKey
    });
    db.set("pt_orders", orders);
    db.set("pt_cart", []);
    setCart([]);
    triggerToast("Order Completed!", "Your lifetime license has been processed successfully.", "success");
    setView('dashboard');
  };

  return (
    <div className="relative min-h-screen pb-12 flex flex-col justify-between">
      <ParticleBackground />
      <ToastList toasts={toasts} setToasts={setToasts} />

      <Header 
        view={view} 
        setView={setView} 
        user={user} 
        handleLogout={handleLogout} 
        cartCount={cart.length} 
        setCartOpen={setCartOpen} 
        setAuthState={setAuthState}
      />

      <main className="flex-grow z-10">
        {view === 'home' && <Home setView={setView} triggerToast={triggerToast} />}
        {view === 'store' && <Store cart={cart} setCart={setCart} setCartOpen={setCartOpen} triggerToast={triggerToast} />}
        {view === 'dashboard' && user && <Dashboard user={user} setView={setView} triggerToast={triggerToast} />}
        {view === 'profile' && user && <Profile user={user} setUser={setUser} triggerToast={triggerToast} />}
        {view === 'admin' && <Admin setView={setView} triggerToast={triggerToast} />}
        {view === 'auth' && (
          <Auth 
            authState={authState} 
            setAuthState={setAuthState} 
            setUser={setUser} 
            setView={setView}
            triggerToast={triggerToast} 
            sendMockMail={sendMockMail}
            verifyEmailTarget={verifyEmailTarget}
            setVerifyEmailTarget={setVerifyEmailTarget}
            verificationCodes={verificationCodes}
            setVerificationCodes={setVerificationCodes}
            captcha={captcha}
            setCaptcha={setCaptcha}
            showCaptcha={showCaptcha}
            setShowCaptcha={setShowCaptcha}
            processOrderCompletion={processOrderCompletion}
          />
        )}
      </main>

      <Footer setView={setView} setUser={setUser} triggerToast={triggerToast} setLegalModal={setLegalModal} />

      <CartDrawer 
        isOpen={cartOpen} 
        setIsOpen={setCartOpen} 
        cart={cart} 
        setCart={setCart} 
        setCheckoutOpen={setCheckoutOpen} 
      />

      <CheckoutModal 
        isOpen={checkoutOpen} 
        setIsOpen={setCheckoutOpen} 
        user={user} 
        cart={cart} 
        setCart={setCart}
        setView={setView}
        setAuthState={setAuthState}
        setVerifyEmailTarget={setVerifyEmailTarget}
        sendMockMail={sendMockMail}
        verificationCodes={verificationCodes}
        setVerificationCodes={setVerificationCodes}
        triggerToast={triggerToast}
        processOrderCompletion={processOrderCompletion}
      />

      <EmailClient 
        isOpen={mailOpen} 
        setIsOpen={setMailOpen} 
        unreadCount={unreadMail} 
        mailList={mailList} 
        setMailList={setMailList} 
        updateUnreadCount={updateUnreadCount} 
        activeMail={activeMail} 
        setActiveMail={setActiveMail} 
      />

      <LegalModal type={legalModal} setType={setLegalModal} />
    </div>
  )
}

export default App
