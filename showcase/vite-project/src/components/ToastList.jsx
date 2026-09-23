import React from 'react'

function ToastList({ toasts, setToasts }) {
  return (
    <div className="fixed top-24 right-6 flex flex-col gap-3 z-[9999] pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto bg-brand-card/90 border border-brand-border p-4 rounded-xl shadow-2xl backdrop-blur-xl w-[320px] text-left border-l-4 flex flex-col gap-1.5 animate-scale-in ${t.type === 'success' ? 'border-l-brand-green' : (t.type === 'error' ? 'border-l-brand-red' : 'border-l-brand-blue')}`}>
          <div className="flex justify-between items-center font-display font-bold text-xs">
            <span>{t.title}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-brand-textMuted hover:text-white font-sans text-sm focus:outline-none">&times;</button>
          </div>
          <p className="text-[11px] text-brand-textMuted leading-relaxed">{t.message}</p>
        </div>
      ))}
    </div>
  );
}

export default ToastList
