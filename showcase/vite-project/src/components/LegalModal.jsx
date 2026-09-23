import React from 'react'
import { X } from 'lucide-react'

function LegalModal({ type, setType }) {
  if (!type) return null;

  const content = {
    terms: {
      title: "Terms of Service",
      body: `
        <h4 class="font-display font-bold text-white text-sm uppercase mt-4 mb-2">1. Acceptance of Terms</h4>
        <p class="mb-4">By accessing Pavo Tweak website and downloading the software suite, you agree to comply with and be bound by these Terms of Service. These terms constitute a legally binding agreement between you and Pavo Tweak.</p>
        
        <h4 class="font-display font-bold text-white text-sm uppercase mt-4 mb-2">2. License Grant</h4>
        <p class="mb-4">Pavo Tweak grants you a non-exclusive, non-transferable, revocable lifetime license to use the optimization software on your personal machines, subject to key verification checks.</p>
        
        <h4 class="font-display font-bold text-white text-sm uppercase mt-4 mb-2">3. Misuse and Reverse Engineering</h4>
        <p class="mb-4">You may not modify, decompile, decrypt, disassemble or reverse engineer Pavo Tweak binaries. Any attempt to bypass licensing activation nodes or redistribute modified builds will result in immediate termination of license keys and user account bans.</p>
      `
    },
    privacy: {
      title: "Privacy Policy",
      body: `
        <h4 class="font-display font-bold text-white text-sm uppercase mt-4 mb-2">1. Data Collection</h4>
        <p class="mb-4">Pavo Tweak does not collect or store personal logs, registry configurations, or web traffic details. Any profile adjustment and optimization command execution occurs locally on your machine.</p>
        
        <h4 class="font-display font-bold text-white text-sm uppercase mt-4 mb-2">2. User Accounts</h4>
        <p class="mb-4">We hold your username, email, and password (in highly secured hashed format) to compile licenses, process downloads, and permit dashboard access. This data is never shared with third parties.</p>
        
        <h4 class="font-display font-bold text-white text-sm uppercase mt-4 mb-2">3. Cookies</h4>
        <p class="mb-4">We use local storage values to maintain session configurations and cart state details to ensure proper UI performance.</p>
      `
    },
    refund: {
      title: "Refund Policy",
      body: `
        <h4 class="font-display font-bold text-white text-sm uppercase mt-4 mb-2">1. Refund Policies</h4>
        <p class="mb-4">Due to the digital nature of lifetime software license keys, we generally do not offer refunds once a license key has been compiled and activated.</p>
        
        <h4 class="font-display font-bold text-white text-sm uppercase mt-4 mb-2">2. Exceptions</h4>
        <p class="mb-4">If you encounter severe hardware incompatibility issues that prevent Pavo Tweak from running altogether, contact support@pavotweak.com within 7 days of purchase. Our engineers will verify system crash logs and, if unresolved, execute a full refund transaction.</p>
      `
    }
  };

  const doc = content[type];

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black/80 backdrop-blur-sm z-[1300] flex justify-center items-center p-6" onClick={() => setType(null)}>
      <div className="bg-brand-card border border-brand-border p-8 rounded-2xl w-full max-w-[650px] max-h-[85%] overflow-y-auto flex flex-col gap-6 shadow-2xl animate-scale-in text-left" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-brand-border pb-4">
          <h3 className="font-display font-black text-xl">{doc.title}</h3>
          <button onClick={() => setType(null)} className="p-2 hover:bg-white/5 border border-transparent hover:border-brand-border rounded-lg text-brand-textMuted hover:text-white focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-brand-textMuted leading-relaxed" dangerouslySetInnerHTML={{ __html: doc.body }} />
      </div>
    </div>
  );
}

export default LegalModal
