/* ==========================================================================
   PAVO TWEAK WEB SHOWCASE INTERACTIVE LOGIC
   Handcrafted frontend logic - LO 2026
   ========================================================================== */

// DEBUG MODE BYPASS
// const DEBUG_BYPASS = true; // LO: Toggle this if testing local layout renders without auth key

// ─── LOCALIZATION DICTIONARIES ───────────────────────────────────────────
const translations = {
    en: {
        "login.subtitle": "LICENSE ACTIVATION",
        "login.desc": "Enter your license key to continue",
        "login.error": "Invalid license key. Try 'SHOWCASE'.",
        "login.activate": "ACTIVATE LICENSE",
        "login.bypass": "Or click here for",
        "login.bypass.link": "Instant Demo Access",
        "status.admin": "ADMINISTRATOR MODE",
        "cat.monitoring": "MONITORING",
        "cat.tweaks": "SYSTEM TWEAKS",
        "cat.storage": "STORAGE & RAM",
        "cat.other": "OTHER",
        "nav.dashboard": "Dashboard",
        "nav.ai": "Diagnostics & AI",
        "nav.custom": "Windows Custom",
        "nav.gaming": "Gaming Hub",
        "nav.driver": "Driver Center",
        "nav.benchmark": "Benchmarks",
        "nav.disk": "Disk Tools",
        "nav.ram": "RAM Manager",
        "nav.startup": "Startup Apps",
        "nav.restore": "System Restore",
        "nav.market": "Marketplace",
        "nav.settings": "Settings",
        "nav.discord": "Discord Support",
        "dash.score.title": "SYSTEM TELEMETRY DIALOGUE",
        "dash.score.desc": "Aggregated state of active kernel tweaks, subkey overrides, and registry cache cleanups.",
        "dash.card.health": "System Integrity",
        "dash.card.storage": "Disk Payload",
        "dash.monitor.title": "LIVE RESOURCE MONITOR",
        "dash.cpu": "CPU",
        "dash.gpu": "GPU",
        "dash.ram": "RAM",
        "widget.weather.clear": "Optimal Ambient",
        "widget.net.title": "NETWORK SPIKES",
        "status.done": "Optimal",
        "btn.scan": "Scan",
        "btn.clean": "Clean",
        "btn.update": "Update",
        "btn.start": "Start",
        "btn.stop": "Stop",
        "btn.optimize": "Apply Optimization",
        // Settings page translation
        "settings.title": "SETTINGS",
        "settings.general": "General",
        "settings.appearance": "Appearance",
        "settings.performance": "Performance",
        "settings.audio": "Audio",
        "settings.advanced": "Advanced",
        "settings.language": "Language",
        "settings.startup": "Launch with Windows",
        "settings.tray": "Minimize to Tray",
        "settings.updates": "Check Updates",
        "settings.notifications": "Notifications",
        "settings.theme": "Theme",
        "settings.theme.dark": "Dark Theme",
        "settings.theme.soft": "Soft Dark",
        "settings.accent": "Accent Color",
        "settings.uiscale": "UI Scale",
        "settings.animations": "Animation Quality",
        "settings.anim.low": "Low",
        "settings.anim.normal": "Normal",
        "settings.anim.high": "High",
        "settings.hwaccel": "Hardware Acceleration",
        "settings.gpurender": "GPU Rendering",
        "settings.memopt": "Memory Optimization",
        // Optimization details
        "ai.title": "SYSTEM DIAGNOSTICS & TELEMETRY",
        "ai.desc": "Runs active WMI queries and registry analysis to compile low-latency specific parameters.",
        "ai.scan": "Run Diagnostic Scan",
        "ai.hardware.info": "LOCAL SPECIFICATIONS DETECTED",
        "ai.suggestions": "Optimization Overrides",
        "custom.desc": "Modify Windows shell parameters and registry subkeys to maximize explorer redraw speeds.",
        "custom.cat.taskbar": "SHELL & TASKBAR",
        "custom.cat.explorer": "REGISTRY TWEAKS",
        "custom.taskbar.align": "Taskbar Alignment",
        "custom.search.mode": "Search Mode",
        "custom.taskbar.trans": "Taskbar Transparency",
        "custom.theme": "System Theme",
        "custom.val.center": "Center",
        "custom.val.left": "Left",
        "custom.val.icon": "Icon Only",
        "custom.val.box": "Search Box",
        "custom.val.hidden": "Hidden",
        "custom.val.blur": "Acrylic Blur",
        "custom.val.transparent": "Transparent",
        "custom.val.opaque": "Opaque",
        "custom.val.light": "Light Theme",
        "custom.chk.telemetry": "Bypass MS Telemetry Daemons",
        "custom.desc.telemetry": "Forces REG ADD cmd checks to suppress background tracker payloads.",
        "custom.chk.cortana": "Disable Bing Search & Cortana",
        "custom.desc.cortana": "Stops explorer taskbar from querying web URLs during index searches.",
        "custom.chk.menu": "Classic Windows 10 Context Menu",
        "custom.desc.menu": "Bypasses Windows 11 'Show more options' secondary folder layouts.",
        "custom.btn.explorer": "Restart Explorer Shell",
        "game.lib.title": "Active Executables Library",
        "game.btn.add": "Add Custom (.exe)",
        "game.btn.launch": "Launch Active Target",
        "game.opts.title": "HUB ENGINE PREFERENCES",
        "game.hud.title": "FPS HUD Overlay",
        "game.hud.btn": "Enable HUD Overlay",
        "game.power.title": "Active Power Plan",
        "game.power.btn": "Restore Balanced Plan",
        "driver.desc": "Scans installed driver hardware addresses and retrieves latency-tested gaming editions.",
        "driver.table.device": "Hardware Interface",
        "driver.table.current": "Installed version",
        "driver.table.status": "State",
        "driver.table.latency": "System Latency Impact",
        "driver.table.scanmsg": "Click 'Scan' to run device directory validation queries.",
        "bench.desc": "Executes CPU and GPU workloads to measure thread latency and FPS stability index.",
        "bench.results": "DIAGNOSTIC REPORT",
        "disk.desc": "Force SSD block indexing cleanups via TRIM controller commands to clear system cache.",
        "disk.tool.cleaner": "OS TEMP CACHE CLEANER",
        "disk.cleaner.label": "Cache Payload Size",
        "disk.tool.trim": "TRIM CONTROLLER OPTIMIZATION",
        "disk.trim.desc": "Forces filesystem to report unallocated sectors immediately to the flash driver.",
        "disk.trim.btn": "Dispatch TRIM Command",
        "ram.desc": "Purges standby memory list cells populated by closed application tables.",
        "ram.stats.title": "RAM MEMORY SPECS",
        "ram.legend.active": "Active Pages",
        "ram.legend.cache": "Standby Cache",
        "ram.standby.size": "Standby List Size",
        "ram.clean.btn": "Purge Standby Cache",
        "ram.explain": "Flushing standby cells reclaims unallocated memory directly, lowering system latency.",
        "ram.opts.title": "RAM BUFFER ACTIONS",
        "startup.desc": "Manage automatic login executables to optimize system startup index times.",
        "startup.table.name": "Executable Name",
        "startup.table.publisher": "Verified Signer",
        "startup.table.impact": "Boot Loading Impact",
        "restore.desc": "Manage restore check registries to revert updates safely if anomalies occur.",
        "restore.action.title": "Registry Restorations",
        "restore.explain": "Generate a system save state before executing custom marketplace profiles.",
        "restore.btn.create": "Create Restore Point",
        "restore.btn.rollback": "Rollback Registry Changes",
        "restore.history.title": "ACTIVE SYSTEM BACKUPS",
        "market.desc": "Download custom e-sport optimization scripts and profiles built by gaming engineers."
    },
    it: {
        "login.subtitle": "ATTIVAZIONE LICENZA",
        "login.desc": "Inserisci la chiave di licenza per continuare",
        "login.error": "Chiave non valida. Prova 'SHOWCASE'.",
        "login.activate": "ATTIVA LICENZA",
        "login.bypass": "O clicca qui per",
        "login.bypass.link": "Accesso Demo Istantaneo",
        "status.admin": "MODALITÀ AMMINISTRATORE",
        "cat.monitoring": "MONITORAGGIO",
        "cat.tweaks": "TWEAK DI SISTEMA",
        "cat.storage": "ARCHIVIAZIONE & RAM",
        "cat.other": "ALTRO",
        "nav.dashboard": "Dashboard",
        "nav.ai": "AI & Diagnostica",
        "nav.custom": "Windows Custom",
        "nav.gaming": "Gaming Hub",
        "nav.driver": "Driver Center",
        "nav.benchmark": "Benchmark",
        "nav.disk": "Disk Tools",
        "nav.ram": "RAM Manager",
        "nav.startup": "App di Avvio",
        "nav.restore": "Ripristino",
        "nav.market": "Marketplace",
        "nav.settings": "Impostazioni",
        "nav.discord": "Supporto Discord",
        "dash.score.title": "TELEMETRIA DI SISTEMA",
        "dash.score.desc": "Stato complessivo dei tweak attivi nel kernel, override di chiavi di registro e pulizia cache.",
        "dash.card.health": "Integrità Sistema",
        "dash.card.storage": "Payload Disco",
        "dash.monitor.title": "RISORSE LIVE DI SISTEMA",
        "dash.cpu": "CPU",
        "dash.gpu": "GPU",
        "dash.ram": "RAM",
        "widget.weather.clear": "Ambiente Ottimale",
        "widget.net.title": "SPIKES DI RETE",
        "status.done": "Ottimale",
        "btn.scan": "Scansiona",
        "btn.clean": "Pulisci",
        "btn.update": "Aggiorna",
        "btn.start": "Avvia",
        "btn.stop": "Ferma",
        "btn.optimize": "Applica Ottimizzazione",
        // Impostazioni
        "settings.title": "IMPOSTAZIONI",
        "settings.general": "Generale",
        "settings.appearance": "Aspetto",
        "settings.performance": "Performance",
        "settings.audio": "Audio",
        "settings.advanced": "Avanzate",
        "settings.language": "Lingua",
        "settings.startup": "Avvia con Windows",
        "settings.tray": "Minimizza nel Tray",
        "settings.updates": "Controlla Aggiornamenti",
        "settings.notifications": "Notifiche",
        "settings.theme": "Tema",
        "settings.theme.dark": "Scuro",
        "settings.theme.soft": "Scuro Morbido",
        "settings.accent": "Colore Accento",
        "settings.uiscale": "Scala UI",
        "settings.animations": "Qualità Animazioni",
        "settings.anim.low": "Bassa",
        "settings.anim.normal": "Normale",
        "settings.anim.high": "Alta",
        "settings.hwaccel": "Accelerazione Hardware",
        "settings.gpurender": "Rendering GPU",
        "settings.memopt": "Ottimizzazione Memoria",
        // Altre schede
        "ai.title": "DIAGNOSTICA DI SISTEMA & TELEMETRIA",
        "ai.desc": "Esegue query WMI attive e analisi del registro per generare profili specifici a bassa latenza.",
        "ai.scan": "Avvia Scansione Diagnostica",
        "ai.hardware.info": "SPECIFICHE HARDWARE RILEVATE",
        "ai.suggestions": "Override di Ottimizzazione",
        "custom.desc": "Modifica l'interfaccia di Windows e i subkey di registro per velocizzare il ridisegno di explorer.",
        "custom.cat.taskbar": "INTERFACCIA & TASKBAR",
        "custom.cat.explorer": "TWEAK REGISTRO",
        "custom.taskbar.align": "Allineamento Taskbar",
        "custom.search.mode": "Metodo di Ricerca",
        "custom.taskbar.trans": "Trasparenza Taskbar",
        "custom.theme": "Tema di Sistema",
        "custom.val.center": "Centrato",
        "custom.val.left": "A Sinistra",
        "custom.val.icon": "Solo Icona",
        "custom.val.box": "Box di Ricerca",
        "custom.val.hidden": "Nascosto",
        "custom.val.blur": "Sfocatura Acrilica",
        "custom.val.transparent": "Trasparente",
        "custom.val.opaque": "Opaco",
        "custom.val.light": "Tema Chiaro",
        "custom.chk.telemetry": "Bypassa Daemon Telemetria MS",
        "custom.desc.telemetry": "Esegue cmd REG ADD per sopprimere i tracker di telemetria Microsoft in background.",
        "custom.chk.cortana": "Disabilita Cortana & Ricerca Bing",
        "custom.desc.cortana": "Evita che la barra di explorer esegua URL web durante le ricerche di file locali.",
        "custom.chk.menu": "Classic Windows 10 Context Menu",
        "custom.desc.menu": "Bypassa il layout di menu a tendina secondario di Windows 11.",
        "custom.btn.explorer": "Riavvia Shell Explorer",
        "game.lib.title": "Libreria Eseguibili Attivi",
        "game.btn.add": "Aggiungi Eseguibile (.exe)",
        "game.btn.launch": "Avvia Target Selezionato",
        "game.opts.title": "PREFERENZE MOTORE HUB",
        "game.hud.title": "Overlay Statistiche FPS",
        "game.hud.btn": "Abilita HUD Overlay",
        "game.power.title": "Piano Energetico",
        "game.power.btn": "Ripristina Bilanciato",
        "driver.desc": "Monitora le interfacce hardware e scarica edizioni di driver ottimizzate a bassa latenza per e-sports.",
        "driver.table.device": "Interfaccia Hardware",
        "driver.table.current": "Versione corrente",
        "driver.table.status": "Stato",
        "driver.table.latency": "Impatto Latenza Sistema",
        "driver.table.scanmsg": "Clicca 'Scansiona' per eseguire query di convalida delle directory dei dispositivi.",
        "bench.desc": "Esegue stress test della CPU e GPU misurando i fotogrammi e l'indice di stabilità degli FPS.",
        "bench.results": "REPORT RISULTATI",
        "disk.desc": "Ottimizza SSD tramite comandi TRIM e ripulisce il filesystem dalle directory cache temporanee.",
        "disk.tool.cleaner": "PULITORE CACHE TEMPORANEA",
        "disk.cleaner.label": "Dimensione Cache Rilevata",
        "disk.tool.trim": "OTTIMIZZAZIONE TRIM CONTROLLER",
        "disk.trim.desc": "Forza il filesystem a notificare immediatamente i settori non allocati al driver flash.",
        "disk.trim.btn": "Invia Comando TRIM",
        "ram.desc": "Svuota la cache standby RAM contenente allocazioni residue di software chiusi.",
        "ram.stats.title": "SPECIFICHE MEMORIA RAM",
        "ram.legend.active": "Pagine Attive",
        "ram.legend.cache": "Cache Standby",
        "ram.standby.size": "Dimensione Cache Standby",
        "ram.clean.btn": "Ottimizza Cache Standby",
        "ram.explain": "Svuotare la cache standby rilascia direttamente celle fisiche non allocate, abbassando la latenza.",
        "ram.opts.title": "AZIONI BUFFER RAM",
        "startup.desc": "Gestisci i processi di avvio automatici all'accesso utente per velocizzare il tempo di boot.",
        "startup.table.name": "Nome Applicazione",
        "startup.table.publisher": "Firmatario Verificato",
        "startup.table.impact": "Impatto Caricamento Boot",
        "restore.desc": "Gestione dei backup del registro per ripristinare lo stato originale in caso di anomalie.",
        "restore.action.title": "Ripristini del Registro",
        "restore.explain": "Crea un checkpoint di salvataggio prima di eseguire script personalizzati del marketplace.",
        "restore.btn.create": "Crea Punto di Ripristino",
        "restore.btn.rollback": "Ripristina Stato Registro",
        "restore.history.title": "BACKUP DI SISTEMA ATTIVI",
        "market.desc": "Scarica script e profili di ottimizzazione custom realizzati direttamente da ingegneri e-sports."
    }
};

