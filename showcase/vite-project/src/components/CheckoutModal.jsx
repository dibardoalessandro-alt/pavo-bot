import React, { useState } from 'react'
import { X, ShieldCheck, MessageSquare } from 'lucide-react'

function CheckoutModal({ isOpen, setIsOpen, triggerToast }) {
  const [method, setMethod] = useState('ltc'); // 'ltc', 'paypal', 'btc', 'eth'
  const [copied, setCopied] = useState(false);
  const discordLink = "https://discord.gg/JjVG5V9K44";
  const ltcAddress = "LTu1AGw1L8Lp3L1vY4t9CtfD6j3qVwRk7z";

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(ltcAddress);
    setCopied(true);
    triggerToast("Address Copied", "Litecoin address copied to clipboard.", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black/85 backdrop-blur-md z-[1200] flex justify-center items-center p-6" onClick={() => setIsOpen(false)}>
      <div className="bg-brand-card border border-brand-border p-8 rounded-3xl w-full max-w-[800px] max-h-[90%] overflow-y-auto flex flex-col gap-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-brand-border pb-4">
          <h3 className="font-display font-black text-xl">Secure Checkout</h3>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 border border-transparent hover:border-brand-border rounded-lg text-brand-textMuted hover:text-white focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
          {/* Left column: payment methods selection & directions */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h4 className="font-display font-bold text-xs text-brand-blue uppercase tracking-wider">Select Payment Method</h4>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Litecoin */}
                <button 
                  type="button"
                  onClick={() => setMethod('ltc')}
                  className={`p-4 rounded-xl border flex flex-col gap-1 items-start transition-all text-left focus:outline-none ${method === 'ltc' ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-white/2 hover:border-white/10'}`}
                >
                  <span className="font-bold text-sm text-white">Litecoin (LTC)</span>
                  <span className="text-[10px] text-brand-textMuted">Pay directly with crypto</span>
                </button>

                {/* PayPal */}
                <button 
                  type="button"
                  onClick={() => setMethod('paypal')}
                  className={`p-4 rounded-xl border flex flex-col gap-1 items-start transition-all text-left focus:outline-none ${method === 'paypal' ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-white/2 hover:border-white/10'}`}
                >
                  <span className="font-bold text-sm text-white">PayPal</span>
                  <span className="text-[10px] text-brand-textMuted">Manual Discord purchase</span>
                </button>

                {/* Bitcoin */}
                <button 
                  type="button"
                  onClick={() => setMethod('btc')}
                  className={`p-4 rounded-xl border flex flex-col gap-1 items-start transition-all text-left focus:outline-none ${method === 'btc' ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-white/2 hover:border-white/10'}`}
                >
                  <span className="font-bold text-sm text-white">Bitcoin (BTC)</span>
                  <span className="text-[10px] text-brand-textMuted">Manual Discord purchase</span>
                </button>

                {/* Ethereum */}
                <button 
                  type="button"
                  onClick={() => setMethod('eth')}
                  className={`p-4 rounded-xl border flex flex-col gap-1 items-start transition-all text-left focus:outline-none ${method === 'eth' ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-border bg-white/2 hover:border-white/10'}`}
                >
                  <span className="font-bold text-sm text-white">Ethereum (ETH)</span>
                  <span className="text-[10px] text-brand-textMuted">Manual Discord purchase</span>
                </button>
              </div>
            </div>

            <hr className="border-brand-border/50" />

            {/* Payment Details Section */}
            {method === 'ltc' ? (
              <div className="flex flex-col gap-4 scale-in">
                <h5 className="font-display font-bold text-xs text-brand-blue uppercase tracking-wider">Litecoin Payment Instructions</h5>
                <p className="text-xs text-brand-textMuted leading-relaxed">
                  To complete your purchase of Pavo Tweak Lifetime access via Litecoin (LTC), please send exactly **$8.00 USD** equivalent in LTC to the address below:
                </p>
                
                <div className="bg-white/2 border border-brand-border p-4 rounded-xl flex flex-col gap-2">
                  <span className="text-[9px] font-bold text-brand-textMuted uppercase tracking-wider">Litecoin (LTC) Address</span>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={ltcAddress} 
                      className="bg-black/30 border border-brand-border rounded-lg px-3 py-2 text-xs font-mono text-white flex-grow select-all focus:outline-none" 
                    />
                    <button 
                      type="button"
                      onClick={handleCopyAddress}
                      className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all focus:outline-none"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="bg-white/2 border border-brand-border p-4 rounded-xl flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Step 2: Verify Your Payment</span>
                  <p className="text-xs text-brand-textMuted leading-relaxed">
                    Once you have broadcast the transaction, join our Discord server, open a billing support ticket, and share your TXID or payment proof. We will manually verify the payment and compile your key.
                  </p>
                  <a 
                    href={discordLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold py-3 rounded-xl transition-all font-display text-xs tracking-wide text-center mt-2 flex items-center justify-center gap-2"
                  >
                    <span>Join Discord to Verify</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 scale-in py-4 text-center items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-brand-blue/10 border border-brand-blue/25 flex items-center justify-center text-brand-blue mb-2">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h5 className="font-display font-black text-base text-white">Manual Discord Purchase</h5>
                <p className="text-xs text-brand-textMuted max-w-sm leading-relaxed mb-4">
                  PayPal, Bitcoin, and Ethereum payments are processed manually by our staff. Click the button below to join our Discord server and open a ticket.
                </p>
                <a 
                  href={discordLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold px-8 py-4 rounded-xl transition-all font-display text-sm tracking-wide text-center flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20"
                >
                  <span>Join Discord Server</span>
                </a>
              </div>
            )}
          </div>

          {/* Right column: Order Summary */}
          <div className="lg:col-span-5 border-l border-brand-border/60 lg:pl-8 flex flex-col gap-5">
            <h4 className="font-display font-bold text-xs text-brand-blue uppercase tracking-wider">Order Summary</h4>
            <div className="bg-white/2 border border-brand-border p-4 rounded-xl flex gap-3.5">
              <img src="product_box.png" alt="Pavo Tweak" className="w-12 h-14 object-cover rounded shadow" />
              <div className="flex flex-grow flex-col justify-center">
                <span className="font-semibold text-xs text-white">Pavo Tweak Lifetime</span>
                <span className="text-[10px] text-brand-textMuted">Quantity: 1</span>
              </div>
              <span className="font-display font-black text-sm text-brand-blue flex items-center">$8.00</span>
            </div>

            <hr className="border-brand-border/50" />
            
            <div className="flex justify-between items-center font-display font-black text-md">
              <span>Total Due</span>
              <span className="text-brand-blue">$8.00 USD</span>
            </div>

            <div className="bg-[#0b0c10] border border-brand-border/80 rounded-xl p-4 flex gap-3 text-xs leading-relaxed text-brand-textMuted items-start mt-2">
              <ShieldCheck className="w-5 h-5 text-brand-blue flex-shrink-0 mt-0.5" />
              <span>Secure checkout. Direct payment instructions or server transitions are secured using standard encryptions.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CheckoutModal
