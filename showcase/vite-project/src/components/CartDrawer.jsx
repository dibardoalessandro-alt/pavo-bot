import React from 'react'
import { X, Trash2 } from 'lucide-react'
import { db } from '../App'

function CartDrawer({ isOpen, setIsOpen, cart, setCart, setCheckoutOpen }) {
  const handleRemoveItem = (id) => {
    const updated = cart.filter(item => item.id !== id);
    setCart(updated);
    db.set("pt_cart", updated);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black/60 backdrop-blur-sm z-[1100] flex justify-end" onClick={() => setIsOpen(false)}>
      <div className="w-full max-w-[400px] h-full bg-brand-card border-l border-brand-border flex flex-col justify-between shadow-2xl animate-slide-in-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-brand-border flex justify-between items-center">
          <h3 className="font-display font-black text-lg">Your Cart</h3>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 border border-transparent hover:border-brand-border rounded-lg text-brand-textMuted hover:text-white focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4 text-left">
          {cart.length === 0 ? (
            <p className="text-brand-textMuted text-sm text-center mt-12">Your cart is currently empty.</p>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="bg-white/2 border border-brand-border p-4 rounded-xl flex gap-4 relative group">
                <img src="product_box.png" alt={item.name} className="w-14 h-16 object-cover rounded-lg shadow-md" />
                <div className="flex flex-col justify-center gap-1">
                  <span className="font-semibold text-xs text-white">{item.name}</span>
                  <span className="font-display font-black text-sm text-brand-blue">${item.price.toFixed(2)} USD</span>
                </div>
                <button onClick={() => handleRemoveItem(item.id)} className="absolute top-2 right-2 p-1.5 text-brand-textMuted hover:text-brand-red opacity-0 group-hover:opacity-100 transition-all focus:outline-none">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-brand-border bg-black/20 flex flex-col gap-5">
          <div className="flex justify-between items-center font-display font-black text-base">
            <span>Subtotal</span>
            <span className="text-brand-blue">${subtotal.toFixed(2)} USD</span>
          </div>
          <button 
            disabled={cart.length === 0} 
            onClick={() => { setIsOpen(false); setCheckoutOpen(true); }} 
            className="bg-brand-blue hover:bg-brand-blueHover disabled:bg-brand-textMuted/10 disabled:text-brand-textMuted/40 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl shadow-md hover:shadow-brand-blue/30 transition-all font-display tracking-wide text-center"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}

export default CartDrawer
