import React, { useState, useEffect } from 'react'
import { db, hashPassword, generate6DigitCode } from '../App'

function Auth({ authState, setAuthState, setUser, setView, triggerToast, sendMockMail, verifyEmailTarget, setVerifyEmailTarget, verificationCodes, setVerificationCodes, captcha, setCaptcha, showCaptcha, setShowCaptcha, processOrderCompletion }) {
  const [loginForm, setLoginForm] = useState({ email: '', password: '', remember: false, captchaAns: '' });
  const [regForm, setRegForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [verifyCode, setVerifyCode] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({ email: '', code: '', newPass: '', confirm: '' });
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const triggerCaptchaGen = () => {
    const a = Math.floor(Math.random() * 12) + 2;
    const b = Math.floor(Math.random() * 12) + 2;
    setCaptcha({ a, b, ans: a + b });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const failedLogins = db.get("pt_failed_logins") || {};
    const attempts = failedLogins[loginForm.email.toLowerCase()] || { count: 0, lockTime: 0 };

    if (attempts.lockTime && Date.now() < attempts.lockTime) {
      const remain = Math.ceil((attempts.lockTime - Date.now()) / 1000);
      triggerToast("Account Locked", `Too many failed login attempts. Locked. Wait ${remain}s.`, "error");
      return;
    }

    if (attempts.count >= 3) {
      if (parseInt(loginForm.captchaAns) !== captcha.ans) {
        triggerToast("Captcha Failed", "Security check failed. Try again.", "error");
        triggerCaptchaGen();
        return;
      }
    }

    const users = db.get("pt_users");
    const userObj = users.find(u => u.email.toLowerCase() === loginForm.email.toLowerCase());

    if (userObj && userObj.banned) {
      triggerToast("Account Banned", "This profile has been banned due to violations.", "error");
      return;
    }

    const hash = hashPassword(loginForm.password);
    if (userObj && userObj.passwordHash === hash) {
      if (!userObj.verified) {
        triggerToast("Email Unverified", "Check your inbox for your account verification code.", "error");
        setVerifyEmailTarget(userObj.email);
        
        const code = generate6DigitCode();
        const expires = Date.now() + 10 * 60 * 1000;
        setVerificationCodes(prev => [...prev.filter(c => c.email !== userObj.email), { email: userObj.email.toLowerCase(), code, exp: expires }]);
        sendMockMail(userObj.email, "Verify Your Pavo Tweak Account", `Welcome to Pavo Tweak!<br><br>Please verify your email address to activate your account by entering the following code:<br><div class="email-code-box">${code}</div>This code expires in 10 minutes.`);
        
        setAuthState('verify');
        return;
      }

      delete failedLogins[loginForm.email.toLowerCase()];
      db.set("pt_failed_logins", failedLogins);

      db.setCurrentUser(userObj, loginForm.remember);
      setUser(userObj);
      triggerToast("Welcome Back", `Successfully logged in as ${userObj.username}.`, "success");
      
      const pendingCheckout = sessionStorage.getItem("pt_pending_checkout");
      if (pendingCheckout) {
        sessionStorage.removeItem("pt_pending_checkout");
        processOrderCompletion(userObj.email);
      } else {
        setView('dashboard');
      }
    } else {
      attempts.count++;
      if (attempts.count >= 5) {
        attempts.lockTime = Date.now() + 30 * 1000;
        triggerToast("Security Lockout", "Too many attempts. Blocked for 30s.", "error");
      } else if (attempts.count >= 3) {
        setShowCaptcha(true);
        triggerCaptchaGen();
        triggerToast("Security Audit", "Math Captcha required to proceed.", "info");
      } else {
        triggerToast("Auth Failed", "Invalid email address or password.", "error");
      }
      failedLogins[loginForm.email.toLowerCase()] = attempts;
      db.set("pt_failed_logins", failedLogins);
    }
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    try {
      let users = db.get("pt_users");

      if (users.some(u => u.email.toLowerCase() === regForm.email.toLowerCase())) {
        triggerToast("Registration Error", "This email address is already registered.", "error");
        return;
      }

      if (regForm.password !== regForm.confirm) {
        triggerToast("Registration Error", "Passwords do not match.", "error");
        return;
      }

      const newU = {
        username: regForm.username,
        email: regForm.email,
        passwordHash: hashPassword(regForm.password),
        role: "user",
        verified: false,
        banned: false,
        createdAt: new Date().toISOString(),
        avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=120&auto=format&fit=crop"
      };
      users.push(newU);
      db.set("pt_users", users);

      const code = generate6DigitCode();
      const expires = Date.now() + 10 * 60 * 1000;
      setVerificationCodes(prev => {
        const current = Array.isArray(prev) ? prev : [];
        return [...current.filter(c => c.email !== regForm.email), { email: regForm.email.toLowerCase(), code, exp: expires }];
      });
      sendMockMail(regForm.email, "Verify Your Pavo Tweak Account", `Welcome to Pavo Tweak!<br><br>Please verify your email address to complete registration by entering the following code:<br><div class="email-code-box">${code}</div>This code expires in 10 minutes.`);

      setVerifyEmailTarget(regForm.email);
      setAuthState('verify');
      setResendCooldown(60);
      triggerToast("Code Dispatched", "Check the simulated inbox drawer for code details.", "success");
    } catch (err) {
      console.error("Register Error", err);
      alert("Register Error: " + err.message + "\n" + err.stack);
    }
  };

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    try {
      const currentCodes = Array.isArray(verificationCodes) ? verificationCodes : [];
      const record = currentCodes.find(c => c.email.toLowerCase() === verifyEmailTarget.toLowerCase());

      if (!record) {
        triggerToast("Verification Failed", "No verification session found. Register again.", "error");
        return;
      }

      if (Date.now() > record.exp) {
        triggerToast("Verification Failed", "Code expired. Request a new one.", "error");
        return;
      }

      if (record.code !== verifyCode.trim()) {
        triggerToast("Verification Failed", "Incorrect 6-digit code.", "error");
        return;
      }

      let users = db.get("pt_users");
      users = users.map(u => {
        if (u.email.toLowerCase() === verifyEmailTarget.toLowerCase()) u.verified = true;
        return u;
      });
      db.set("pt_users", users);

      setVerificationCodes(prev => {
        const current = Array.isArray(prev) ? prev : [];
        return current.filter(c => c.email.toLowerCase() !== verifyEmailTarget.toLowerCase());
      });
      triggerToast("Email Verified", "Your account has been activated. Welcome to Pavo Tweak!", "success");
      
      const activeU = users.find(u => u.email.toLowerCase() === verifyEmailTarget.toLowerCase());
      db.setCurrentUser(activeU);
      setUser(activeU);

      const pendingCheckout = sessionStorage.getItem("pt_pending_checkout");
      if (pendingCheckout) {
        sessionStorage.removeItem("pt_pending_checkout");
        processOrderCompletion(activeU.email);
      } else {
        setView('dashboard');
      }
    } catch (err) {
      console.error("Verify Error", err);
      alert("Verify Error: " + err.message + "\n" + err.stack);
    }
  };

  const handleResendCode = () => {
    try {
      const code = generate6DigitCode();
      const expires = Date.now() + 10 * 60 * 1000;
      setVerificationCodes(prev => {
        const current = Array.isArray(prev) ? prev : [];
        return [...current.filter(c => c.email !== verifyEmailTarget), { email: verifyEmailTarget.toLowerCase(), code, exp: expires }];
      });
      sendMockMail(verifyEmailTarget, "Verify Your Pavo Tweak Account", `Welcome to Pavo Tweak!<br><br>Please verify your email address to complete registration by entering the following code:<br><div class="email-code-box">${code}</div>This code expires in 10 minutes.`);
      setResendCooldown(60);
      triggerToast("Code Resent", "A new code has been sent to your mock inbox.", "success");
    } catch (err) {
      console.error("Resend Error", err);
      alert("Resend Error: " + err.message + "\n" + err.stack);
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    try {
      const users = db.get("pt_users");
      const userObj = users.find(u => u.email.toLowerCase() === forgotEmail.toLowerCase());

      if (userObj) {
        const code = generate6DigitCode();
        const expires = Date.now() + 10 * 60 * 1000;
        setVerificationCodes(prev => {
          const current = Array.isArray(prev) ? prev : [];
          return [...current.filter(c => c.email !== forgotEmail), { email: forgotEmail.toLowerCase(), code, exp: expires }];
        });
        sendMockMail(forgotEmail, "Reset Password Request", `We received a request to reset your Pavo Tweak password.<br><br>Please use the following 6-digit recovery code to choose a new password:<br><div class="email-code-box">${code}</div>If you did not request this, you can safely ignore this email.`);
        
        setResetForm({...resetForm, email: forgotEmail});
        setAuthState('reset');
        triggerToast("Code Sent", "Check the simulated inbox drawer for reset code details.", "success");
      } else {
        triggerToast("Forgot Error", "No account registered with this email.", "error");
      }
    } catch (err) {
      console.error("Forgot Error", err);
      alert("Forgot Error: " + err.message + "\n" + err.stack);
    }
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    try {
      if (resetForm.newPass !== resetForm.confirm) {
        triggerToast("Reset Error", "Passwords do not match.", "error");
        return;
      }

      const currentCodes = Array.isArray(verificationCodes) ? verificationCodes : [];
      const record = currentCodes.find(c => c.email.toLowerCase() === resetForm.email.toLowerCase());
      if (!record || record.code !== resetForm.code.trim()) {
        triggerToast("Reset Error", "Recovery verification code is invalid.", "error");
        return;
      }

      let users = db.get("pt_users");
      users = users.map(u => {
        if (u.email.toLowerCase() === resetForm.email.toLowerCase()) {
          u.passwordHash = hashPassword(resetForm.newPass);
        }
        return u;
      });
      db.set("pt_users", users);

      setVerificationCodes(prev => {
        const current = Array.isArray(prev) ? prev : [];
        return current.filter(c => c.email.toLowerCase() !== resetForm.email.toLowerCase());
      });
      triggerToast("Password Reset Success", "Your password has been changed. Logging you in.", "success");
      
      const activeU = users.find(u => u.email.toLowerCase() === resetForm.email.toLowerCase());
      db.setCurrentUser(activeU);
      setUser(activeU);
      setView('dashboard');
    } catch (err) {
      console.error("Reset Error", err);
      alert("Reset Error: " + err.message + "\n" + err.stack);
    }
  };

  return (
    <div className="container small-container min-h-[calc(100vh-160px)] flex justify-center items-center py-16">
      {/* LOGIN */}
      {authState === 'login' && (
        <div className="bg-brand-card border border-brand-border p-8 rounded-2xl w-full max-w-[430px] text-left backdrop-blur-md animate-scale-in">
          <h2 className="font-display font-black text-2xl text-center">Welcome Back</h2>
          <p className="text-brand-textMuted text-xs text-center mt-1 mb-8">Login to manage downloads and license keys.</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Email Address</label>
              <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({...loginForm, email: e.target.value})} required className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Password</label>
                <button type="button" onClick={() => setAuthState('forgot')} className="text-xs font-semibold text-brand-blue hover:text-white transition-colors">Forgot?</button>
              </div>
              <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} required className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>

            <div className="flex items-center mt-1">
              <label className="flex items-center gap-2 text-xs text-brand-textMuted cursor-pointer">
                <input type="checkbox" checked={loginForm.remember} onChange={(e) => setLoginForm({...loginForm, remember: e.target.checked})} className="rounded bg-white/5 border-brand-border text-brand-blue focus:ring-0" />
                Remember Me
              </label>
            </div>

            {showCaptcha && (
              <div className="bg-brand-red/5 border border-brand-red/20 p-4 rounded-xl flex flex-col gap-2 mt-2">
                <span className="text-[10px] font-bold text-brand-red uppercase">Verification Check Required</span>
                <div className="flex items-center gap-4">
                  <span className="font-display font-black text-md text-white">{captcha.a} + {captcha.b} = </span>
                  <input type="text" value={loginForm.captchaAns} onChange={(e) => setLoginForm({...loginForm, captchaAns: e.target.value})} required className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-lg px-2.5 py-1.5 w-20 text-center text-sm focus:outline-none" />
                </div>
              </div>
            )}

            <button type="submit" className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold py-3.5 rounded-xl shadow-md hover:shadow-brand-blue/20 transition-all font-display tracking-wide text-center mt-3">Log In</button>
          </form>
          
          <div className="text-center text-xs text-brand-textMuted mt-6">
            Don't have an account? <button onClick={() => setAuthState('register')} className="font-semibold text-brand-blue hover:text-white transition-colors ml-1">Create one</button>
          </div>
        </div>
      )}

      {/* REGISTER */}
      {authState === 'register' && (
        <div className="bg-brand-card border border-brand-border p-8 rounded-2xl w-full max-w-[430px] text-left backdrop-blur-md animate-scale-in">
          <h2 className="font-display font-black text-2xl text-center">Create Account</h2>
          <p className="text-brand-textMuted text-xs text-center mt-1 mb-8">Get lifetime license codes updates and support.</p>

          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Username</label>
              <input type="text" value={regForm.username} onChange={(e) => setRegForm({...regForm, username: e.target.value})} required minLength="3" className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Email Address</label>
              <input type="email" value={regForm.email} onChange={(e) => setRegForm({...regForm, email: e.target.value})} required className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Password</label>
              <input type="password" value={regForm.password} onChange={(e) => setRegForm({...regForm, password: e.target.value})} required minLength="8" className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Confirm Password</label>
              <input type="password" value={regForm.confirm} onChange={(e) => setRegForm({...regForm, confirm: e.target.value})} required className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>

            <button type="submit" className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold py-3.5 rounded-xl shadow-md hover:shadow-brand-blue/20 transition-all font-display tracking-wide text-center mt-3">Send Verification Code</button>
          </form>
          
          <div className="text-center text-xs text-brand-textMuted mt-6">
            Already have an account? <button onClick={() => setAuthState('login')} className="font-semibold text-brand-blue hover:text-white transition-colors ml-1">Log In</button>
          </div>
        </div>
      )}

      {/* VERIFY */}
      {authState === 'verify' && (
        <div className="bg-brand-card border border-brand-border p-8 rounded-2xl w-full max-w-[430px] text-left backdrop-blur-md animate-scale-in">
          <h2 className="font-display font-black text-2xl text-center">Verify Your Email</h2>
          <p className="text-brand-textMuted text-xs text-center mt-2 mb-8 leading-relaxed font-sans">Enter the 6-digit activation code sent to <strong className="text-white">{verifyEmailTarget}</strong>. Verify PavoMail overlay if code hasn't appeared yet.</p>

          <form onSubmit={handleVerifySubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 text-center">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Verification Code</label>
              <input type="text" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} required maxLength="6" placeholder="123456" className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl py-3.5 text-center text-2xl font-bold font-display tracking-[8px] text-brand-blue focus:outline-none transition-all" />
            </div>

            <button type="submit" className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold py-3.5 rounded-xl shadow-md hover:shadow-brand-blue/20 transition-all font-display tracking-wide text-center">Verify & Activate</button>
          </form>

          <div className="text-center mt-6">
            <button onClick={handleResendCode} disabled={resendCooldown > 0} className={`text-xs font-semibold focus:outline-none ${resendCooldown > 0 ? 'text-brand-textMuted cursor-not-allowed' : 'text-brand-blue hover:text-white'}`}>
              {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Resend Verification Code"}
            </button>
          </div>
        </div>
      )}

      {/* FORGOT */}
      {authState === 'forgot' && (
        <div className="bg-brand-card border border-brand-border p-8 rounded-2xl w-full max-w-[430px] text-left backdrop-blur-md animate-scale-in">
          <h2 className="font-display font-black text-2xl text-center">Forgot Password</h2>
          <p className="text-brand-textMuted text-xs text-center mt-1 mb-8">Enter email address to compile recovery procedures.</p>

          <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Email Address</label>
              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>
            <button type="submit" className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold py-3.5 rounded-xl shadow-md hover:shadow-brand-blue/20 transition-all font-display tracking-wide text-center mt-2">Send Recovery Code</button>
          </form>

          <div className="text-center text-xs text-brand-textMuted mt-6">
            Remember password? <button onClick={() => setAuthState('login')} className="font-semibold text-brand-blue hover:text-white transition-colors ml-1">Back to Log In</button>
          </div>
        </div>
      )}

      {/* RESET */}
      {authState === 'reset' && (
        <div className="bg-brand-card border border-brand-border p-8 rounded-2xl w-full max-w-[430px] text-left backdrop-blur-md animate-scale-in">
          <h2 className="font-display font-black text-2xl text-center">Reset Password</h2>
          <p className="text-brand-textMuted text-xs text-center mt-1 mb-8">Enter the code from PavoMail and pick a new password.</p>

          <form onSubmit={handleResetSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">6-Digit Recovery Code</label>
              <input type="text" value={resetForm.code} onChange={(e) => setResetForm({...resetForm, code: e.target.value})} required maxLength="6" placeholder="123456" className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl py-3.5 text-center text-xl font-bold font-display tracking-[4px] focus:outline-none transition-all" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">New Password</label>
              <input type="password" value={resetForm.newPass} onChange={(e) => setResetForm({...resetForm, newPass: e.target.value})} required minLength="8" className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase font-semibold">Confirm New Password</label>
              <input type="password" value={resetForm.confirm} onChange={(e) => setResetForm({...resetForm, confirm: e.target.value})} required className="bg-white/3 border border-brand-border focus:border-brand-blue rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all" />
            </div>

            <button type="submit" className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold py-3.5 rounded-xl shadow-md hover:shadow-brand-blue/20 transition-all font-display tracking-wide text-center mt-3">Reset Password</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Auth
