import React from 'react'
import { ChevronUp, ArrowLeft } from 'lucide-react'
import { db } from '../App'

function EmailClient({ isOpen, setIsOpen, unreadCount, mailList, setMailList, updateUnreadCount, activeMail, setActiveMail }) {
  const handleExpandInbox = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
    
    if (isOpen) {
      const readMails = mailList.map(m => ({ ...m, unread: false }));
      setMailList(readMails);
      db.set("pt_mails", readMails);
      updateUnreadCount(readMails);
    }
  };

  const openMailDetail = (idx) => {
    const mail = mailList[idx];
    mail.unread = false;
    const updated = [...mailList];
    updated[idx] = mail;
    setMailList(updated);
    db.set("pt_mails", updated);
    updateUnreadCount(updated);
    setActiveMail(mail);
  };

  return (
    <div className={`fixed bottom-0 right-6 w-full max-w-[420px] bg-[#0d0e12] border border-brand-border rounded-t-2xl shadow-2xl z-[1000] flex flex-col transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'h-[385px]' : 'h-[50px] overflow-hidden'}`}>
      <div onClick={handleExpandInbox} className="bg-[#111319] border-b border-brand-border px-4 py-3 flex justify-between items-center cursor-pointer rounded-t-2xl">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-blue animate-pulse shadow-md shadow-brand-blue/35" />
          <strong className="text-white">PavoMail Delivery node</strong>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="bg-brand-red text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 animate-pulse">{unreadCount}</span>
          )}
          <ChevronUp className={`w-4 h-4 text-brand-textMuted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="flex-grow overflow-hidden relative">
          {!activeMail ? (
            <div className="w-full h-full p-4 overflow-y-auto flex flex-col gap-2 text-left">
              {mailList.length === 0 ? (
                <p className="text-xs text-brand-textMuted text-center mt-20 leading-relaxed">No emails received. Complete a Registration or Request Password Recovery to trigger a simulated mail payload here.</p>
              ) : (
                mailList.map((m, idx) => (
                  <div key={idx} onClick={() => openMailDetail(idx)} className={`border border-brand-border rounded-lg p-3 hover:bg-white/4 cursor-pointer flex flex-col gap-1 transition-colors ${m.unread ? 'border-l-4 border-l-brand-blue bg-brand-blue/2' : 'bg-white/2'}`}>
                    <div className="flex justify-between items-center text-[10px] text-brand-textMuted">
                      <span className="font-bold text-brand-blue">{m.from}</span>
                      <span>{m.time}</span>
                    </div>
                    <span className="font-display font-bold text-xs text-white truncate">{m.subject}</span>
                    <span className="text-[11px] text-brand-textMuted truncate">Click to read details and copy code...</span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="w-full h-full p-4 overflow-y-auto text-left flex flex-col gap-4">
              <button onClick={() => setActiveMail(null)} className="flex items-center gap-1 text-xs font-semibold text-brand-blue hover:text-white transition-colors focus:outline-none">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Inbox
              </button>
              <div className="text-[11px] border-b border-brand-border pb-3 flex flex-col gap-1 text-brand-textMuted leading-relaxed">
                <p><strong>From:</strong> {activeMail.from}</p>
                <p><strong>To:</strong> {activeMail.to}</p>
                <p><strong>Subject:</strong> <span className="text-white font-semibold">{activeMail.subject}</span></p>
                <p><strong>Time:</strong> {activeMail.time}</p>
              </div>
              <div className="email-body-markup text-xs text-brand-textMuted" dangerouslySetInnerHTML={{ __html: activeMail.body }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EmailClient