// ─── STATE MANAGEMENT ────────────────────────────────────────────────────
let currentLang = "en";
let scoreVal = 74;
let settings = {
    theme: "dark",
    accent: "#3B82F6",
    scale: 100,
    animations: "high",
    audio: true,
    volume: 50,
    clickSound: true,
    hoverSound: true
};

function logConsole(text, status = "INFO") {
    const consoleLogText = document.getElementById("console-log-text");
    if (consoleLogText) {
        const time = new Date().toTimeString().split(' ')[0]; // HH:mm:ss
        const line = `[${time}] [${status}] ${text}\n`;
        consoleLogText.textContent += line;
        consoleLogText.scrollTop = consoleLogText.scrollHeight;
    }
}

const drawerData = {
    health: {
        title_en: "PC Health & Security Details",
        title_it: "Dettagli Integrità & Sicurezza PC",
        status_en: "Security and stability items flagged",
        status_it: "Elementi di stabilità e sicurezza rilevati",
        items_en: [
            "Administrator rights verified. Fully authorized execution.",
            "UAC protection bypass detected. Recommend leaving enabled.",
            "Visual effects priority is set to Windows default. Optimize for raw performance."
        ],
        items_it: [
            "Privilegi di amministratore verificati. Esecuzione autorizzata.",
            "Bypass protezione UAC rilevato. Si consiglia di lasciarlo attivo.",
            "Priorità effetti visivi impostata su default. Ottimizza per le performance."
        ]
    },
    startup: {
        title_en: "Startup Services Analysis",
        title_it: "Analisi Servizi di Avvio",
        status_en: "3 Non-critical processes launching at boot",
        status_it: "3 Processi non critici avviati al boot",
        items_en: [
            "SpotifyWebHelper starts automatically. Delay recommended.",
            "Steam overlay helper triggers on boot. Impact: Medium.",
            "OneDrive synchronizes on login. Disable if unused."
        ],
        items_it: [
            "SpotifyWebHelper si avvia in automatico. Consigliato ritardo.",
            "Steam overlay helper caricato al boot. Impatto: Medio.",
            "OneDrive si sincronizza all'accesso. Disabilita se non usato."
        ]
    },
    storage: {
        title_en: "Disk Cache Accumulation",
        title_it: "Accumulo File Cache su Disco",
        status_en: "Junk temp files discovered",
        status_it: "Rilevati file temporanei inutilizzati",
        items_en: [
            "Temporary browser caching directories exceed 4.8 GB.",
            "Windows upgrade log files residual payload: 1.2 GB.",
            "System error crash dump files memory footprint: 6.4 GB."
        ],
        items_it: [
            "File temporanei dei browser superiori a 4.8 GB.",
            "Log residui degli aggiornamenti di Windows: 1.2 GB.",
            "File di dump degli errori di sistema allocati: 6.4 GB."
        ]
    },
    ram: {
        title_en: "RAM Standby Cache Allocation",
        title_it: "Allocazione Cache Standby RAM",
        status_en: "Standby memory holds idle pages",
        status_it: "La memoria in standby contiene pagine inattive",
        items_en: [
            "Closed apps retaining reference tables in standby cache.",
            "Standby cache size currently at 4.2 GB.",
            "Flush standby buffer to reclaim raw memory bytes instantly."
        ],
        items_it: [
            "Le app chiuse mantengono tabelle di allocazione in standby.",
            "Dimensione della cache di standby attualmente a 4.2 GB.",
            "Pulisci il buffer standby per recuperare memoria istantaneamente."
        ]
    },
    gaming: {
        title_en: "Gaming HUD Overlay & Energy Tweak",
        title_it: "HUD Overlay Gaming & Tweak Energia",
        status_en: "Profile scheduler optimizations",
        status_it: "Ottimizzazione profilo di pianificazione",
        items_en: [
            "Power management plan set to Balanced. High-Performance suggested.",
            "Game Overlay HUD service is currently turned off.",
            "GPU hardware accelerated scheduling ready for activation."
        ],
        items_it: [
            "Pianificazione energetica impostata su Bilanciato. Consigliato Alte Prestazioni.",
            "Il servizio HUD Overlay di gioco è attualmente spento.",
            "Hardware scheduling accelerato GPU pronto per l'attivazione."
        ]
    }
};

let activeDrawerCategory = "";

// ─── AUDIO SYNTHESIZER (WEB AUDIO API) ───────────────────────────────────
function playSound(type) {
    if (!settings.audio) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const volFactor = settings.volume / 100;

        if (type === 'click' && settings.clickSound) {
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(volFactor * 0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } else if (type === 'hover' && settings.hoverSound) {
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.04);
            gain.gain.setValueAtTime(volFactor * 0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
            osc.start();
            osc.stop(ctx.currentTime + 0.04);
        }
    } catch (e) {
        console.warn("Web Audio API not allowed or initialized: ", e);
    }
}

// ─── INITIALIZATION ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initSpotlight();
    bindLoginEvents();
    bindNavigation();
    bindSettingsControls();
    updateLocalization();
    initWidgets();
    bindInteractiveViews();
    
    // Bind global sound triggers on interactive elements
    document.querySelectorAll("button, .interactive-card, input[type='checkbox'], select, input[type='range']").forEach(elem => {
        elem.addEventListener("mouseenter", () => playSound('hover'));
        elem.addEventListener("click", () => playSound('click'));
    });
});

// ─── SPOTLIGHT EFFECT (DynamicSpotlightGrid recreation) ──────────────────
function initSpotlight() {
    const canvas = document.getElementById("spotlight-canvas");
    const ctx = canvas.getContext("2d");
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    window.addEventListener("mousemove", (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Dynamic spotlight gradient
        const gradient = ctx.createRadialGradient(
            mouse.x, mouse.y, 10,
            mouse.x, mouse.y, Math.max(canvas.width, canvas.height) * 0.6
        );
        
        // Spotlight gradient colors matching WPF accent color glow
        gradient.addColorStop(0, `rgba(${hexToRgb(settings.accent)}, 0.08)`);
        gradient.addColorStop(0.3, "rgba(8, 11, 24, 0.02)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        requestAnimationFrame(draw);
    }
    draw();
}

function hexToRgb(hex) {
    const bigint = parseInt(hex.replace("#", ""), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
}

// ─── LOGIN AND MOCK BYPASS ───────────────────────────────────────────────
function bindLoginEvents() {
    const btnActivate = document.getElementById("btn-activate");
    const licenseKeyInput = document.getElementById("license-key");
    const loginError = document.getElementById("login-error");
    const bypassLink = document.getElementById("link-bypass-demo");
    const spinner = document.getElementById("login-spinner");
    const btnText = document.getElementById("btn-activate-text");

    function attemptLogin(key) {
        btnActivate.disabled = true;
        spinner.classList.remove("hidden");
        btnText.classList.add("hidden");
        loginError.classList.add("hidden");

        // Simulate secure license key checking delay (1.5 seconds)
        setTimeout(() => {
            if (key.trim().toUpperCase() === "SHOWCASE" || key === "BYPASS") {
                // Success trigger animation
                document.getElementById("login-screen").classList.add("hidden");
                const appScreen = document.getElementById("app-screen");
                appScreen.classList.remove("hidden");
                appScreen.style.opacity = 0;
                setTimeout(() => {
                    appScreen.style.opacity = 1;
                    triggerDashboardAnimation();
                    const activeBtn = document.querySelector(".sidebar-btn.active");
                    updateActiveIndicator(activeBtn);
                    logConsole(currentLang === 'it' ? "Pavo Tweak avviato. Pronto." : "Pavo Tweak started. Ready.", "INFO");
                }, 50);
            } else {
                loginError.classList.remove("hidden");
                btnActivate.disabled = false;
                spinner.classList.add("hidden");
                btnText.classList.remove("hidden");
            }
        }, 1500);
    }

    btnActivate.addEventListener("click", () => {
        attemptLogin(licenseKeyInput.value);
    });

    licenseKeyInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            attemptLogin(licenseKeyInput.value);
        }
    });

    bypassLink.addEventListener("click", (e) => {
        e.preventDefault();
        attemptLogin("BYPASS");
    });
}

// ─── NAVIGATION VIEW ROUTING ─────────────────────────────────────────────
function updateActiveIndicator(btn) {
    const indicator = document.getElementById("sidebar-indicator");
    if (indicator && btn) {
        indicator.style.transform = `translateY(${btn.offsetTop}px)`;
    }
}

function bindNavigation() {
    const buttons = document.querySelectorAll(".sidebar-btn");
    const views = document.querySelectorAll(".view-panel");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetView = btn.getAttribute("data-view");
            if (!targetView) return; // Skip non-view triggers like footer buttons

            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            updateActiveIndicator(btn);

            views.forEach(v => {
                v.classList.add("hidden");
                if (v.id === `view-${targetView}`) {
                    v.classList.remove("hidden");
                }
            });

            // Log navigation to console
            const labelEl = btn.querySelector(".btn-label");
            const labelText = labelEl ? labelEl.textContent.trim() : btn.textContent.trim();
            logConsole((currentLang === 'it' ? "Navigazione verso " : "Navigating to ") + labelText + "...", "INFO");

            // Specific view inits
            if (targetView === 'dashboard') {
                triggerDashboardAnimation();
            }
        });
    });

    // Discord support button explicit logging
    const btnDiscord = document.getElementById("btn-join-discord");
    if (btnDiscord) {
        btnDiscord.addEventListener("click", () => {
            logConsole((currentLang === 'it' ? "Apertura canale di supporto Discord..." : "Opening Discord support channel..."), "INFO");
            window.open("https://discord.gg/pavo", "_blank");
        });
    }

    // Window control buttons close showcase helper
    document.getElementById("btn-close").addEventListener("click", () => {
        if (confirm("Close Pavo Tweak Showcase?")) {
            location.reload();
        }
    });
}

// ─── LOCALIZATION UPDATES ────────────────────────────────────────────────
function updateLocalization() {
    document.querySelectorAll("[data-key]").forEach(el => {
        const key = el.getAttribute("data-key");
        const translation = translations[currentLang][key];
        if (translation) {
            el.innerHTML = translation;
        }
    });
}

// ─── SETTINGS ACTIONS ────────────────────────────────────────────────────
function bindSettingsControls() {
    // Navigation inside Settings panel
    const setNavBtns = document.querySelectorAll(".set-nav-btn");
    const setPanes = document.querySelectorAll(".set-pane");

    setNavBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            setNavBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const targetPane = btn.getAttribute("data-setcat");
            setPanes.forEach(pane => {
                pane.classList.add("hidden");
                if (pane.id === `setpane-${targetPane}`) {
                    pane.classList.remove("hidden");
                }
            });
        });
    });

    // Language selector
    document.getElementById("btn-lang-en").addEventListener("click", () => {
        currentLang = "en";
        document.getElementById("btn-lang-en").classList.add("active");
        document.getElementById("btn-lang-it").classList.remove("active");
        updateLocalization();
    });

    document.getElementById("btn-lang-it").addEventListener("click", () => {
        currentLang = "it";
        document.getElementById("btn-lang-it").classList.add("active");
        document.getElementById("btn-lang-en").classList.remove("active");
        updateLocalization();
    });

    // Accent swatch picker
    document.querySelectorAll(".swatch").forEach(sw => {
        sw.addEventListener("click", () => {
            document.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
            sw.classList.add("active");
            settings.accent = sw.getAttribute("data-accent");
            document.documentElement.style.setProperty('--accent-color', settings.accent);
            document.documentElement.style.setProperty('--accent-glow', `rgba(${hexToRgb(settings.accent)}, 0.3)`);
        });
    });

    // Theme selector
    document.getElementById("btn-theme-dark").addEventListener("click", () => {
        document.body.classList.remove("theme-soft");
        document.getElementById("btn-theme-dark").classList.add("active");
        document.getElementById("btn-theme-soft").classList.remove("active");
        settings.theme = "dark";
    });

    document.getElementById("btn-theme-soft").addEventListener("click", () => {
        document.body.classList.add("theme-soft");
        document.getElementById("btn-theme-soft").classList.add("active");
        document.getElementById("btn-theme-dark").classList.remove("active");
        settings.theme = "soft";
    });

    // UI Scale slider
    const scaleSlider = document.getElementById("slider-uiscale");
    const scaleLabel = document.getElementById("label-uiscale");
    scaleSlider.addEventListener("input", () => {
        settings.scale = scaleSlider.value;
        scaleLabel.textContent = `${settings.scale}%`;
        document.documentElement.style.setProperty('--ui-scale', settings.scale / 100);
        document.getElementById("app-screen").style.transform = `scale(${settings.scale / 100})`;
    });

    // Animation Quality
    const animBtns = document.querySelectorAll(".anim-btn");
    animBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            animBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            settings.animations = btn.getAttribute("data-anim");
            if (settings.animations === 'low') {
                document.documentElement.style.setProperty('--transition-speed', '0s');
                document.body.classList.add("disable-animations");
            } else {
                document.documentElement.style.setProperty('--transition-speed', '0.25s');
                document.body.classList.remove("disable-animations");
            }
        });
    });

    // Master Volume
    const volSlider = document.getElementById("slider-volume");
    const volLabel = document.getElementById("label-volume");
    volSlider.addEventListener("input", () => {
        settings.volume = volSlider.value;
        volLabel.textContent = `${settings.volume}%`;
    });

    // Audio effects toggles
    const chkAudio = document.getElementById("set-audio-effects");
    chkAudio.addEventListener("change", () => {
        settings.audio = chkAudio.checked;
    });

    const chkClick = document.getElementById("set-click-sound");
    chkClick.addEventListener("change", () => {
        settings.clickSound = chkClick.checked;
    });

    const chkHover = document.getElementById("set-hover-sound");
    chkHover.addEventListener("change", () => {
        settings.hoverSound = chkHover.checked;
    });
}

// ─── DASHBOARD LIVE MONITORS & CLOCK ────────────────────────────────────
function triggerDashboardAnimation() {
    const fill = document.getElementById("score-ring-fill");
    const val = document.getElementById("dashboard-score-val");
    
    // Circular Dash Offset Calculation
    // Total perimeter = 2 * PI * R (R=40) = 251.2
    const totalOffset = 251.2;
    const targetOffset = totalOffset - (totalOffset * scoreVal / 100);

    fill.style.strokeDashoffset = targetOffset;

    // Numerical counter ticker
    let count = 0;
    const ticker = setInterval(() => {
        if (count >= scoreVal) {
            clearInterval(ticker);
        } else {
            count++;
            val.textContent = count;
        }
    }, 15);
}

function initWidgets() {
    // Clock widget
    setInterval(() => {
        const dateObj = new Date();
        const timeStr = dateObj.toLocaleTimeString();
        document.getElementById("widget-time").textContent = timeStr;

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById("widget-date").textContent = dateObj.toLocaleDateString(currentLang === 'it' ? 'it-IT' : 'en-US', options);
    }, 1000);

    // Weather desc language update listener
    setInterval(() => {
        document.getElementById("widget-weather").textContent = translations[currentLang]["widget.weather.clear"];
    }, 500);

    // Realtime progress bar monitors
    const cpuVal = document.getElementById("mon-cpu-text");
    const cpuFill = document.getElementById("mon-cpu-fill");
    const gpuVal = document.getElementById("mon-gpu-text");
    const gpuFill = document.getElementById("mon-gpu-fill");
    const ramVal = document.getElementById("mon-ram-text");
    const ramFill = document.getElementById("mon-ram-fill");

    setInterval(() => {
        // CPU usage
        let cpu = Math.floor(Math.random() * 15) + 5; // 5-20%
        cpuVal.textContent = `${cpu}%`;
        cpuFill.style.width = `${cpu}%`;
        document.getElementById("hud-cpu-val").textContent = `${cpu}%`;

        // GPU usage
        let gpu = Math.floor(Math.random() * 8) + 2;  // 2-10%
        gpuVal.textContent = `${gpu}%`;
        gpuFill.style.width = `${gpu}%`;

        // RAM usage
        let ram = Math.floor(Math.random() * 2) + 43; // 43-45%
        ramVal.textContent = `${ram}%`;
        ramFill.style.width = `${ram}%`;
        document.getElementById("hud-ram-val").textContent = `${ram}%`;
    }, 2000);

    // Network Widget Chart drawing
    const canvas = document.getElementById("net-chart-canvas");
    const ctx = canvas.getContext("2d");
    let netHistory = Array(20).fill(5);

    setInterval(() => {
        // Generate net traffic value
        const valKb = (Math.random() * 30 + 5).toFixed(1);
        document.getElementById("net-traffic-text").textContent = `${valKb} KB/s`;

        netHistory.shift();
        netHistory.push(parseFloat(valKb));

        drawNetGraph();
    }, 1000);

    function drawNetGraph() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = settings.accent;

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, `rgba(${hexToRgb(settings.accent)}, 0.3)`);
        grad.addColorStop(1, "rgba(59, 130, 246, 0)");

        ctx.beginPath();
        const step = canvas.width / (netHistory.length - 1);
        
        netHistory.forEach((v, index) => {
            const x = index * step;
            // Map 0-50Kb to canvas height
            const y = canvas.height - (v / 50) * (canvas.height - 10) - 5;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();

        // Area fill
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
    }
}

function bindInteractiveViews() {
    // ── WINDOWS CUSTOM CHECKBOX LOGGING
    const chkTelemetry = document.getElementById("chk-telemetry");
    if (chkTelemetry) {
        chkTelemetry.addEventListener("change", (e) => {
            if (e.target.checked) {
                logConsole(currentLang === 'it' ? "Disabilitazione telemetria di Windows..." : "Disabling Windows background telemetry trackers...", "INFO");
                logConsole(currentLang === 'it' ? "Aggiornamento registri telemetria Windows completato." : "Windows telemetry registry check updated.", "SUCCESS");
            } else {
                logConsole(currentLang === 'it' ? "Ripristino parametri telemetria di Windows..." : "Restoring Windows telemetry default settings...", "INFO");
            }
        });
    }

    const chkCortana = document.getElementById("chk-cortana");
    if (chkCortana) {
        chkCortana.addEventListener("change", (e) => {
            if (e.target.checked) {
                logConsole(currentLang === 'it' ? "Disabilitazione Cortana e Bing Search..." : "Disabling Cortana and web searches on desktop indexing...", "INFO");
                logConsole(currentLang === 'it' ? "Cortana disabilitata correttamente." : "Cortana services suppressed successfully.", "SUCCESS");
            } else {
                logConsole(currentLang === 'it' ? "Ripristino impostazioni Cortana..." : "Restoring default Cortana configuration settings...", "INFO");
            }
        });
    }

    const chkMenu = document.getElementById("chk-menu");
    if (chkMenu) {
        chkMenu.addEventListener("change", (e) => {
            if (e.target.checked) {
                logConsole(currentLang === 'it' ? "Abilitazione menu contestuale classico Windows 10..." : "Enabling Classic Windows 10 context menu system...", "INFO");
                logConsole(currentLang === 'it' ? "Valore registro Classic Menu modificato." : "Classic Menu registry key modified.", "SUCCESS");
            } else {
                logConsole(currentLang === 'it' ? "Ripristino menu contestuale di Windows 11..." : "Restoring Windows 11 default menu layouts...", "INFO");
            }
        });
    }

    // ── DETAILS DRAWER LOGIC
    const drawer = document.getElementById("details-drawer");
    const closeDrawerBtn = document.getElementById("btn-close-drawer");
    const fixDrawerBtn = document.getElementById("btn-drawer-fix");

    document.querySelectorAll("[data-drawer]").forEach(card => {
        card.addEventListener("click", () => {
            const category = card.getAttribute("data-drawer");
            activeDrawerCategory = category;
            
            // Populate drawer items
            const data = drawerData[category];
            document.getElementById("drawer-title").textContent = currentLang === 'en' ? data.title_en : data.title_it;
            document.getElementById("drawer-status").textContent = currentLang === 'en' ? data.status_en : data.status_it;

            const listContainer = document.getElementById("drawer-items-container");
            listContainer.innerHTML = "";
            const list = currentLang === 'en' ? data.items_en : data.items_it;
            
            list.forEach(item => {
                const li = document.createElement("li");
                li.className = "drawer-item";
                li.textContent = item;
                listContainer.appendChild(li);
            });

            drawer.classList.remove("hidden");
        });
    });

    closeDrawerBtn.addEventListener("click", () => {
        drawer.classList.add("hidden");
    });

    fixDrawerBtn.addEventListener("click", () => {
        logConsole((currentLang === 'it' ? "Avvio ottimizzazione rapida per categoria: " : "Running Quick Fix for category: ") + activeDrawerCategory.toUpperCase() + "...", "INFO");
        fixDrawerBtn.disabled = true;
        fixDrawerBtn.textContent = currentLang === 'en' ? "Optimizing..." : "Ottimizzazione...";

        setTimeout(() => {
            fixDrawerBtn.disabled = false;
            fixDrawerBtn.textContent = currentLang === 'en' ? "Fix Issues" : "Ottimizza";
            logConsole((currentLang === 'it' ? "Ottimizzazione rapida completata." : "Quick Fix completed successfully."), "SUCCESS");
            drawer.classList.add("hidden");

            // Complete card status
            if (activeDrawerCategory === 'startup') {
                document.getElementById("card-startup-status").textContent = currentLang === 'en' ? "Optimal" : "Ottimale";
                document.getElementById("card-startup-status").className = "card-status status-ok";
            } else if (activeDrawerCategory === 'storage') {
                document.getElementById("card-storage-status").textContent = currentLang === 'en' ? "Cleaned" : "Ripulito";
                document.getElementById("card-storage-status").className = "card-status status-ok";
                // Sync clean Disk view size gauge
                document.getElementById("cleaner-size-val").textContent = "0.0";
            }

            // Bump overall score towards 100
            scoreVal = Math.min(scoreVal + 10, 100);
            triggerDashboardAnimation();
        }, 1200);
    });

    // ── AI OPTIMIZER INTERACTIONS
    const btnAiScan = document.getElementById("btn-ai-scan");
    const aiConsole = document.getElementById("ai-console");
    const aiSuggestions = document.getElementById("ai-suggestions-panel");
    const suggestionsList = document.getElementById("suggestions-list");

    const scanLines = [
        "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"Invoke-Diagnostics\"",
        "Loading kernel space telemetry libraries...",
        "Querying processor WMI configuration settings...",
        " > Processor: Intel(R) Core(TM) i9-14900K [24 Cores / 32 Threads]",
        "Checking registry value HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\0cc5b647-c1df-4637-891a-dec35c318583\\ValueMax",
        " > [WARNING] Core Parking value is 100 (Core Parking Enabled). Thread switching overhead: +4.2ms.",
        "Querying display adapters via DXGI interface...",
        " > Display Card: NVIDIA GeForce RTX 4090 [VRAM: 24576MB | BIOS: 95.02.18.00.01]",
        "Checking registry key HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\HwSchMode...",
        " > [WARNING] HwSchMode = 1. Hardware Accelerated GPU Scheduling (HAGS) is DISABLED in registry.",
        "Evaluating system page tables and memory speeds...",
        " > Installed RAM: 32.00 GB DDR5 Dual-Channel [Speed: 6000MT/s | Timings: CL30-36-36-76]",
        "Checking HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\LargeSystemCache...",
        " > [INFO] LargeSystemCache is 0. Standard Windows filesystem cache memory prioritization active.",
        "Diagnostic trace complete. Telemetry recommendations compiled successfully."
    ];

    btnAiScan.addEventListener("click", () => {
        logConsole(currentLang === 'it' ? "Avvio scansione diagnostica hardware..." : "Starting hardware diagnostic telemetry scan...", "INFO");
        btnAiScan.disabled = true;
        aiConsole.innerHTML = "";
        aiSuggestions.classList.add("hidden");

        let index = 0;
        const logTimer = setInterval(() => {
            if (index < scanLines.length) {
                const line = document.createElement("div");
                line.className = "console-line";
                if (scanLines[index].includes("[WARNING]")) {
                    line.className = "console-line text-warn";
                } else if (scanLines[index].includes("[INFO]")) {
                    line.className = "console-line text-muted";
                }
                line.textContent = `> ${scanLines[index]}`;
                aiConsole.appendChild(line);
                aiConsole.scrollTop = aiConsole.scrollHeight;
                index++;
            } else {
                clearInterval(logTimer);
                btnAiScan.disabled = false;
                logConsole(currentLang === 'it' ? "Scansione completata. Rilevati parametri di latenza da ottimizzare." : "Diagnostic scan complete. Outdated latency parameters detected.", "SUCCESS");
                showAiSuggestions();
            }
        }, 300);
    });

    function showAiSuggestions() {
        suggestionsList.innerHTML = "";

        const list = [
            {
                title: translations[currentLang]["opt.cpu_core_parking.title"] || "Tweak Disattivazione Core Parking CPU",
                desc: (translations[currentLang]["opt.cpu_core_parking.explain"] || "Disables core parking for CPU").replace("{0}", "Intel Core i9-14900K").replace("{1}", "32"),
                side: translations[currentLang]["opt.cpu_core_parking.side"] || "None."
            },
            {
                title: translations[currentLang]["opt.gpu_hags.title"] || "Abilita Hardware Accelerated GPU Scheduling",
                desc: (translations[currentLang]["opt.gpu_hags.explain"] || "Enables hardware accelerated graphics scheduling").replace("{0}", "NVIDIA GeForce RTX 4090"),
                side: translations[currentLang]["opt.gpu_hags.side"] || "None."
            },
            {
                title: translations[currentLang]["opt.ram_large_cache.title"] || "Abilita Large System Cache",
                desc: (translations[currentLang]["opt.ram_large_cache.explain"] || "Enables larger system caching").replace("{0}", "32.0"),
                side: translations[currentLang]["opt.ram_large_cache.side"] || "None."
            }
        ];

        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "opt-card";
            card.innerHTML = `
                <div class="opt-details">
                    <h4>${item.title}</h4>
                    <p class="opt-explain">${item.desc}</p>
                    <p class="opt-side">⚠️ ${item.side}</p>
                </div>
                <label class="switch-container">
                    <input type="checkbox" checked class="opt-toggle-switch">
                    <span class="switch-slider"></span>
                </label>
            `;
            suggestionsList.appendChild(card);

            card.querySelector(".opt-toggle-switch").addEventListener("change", (e) => {
                if (e.target.checked) {
                    logConsole((currentLang === 'it' ? "Ottimizzazione applicata con successo: " : "Optimization applied successfully: ") + item.title, "SUCCESS");
                    scoreVal = Math.min(scoreVal + 5, 100);
                } else {
                    logConsole((currentLang === 'it' ? "Ottimizzazione rimossa: " : "Optimization reverted: ") + item.title, "INFO");
                    scoreVal = Math.max(scoreVal - 5, 50);
                }
                triggerDashboardAnimation();
            });
        });

        aiSuggestions.classList.remove("hidden");
    }

    // ── WINDOWS CUSTOM ACTIONS
    document.getElementById("btn-restart-explorer").addEventListener("click", () => {
        const btn = document.getElementById("btn-restart-explorer");
        logConsole(currentLang === 'it' ? "Riavvio della shell explorer.exe in corso..." : "Restarting explorer.exe shell interface...", "INFO");
        btn.disabled = true;
        btn.textContent = currentLang === 'en' ? "Restarting Shell..." : "Riavvio in corso...";
        
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = currentLang === 'en' ? "Restart Explorer" : "Riavvia Explorer";
            logConsole(currentLang === 'it' ? "Shell explorer.exe riavviata con successo." : "Explorer shell process re-created successfully.", "SUCCESS");
            alert("Explorer shell successfully restarted! (Re-created Explorer process in background)");
        }, 1500);
    });

    // ── GAMING HUB LIBRARY & HUD OVERLAY DRAGGING
    const gamesGrid = document.getElementById("games-grid-list");
    let initialGames = [
        { title: "Counter-Strike 2", source: "Steam", icon: "🔫" },
        { title: "Cyberpunk 2077", source: "Steam", icon: "🦾" },
        { title: "Grand Theft Auto V", source: "Epic Games", icon: "🚗" },
        { title: "Valorant", source: "Riot Client", icon: "🎯" }
    ];

    function renderGames() {
        gamesGrid.innerHTML = "";
        initialGames.forEach(game => {
            const card = document.createElement("div");
            card.className = "game-card";
            card.innerHTML = `
                <div class="game-cover-art">${game.icon}</div>
                <span>${game.title}</span>
                <small>${game.source}</small>
            `;
            card.addEventListener("click", () => {
                document.querySelectorAll(".game-card").forEach(c => c.classList.remove("selected"));
                card.classList.add("selected");
            });
            gamesGrid.appendChild(card);
        });
    }
    renderGames();

    document.getElementById("btn-launch-game").addEventListener("click", () => {
        const selected = document.querySelector(".game-card.selected");
        if (selected) {
            const title = selected.querySelector("span").textContent;
            logConsole((currentLang === 'it' ? "Avvio del gioco: " : "Launching game: ") + title, "INFO");
            logConsole(currentLang === 'it' ? "Piano energetico High Performance abilitato per sessione di gioco." : "High Performance power plan enabled for gaming session.", "SUCCESS");
            logConsole(currentLang === 'it' ? "Auto-Closer attivo: chiusura processi background (Chrome, Discord, Spotify)..." : "Auto-Closer active: closing background processes (Chrome, Discord, Spotify)...", "INFO");
            alert(currentLang === 'en' ? `Launching optimized instance of ${title}...` : `Avvio ottimizzato di ${title} in corso...`);
        } else {
            alert(currentLang === 'en' ? "Select a game first." : "Seleziona prima un gioco.");
        }
    });

    document.getElementById("btn-add-game").addEventListener("click", () => {
        const title = prompt(currentLang === 'en' ? "Enter game executable title:" : "Inserisci il nome del gioco:");
        if (title) {
            initialGames.push({
                title: title,
                source: "Custom",
                icon: "🎮"
            });
            logConsole((currentLang === 'it' ? "Gioco aggiunto manualmente: " : "Game added manually: ") + title, "SUCCESS");
            renderGames();
        }
    });

    const btnPower = document.getElementById("btn-power-plan");
    if (btnPower) {
        btnPower.addEventListener("click", () => {
            logConsole(currentLang === 'it' ? "Rilevata chiusura gioco. Ripristino del piano energetico bilanciato." : "Game close detected. Restoring balanced power plan.", "INFO");
            alert(currentLang === 'en' ? "Power plan successfully restored to Balanced!" : "Piano energetico ripristinato con successo su Bilanciato!");
        });
    }

    // Floating Overlay HUD
    const hud = document.getElementById("hud-overlay");
    const toggleHudBtn = document.getElementById("btn-toggle-hud");
    
    toggleHudBtn.addEventListener("click", () => {
        hud.classList.toggle("hidden");
        if (hud.classList.contains("hidden")) {
            toggleHudBtn.textContent = currentLang === 'en' ? "Enable HUD Overlay" : "Abilita HUD Overlay";
            logConsole(currentLang === 'it' ? "Overlay HUD disattivato." : "HUD overlay disabled.", "INFO");
        } else {
            toggleHudBtn.textContent = currentLang === 'en' ? "Disable HUD Overlay" : "Disabilita HUD Overlay";
            logConsole(currentLang === 'it' ? "Overlay HUD attivato in primo piano." : "HUD overlay shown in foreground.", "SUCCESS");
        }
    });

    // Draggable HUD handler
    const dragHandle = hud.querySelector(".hud-drag-handle");
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    dragHandle.addEventListener("mousedown", (e) => {
        isDragging = true;
        offset.x = e.clientX - hud.offsetLeft;
        offset.y = e.clientY - hud.offsetTop;
    });

    document.addEventListener("mousemove", (e) => {
        if (isDragging) {
            hud.style.left = `${e.clientX - offset.x}px`;
            hud.style.top = `${e.clientY - offset.y}px`;
            hud.style.right = 'auto'; // Break initial top-right binding
        }
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
    });

    // HUD Ticker simulating realtime in-game fluctuations
    setInterval(() => {
        if (!hud.classList.contains("hidden")) {
            const randomFps = Math.floor(Math.random() * 10) + 138; // 138-148 fps
            document.getElementById("hud-fps-val").textContent = randomFps;
        }
    }, 800);

    // ── DRIVER CENTER SCANNER
    const btnScanDrivers = document.getElementById("btn-scan-drivers");
    const btnUpdateDrivers = document.getElementById("btn-update-drivers");
    const driversListBody = document.getElementById("drivers-list-body");
    const driversStatusText = document.getElementById("drivers-status-text");

    const driverMockData = [
        { device: "NVIDIA High Definition GPU Driver", current: "v537.58", target: "v555.99 (Ultra Low Latency Tweak)", impact: "High" },
        { device: "Realtek High Definition Audio Driver", current: "v6.0.9524", target: "v6.0.9632 (Latency Optimized)", impact: "Medium" },
        { device: "Intel I225-V Ethernet Controller Driver", current: "v2.1.2.3", target: "v2.1.3.15 (Bufferbloat Fixed)", impact: "High" }
    ];

    btnScanDrivers.addEventListener("click", () => {
        logConsole(currentLang === 'it' ? "Avvio scansione driver hardware..." : "Starting hardware driver scan...", "INFO");
        btnScanDrivers.disabled = true;
        driversStatusText.textContent = currentLang === 'en' ? "Scanning system drivers..." : "Ricerca driver di sistema...";
        
        setTimeout(() => {
            logConsole(currentLang === 'it' ? "Scansione driver completata. Rilevati elementi da aggiornare." : "Driver scan complete. Outdated items detected.", "SUCCESS");
            driversStatusText.textContent = currentLang === 'en' ? "3 Outdated driver optimization modules found." : "Trovati 3 driver obsoleti ottimizzabili.";
            btnScanDrivers.classList.add("hidden");
            btnUpdateDrivers.classList.remove("hidden");

            driversListBody.innerHTML = "";
            driverMockData.forEach((drv, i) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${drv.device}</strong></td>
                    <td>${drv.current}</td>
                    <td id="drv-status-${i}"><span class="text-warn">${translations[currentLang]["status.warning"] || "Warning"}</span></td>
                    <td class="driver-progress-container">
                        <span class="badge-premium">${drv.impact}</span>
                        <div class="driver-update-bar hidden" id="drv-bar-bg-${i}">
                            <div class="driver-update-fill" id="drv-bar-fill-${i}"></div>
                        </div>
                    </td>
                `;
                driversListBody.appendChild(tr);
            });
        }, 1500);
    });

    btnUpdateDrivers.addEventListener("click", () => {
        logConsole(currentLang === 'it' ? "Compilazione e installazione driver a bassa latenza..." : "Downloading and compiling optimized drivers...", "INFO");
        btnUpdateDrivers.disabled = true;
        driversStatusText.textContent = currentLang === 'en' ? "Downloading and compiling optimized drivers..." : "Compilazione e ottimizzazione driver...";

        driverMockData.forEach((drv, i) => {
            const barBg = document.getElementById(`drv-bar-bg-${i}`);
            const barFill = document.getElementById(`drv-bar-fill-${i}`);
            const statusCell = document.getElementById(`drv-status-${i}`);

            barBg.classList.remove("hidden");
            
            // Start updating progression bar
            let progress = 0;
            const updateInterval = setInterval(() => {
                progress += Math.floor(Math.random() * 15) + 5;
                if (progress >= 100) {
                    clearInterval(updateInterval);
                    barFill.style.width = "100%";
                    statusCell.innerHTML = `<span class="text-ok">Updated</span>`;
                    barBg.classList.add("hidden");
                    
                    // Final checking
                    if (i === driverMockData.length - 1) {
                        logConsole(currentLang === 'it' ? "Tutti i driver sono stati aggiornati alle edizioni low latency!" : "All drivers updated to low latency editions!", "SUCCESS");
                        driversStatusText.textContent = currentLang === 'en' ? "All drivers updated to low latency editions!" : "Tutti i driver sono stati ottimizzati!";
                        scoreVal = Math.min(scoreVal + 10, 100);
                        triggerDashboardAnimation();
                    }
                } else {
                    barFill.style.width = `${progress}%`;
                }
            }, 200 + i * 150);
        });
    });

    // ── BENCHMARK RUNNER STRESS TEST
    const btnRunBench = document.getElementById("btn-run-benchmark");
    const benchStateText = document.getElementById("bench-state-text");
    const benchCanvas = document.getElementById("bench-canvas");
    const benchCtx = benchCanvas.getContext("2d");
    
    let benchHistory = [];
    let benchInterval = null;

    function resizeBenchCanvas() {
        benchCanvas.width = benchCanvas.parentElement.clientWidth;
        benchCanvas.height = benchCanvas.parentElement.clientHeight;
    }
    resizeBenchCanvas();
    window.addEventListener("resize", resizeBenchCanvas);

    btnRunBench.addEventListener("click", () => {
        logConsole(currentLang === 'it' ? "Avvio stress test CPU e GPU..." : "Starting CPU and GPU stress workload benchmark...", "INFO");
        btnRunBench.disabled = true;
        benchStateText.textContent = currentLang === 'en' ? "Warming up core registers..." : "Inizializzazione registri core...";
        benchHistory = [];

        setTimeout(() => {
            benchStateText.textContent = currentLang === 'en' ? "Running GPU stress rendering (1440p shadow buffer)..." : "Analisi stress GPU (Shadow buffer 1440p)...";
            let time = 0;

            benchInterval = setInterval(() => {
                time++;
                // Simulate FPS spikes
                let fps = Math.floor(Math.random() * 80) + 120; // 120-200 FPS
                if (time > 15 && time < 25) {
                    // Extreme drop stress simulation
                    fps = Math.floor(Math.random() * 30) + 60; // 60-90 FPS
                }
                benchHistory.push(fps);
                drawBenchChart();

                if (time >= 40) {
                    clearInterval(benchInterval);
                    finalizeBenchmark();
                }
            }, 150);
        }, 1200);
    });

    function drawBenchChart() {
        benchCtx.clearRect(0, 0, benchCanvas.width, benchCanvas.height);
        
        benchCtx.strokeStyle = "#EC4899";
        benchCtx.lineWidth = 3;

        const grad = benchCtx.createLinearGradient(0, 0, 0, benchCanvas.height);
        grad.addColorStop(0, "rgba(236, 72, 153, 0.2)");
        grad.addColorStop(1, "rgba(236, 72, 153, 0)");

        benchCtx.beginPath();
        const step = benchCanvas.width / 40;
        
        benchHistory.forEach((fps, index) => {
            const x = index * step;
            // Map 0-300 FPS to canvas height
            const y = benchCanvas.height - (fps / 300) * (benchCanvas.height - 40) - 20;
            if (index === 0) {
                benchCtx.moveTo(x, y);
            } else {
                benchCtx.lineTo(x, y);
            }
        });

        benchCtx.stroke();
    }

    function finalizeBenchmark() {
        btnRunBench.disabled = false;
        logConsole(currentLang === 'it' ? "Stress Test completato con successo!" : "Benchmark completed successfully!", "SUCCESS");
        benchStateText.textContent = currentLang === 'en' ? "Benchmark Completed successfully!" : "Stress Test completato con successo!";
        
        document.getElementById("bench-max-fps").textContent = "284";
        document.getElementById("bench-avg-fps").textContent = "214";
        document.getElementById("bench-low-fps").textContent = "138";

        document.getElementById("bench-cpu-score").textContent = "22,450 pts";
        document.getElementById("bench-gpu-score").textContent = "38,124 pts";
    }

    // ── DISK TOOLS CACHE CLEANER & TRIM
    const btnCleanDisk = document.getElementById("btn-clean-disk");
    const cleanerSizeVal = document.getElementById("cleaner-size-val");
    const btnTrimDisk = document.getElementById("btn-trim-disk");
    const trimConsole = document.getElementById("trim-console-log");

    btnCleanDisk.addEventListener("click", () => {
        logConsole(currentLang === 'it' ? "Avvio pulizia cache di sistema..." : "Starting system cache cleanup...", "INFO");
        btnCleanDisk.disabled = true;
        btnCleanDisk.textContent = currentLang === 'en' ? "Vaporizing..." : "Cancellazione...";

        let cacheSize = 12.4;
        const countdown = setInterval(() => {
            cacheSize -= 0.6;
            if (cacheSize <= 0) {
                clearInterval(countdown);
                cleanerSizeVal.textContent = "0.0";
                btnCleanDisk.textContent = currentLang === 'en' ? "Cleaned" : "PULITO";
                logConsole(currentLang === 'it' ? "Pulizia completata. Rimosse 124 chiavi/file cache temporanee." : "Cleanup complete. Removed 124 temporary cache keys/files.", "SUCCESS");
                document.getElementById("card-storage-status").textContent = currentLang === 'en' ? "Cleaned" : "Ripulito";
                document.getElementById("card-storage-status").className = "card-status status-ok";
            } else {
                cleanerSizeVal.textContent = cacheSize.toFixed(1);
            }
        }, 80);
    });

    btnTrimDisk.addEventListener("click", () => {
        logConsole(currentLang === 'it' ? "Forzatura comando TRIM su volumi SSD..." : "Forcing TRIM command to SSD volumes...", "INFO");
        btnTrimDisk.disabled = true;
        trimConsole.innerHTML = "";
        
        const lines = [
            "Sending ioctl FSCTL_FILE_LEVEL_TRIM block descriptor...",
            "Tracing sectors allocated on primary partition C: SSD...",
            "Clean block lists validated. Flash controller ready.",
            "Flushing 1,424 unused physical blocks lists...",
            "TRIM optimization completed. Target flash cells verified: 100%."
        ];

        let index = 0;
        const logTimer = setInterval(() => {
            if (index < lines.length) {
                const div = document.createElement("div");
                div.textContent = `> ${lines[index]}`;
                trimConsole.appendChild(div);
                trimConsole.scrollTop = trimConsole.scrollHeight;
                index++;
            } else {
                clearInterval(logTimer);
                btnTrimDisk.disabled = false;
                logConsole(currentLang === 'it' ? "Ottimizzazione TRIM completata. Celle flash verificate." : "TRIM optimization completed. Flash cells verified.", "SUCCESS");
            }
        }, 400);
    });

    // ── RAM MANAGER ACTIONS
    const btnCleanRam = document.getElementById("btn-clean-ram");
    const ramStandbyVal = document.getElementById("ram-standby-val");
    const ramActiveVal = document.getElementById("ram-active-val");
    const ramCacheVal = document.getElementById("ram-cache-val");
    const ramFreeVal = document.getElementById("ram-free-val");
    const ramUsedPercent = document.getElementById("ram-used-percent");
    const ramToast = document.getElementById("ram-opt-toast");

    btnCleanRam.addEventListener("click", () => {
        logConsole(currentLang === 'it' ? "Avvio rilascio memoria Working Sets per tutti i processi utente..." : "Starting Working Set release for all user processes...", "INFO");
        btnCleanRam.disabled = true;
        btnCleanRam.textContent = currentLang === 'en' ? "Reclaiming pages..." : "Ottimizzazione...";

        setTimeout(() => {
            btnCleanRam.disabled = false;
            btnCleanRam.textContent = currentLang === 'en' ? "Flush Standby RAM" : "Ottimizza Memoria";
            
            // Re-allocate stats
            ramStandbyVal.textContent = "0.2 GB";
            ramCacheVal.textContent = "1.8 GB";
            ramActiveVal.textContent = "12.2 GB";
            ramFreeVal.textContent = "18.0 GB";
            ramUsedPercent.textContent = "38%";

            ramToast.classList.remove("hidden");
            setTimeout(() => {
                ramToast.classList.add("hidden");
            }, 3000);

            logConsole(currentLang === 'it' ? "Standby List ottimizzata. Ripuliti i working sets di 45 processi." : "Standby List optimized. Cleared working sets of 45 processes.", "SUCCESS");
            scoreVal = Math.min(scoreVal + 10, 100);
            triggerDashboardAnimation();
        }, 1400);
    });

    // ── STARTUP APPLICATION SWITCHERS
    const startupAppsList = document.getElementById("startup-apps-list");
    const startupAppsData = [
        { name: "Steam Client Bootstrapper", pub: "Valve Corporation", impact: "High", enabled: true },
        { name: "Spotify Web Helper", pub: "Spotify Technology", impact: "Medium", enabled: true },
        { name: "Microsoft OneDrive Sync", pub: "Microsoft Corporation", impact: "High", enabled: false },
        { name: "Discord App Launcher", pub: "Discord Inc.", impact: "High", enabled: true },
        { name: "EA Desktop Service", pub: "Electronic Arts", impact: "Low", enabled: false }
    ];

    function renderStartupApps() {
        startupAppsList.innerHTML = "";
        startupAppsData.forEach((app, index) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${app.name}</strong></td>
                <td>${app.pub}</td>
                <td><span class="badge-premium">${app.impact}</span></td>
                <td>
                    <label class="switch-container">
                        <input type="checkbox" id="startup-toggle-${index}" ${app.enabled ? "checked" : ""}>
                        <span class="switch-slider"></span>
                    </label>
                </td>
            `;
            startupAppsList.appendChild(tr);

            // Bind toggle switch change event
            document.getElementById(`startup-toggle-${index}`).addEventListener("change", (e) => {
                startupAppsData[index].enabled = e.target.checked;
                if (e.target.checked) {
                    logConsole((currentLang === 'it' ? "Programma abilitato all'avvio: " : "Startup program enabled: ") + app.name, "INFO");
                } else {
                    logConsole((currentLang === 'it' ? "Programma all'avvio disabilitato con successo: " : "Startup program disabled successfully: ") + app.name, "SUCCESS");
                }
                // If user disabled high impact apps, optimize startup score card
                const anyHighActive = startupAppsData.some(a => a.enabled && a.impact === 'High');
                if (!anyHighActive) {
                    document.getElementById("card-startup-status").textContent = currentLang === 'en' ? "Optimal" : "Ottimale";
                    document.getElementById("card-startup-status").className = "card-status status-ok";
                }
            });
        });
    }
    renderStartupApps();

    // ── SYSTEM RESTORE MANAGER
    const btnCreateRestore = document.getElementById("btn-create-restore");
    const restoreConsole = document.getElementById("restore-console-log");
    const restoreListContainer = document.getElementById("restore-list-container");

    let restorePoints = [
        { title: "Initial Pavo Tweak Installation Config", date: "11 July 2026, 23:49" }
    ];

    function renderRestorePoints() {
        restoreListContainer.innerHTML = "";
        restorePoints.forEach((rp, index) => {
            const li = document.createElement("li");
            li.className = "restore-item";
            li.innerHTML = `
                <div class="restore-details">
                    <span class="restore-point-title">${rp.title}</span>
                    <span class="restore-point-date">${rp.date}</span>
                </div>
                <button class="btn-delete-point" data-restore-idx="${index}">🗑️</button>
            `;
            li.querySelector(".btn-delete-point").addEventListener("click", () => {
                logConsole(currentLang === 'it' ? "Punto di ripristino rimosso dall'archivio." : "Restore point removed from archive.", "INFO");
                restorePoints.splice(index, 1);
                renderRestorePoints();
            });
            restoreListContainer.appendChild(li);
        });
    }
    renderRestorePoints();

    btnCreateRestore.addEventListener("click", () => {
        const title = prompt(currentLang === 'en' ? "Enter Restore Point Name:" : "Inserisci Nome Punto di Ripristino:");
        if (title) {
            logConsole(currentLang === 'it' ? "Avvio creazione punto di ripristino di Windows..." : "Starting Windows restore point creation...", "INFO");
            btnCreateRestore.disabled = true;
            restoreConsole.innerHTML = "";

            const lines = [
                "Snapshotting registry hive configuration...",
                "Saving SAM and system device files descriptors...",
                "Verifying partition integrity checkpoints...",
                "Recovery point successfully generated!"
            ];

            let idx = 0;
            const logTimer = setInterval(() => {
                if (idx < lines.length) {
                    const div = document.createElement("div");
                    div.textContent = `> ${lines[idx]}`;
                    restoreConsole.appendChild(div);
                    restoreConsole.scrollTop = restoreConsole.scrollHeight;
                    idx++;
                } else {
                    clearInterval(logTimer);
                    btnCreateRestore.disabled = false;
                    
                    const now = new Date();
                    restorePoints.push({
                        title: title,
                        date: now.toLocaleString()
                    });
                    logConsole(currentLang === 'it' ? "Punto di ripristino di sistema creato con successo!" : "System restore point created successfully!", "SUCCESS");
                    renderRestorePoints();
                }
            }, 300);
        }
    });

    // ── MARKETPLACE POPULATOR
    const marketGrid = document.getElementById("market-items-grid");
    const marketItems = [
        { title: "Shroud CS2 Optimized Config", desc: "Latency configurations and binds optimized for Counter-Strike 2 competitive play.", price: "$4.99", icon: "🔫" },
        { title: "Faker LoL Registry Script", desc: "Mouse response curves and network parameters optimized for League of Legends servers.", price: "$5.99", icon: "⚡" },
        { title: "Ultra Low Latency Windows 11 Profile", desc: "Exotic registry alterations bypassing power throttles on high-end chipsets.", price: "$9.99", icon: "🛡️" },
        { title: "S1mple AWP Reflex Pack", desc: "Audio queue optimizations and custom crosshair engine overrides.", price: "$3.99", icon: "🎯" }
    ];

    marketItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "market-card";
        card.innerHTML = `
            <div class="game-cover-art" style="font-size: 34px;">${item.icon}</div>
            <span class="market-item-title">${item.title}</span>
            <p class="market-item-desc">${item.desc}</p>
            <div class="market-buy-row">
                <span class="market-price">${item.price}</span>
                <button class="premium-button market-buy-btn" onclick="alert('Purchasing mock-up configs is disabled in web demo mode!')">BUY</button>
            </div>
        `;
        marketGrid.appendChild(card);
    });
}
