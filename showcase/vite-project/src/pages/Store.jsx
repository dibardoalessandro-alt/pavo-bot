import React from 'react'
import { CheckCircle2 } from 'lucide-react'

function Store({ cart, setCart, setCartOpen, triggerToast }) {
  const product = {
    id: "pavo_lifetime",
    name: "Pavo Tweak Lifetime",
    price: 8.00,
    desc: "One-time purchase license. Unlimited PC configurations. Automated updates."
  };

  const handleAddToCart = () => {
    if (cart.some(item => item.id === product.id)) {
      triggerToast("Cart Notice", "Pavo Tweak Lifetime is already in your cart.", "info");
      setCartOpen(true);
      return;
    }
    const updated = [...cart, { ...product, qty: 1 }];
    setCart(updated);
    localStorage.setItem("pt_cart", JSON.stringify(updated));
    triggerToast("Added to Cart", "Pavo Tweak Lifetime added to cart successfully.", "success");
    setCartOpen(true);
  };

  return (
    <div className="py-20 relative z-10">
      <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-brand-blue/5 rounded-full blur-[140px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16 flex flex-col items-center gap-4">
          <span className="font-display font-bold text-xs tracking-widest text-brand-blue uppercase">STORE</span>
          <h2 className="font-display font-black text-4xl tracking-tight">Acquire License Access</h2>
          <p className="text-brand-textMuted text-base">Get lifetime setup utility access and support updates in one single payment.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-5xl mx-auto">
          <div className="lg:col-span-6 flex justify-center">
            <div className="relative group">
              <div className="w-[280px] h-[370px] sm:w-[320px] sm:h-[420px] bg-brand-card border border-brand-border rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]">
                <img src="product_box.png" alt="Pavo Tweak Lifetime product box image" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-10 left-[10%] w-[80%] h-10 bg-brand-blue/20 rounded-full blur-xl filter -z-10 group-hover:bg-brand-blue/30 transition-colors" />
            </div>
          </div>

          <div className="lg:col-span-6 text-left">
            <div className="bg-brand-card/85 border border-brand-border p-8 sm:p-10 rounded-2xl backdrop-blur-md flex flex-col gap-6">
              <div>
                <span className="bg-brand-blue text-white text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wider font-display uppercase shadow-md shadow-brand-blue/35 inline-block mb-3">BESTSELLER</span>
                <h3 className="font-display font-extrabold text-2xl text-white">Pavo Tweak Lifetime Package</h3>
                <p className="text-brand-textMuted text-sm leading-relaxed mt-2">{product.desc}</p>
              </div>

              <div className="flex items-baseline gap-1 py-2 border-y border-brand-border/40 my-1">
                <span className="text-xl font-bold font-display text-white">$</span>
                <span className="text-5xl font-black font-display text-white">8.00</span>
                <span className="text-xs font-semibold text-brand-textMuted uppercase ml-2">USD (one-time fee)</span>
              </div>

              <ul className="flex flex-col gap-3 text-sm">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-green" />
                  <span>Lifetime Product Key</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-green" />
                  <span>Full Software Downloads Included</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-green" />
                  <span>Instant Delivery to Dashboard Inbox</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-green" />
                  <span>Premium Registry & OS Configuration files</span>
                </li>
              </ul>

              <button onClick={handleAddToCart} className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold py-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-brand-blue/30 scale-btn font-display tracking-wide text-center">Add to Cart</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Store
