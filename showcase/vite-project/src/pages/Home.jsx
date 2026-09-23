import React, { useState } from 'react'
import { Cpu, Activity, Zap, MousePointer, ShieldAlert, Rocket, Sliders, Layout, CheckCircle, MessageSquare, Mail, ChevronDown } from 'lucide-react'

function Home({ setView, triggerToast }) {
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [activeFAQ, setActiveFAQ] = useState(null);

  const handleSubmitContact = (e) => {
    e.preventDefault();
    setContactForm({ name: '', email: '', subject: '', message: '' });
    triggerToast("Message Dispatched", "Thank you! Our support engineers will contact you shortly.", "success");
  };

  const featureItems = [
    { icon: Cpu, title: "Optimize Windows", desc: "Fine-tune system scheduler, disable idle telemetry daemons, and eliminate hidden performance-throttling profiles." },
    { icon: Activity, title: "Reduce Background Processes", desc: "Instantly terminate useless OS components, bloatware, and auto-run apps to free up precious CPU cycles." },
    { icon: Zap, title: "FPS Optimization", desc: "Direct hardware prioritization to ensure games receive maximum GPU rendering queue preference." },
    { icon: MousePointer, title: "Low Input Delay", desc: "Fine-tune registry interrupt moderation and usb polling parameters to yield instant physical reaction times." },
    { icon: ShieldAlert, title: "Privacy Improvements", desc: "Enforce complete local security by stopping background data uploads, diagnostic tracking, and user logs compiling." },
    { icon: Rocket, title: "Startup Optimization", desc: "Audit and delay non-essential startup registries to slash boot time sequences and reach desktops faster." },
    { icon: Sliders, title: "Windows Customization", desc: "Rebuild context drawers, force custom theme profiles, align task menus, and accelerate system rendering speed." },
    { icon: Layout, title: "Beautiful Dashboard", desc: "Manage your system settings and optimizations from a sleek, responsive interface designed for gamers." },
    { icon: CheckCircle, title: "One Click Optimization", desc: "Deploy multiple safe registries edits instantly in one single click, zero configuration required." }
  ];

  const statItems = [
    { val: "50,000+", label: "Active Installations" },
    { val: "-14ms", label: "Input Delay Reduction" },
    { val: "+32%", label: "Average FPS Increase" },
    { val: "99.9%", label: "User Satisfaction" }
  ];

  const testimonialItems = [
    { quote: "Pavo Tweak stabilized my frame times completely. I went from micro-stutters to butter-smooth 240Hz gameplay in Valorant.", author: "Marcus 'Viper' Chen", role: "Apex Legends Pro" },
    { quote: "I was skeptical about registry cleaners, but Pavo's one-click optimization shaved 8ms off mouse response latency. It's legendary.", author: "Sarah Jenkins", role: "Esports Coach" }
  ];

  const faqItems = [
    { q: "How do I install Pavo Tweak?", a: "After acquiring a lifetime key, download the compiled Setup package from your dashboard. Execute the setup with Administrator rights, type in your license key, and let the installer complete setup steps. Once finished, launch the desktop app to begin." },
    { q: "Is Pavo Tweak safe to use?", a: "Absolutely. All tweaks implemented by Pavo Tweak are fully validated against standard Windows parameters. We compile restore checkpoints prior to deploying optimization scripts to safeguard system files." },
    { q: "What versions of Windows are supported?", a: "Pavo Tweak is optimized for all versions of Windows 10 (Build 1809 and newer) and all Windows 11 releases. It fully supports both 64-bit and ARM structures." },
    { q: "Does the license key expire?", a: "No. The Pavo Tweak Lifetime package is a one-time purchase ($8 USD) that provides an active, unlimited key including all future releases and update downloads." }
  ];

  return (
    <div className="w-full">
      {/* HERO SECTION */}
      <section id="hero" className="min-h-[calc(100vh-80px)] flex flex-col justify-center py-20 relative overflow-hidden">
        <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-brand-blue/10 rounded-full blur-[140px] pointer-events-none z-0" />
        
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 text-left flex flex-col items-start gap-6">
            <span className="bg-brand-blue/10 border border-brand-border text-brand-blue text-xs font-bold font-display px-3 py-1.5 rounded-full tracking-wider animate-pulse shadow-md shadow-brand-blue/10">WINDOWS 10 & 11 READY</span>
            <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7.5xl leading-[1.05] tracking-tight">THE ULTIMATE <span className="bg-gradient-to-r from-white to-brand-blue bg-clip-text text-transparent">WINDOWS OPTIMIZER</span></h1>
            <p className="text-brand-textMuted text-lg sm:text-xl font-normal max-w-xl leading-relaxed">Customize Windows. Optimize Performance. Reduce Processes. Increase FPS. Lower input latency instantly.</p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-2">
              <button onClick={() => setView('store')} className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 shadow-lg shadow-brand-blue/20 hover:shadow-brand-blue/40 scale-btn font-display tracking-wide text-center">Buy Now ($8)</button>
              <button onClick={() => { const el = document.getElementById('features'); if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' }); }} className="bg-white/5 hover:bg-white/10 border border-brand-border hover:border-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 text-center font-display tracking-wide backdrop-blur-md">Learn More</button>
            </div>
          </div>
          <div className="lg:col-span-5 flex justify-center items-center">
            <div className="product-box-wrapper relative cursor-pointer">
              <div className="product-box-3d w-[280px] h-[370px] sm:w-[320px] sm:h-[425px] rounded-3xl overflow-hidden border border-brand-border/60 shadow-2xl">
                <img src="product_box.png" alt="Pavo Tweak Box" className="w-full h-full object-cover" />
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
              </div>
              <div className="absolute -bottom-10 left-[10%] w-[80%] h-10 bg-brand-blue/20 rounded-full blur-xl filter -z-10 animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* STATISTICS ROW */}
      <section className="border-y border-brand-border bg-brand-card/40 backdrop-blur-md py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {statItems.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              <span className="font-display font-black text-3xl sm:text-4xl text-brand-blue">{item.val}</span>
              <span className="text-xs font-semibold text-brand-textMuted tracking-wider uppercase">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-24 border-b border-brand-border relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 flex flex-col items-center gap-4">
            <span className="font-display font-bold text-xs tracking-widest text-brand-blue uppercase">UNMATCHED POWER</span>
            <h2 className="font-display font-black text-3xl sm:text-4xl leading-tight tracking-tight">Engineered for Latency Domination</h2>
            <p className="text-brand-textMuted text-base leading-relaxed">Pavo Tweak cleans systems registries, modifies WMI values, audits background drivers, and prioritizes gaming threads.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="bg-brand-card/50 hover:bg-brand-card/80 border border-brand-border hover:border-brand-blue/30 p-8 rounded-2xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col gap-4 group hover:shadow-xl hover:shadow-brand-blue/5">
                  <div className="w-12 h-12 rounded-xl bg-brand-blue/10 border border-brand-blue/20 text-brand-blue flex items-center justify-center group-hover:bg-brand-blue group-hover:text-white transition-all duration-300 group-hover:scale-105 shadow-md shadow-brand-blue/15">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-white group-hover:text-brand-blue transition-colors duration-200">{item.title}</h3>
                  <p className="text-brand-textMuted text-sm leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 border-b border-brand-border relative z-10 overflow-hidden">
        <div className="absolute top-[30%] left-[5%] w-[400px] h-[400px] bg-brand-blue/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 flex flex-col items-center gap-4">
            <span className="font-display font-bold text-xs tracking-widest text-brand-blue uppercase">USER FEEDBACK</span>
            <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight">Approved by Champions</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonialItems.map((t, idx) => (
              <div key={idx} className="bg-brand-card/30 border border-brand-border p-8 sm:p-10 rounded-2xl flex flex-col justify-between gap-8 relative backdrop-blur-md">
                <span className="absolute top-6 left-6 text-7xl font-serif text-brand-blue/10 pointer-events-none">“</span>
                <p className="text-white text-base sm:text-lg italic leading-relaxed relative z-10">{t.quote}</p>
                <div className="flex items-center gap-4 border-t border-brand-border/60 pt-6">
                  <div className="w-10 h-10 rounded-full bg-brand-blue/20 border border-brand-blue/40 flex items-center justify-center font-display font-bold text-brand-blue">{t.author[0]}</div>
                  <div className="flex flex-col text-left">
                    <span className="font-display font-bold text-sm text-white">{t.author}</span>
                    <span className="text-xs text-brand-textMuted">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ ACCORDION */}
      <section id="faq" className="py-24 border-b border-brand-border relative z-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 flex flex-col items-center gap-4">
            <span className="font-display font-bold text-xs tracking-widest text-brand-blue uppercase">FAQ</span>
            <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight">Frequently Asked Questions</h2>
          </div>

          <div className="flex flex-col gap-4">
            {faqItems.map((item, idx) => (
              <div key={idx} className="bg-brand-card/40 border border-brand-border rounded-xl overflow-hidden hover:bg-brand-card/65 transition-colors duration-200">
                <button onClick={() => setActiveFAQ(activeFAQ === idx ? null : idx)} className="w-full px-6 py-5 text-left font-display font-bold text-base flex justify-between items-center text-white focus:outline-none">
                  <span>{item.q}</span>
                  <ChevronDown className={`w-5 h-5 text-brand-textMuted transition-transform duration-300 ${activeFAQ === idx ? 'rotate-180 text-brand-blue' : ''}`} />
                </button>
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${activeFAQ === idx ? 'max-h-[300px] border-t border-brand-border/30' : 'max-h-0'}`}>
                  <p className="px-6 py-5 text-sm text-brand-textMuted leading-relaxed">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 text-left flex flex-col items-start gap-4">
            <span className="font-display font-bold text-xs tracking-widest text-brand-blue uppercase">GET IN TOUCH</span>
            <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight leading-none">Need Support?</h2>
            <p className="text-brand-textMuted text-sm leading-relaxed mb-4">Have questions about optimizations, compatibility, or licenses? Reach out. Our engineers reply within 12 hours.</p>
            
            <div className="flex flex-col gap-4 w-full">
              <a href="https://discord.gg/pavotweak" target="_blank" className="flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-[#5865f2]/20 w-fit">
                <MessageSquare className="w-5 h-5" /> Join Discord Server
              </a>
              <div className="flex items-center gap-3 text-sm text-brand-textMuted mt-1">
                <Mail className="w-4 h-4 text-brand-blue" />
                <span>support@pavotweak.com</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-brand-card/75 border border-brand-border p-8 sm:p-10 rounded-2xl backdrop-blur-md">
              <form onSubmit={handleSubmitContact} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2 text-left">
                    <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase">Name</label>
                    <input type="text" value={contactForm.name} onChange={(e) => setContactForm({...contactForm, name: e.target.value})} placeholder="John Doe" required className="bg-white/3 border border-brand-border focus:border-brand-blue focus:bg-brand-blue/3 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all duration-200" />
                  </div>
                  <div className="flex flex-col gap-2 text-left">
                    <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase">Email</label>
                    <input type="email" value={contactForm.email} onChange={(e) => setContactForm({...contactForm, email: e.target.value})} placeholder="john@example.com" required className="bg-white/3 border border-brand-border focus:border-brand-blue focus:bg-brand-blue/3 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all duration-200" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-left">
                  <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase">Subject</label>
                  <input type="text" value={contactForm.subject} onChange={(e) => setContactForm({...contactForm, subject: e.target.value})} placeholder="Licensing help, setup query..." required className="bg-white/3 border border-brand-border focus:border-brand-blue focus:bg-brand-blue/3 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all duration-200" />
                </div>
                <div className="flex flex-col gap-2 text-left">
                  <label className="text-xs font-semibold tracking-wider text-brand-textMuted uppercase">Message</label>
                  <textarea rows="4" value={contactForm.message} onChange={(e) => setContactForm({...contactForm, message: e.target.value})} placeholder="Describe your request..." required className="bg-white/3 border border-brand-border focus:border-brand-blue focus:bg-brand-blue/3 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all duration-200 resize-none" />
                </div>
                <button type="submit" className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold py-3.5 rounded-xl transition-all duration-300 shadow-md hover:shadow-brand-blue/20 scale-btn font-display tracking-wide mt-2">Send Message</button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home
