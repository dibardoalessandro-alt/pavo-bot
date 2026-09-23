import React, { useState, useEffect } from 'react'
import { Package, Key, Download, FileText, Box } from 'lucide-react'
import { db } from '../App'

function Dashboard({ user, setView, triggerToast }) {
  const [keys, setKeys] = useState([]);
  const [orders, setOrders] = useState([]);
  const [releases, setReleases] = useState([]);

  useEffect(() => {
    setKeys(db.get("pt_keys").filter(k => k.userEmail === user.email));
    setOrders(db.get("pt_orders").filter(o => o.userEmail === user.email));
    setReleases(db.get("pt_releases"));
  }, [user]);

  const copyKey = (keyStr) => {
    navigator.clipboard.writeText(keyStr).then(() => {
      triggerToast("Key Copied", "License key copied to clipboard.", "success");
    });
  };

  const downloadFile = () => {
    triggerToast("Download Started", "Retrieving PavoSetup.exe bundle file...", "success");
  };

  return (
    <div className="py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-brand-border pb-6 mb-8 gap-4 text-left">
          <div>
            <h2 className="font-display font-black text-3xl text-white">Welcome back, <span className="text-brand-blue">{user.username}</span></h2>
            <p className="text-brand-textMuted text-sm mt-1">Configure registry profiles, manage systems keys, and download installer packages.</p>
          </div>
          <div className="flex items-center gap-2 bg-white/3 border border-brand-border rounded-full px-4 py-1.5 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse shadow-md shadow-brand-green/30" />
            Secured Session
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Column 1 */}
          <div className="lg:col-span-6 flex flex-col gap-8">
            {/* Products */}
            <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-5 text-left">
              <h3 className="font-display font-bold text-md tracking-wider text-white uppercase flex items-center gap-2.5">
                <Package className="w-4 h-4 text-brand-blue" /> Purchased Products
              </h3>
              
              {keys.length === 0 ? (
                <div className="border border-dashed border-brand-border rounded-xl p-8 text-center flex flex-col items-center gap-4">
                  <p className="text-sm text-brand-textMuted max-w-[260px]">No active products purchased. Explore the store page to buy a lifetime license.</p>
                  <button onClick={() => setView('store')} className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-md transition-all">Go to Store</button>
                </div>
              ) : (
                <div className="bg-white/2 border border-brand-border rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand-blue/10 border border-brand-blue/20 text-brand-blue flex items-center justify-center">
                      <Box className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-white font-display">Pavo Tweak Lifetime</span>
                      <span className="text-xs text-brand-textMuted font-sans">Licenses Owned: {keys.length}</span>
                    </div>
                  </div>
                  <span className="bg-brand-green/10 border border-brand-green/20 text-brand-green text-[10px] font-bold px-2 py-0.5 rounded uppercase">ACTIVE</span>
                </div>
              )}
            </div>

            {/* Keys */}
            <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-5 text-left">
              <h3 className="font-display font-bold text-md tracking-wider text-white uppercase flex items-center gap-2.5">
                <Key className="w-4 h-4 text-brand-blue" /> System License Keys
              </h3>

              {keys.length === 0 ? (
                <div className="border border-dashed border-brand-border rounded-xl p-8 text-center">
                  <p className="text-sm text-brand-textMuted">Key registries will populate after checkout.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {keys.map((k, idx) => (
                    <div key={idx} className="bg-white/2 border border-brand-border rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-brand-textMuted tracking-wider uppercase">LICENSE KEY</span>
                        <code className="text-sm font-bold text-white tracking-wide">{k.key}</code>
                      </div>
                      <button onClick={() => copyKey(k.key)} className="bg-white/5 hover:bg-white/10 border border-brand-border hover:border-white/25 text-xs font-semibold px-4 py-2 rounded-lg transition-all focus:outline-none">Copy</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column 2 */}
          <div className="lg:col-span-6 flex flex-col gap-8">
            {/* Downloads */}
            <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-5 text-left">
              <h3 className="font-display font-bold text-md tracking-wider text-white uppercase flex items-center gap-2.5">
                <Download className="w-4 h-4 text-brand-blue" /> Downloads
              </h3>

              {keys.length === 0 ? (
                <div className="border border-dashed border-brand-border rounded-xl p-8 text-center flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-red/5 border border-brand-red/20 text-brand-red flex items-center justify-center">
                    <Key className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-brand-textMuted max-w-[220px]">Setup download locked. Purchase product to gain downloads access.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="bg-gradient-to-r from-brand-blue/10 to-brand-blue/2 border border-brand-blue/20 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">Pavo Setup Suite (v1.2.0)</span>
                      <span className="text-xs text-brand-textMuted">Binary executable (Gzip compressed) | Size: 1.2 MB</span>
                    </div>
                    <a href="../PavoSetup.exe" download onClick={downloadFile} className="bg-brand-blue hover:bg-brand-blueHover text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold tracking-wider text-white uppercase mb-3">Version Release Changelogs</h4>
                    <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-2">
                      {releases.map((rel, idx) => (
                        <div key={idx} className="bg-white/2 border border-brand-border rounded-lg p-3.5 text-xs flex flex-col gap-1.5">
                          <div className="flex justify-between font-semibold">
                            <span className="text-brand-blue">v{rel.version}</span>
                            <span className="text-brand-textMuted">{rel.date}</span>
                          </div>
                          <p className="text-brand-textMuted leading-relaxed">{rel.notes}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Orders */}
            <div className="bg-brand-card border border-brand-border p-6 rounded-2xl flex flex-col gap-5 text-left">
              <h3 className="font-display font-bold text-md tracking-wider text-white uppercase flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-brand-blue" /> Order History
              </h3>

              {orders.length === 0 ? (
                <div className="border border-dashed border-brand-border rounded-xl p-8 text-center">
                  <p className="text-sm text-brand-textMuted">No purchase invoices registered.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {orders.map((ord, idx) => (
                    <div key={idx} className="bg-white/2 border border-brand-border rounded-xl p-4 flex flex-col gap-3 text-xs text-left">
                      <div className="flex justify-between border-b border-brand-border/30 pb-2">
                        <span className="font-bold text-white">{ord.orderId}</span>
                        <span className="text-brand-textMuted">{new Date(ord.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-brand-textMuted">{ord.productName}</span>
                        <span className="font-bold text-brand-blue font-display">$8.00 USD</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard
