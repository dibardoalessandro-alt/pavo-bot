using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Media;
using System.Windows.Controls;

namespace PavoTweak
{
    public enum AppLanguage { Italian, English }

    /// <summary>
    /// Static localization engine. Call Lang.Get("key") from any view.
    /// Subscribe to Lang.LanguageChanged to refresh UI when language switches.
    /// </summary>
    public static class Lang
    {
        public static event Action LanguageChanged;

        private static AppLanguage _current = AppLanguage.Italian;
        public static AppLanguage Current
        {
            get { return _current; }
            set
            {
                if (_current != value)
                {
                    _current = value;
                    if (LanguageChanged != null) LanguageChanged();
                }
            }
        }

        public static string Get(string key)
        {
            Dictionary<string, string> dict = _current == AppLanguage.Italian ? _it : _en;
            string val;
            if (dict.TryGetValue(key, out val)) return val;
            if (_en.TryGetValue(key, out val)) return val;
            return "[" + key + "]";
        }

        public static string Resolve(string xaml)
        {
            int idx = 0;
            while (true)
            {
                int start = xaml.IndexOf("[[", idx);
                if (start == -1) break;
                int end = xaml.IndexOf("]]", start);
                if (end == -1) break;

                string key = xaml.Substring(start + 2, end - start - 2);
                string val = Get(key);
                xaml = xaml.Substring(0, start) + val + xaml.Substring(end + 2);
                idx = start + val.Length;
            }
            return xaml;
        }

        public static void TranslateUI(DependencyObject parent)
        {
            if (parent == null) return;
            try
            {
                TranslateControl(parent);

                // Recurse logical tree
                foreach (object child in LogicalTreeHelper.GetChildren(parent))
                {
                    DependencyObject depChild = child as DependencyObject;
                    if (depChild != null)
                    {
                        TranslateUI(depChild);
                    }
                }

                // Recurse visual tree if visual
                if (parent is System.Windows.Media.Visual || parent is System.Windows.Media.Media3D.Visual3D)
                {
                    int visualCount = VisualTreeHelper.GetChildrenCount(parent);
                    for (int i = 0; i < visualCount; i++)
                    {
                        DependencyObject visualChild = VisualTreeHelper.GetChild(parent, i);
                        TranslateUI(visualChild);
                    }
                }
            }
            catch {}
        }

        private static void TranslateControl(DependencyObject element)
        {
            TextBlock tb = element as TextBlock;
            if (tb != null)
            {
                tb.Text = TranslateString(tb.Text);
                return;
            }

            ContentControl cc = element as ContentControl;
            if (cc != null)
            {
                string s = cc.Content as string;
                if (s != null)
                {
                    cc.Content = TranslateString(s);
                }
                return;
            }

            HeaderedContentControl hcc = element as HeaderedContentControl;
            if (hcc != null)
            {
                string sh = hcc.Header as string;
                if (sh != null)
                {
                    hcc.Header = TranslateString(sh);
                }
                return;
            }

            HeaderedItemsControl hic = element as HeaderedItemsControl;
            if (hic != null)
            {
                string sih = hic.Header as string;
                if (sih != null)
                {
                    hic.Header = TranslateString(sih);
                }
                return;
            }

            ListView lv = element as ListView;
            if (lv != null)
            {
                GridView gv = lv.View as GridView;
                if (gv != null)
                {
                    foreach (GridViewColumn col in gv.Columns)
                    {
                        string colHeader = col.Header as string;
                        if (colHeader != null)
                        {
                            col.Header = TranslateString(colHeader);
                        }
                    }
                }
            }
        }

        public static string TranslateString(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            if (_current == AppLanguage.Italian) return input;

            string trimmed = input.Trim();
            string val;
            if (_translationMap.TryGetValue(trimmed, out val))
            {
                string leading = input.Substring(0, input.Length - input.TrimStart().Length);
                string trailing = input.Substring(input.TrimEnd().Length);
                return leading + val + trailing;
            }
            return input;
        }

        private static readonly Dictionary<string, string> _translationMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            // CustomizationView
            { "BARRA DELLE APPLICAZIONI", "TASKBAR OPTIONS" },
            { "Personalizza l'allineamento, lo stile e il comportamento della taskbar.", "Customize the alignment, style, and behavior of the taskbar." },
            { "Allineamento Icone", "Icon Alignment" },
            { "Sposta le icone a sinistra o al centro della barra.", "Move icons to the left or center of the taskbar." },
            { "Sinistra", "Left" },
            { "Centro", "Center" },
            { "Barra di Ricerca", "Search Bar" },
            { "Mostra o nascondi il box di ricerca Windows.", "Show or hide the Windows search box." },
            { "Nascondi", "Hide" },
            { "Icona", "Icon" },
            { "Barra", "Bar" },
            { "Barra Trasparente", "Transparent Taskbar" },
            { "Forza la trasparenza lucida (tweak OLED).", "Force glossy transparency (OLED tweak)." },
            { "Standard", "Standard" },
            { "Trasparente", "Transparent" },
            { "Nascondi Barra", "Auto-Hide Taskbar" },
            { "Nascondi automaticamente la taskbar.", "Automatically hide the taskbar." },
            { "Disattivato", "Disabled" },
            { "Attivo", "Enabled" },
            { "ESPLORA FILE & SHELL", "FILE EXPLORER & SHELL" },
            { "Tweak di sistema per le cartelle ed il menu contestuale legacy.", "System tweaks for folders and legacy context menu." },
            { "Estensioni File", "File Extensions" },
            { "Mostra o nascondi estensioni note dei file (.exe, .txt).", "Show or hide known file extensions (.exe, .txt)." },
            { "Mostra", "Show" },
            { "Menu Win10 Classico", "Classic Win10 Menu" },
            { "Ripristina il classico menu del tasto destro (Win 11).", "Restore the classic right-click menu (Win 11)." },
            { "Default 11", "Default 11" },
            { "Classico 10", "Classic 10" },
            { "Riavvia Esplora Risorse", "Restart File Explorer" },
            { "STILE & TRASPARENZA TEMA", "THEME STYLE & TRANSPARENCY" },
            { "Regola le tonalità del sistema operativo ed effetti di sfocatura.", "Adjust operating system shades and blur effects." },
            { "Tema di Sistema", "System Theme" },
            { "Passa dal tema chiaro a scuro per Windows e app.", "Switch between light and dark theme for Windows and apps." },
            { "Scuro", "Dark" },
            { "Chiaro", "Light" },
            { "Effetti Trasparenza", "Transparency Effects" },
            { "Abilita gli effetti acrilici ed estetici nativi.", "Enable native acrylic and aesthetic effects." },
            { "PUNTATORE DEL MOUSE", "MOUSE CURSOR" },
            { "Regola le proporzioni e lo schema colori del cursore.", "Adjust cursor proportions and color scheme." },
            { "Dimensione Cursore", "Cursor Size" },
            { "Regola la grandezza del puntatore mouse.", "Adjust the size of the mouse pointer." },
            { "Grande", "Large" },
            { "Molto Grande", "Very Large" },
            { "Gigante", "Huge" },
            { "Colore Cursore", "Cursor Color" },
            { "Modifica lo schema grafico dei puntatori.", "Modify the graphic scheme of pointers." },
            { "Default Aero", "Default Aero" },
            { "Nero Classico", "Classic Black" },
            { "Neon Invertito", "Inverted Neon" },
            { "Applica Puntatore", "Apply Cursor" },

            // GamingHubView
            { "Libreria Giochi Rilevati", "Detected Games Library" },
            { "Titolo Gioco", "Game Title" },
            { "Origine", "Source" },
            { "Aggiungi Eseguibile (.exe)", "Add Executable (.exe)" },
            { "Avvia Gioco Selezionato", "Launch Selected Game" },
            { "OPZIONI GAMING HUB", "GAMING HUB OPTIONS" },
            { "Overlay Statistiche FPS", "FPS Stats Overlay" },
            { "Abilita HUD Overlay", "Enable HUD Overlay" },
            { "Disabilita HUD Overlay", "Disable HUD Overlay" },
            { "Piano Energetico", "Power Plan" },
            { "Ripristina Bilanciato", "Restore Balanced" },
            { "Seleziona un gioco per avviarlo.", "Please select a game to launch." },
            { "Impossibile impostare il piano ad alte prestazioni.", "Unable to set high performance power plan." },

            // StartupView
            { "Gestore Programmi all'Avvio di Windows", "Windows Startup Program Manager" },
            { "Nome App", "App Name" },
            { "Percorso", "Path" },
            { "Impatto Avvio", "Startup Impact" },
            { "* Rimuovere i processi riduce il tempo di avvio (Boot Time).", "* Removing processes reduces boot time." },
            { "Disabilita all'Avvio", "Disable at Startup" },
            { "CONFIGURA AVVIO RITARDATO", "CONFIGURING DELAYED STARTUP" },
            { "Per le app necessarie che rallentano l'avvio, puoi configurare un ritardo personalizzato. Windows le caricherà solo dopo N secondi dal login desktop.", "For necessary apps that slow down boot, you can configure a custom delay. Windows will load them only N seconds after desktop login." },
            { "Seleziona app sopra, poi inserisci i secondi:", "Select an app above, then enter the seconds:" },
            { "Imposta Avvio Ritardato", "Set Delayed Startup" },
            { "Avvio Ritardato", "Delayed Startup" },

            // RestoreView
            { "Stato Modifiche Registro e Punti di Ripristino", "Registry Changes & Restore Points Status" },
            { "Data Backup", "Backup Date" },
            { "Chiave Registro", "Registry Key" },
            { "Valore", "Value" },
            { "Valore Originale", "Original Value" },
            { "Ripristina Tutto (Revert)", "Restore All (Revert)" },
            { "RIPRISTINO DI SISTEMA WINDOWS", "WINDOWS SYSTEM RESTORE" },
            { "Prima di applicare qualsiasi tweak di registro, si consiglia vivamente di generare un Punto di Ripristino (System Restore Point) ufficiale di Windows, per consentire il rollback completo del sistema in caso di errori.", "Before applying any registry tweaks, it is strongly recommended to generate an official Windows System Restore Point, to allow full system rollback in case of errors." },
            { "Crea Ripristino di Sistema", "Create System Restore" },
            { "0 Chiavi Backup", "0 Backup Keys" },
            { "Sono necessari privilegi di amministratore per creare punti di ripristino del sistema.", "Administrator privileges are required to create system restore points." },
            { "Nessun backup memorizzato. Nessuna modifica da ripristinare.", "No backup stored. No changes to revert." },
            { "Sei sicuro di voler ripristinare i valori predefiniti per {0} chiavi di registro modificate?", "Are you sure you want to restore default values for {0} modified registry keys?" },
            { "Ripristino Registro", "Registry Restore" },
            { "Creazione punto di ripristino non riuscita.\r\nAssicurarsi che la protezione del sistema sia abilitata per il disco C: in Windows.\r\n\r\nDettaglio: ", "Failed to create restore point.\r\nMake sure system protection is enabled for drive C: in Windows.\r\n\r\nDetail: " },
            { "Errore Restore Point", "Restore Point Error" },

            // DiskToolsView
            { "Scansione File Grandi (Maggiore di 100MB)", "Large Files Scan (Over 100MB)" },
            { "Nome File", "File Name" },
            { "Dimensione", "Size" },
            { "* Cerca file di grandi dimensioni nelle cartelle di Download e Temp.", "* Search for large files in Download and Temp folders." },
            { "Avvia Scansione", "Start Scan" },
            { "Elimina File Selezionato", "Delete Selected File" },
            { "DIAGNOSTICA S.M.A.R.T. DISCO", "DISK S.M.A.R.T. DIAGNOSTICS" },
            { "Interroga i parametri SMART interni per diagnosticare predizioni di rottura hardware dell'SSD/HDD.", "Query internal SMART parameters to diagnose hardware failure predictions of SSD/HDD." },
            { "Stato: ", "Status: " },
            { "ATTESA SCANSIONE", "WAITING FOR SCAN" },
            { "Cerca File Duplicati", "Find Duplicate Files" },
            { "ATTENZIONE ROTTURA", "FAILURE PREDICTED" },
            { "FUNZIONANTE (ECCELLENTE)", "HEALTHY (EXCELLENT)" },
            { "OK (SMART NON SUPP.)", "OK (SMART NOT SUPPORTED)" },

            // BenchmarkView
            { "1. BENCHMARK PROCESSORE CPU", "1. CPU PROCESSOR BENCHMARK" },
            { "Risoluzione parallela multi-thread di numeri primi complessi per sollecitare i core a pieno carico.", "Parallel multi-threaded resolution of complex prime numbers to stress the cores at full load." },
            { "2. BENCHMARK MEMORIA RAM", "2. RAM MEMORY BENCHMARK" },
            { "Calcola la velocità di allocazione dinamica e lettura/scrittura di blocchi sequenziali in memoria virtuale.", "Calculates dynamic allocation and read/write speed of sequential blocks in virtual memory." },
            { "3. BENCHMARK DISCO DI SISTEMA", "3. SYSTEM DISK BENCHMARK" },
            { "Misura la velocità di scrittura sequenziale scrivendo un file temporaneo criptato da 200MB su partizione C:.", "Measures sequential write speed by writing an encrypted 200MB temporary file on C: drive." },
            { "CRONOLOGIA RISULTATI", "RESULTS HISTORY" },
            { "Cancella Archivio", "Clear History" },
            { "Avvia CPU Test", "Start CPU Test" },
            { "Avvia RAM Test", "Start RAM Test" },
            { "Avvia Disco Test", "Start Disk Test" },
            { "Data", "Date" },

            // RAM Manager
            { "RAM MANAGER", "RAM MANAGER" },
            { "Libera RAM", "Free RAM" },
            { "Monitor RAM", "RAM Monitor" },
            { "Totale", "Total" },
            { "In Uso", "In Use" },
            { "Disponibile", "Available" },
            { "Processi Attivi (per RAM)", "Active Processes (by RAM)" },
            { "Processo", "Process" },
            { "PID", "PID" },
            { "Aggiorna Lista", "Refresh List" },
            { "RAM LIVE STATUS", "RAM LIVE STATUS" },
            { "Caricamento...", "Loading..." },
            { "STANDBY MEMORY CLEANER", "STANDBY MEMORY CLEANER" },
            { "La memoria Standby è occupata da file precedentemente aperti. Svuota la cache in modo sicuro senza crashare i programmi attivi.", "Standby memory is occupied by previously opened files. Clear the cache safely without crashing active programs." },
            { "Svuota Memoria Standby", "Clear Standby Memory" },
            { "OTTIMIZZAZIONE INTELLIGENTE PROCESSI", "SMART PROCESS OPTIMIZATION" },
            { "Analizza ed effettua il raggruppamento sicuro dei wrapper svchost e la pausa dei servizi non essenziali (-50 processi).", "Analyzes and safely groups svchost wrappers while pausing non-essential services (-50 processes)." },
            { "✔ 100% Sicuro & Reversibile (0 Rischio Crash)", "✔ 100% Safe & Reversible (0 Crash Risk)" },
            { "Ottimizza Processi (-50)", "Optimize Processes (-50)" },
            { "Ripristina Stato Processi", "Restore Process State" },
            { "SMART PROCESS KILLER", "SMART PROCESS KILLER" },
            { "Rileva automaticamente processi inutili in background che sprecano RAM e CPU. Permette all'utente di terminarli selettivamente.", "Automatically detect useless background processes that waste RAM and CPU. Allows the user to selectively terminate them." },
            { "Processi inutili rilevati:", "Useless processes detected:" },
            { "Cat.", "Cat." },
            { "Scansiona Processi Inutili", "Scan Useless Processes" },
            { "Termina Selezionato", "Terminate Selected" },
            { "Termina TUTTI i Processi Inutili", "Terminate ALL Useless Processes" },
            { "AMD Radeon Software (usa su richiesta)", "AMD Radeon Software (use on demand)" },
            { "Microsoft Teams processo", "Microsoft Teams process" },
            { "Windows Search indexer (alto I/O disco)", "Windows Search indexer (high disk I/O)" },
            { "Seleziona un processo dalla lista dei processi inutili.", "Select a process from the useless processes list." },
            { "Sei sicuro di voler terminare il processo '{0}'?", "Are you sure you want to terminate the process '{0}'?" },
            { "Conferma Terminazione", "Confirm Termination" },
            { "Impossibile trovare o terminare il processo.", "Unable to find or terminate the process." },
            { "Nessun processo inutile rilevato. Avvia prima la scansione.", "No useless process detected. Run the scan first." },
            { "Stai per terminare {0} processi inutili rilevati in background.\n\nI programmi di sistema e quelli attivi in primo piano non saranno toccati.\n\nContinuare?", "You are about to terminate {0} useless processes detected in background.\n\nSystem programs and active foreground programs will not be affected.\n\nContinue?" },
            { "Smart Killer: terminati {0} processi inutili. RAM liberata: ~{1:F0} MB", "Smart Killer: terminated {0} useless processes. RAM freed: ~{1:F0} MB" },
            { "Liberati ~{0:F0} MB! ({1} processi terminati)", "Freed ~{0:F0} MB! ({1} processes terminated)" },

            // UpdateDialog
            { "Pavo Tweak – Aggiornamento Disponibile", "Pavo Tweak – Update Available" },
            { "AGGIORNAMENTO DISPONIBILE", "UPDATE AVAILABLE" },
            { "Nuova versione disponibile per il download", "New version available for download" },
            { "Versione installata:", "Installed version:" },
            { "Nuova versione:", "New version:" },
            { "Nessun dettaglio specificato per questa versione.", "No details specified for this version." },
            { "Avvio del download...", "Starting download..." },
            { "Vuoi procedere all'aggiornamento?", "Do you want to proceed with the update?" },
            { "Più Tardi", "Later" },
            { "Aggiorna Ora", "Update Now" },
            { "Download completato! Avvio installazione in corso...", "Download completed! Starting installation..." },
            { "Impossibile trovare il modulo di aggiornamento (Uninstall.exe).\nSi prega di reinstallare l'applicazione.", "Unable to find the update module (Uninstall.exe).\nPlease reinstall the application." },

            // Driver Center View
            { "CENTRO CONTROLLO DRIVER HARDWARE", "HARDWARE DRIVER CONTROL CENTER" },
            { "Esegui la scansione per trovare driver di rete, chipset o schede video obsoleti ed ottieni i link ufficiali del produttore.", "Scan for outdated network, chipset, or video card drivers and get official manufacturer links." },
            { "Dispositivo Rilevato", "Device Detected" },
            { "Produttore", "Manufacturer" },
            { "Versione Driver", "Driver Version" },
            { "Stato", "Status" },
            { "* Pavo Tweak non scarica file di installazione terzi per evitare driver incompatibili.", "* Pavo Tweak does not download third-party installer files to avoid incompatible drivers." },
            { "Scansiona Driver Obsoleti", "Scan Outdated Drivers" },
            { "Scarica dal Produttore Ufficiale", "Download from Official Manufacturer" },
            { "Da Aggiornare", "Outdated" },
            { "Aggiornato", "Up to Date" },
            { "Seleziona un driver hardware per aprire la pagina di download.", "Select a hardware driver to open the download page." },

            // Marketplace View
            { "MARKETPLACE PROFILI DI OTTIMIZZAZIONE", "MARKETPLACE OPTIMIZATION PROFILES" },
            { "Scarica o importa profili di ottimizzazione preconfezionati e personalizzati dalla community locale.", "Download or import pre-made and custom optimization profiles from the local community." },
            { "Profili Preimpostati Disponibili", "Available Preset Profiles" },
            { "Nome Profilo", "Profile Name" },
            { "Descrizione Funzionale", "Functional Description" },
            { "Autore", "Author" },
            { "Tweaks", "Tweaks" },
            { "* I profili community caricano file .json locali contenenti impostazioni consigliate.", "* Community profiles load local .json files containing recommended settings." },
            { "Importa Profilo Esterno", "Import External Profile" },
            { "Applica Profilo Selezionato", "Apply Selected Profile" },
            { "Ottimizza latenze, piano energetico a prestazioni estreme, sblocca core parking e chiude telemetrie.", "Optimizes latencies, extreme performance power plan, unlocks core parking and disables telemetry." },
            { "Mantiene l'allineamento dei consumi, abilita caching file di grandi dimensioni e mantiene l'avvio pulito.", "Maintains power alignment, enables large file caching and keeps startup clean." },
            { "Limita frequenze di clock non necessarie in idle, riabilita core parking e ottimizza consumi DWM.", "Limits unnecessary idle clock frequencies, re-enables core parking and optimizes DWM power consumption." },
            { "Abilita caches file system avanzate, disabilita telemetrie e pulisce periodicamente la RAM Standby.", "Enables advanced file system caches, disables telemetry and periodically clears Standby RAM." },
            { "Seleziona un profilo dal marketplace.", "Select a profile from the marketplace." },
            { "Sei sicuro di voler caricare ed applicare il profilo '{0}'?\r\n\r\nQuesto cambierà diversi parametri grafici ed energetici.", "Are you sure you want to load and apply the '{0}' profile?\r\n\r\nThis will change several graphics and power settings." },
            { "Conferma Caricamento Profilo", "Confirm Profile Loading" },
            { "Profilo applicato con successo!", "Profile applied successfully!" },
            { "Profilo locale caricato!", "Local profile loaded!" },
            { "Importa file profilo locale", "Import local profile file" },
            { "Profilo Pavo (*.pavo;*.json)|*.pavo;*.json", "Pavo Profile (*.pavo;*.json)|*.pavo;*.json" },

            // CustomizationView Logs & Dialogs
            { "Trasparenza Taskbar impostata su: ", "Taskbar transparency set to: " },
            { "Attiva", "Active" },
            { "Disattiva", "Inactive" },
            { "Auto-hide Barra Applicazioni impostata su: ", "Taskbar Auto-hide set to: " },
            { "Visibilità estensioni file impostata a: ", "File extensions visibility set to: " },
            { "Menu contestuale classico Windows 10 abilitato. Riavvia Explorer per applicare.", "Classic Windows 10 context menu enabled. Restart Explorer to apply." },
            { "Menu contestuale moderno Windows 11 ripristinato. Riavvia Explorer per applicare.", "Modern Windows 11 context menu restored. Restart Explorer to apply." },
            { "Tema di sistema modificato in: ", "System theme changed to: " },
            { "Effetti di trasparenza impostati a: ", "Transparency effects set to: " },
            { "Disattivo", "Disabled" },
            { "Applicazione configurazione puntatore mouse...", "Applying mouse pointer configuration..." },
            { "Configurazione cursore aggiornata ed inviata alle API di Windows.", "Cursor configuration updated and sent to Windows APIs." },
            { "Impossibile salvare configurazione cursore: ", "Unable to save cursor configuration: " },
            { "Riavvio in corso della shell Esplora Risorse...", "Restarting Windows Explorer shell..." },
            { "Esplora Risorse riavviato correttamente.", "Windows Explorer restarted successfully." },
            { "Puntatore mouse aggiornato!", "Mouse pointer updated!" },
            { "Esplora Risorse riavviato!", "Windows Explorer restarted!" },
            { "Questa operazione riavvierà la shell di Windows (Esplora Risorse).\n\n", "This operation will restart the Windows shell (Windows Explorer).\n\n" },
            { "Il desktop sparirà per un secondo e poi verrà ripristinato automaticamente.\n\n", "The desktop will disappear for a second and then automatically restore.\n\n" },

            // DashboardView Logs & Toasts
            { "Privilegi elevati già verificati.", "Elevated privileges already verified." },
            { "Startup ottimizzato!", "Startup optimized!" },
            { "Spazio su disco liberato!", "Disk space freed!" },
            { "Cache RAM pulita!", "RAM Cache cleaned!" },
            { "Gaming Mode attivo!", "Gaming Mode active!" },
            { "Esecuzione Quick Fix per categoria: ", "Executing Quick Fix for category: " },
            { "Avvio prompt UAC per riavviare con privilegi elevati...", "Launching UAC prompt to restart with elevated privileges..." },
            { "Reindirizzamento a Startup Manager...", "Redirecting to Startup Manager..." },
            { "Cancellazione file temporanei...", "Deleting temporary files..." },
            { "Ripulitura Standby List cache...", "Cleaning Standby List cache..." },
            { "Caricamento Profilo Energetico Prestazioni Elevate...", "Loading High Performance Power Plan..." },

            // BenchmarkView Logs, States & Toasts
            { "Calcolo...", "Calculating..." },
            { "Allocazione...", "Allocating..." },
            { "Scrittura...", "Writing..." },
            { "Benchmark CPU completato!", "CPU Benchmark completed!" },
            { "Benchmark RAM completato!", "RAM Benchmark completed!" },
            { "Benchmark Disco completato!", "Disk Benchmark completed!" },
            { "Avvio benchmark CPU (Calcolo numeri primi parallelo)...", "Starting CPU benchmark (Parallel prime numbers calculation)..." },
            { "Avvio benchmark RAM (Scrittura sequenziale array di dati)...", "Starting RAM benchmark (Sequential data array write)..." },
            { "Avvio benchmark Disco (Scrittura sequenziale file temporaneo C:\\pavo_temp_bench)...", "Starting Disk benchmark (Sequential write of temporary file C:\\pavo_temp_bench)..." },
            { "Impossibile eseguire benchmark disco: ", "Unable to run disk benchmark: " },
            { "Archivio cronologia benchmark cancellato.", "Benchmark history cleared." },

            // StartupView Strings
            { "Alto", "High" },
            { "Medio", "Medium" },
            { "Basso", "Low" },
            { "Seleziona una voce di avvio dalla lista.", "Select a startup item from the list." },
            { "Privilegi amministratore insufficienti per scrivere in HKLM: ", "Insufficient administrator privileges to write to HKLM: " },
            { "Rifiutato", "Denied" },
            { "Seleziona un'app dall'avvio da ritardare.", "Select an app from startup to delay." },
            { "Inserisci un numero di secondi valido (es: 15).", "Please enter a valid number of seconds (e.g. 15)." },
            { "Parametro Errato", "Invalid Parameter" },
            { "Impossibile salvare lo script batch: ", "Unable to save batch script: " },

            // UpdateDialog Strings
            { "Errore di download: ", "Download error: " },
            { "Errore di inizializzazione download: ", "Download initialization error: " },
            { "Errore durante la preparazione dell'aggiornamento: ", "Error during update preparation: " },

            // DiskToolsView Strings
            { "Seleziona un file dalla lista.", "Select a file from the list." },
            { "Sei sicuro di voler eliminare definitivamente il file '{0}'?", "Are you sure you want to permanently delete the file '{0}'?" },
            { "Conferma Eliminazione", "Confirm Deletion" },
            { "Errore di cancellazione: ", "Deletion error: " },
            { " (Duplicato)", " (Duplicate)" },

            // RamManagerView Strings
            { "Scansione completata. Processi in background rilevati: {0}", "Scan complete. Background processes detected: {0}" },
            { "Trovati {0} processi in background.", "Found {0} background processes." },
            { "Processo terminato con successo: {0}", "Process terminated successfully: {0}" },
            { "Processo terminato!", "Process terminated!" },

            // PavoTweak Entry Point Strings
            { "Errore irreversibile durante l'avvio di Pavo Tweak.\n\n", "Fatal error during Pavo Tweak startup.\n\n" },
            { "Errore:\n", "Error:\n" },
            { "Pavo Tweak - Errore Fatale", "Pavo Tweak - Fatal Error" },

            // Additional logs, dialogs, and states
            { "Errore controllo aggiornamenti: ", "Update check error: " },
            { "Taskbar allineata a: ", "Taskbar aligned to: " },
            { "Modalità ricerca modificata in: ", "Search mode changed to: " },
            { "Continuare?", "Continue?" },
            { "Piano Bilanciato attivo.", "Balanced Power Plan active." },
            { "Piano energetico ripristinato su Bilanciato.", "Power plan restored to Balanced." },
            { "Applicazione del profilo da Marketplace: ", "Applying profile from Marketplace: " },
            { "Profilo '{0}' caricato ed applicato con successo.", "Profile '{0}' successfully loaded and applied." },
            { "Errore applicazione profilo: ", "Profile application error: " },
            { "Caricamento profilo locale esterno: ", "Loading external local profile: " },
            { "Impossibile caricare profilo: ", "Unable to load profile: " },
            { "Errore File", "File Error" },
            { "Errore IO", "IO Error" },
            { "Driver Center", "Driver Center" },
            { "Tweaks Marketplace", "Tweaks Marketplace" },
            { "Archiviazione", "Storage" },
            { "CPU: {0} | GPU: {1} | RAM: {2:F1} GB | DISCO C: {3} ({4:F1} GB Liberi)", "CPU: {0} | GPU: {1} | RAM: {2:F1} GB | SYSTEM DISK C: {3} ({4:F1} GB Free)" }
        };

        // ─── ITALIAN ────────────────────────────────────────────────────────────
        private static readonly Dictionary<string, string> _it = new Dictionary<string, string>
        {
            // Navigation
            { "nav.dashboard",      "Dashboard" },
            { "nav.ai",             "AI Optimizer" },
            { "nav.custom",         "Windows Custom" },
            { "nav.gaming",         "Gaming Hub" },
            { "nav.driver",         "Driver Center" },
            { "nav.benchmark",      "Benchmarks" },
            { "nav.disk",           "Disk Tools" },
            { "nav.ram",            "RAM Manager" },
            { "nav.startup",        "App di Avvio" },
            { "nav.restore",        "Ripristino" },
            { "nav.market",         "Marketplace" },
            { "nav.settings",       "Impostazioni" },
            { "nav.discord",        "Supporto Discord" },

            // Common buttons
            { "btn.save",           "Salva" },
            { "btn.apply",          "Applica" },
            { "btn.cancel",         "Annulla" },
            { "btn.reset",          "Ripristina" },
            { "btn.refresh",        "Aggiorna" },
            { "btn.scan",           "Scansiona" },
            { "btn.clean",          "Pulisci" },
            { "btn.optimize",       "Ottimizza" },
            { "btn.start",          "Avvia" },
            { "btn.stop",           "Ferma" },
            { "btn.enable",         "Abilita" },
            { "btn.disable",        "Disabilita" },
            { "btn.delete",         "Elimina" },
            { "btn.export",         "Esporta" },
            { "btn.import",         "Importa" },
            { "btn.confirm",        "Confermo e Applico" },
            { "btn.update",         "Aggiorna" },

            // Status labels
            { "status.admin",       "MODALITÀ AMMINISTRATORE" },
            { "status.user",        "MODALITÀ UTENTE" },
            { "status.loading",     "Caricamento..." },
            { "status.done",        "Completato!" },
            { "status.error",       "Errore" },
            { "status.success",     "Successo" },
            { "status.warning",     "Attenzione" },

            // Dashboard
            { "dash.score.title",   "STATO DI OTTIMIZZAZIONE DEL PC" },
            { "dash.score.desc",    "Punteggio 0-100 che rappresenta il livello di pulizia e configurazione ottimale del sistema." },
            { "dash.monitor.title", "MONITOR LIVE HARDWARE" },
            { "dash.quick.title",   "AZIONI RAPIDE" },
            { "dash.cpu",           "CPU" },
            { "dash.gpu",           "GPU" },
            { "dash.ram",           "RAM" },
            { "dash.disk",          "Disco" },
            { "dash.temp",          "Temperatura" },
            { "dash.usage",         "Utilizzo" },
            { "dash.free",          "Libero" },
            { "dash.drawer.health.title",   "Stato PC Health &amp; Sicurezza" },
            { "dash.drawer.health.noadmin", "Non eseguito come Amministratore (Score: 60)" },
            { "dash.drawer.health.noadmin.item1", "I privilegi di amministratore sono necessari per applicare le ottimizzazioni di sistema avanzate." },
            { "dash.drawer.health.noadmin.item2", "I benchmarks del disco potrebbero risultare bloccati." },
            { "dash.drawer.health.admin",   "Tutti i parametri di integrità sono in ordine (Score: 100)" },
            { "dash.drawer.health.admin.item1", "Eseguito come Amministratore." },
            { "dash.drawer.health.admin.item2", "I privilegi UAC sono configurati correttamente." },
            { "dash.drawer.startup.title",  "Analisi Avvio Applicazioni" },
            { "dash.drawer.startup.status", "Applicazioni rilevate all'avvio" },
            { "dash.drawer.startup.item1",  "Rilevate applicazioni superflue nel registro 'Run'." },
            { "dash.drawer.startup.item2",  "Si consiglia di ritardare l'avvio delle applicazioni non critiche nel pannello Startup Manager." },
            { "dash.drawer.storage.title",  "Spazio su Disco &amp; File Spazzatura" },
            { "dash.drawer.storage.status", "File di cache rilevati" },
            { "dash.drawer.storage.item1",  "Spazio libero su C: " },
            { "dash.drawer.storage.item2",  "File temporanei utente accumulati nella cartella Temp." },
            { "dash.drawer.ram.title",      "Carico Memoria in Background" },
            { "dash.drawer.ram.status",     "RAM Standby elevata" },
            { "dash.drawer.ram.item1",      "Standby cache occupata da pagine allocate chiuse." },
            { "dash.drawer.ram.item2",      "Pulisci la memoria di cache per liberare spazio reale." },
            { "dash.drawer.gaming.title",   "Pianificazione Gaming Hub" },
            { "dash.drawer.gaming.status",  "Ottimizzazione profilo attivo" },
            { "dash.drawer.gaming.item1",   "Pianificazione energetica impostata su Bilanciato." },
            { "dash.drawer.gaming.item2",   "Overlay HUD non visualizzato per le frequenze FPS." },

            // AI Optimizer
            { "ai.title",           "ANALISI AI HARDWARE" },
            { "ai.desc",            "Analizza il tuo hardware e suggerisce ottimizzazioni sicure specifiche per il tuo sistema." },
            { "ai.scan",            "Scansiona Hardware" },
            { "ai.hardware.info",   "Informazioni Hardware" },
            { "ai.suggestions",     "Suggerimenti AI" },
            { "ai.warning.title",   "Conferma Ottimizzazione" },
            { "ai.warning.desc",    "Stai per applicare una modifica al sistema. L'operazione sarà registrata per permettere il ripristino." },

            // Optimization items (Italian)
            { "opt.cpu_core_parking.title",   "Tweak Disattivazione Core Parking CPU" },
            { "opt.cpu_core_parking.explain", "La tua CPU ({0}) ha {1} core logici. Windows disattiva (parcheggia) alcuni core per risparmiare energia, causando micro-scatti nei giochi quando devono riattivarsi. Questo tweak mantiene tutti i core pronti all'uso." },
            { "opt.cpu_core_parking.side",    "Leggero aumento del consumo di batteria sui laptop; nessuna differenza sui desktop." },
            { "opt.gpu_hags.title",           "Abilita Hardware Accelerated GPU Scheduling" },
            { "opt.gpu_hags.explain",         "La scheda video ({0}) supporta la pianificazione accelerata hardware per ridurre la latenza del processore grafico e inoltrare direttamente la memoria video ai frame buffer dei giochi." },
            { "opt.gpu_hags.side",            "Può causare rari crash con driver obsoleti. Assicurarsi di aggiornare i driver." },
            { "opt.gpu_nv_telemetry.title",   "Disattiva Servizi Telemetria NVIDIA" },
            { "opt.gpu_nv_telemetry.explain", "I driver NVIDIA contengono un demone di telemetria in background che raccoglie e invia report sui dati di gioco. Rimuovendo questo background si risparmiano cicli di CPU." },
            { "opt.gpu_nv_telemetry.side",    "Nessuno. GeForce Experience non invierà feedback statistici a NVIDIA." },
            { "opt.ram_superfetch.title",     "Ottimizzazione SysMain per sistemi con poca RAM" },
            { "opt.ram_superfetch.explain",   "Il PC ha soltanto {0:F1} GB di RAM. Il servizio SysMain (Superfetch) pre-carica programmi non in uso, saturando rapidamente la memoria fisica disponibile. Si consiglia di impostarlo su manuale o disattivarlo." },
            { "opt.ram_superfetch.side",      "Le app che si aprono per la prima volta potrebbero impiegare un secondo in più ad avviarsi." },
            { "opt.ram_large_cache.title",    "Abilita Large System Cache" },
            { "opt.ram_large_cache.explain",  "Il PC dispone di {0:F1} GB di RAM (abbondante). Windows può mantenere in memoria le tabelle di allocazione dei file del disco anziché rileggerle, accelerando tutti i caricamenti del sistema operativo." },
            { "opt.ram_large_cache.side",     "Consuma circa 120 MB in più di RAM costante in background." },
            { "opt.storage_ssd_trim.title",   "Forza Abilitazione Comando TRIM SSD" },
            { "opt.storage_ssd_trim.explain", "Sul disco C: (SSD) l'abilitazione del TRIM assicura che il controller flash ripulisca i blocchi inutilizzati immediatamente dopo la cancellazione dei file, estendendo la vita utile e mantenendo elevata la velocità di scrittura." },
            { "opt.storage_ssd_trim.side",    "Nessuno. Valido per tutti i moderni SSD." },
            { "opt.storage_hdd_comp.title",   "Disabilita Compressione NTFS in background" },
            { "opt.storage_hdd_comp.explain", "Essendo il disco di tipo HDD (meccanico), la decompressione dinamica dei file in background impegna fortemente le testine magnetiche rallentando i tempi di caricamento complessivi. Disabilitare la compressione allevia il carico." },
            { "opt.storage_hdd_comp.side",    "I file occuperanno leggermente più spazio su disco." },
            { "opt.sys_process_grouping.title",   "Accorpamento Intelligente Processi SvcHost" },
            { "opt.sys_process_grouping.explain", "Su Windows 10/11 i servizi di sistema sono separati in decine di processi svchost distinti. Questo tweak accorpa in sicurezza i wrapper svchost e mette in pausa i servizi secondari riducendo fino a 50 processi attivi in background." },
            { "opt.sys_process_grouping.side",      "Nessuno. Totalmente reversibile e privo di rischi per la stabilità." },
            { "opt.status.optimized",         "Ottimizzato" },
            { "opt.status.not_optimized",     "Non ottimizzato" },

            // Pavo Game Optimizer (Italian)
            { "gaming.title",                   "PAVO GAME OPTIMIZER" },
            { "gaming.subtitle",                "Sistema trasparente e sicuro di scansione, ottimizzazione e profilazione per le massime prestazioni nei giochi." },
            { "gaming.mode.label",              "GAMING MODE" },
            { "gaming.mode.active",             "ATTIVO" },
            { "gaming.mode.inactive",           "DISATTIVATO" },
            { "gaming.metric.cpu",              "CARICO CPU LIVE" },
            { "gaming.metric.ram",              "USO MEMORIA RAM" },
            { "gaming.metric.processes",        "AVVIO E PROCESSI" },
            { "gaming.metric.score",            "PUNTEGGIO OTTIMIZZATORE" },
            { "gaming.metric.cpu.sub",          "Dato reale misurato WMI" },
            { "gaming.metric.ram.sub",          "Cache Standby inclusa" },
            { "gaming.metric.gpu.protected",    "GPU driver protetti" },
            { "gaming.metric.os.sub",           "Stato configurazione OS" },
            { "gaming.profiles.title",          "PROFILI GIOCO" },
            { "gaming.btn.addcustom",           "Aggiungi Gioco (.exe)" },
            { "gaming.btn.hud.enable",          "Abilita HUD Overlay" },
            { "gaming.btn.hud.disable",         "Disabilita HUD Overlay" },
            { "gaming.scan.title",              "RISULTATI DIAGNOSTICA WINDOWS" },
            { "gaming.btn.scan",                "Scansiona Ora" },
            { "gaming.btn.optimize",            "Ottimizza Ora (1-Click)" },
            { "gaming.btn.restore",             "Ripristina Impostazioni Precedenti" },
            { "gaming.grid.enable",             "Abilita" },
            { "gaming.grid.category",           "Categoria" },
            { "gaming.grid.optimization",       "Ottimizzazione" },
            { "gaming.grid.status",             "Stato Attuale" },
            { "gaming.opt.select_prompt",       "Seleziona un'ottimizzazione per dettagli" },
            { "gaming.opt.select_desc",         "Clicca su una riga sopra per leggere la spiegazione tecnica trasparente della modifica proponibile." },
            { "gaming.opt.safety_info",         "Sicurezza: Modifica 100% reversibile con backup automatico del registro prima dell'applicazione." },

            { "opt.game_mode.title",          "Windows Game Mode (Modalità Gioco Windows)" },
            { "opt.game_mode.explain",        "Assegna le risorse CPU e GPU direttamente alle finestre di gioco attive e sospende gli aggiornamenti di Windows in background durante il gameplay." },
            { "opt.game_mode.side",           "Nessuno. Funzione nativa consigliata da Microsoft per Windows 10 e 11." },
            { "opt.hags.title",               "Hardware-Accelerated GPU Scheduling (HAGS)" },
            { "opt.hags.explain",             "Consente alla scheda video di gestire direttamente la pianificazione della propria memoria VRAM, riducendo l'overhead della CPU sui frame time." },
            { "opt.hags.side",                "Nessuno sui driver recenti. Migliora la stabilità nei titoli DirectX 12 e Vulkan." },
            { "opt.mmcss.title",              "Priorità MMCSS Gaming &amp; Rendering" },
            { "opt.mmcss.explain",            "Imposta le chiavi MMCSS (Multimedia Class Scheduler) per dare massima priorità ai thread di gioco e audio rispetto alle app di sistema in background." },
            { "opt.mmcss.side",               "Nessuno. Riduce le micro-interruzioni audio e le fluttuazioni dei millisecondi dei frame." },
            { "opt.net_throttling.title",     "Disattivazione Network Throttling per i Giochi" },
            { "opt.net_throttling.explain",   "Windows limita l'elaborazione dei pacchetti di rete non-multimediali. Disattivando il throttling, si garantisce l'invio immediato dei pacchetti UDP di gioco." },
            { "opt.net_throttling.side",      "Nessuno per il gaming. Riduce la latenza e i picchi di ping nei giochi multiplayer online." },
            { "opt.sys_resp.title",           "Ottimizzazione System Responsiveness" },
            { "opt.sys_resp.explain",         "Imposta SystemResponsiveness a 0 nel registro affinché Windows assegni il 100% delle risorse di sistema all'applicazione di gioco attiva." },
            { "opt.sys_resp.side",            "Nessuno sui PC moderni. Evita che processi di sistema rallentino il gioco in primo piano." },
            { "opt.gamedvr.title",            "Disattiva Registrazione GameDVR in Background" },
            { "opt.gamedvr.explain",          "La registrazione in background di Xbox Game Bar consuma costantemente cicli di encoder GPU e memoria. Disattivando il DVR si liberano risorse video." },
            { "opt.gamedvr.side",             "La registrazione automatica di Game Bar sarà disattivata (ShadowPlay/OBS continuano a funzionare regolarmente)." },
            { "opt.power_plan.title",         "Piano Energetico Prestazioni Elevate / Gaming" },
            { "opt.power_plan.explain",       "Forza la CPU a rimanere alla frequenza di clock massima (eliminando i ritardi di cambio stato energetico) e previene il parking dei core." },
            { "opt.power_plan.side",          "Leggero consumo energetico in più in idle su laptop." },
            { "opt.win32_priority.title",     "Windows Scheduler Quantum Boost (Win32PrioritySeparation 0x26)" },
            { "opt.win32_priority.explain",   "Assegna quantum temporali brevi e variabili favoriti per il processo in primo piano. Garantisce che la CPU dia priorità immediata ai calcoli di gioco." },
            { "opt.win32_priority.side",      "Nessuno. Standard ottimizzato per le prestazioni nei giochi." },

            { "opt.disable_lastaccess.title", "Ottimizzazione Scrittura Disco (Disabilita LastAccessUpdate)" },
            { "opt.disable_lastaccess.explain", "Disattiva l'aggiornamento automatico della data dell'ultimo accesso ai file su partizioni NTFS, riducendo le micro-scritture non necessarie su disco durante il gioco." },
            { "opt.disable_lastaccess.side", "Nessuno. La data dell'ultimo accesso ai file non sarà aggiornata (data di creazione e modifica rimangono inalterate)." },
            { "opt.tcp_nodelay.title", "Ottimizzazione Latenza Rete (TCP NoDelay / Nagle)" },
            { "opt.tcp_nodelay.explain", "Disabilita l'algoritmo di Nagle sulle interfacce di rete, inviando immediatamente i pacchetti di gioco TCP/UDP senza accorparli. Riduce la latenza nei giochi multiplayer." },
            { "opt.tcp_nodelay.side", "Nessuno. Può aumentare leggermente l'utilizzo della banda di rete a favore di un ping più basso." },
            { "opt.shader_cache.title", "Ottimizzazione e Pulizia Shader Cache DirectX" },
            { "opt.shader_cache.explain", "Elimina i file shader DirectX obsoleti o corrotti e imposta una cache shader ottimale a 10 GB per schede NVIDIA/AMD per prevenire scatti durante il caricamento delle texture." },
            { "opt.shader_cache.side", "Il primo avvio di un gioco dopo la pulizia potrebbe richiedere qualche secondo in più per ricostruire gli shader." },

            // Settings
            { "settings.title",         "IMPOSTAZIONI" },
            { "settings.general",       "Generale" },
            { "settings.appearance",    "Aspetto" },
            { "settings.performance",   "Performance" },
            { "settings.audio",         "Audio" },
            { "settings.advanced",      "Avanzate" },
            { "settings.language",      "Lingua" },
            { "settings.lang.it",       "🇮🇹 Italiano" },
            { "settings.lang.en",       "🇬🇧 English" },
            { "settings.startup",       "Avvia con Windows" },
            { "settings.tray",          "Minimizza nel Tray" },
            { "settings.updates",       "Controlla Aggiornamenti" },
            { "settings.notifications", "Notifiche" },
            { "settings.theme",         "Tema" },
            { "settings.theme.dark",    "Scuro" },
            { "settings.theme.soft",    "Scuro Morbido" },
            { "settings.theme.system",  "Automatico" },
            { "settings.accent",        "Colore Accento" },
            { "settings.uiscale",       "Scala UI" },
            { "settings.animations",    "Qualità Animazioni" },
            { "settings.anim.low",      "Bassa" },
            { "settings.anim.normal",   "Normale" },
            { "settings.anim.high",     "Alta" },
            { "settings.hwaccel",       "Accelerazione Hardware" },
            { "settings.gpurender",     "Rendering GPU" },
            { "settings.memopt",        "Ottimizzazione Memoria" },
            { "settings.fpslimit",      "Limite FPS" },
            { "settings.sounds",        "Suoni UI" },
            { "settings.clicksound",    "Suono Click" },
            { "settings.hoversound",    "Suono Hover" },
            { "settings.volume",        "Volume" },
            { "settings.reset",         "Ripristina Impostazioni Predefinite" },
            { "settings.clearcache",    "Pulisci Cache" },
            { "settings.restorepoint",  "Crea Punto di Ripristino" },
            { "settings.export",        "Esporta Impostazioni" },
            { "settings.import",        "Importa Impostazioni" },
            { "settings.devmode",       "Modalità Sviluppatore" },
            { "settings.experimental",  "Funzioni Sperimentali" },
            { "settings.saved",         "Impostazioni salvate!" },
            { "settings.reset.confirm", "Tutte le impostazioni sono state ripristinate ai valori predefiniti." },

            // Benchmark
            { "bench.cpu.title",    "BENCHMARK PROCESSORE CPU" },
            { "bench.cpu.desc",     "Risoluzione parallela multi-thread di numeri primi per sollecitare i core." },
            { "bench.ram.title",    "BENCHMARK MEMORIA RAM" },
            { "bench.ram.desc",     "Velocità di allocazione e lettura/scrittura in memoria virtuale." },
            { "bench.disk.title",   "BENCHMARK DISCO DI SISTEMA" },
            { "bench.disk.desc",    "Velocità di scrittura sequenziale su partizione C:." },
            { "bench.history",      "CRONOLOGIA RISULTATI" },
            { "bench.clear",        "Cancella Archivio" },
            { "bench.start.cpu",    "Avvia CPU Test" },
            { "bench.start.ram",    "Avvia RAM Test" },
            { "bench.start.disk",   "Avvia Disco Test" },

            // Disk Tools
            { "disk.analyze.title", "ANALISI DISCO" },
            { "disk.cache.title",   "PULIZIA CACHE &amp; FILE JUNK" },
            { "disk.cache.desc",    "Rimuove cache browser, file temp, log di crash e file Windows Update obsoleti." },
            { "disk.clean.btn",     "Pulisci Cache Sistema" },
            { "disk.analyze.btn",   "Analizza Disco" },

            // Driver Center
            { "driver.title",       "DRIVER CENTER" },
            { "driver.desc",        "Rileva driver GPU, chipset e rete obsoleti e fornisce link alle pagine di download ufficiali." },
            { "driver.scan.btn",    "Scansiona Driver" },
            { "driver.nvidia",      "Driver NVIDIA" },
            { "driver.amd",         "Driver AMD" },
            { "driver.intel",       "Driver Intel" },



            // RAM Manager
            { "ram.title",          "RAM MANAGER" },
            { "ram.free.btn",       "Libera RAM" },
            { "ram.monitor",        "Monitor RAM" },
            { "ram.total",          "Totale" },
            { "ram.used",           "In Uso" },
            { "ram.available",      "Disponibile" },
            { "ram.sysproc.title",       "OTTIMIZZAZIONE DINAMICA UNIVERSALE PROCESSI" },
            { "ram.sysproc.desc",        "Analisi dinamica in tempo reale: protegge kernel, driver, GPU, audio e antivirus. Raggruppa i wrapper svchost e gestisce gli updater inattivi senza mai alterare permessi o privilegi di rete/app." },
            { "ram.sysproc.optimize",    "Ottimizza Processi di Sistema (-50)" },
            { "ram.sysproc.restore",     "Ripristina Stato Processi" },
            { "ram.sysproc.safe_badge",  "100% Sicuro & Reversibile" },

            // Startup
            { "startup.title",      "APP DI AVVIO" },
            { "startup.desc",       "Gestisci le applicazioni che si avviano automaticamente con Windows." },
            { "startup.enable",     "Abilita" },
            { "startup.disable",    "Disabilita" },
            { "startup.refresh",    "Aggiorna Lista" },

            // Restore
            { "restore.title",      "RESTORE CENTER" },
            { "restore.desc",       "Ripristina le modifiche al registro effettuate da Pavo Tweak con un solo click." },
            { "restore.backup",     "BACKUP REGISTRO" },
            { "restore.undo",       "Annulla Modifica" },
            { "restore.undo.all",   "Annulla Tutto" },

            // Customization
            { "custom.accent",      "COLORE DI ACCENTO APPLICAZIONE" },
            { "custom.accent.desc", "Scegli il colore primario dell'applicazione Pavo Tweak." },
            { "custom.theme.packs", "THEME &amp; CURSOR PACKS" },
            { "custom.theme.packs.desc", "Applica schemi di puntatori mouse o icone di cartella di sistema Windows." },
            { "custom.save.color",  "Salva Colore" },

            // Marketplace
            { "market.title",       "MARKETPLACE" },
            { "market.desc",        "Esplora temi, pack e strumenti aggiuntivi per Pavo Tweak." },

            // Console
            { "console.title",      "REGISTRO OPERAZIONI — PAVO CONSOLE" },

            // Notifications / Toast
            { "toast.settings.saved",   "Impostazioni salvate!" },
            { "toast.lang.changed",     "Lingua cambiata!" },
            { "toast.cache.cleared",    "Cache pulita!" },
            { "toast.optimize.done",    "Ottimizzazione completata!" },
            { "toast.restore.done",     "Ripristino completato!" },

            // AI Optimizer log/confirm strings
            { "ai.warning.details",     "Stai per applicare le seguenti modifiche nel Registro di Windows:\r\n\r\nTweak: {0}\r\nPercorso: {1}\r\nValore: {2} -> {3}\r\n\r\nSpiegazione Tecnica:\r\n{4}\r\n\r\nEffetti Collaterali: {5}" },
            { "log.ai.approved",        "Ottimizzazione registro approvata: {0}" },
            { "log.ai.success",         "Ottimizzazione '{0}' applicata con successo." },
            { "log.ai.toast",           "Ottimizzazione applicata!" },
            { "log.ai.error",           "Impossibile applicare ottimizzazione: {0}" },
            { "log.ai.error.dialog",    "Errore scrittura registro: {0}" },

            // Log strings (various views)
            { "log.startup.remove",     "Rimozione programma all'avvio: {0}" },
            { "log.startup.disabled",   "Programma all'avvio disabilitato con successo: {0}" },
            { "log.startup.delay",      "Configurazione avvio ritardato ({0}s) per {1}..." },
            { "log.startup.delay.ok",   "Avvio ritardato creato nel percorso Startup locale: {0}" },
            { "log.cache.start",        "Pulizia cache applicazione Pavo Tweak..." },
            { "log.cache.done",         "Cache pulita." },
            { "log.restore.start",      "Creazione punto di ripristino Windows..." },
            { "log.restore.ok",         "Punto di ripristino creato con successo." },
            { "log.restore.error",      "Impossibile creare punto di ripristino: {0}" },
            { "log.export.ok",          "Impostazioni esportate in: {0}" },
            { "log.export.error",       "Errore esportazione: {0}" },
            { "log.import.notfound",    "File pavo_settings_export.json non trovato sul Desktop." },
            { "log.import.ok",          "Impostazioni importate con successo." },
            { "log.import.error",       "Errore importazione: {0}" },
            { "log.restore.backup.start", "Avvio creazione punto di ripristino di Windows..." },
            { "log.restore.backup.ok",  "Punto di ripristino di sistema creato con successo!" },
            { "log.restore.backup.err", "Impossibile creare punto di ripristino: {0}" },
            { "log.restore.undo.start", "Ripristino di tutte le chiavi di registro modificate..." },
            { "log.restore.undo.done",  "Ripristino completato. {0}/{1} valori ripristinati correttamente." },
            { "log.ram.kill",           "Processo terminato: {0}" },
            { "log.ram.free.start",     "Avvio rilascio memoria Working Sets per tutti i processi utente..." },
            { "log.ram.free.done",      "Standby List ottimizzata. Ripuliti i working sets di {0} processi." },
            { "log.market.apply",       "Applicazione del profilo da Marketplace: {0}" },
            { "log.market.ok",          "Profilo '{0}' caricato ed applicato con successo." },
            { "log.market.error",       "Errore applicazione profilo: {0}" },
            { "log.market.load",        "Caricamento profilo locale esterno: {0}" },
            { "log.market.load.error",  "Impossibile caricare profilo: {0}" },
            { "log.gaming.add",         "Gioco aggiunto manualmente: {0}" },
            { "log.gaming.launch",      "Avvio del gioco: {0}" },
            { "log.gaming.hiperf",      "Piano energetico High Performance abilitato per sessione di gioco." },
            { "log.gaming.autocloser",  "Auto-Closer attivo: chiusura processi background (Chrome, Discord, Spotify)..." },
            { "log.gaming.hud.off",     "Overlay HUD disattivato." },
            { "log.gaming.hud.on",      "Overlay HUD attivato in primo piano." },
            { "log.gaming.restore",     "Rilevata chiusura gioco. Ripristino del piano energetico bilanciato." },
            { "log.driver.scan",        "Avvio scansione driver hardware..." },
            { "log.driver.scan.done",   "Scansione driver completata. Rilevati elementi da aggiornare." },
            { "log.driver.open",        "Apertura pagina ufficiale download driver per: {0}" },
            { "log.disk.scan",          "Scansione file maggiori di 100MB nelle cartelle utente..." },
            { "log.disk.scan.done",     "Scansione completata. Rilevati {0} file di grandi dimensioni." },
            { "log.disk.delete",        "File eliminato: {0}" },
            { "log.disk.delete.sim",    "Simulazione: eliminato file mockup {0}" },
            { "log.disk.cache.start",   "Avvio pulizia cache di sistema..." },
            { "log.disk.cache.done",    "Pulizia completata. Rimosse {0} chiavi/file cache temporanee." },
            { "log.disk.dup.start",     "Avvio scansione file duplicati nella cartella Download..." },
            { "log.disk.dup.found",     "Trovati {0} file duplicati." },
            { "log.disk.dup.none",      "Scansione completata. Nessun file duplicato trovato." },
            { "log.dash.quickfix",      "Esecuzione Quick Fix per categoria: {0}" },
            { "log.dash.uac",           "Avvio prompt UAC per riavviare con privilegi elevati..." },
            { "log.dash.startup",       "Reindirizzamento a Startup Manager..." },
            { "log.dash.temp",          "Cancellazione file temporanei..." },

            // New UI keys
            { "dash.card.health",       "Integrità PC" },
            { "dash.card.startup",      "Impatto Avvio" },
            { "dash.card.storage",      "Cache Disco" },
            { "dash.card.ram",          "Carico RAM" },
            { "dash.card.gaming",       "Gaming Pronto" },
            { "dash.network",           "Rete:" },
            { "gaming.grid.title",      "Titolo Gioco" },
            { "gaming.grid.source",     "Origine" },
            { "gaming.grid.profile",    "Profilo" },
            { "gaming.opt.category_header", "CATEGORIA" },
            { "gaming.btn.add",         "Aggiungi Eseguibile (.exe)" },
            { "gaming.btn.launch",      "Avvia Gioco Selezionato" },
            { "gaming.opts.title",      "OPZIONI GAMING HUB" },
            { "gaming.hud.title",       "Overlay Statistiche FPS" },
            { "gaming.hud.btn.enable",  "Abilita HUD Overlay" },
            { "gaming.hud.btn.disable", "Disabilita HUD Overlay" },
            { "gaming.power.title",     "Piano Energetico" },
            { "gaming.power.btn",       "Ripristina Bilanciato" },
            { "gaming.selectgame",      "Seleziona un gioco per avviarlo." },
            { "profile.fivem.desc",     "Ottimizza latenza pacchetti UDP, MMCSS audio/render priority e svuota la cache Standby RAM prima del caricamento asset." },
            { "profile.fortnite.desc",  "Massimizza la frequenza della CPU, sblocca la pianificazione HAGS ed elimina le registrazioni GameDVR in background." },
            { "profile.gtav.desc",      "Ottimizza l'allocazione memoria video, prioritizzazione thread di rendering e stabilità frame time." },
            { "profile.cod.desc",       "Pianificazione GPU accelerata (HAGS), elevata risposta di sistema e zero throttling di rete per scontro a fuoco reattivo." },
            { "log.gaming.hiperf.err",  "Impossibile impostare il piano ad alte prestazioni." },
            { "custom.taskbar.title",   "BARRA DELLE APPLICAZIONI" },
            { "custom.taskbar.desc",    "Personalizza l'allineamento, lo stile e il comportamento della taskbar." },
            { "custom.taskbar.align",   "Allineamento Icone" },
            { "custom.taskbar.align.desc", "Sposta le icone a sinistra o al centro della barra." },
            { "custom.val.left",        "Sinistra" },
            { "custom.val.center",      "Centro" },
            { "custom.taskbar.search",  "Barra di Ricerca" },
            { "custom.taskbar.search.desc", "Mostra o nascondi il box di ricerca Windows." },
            { "custom.val.hidden",      "Nascondi" },
            { "custom.val.icon",        "Icona" },
            { "custom.val.box",         "Barra" },
            { "custom.taskbar.trans",   "Barra Trasparente" },
            { "custom.taskbar.trans.desc", "Forza la trasparenza lucida (tweak OLED)." },
            { "custom.val.standard",    "Standard" },
            { "custom.val.transparent", "Trasparente" },
            { "custom.taskbar.autohide", "Nascondi Barra" },
            { "custom.taskbar.autohide.desc", "Nascondi automaticamente la taskbar." },
            { "custom.val.disabled",    "Disattivato" },
            { "custom.val.enabled",     "Attivo" },
            { "custom.explorer.title",  "ESPLORA FILE &amp; SHELL" },
            { "custom.explorer.desc",   "Tweak di sistema per le cartelle ed il menu contestuale legacy." },
            { "custom.explorer.ext",    "Estensioni File" },
            { "custom.explorer.ext.desc", "Mostra o nascondi estensioni note dei file (.exe, .txt)." },
            { "custom.val.show",        "Mostra" },
            { "custom.explorer.menu",   "Menu Win10 Classico" },
            { "custom.explorer.menu.desc", "Ripristina il classico menu del tasto destro (Win 11)." },
            { "custom.val.default11",   "Default 11" },
            { "custom.val.classico10",  "Classico 10" },
            { "custom.btn.explorer",    "Riavvia Esplora Risorse" },
            { "custom.theme.title",     "STILE &amp; TRASPARENZA TEMA" },
            { "custom.theme.desc",      "Regola le tonalità del sistema operativo ed effetti di sfocatura." },
            { "custom.theme.system",    "Tema di Sistema" },
            { "custom.theme.system.desc", "Passa dal tema chiaro a scuro per Windows e app." },
            { "custom.val.dark",        "Scuro" },
            { "custom.val.light",       "Chiaro" },
            { "custom.theme.trans",     "Effetti Trasparenza" },
            { "custom.theme.trans.desc", "Abilita gli effetti acrilici ed estetici nativi." },
            { "custom.cursor.title",    "PUNTATORE DEL MOUSE" },
            { "custom.cursor.desc",     "Regola le proporzioni e lo schema colori del cursore." },
            { "custom.cursor.size",     "Dimensione Cursore" },
            { "custom.cursor.size.desc", "Regola la grandezza del puntatore mouse." },
            { "custom.val.grande",      "Grande" },
            { "custom.val.moltogrange", "Molto Grande" },
            { "custom.val.gigante",     "Gigante" },
            { "custom.cursor.color",    "Colore Cursore" },
            { "custom.cursor.color.desc", "Modifica lo schema grafico dei puntatori." },
            { "custom.val.defaultaero", "Default Aero" },
            { "custom.val.neroclassico", "Nero Classico" },
            { "custom.val.neoninvertito", "Neon Invertito" },
            { "custom.btn.cursor",      "Applica Puntatore" },
        };

        // ─── ENGLISH ────────────────────────────────────────────────────────────
        private static readonly Dictionary<string, string> _en = new Dictionary<string, string>
        {
            // Navigation
            { "nav.dashboard",      "Dashboard" },
            { "nav.ai",             "AI Optimizer" },
            { "nav.custom",         "Windows Custom" },
            { "nav.gaming",         "Gaming Hub" },
            { "nav.driver",         "Driver Center" },
            { "nav.benchmark",      "Benchmarks" },
            { "nav.disk",           "Disk Tools" },
            { "nav.ram",            "RAM Manager" },
            { "nav.startup",        "Startup Apps" },
            { "nav.restore",        "Restore Center" },
            { "nav.market",         "Marketplace" },
            { "nav.settings",       "Settings" },
            { "nav.discord",        "Discord Support" },

            // Common buttons
            { "btn.save",           "Save" },
            { "btn.apply",          "Apply" },
            { "btn.cancel",         "Cancel" },
            { "btn.reset",          "Reset" },
            { "btn.refresh",        "Refresh" },
            { "btn.scan",           "Scan" },
            { "btn.clean",          "Clean" },
            { "btn.optimize",       "Optimize" },
            { "btn.start",          "Start" },
            { "btn.stop",           "Stop" },
            { "btn.enable",         "Enable" },
            { "btn.disable",        "Disable" },
            { "btn.delete",         "Delete" },
            { "btn.export",         "Export" },
            { "btn.import",         "Import" },
            { "btn.confirm",        "Confirm &amp; Apply" },
            { "btn.update",         "Update" },

            // Status labels
            { "status.admin",       "ADMINISTRATOR MODE" },
            { "status.user",        "USER MODE" },
            { "status.loading",     "Loading..." },
            { "status.done",        "Done!" },
            { "status.error",       "Error" },
            { "status.success",     "Success" },
            { "status.warning",     "Warning" },

            // Dashboard
            { "dash.score.title",   "PC OPTIMIZATION STATUS" },
            { "dash.score.desc",    "Score 0-100 representing the level of system cleanliness and optimal configuration." },
            { "dash.monitor.title", "LIVE HARDWARE MONITOR" },
            { "dash.quick.title",   "QUICK ACTIONS" },
            { "dash.cpu",           "CPU" },
            { "dash.gpu",           "GPU" },
            { "dash.ram",           "RAM" },
            { "dash.disk",          "Disk" },
            { "dash.temp",          "Temperature" },
            { "dash.usage",         "Usage" },
            { "dash.free",          "Free" },
            { "dash.drawer.health.title",   "PC Health &amp; Security Status" },
            { "dash.drawer.health.noadmin", "Not running as Administrator (Score: 60)" },
            { "dash.drawer.health.noadmin.item1", "Administrator privileges are required to apply advanced system optimizations." },
            { "dash.drawer.health.noadmin.item2", "Disk benchmarks might be blocked." },
            { "dash.drawer.health.admin",   "All health parameters are in order (Score: 100)" },
            { "dash.drawer.health.admin.item1", "Running as Administrator." },
            { "dash.drawer.health.admin.item2", "UAC privileges are configured correctly." },
            { "dash.drawer.startup.title",  "Startup Apps Analysis" },
            { "dash.drawer.startup.status", "Applications detected at startup" },
            { "dash.drawer.startup.item1",  "Unnecessary applications detected in 'Run' registry." },
            { "dash.drawer.startup.item2",  "It is recommended to delay the startup of non-critical applications in Startup Manager." },
            { "dash.drawer.storage.title",  "Disk Space &amp; Junk Files" },
            { "dash.drawer.storage.status", "Cache files detected" },
            { "dash.drawer.storage.item1",  "Free space on C: " },
            { "dash.drawer.storage.item2",  "User temporary files accumulated in Temp folder." },
            { "dash.drawer.ram.title",      "Background Memory Load" },
            { "dash.drawer.ram.status",     "High RAM Standby" },
            { "dash.drawer.ram.item1",      "Standby cache occupied by closed allocated pages." },
            { "dash.drawer.ram.item2",      "Clean cache memory to free real space." },
            { "dash.drawer.gaming.title",   "Gaming Hub Scheduling" },
            { "dash.drawer.gaming.status",  "Active profile optimization" },
            { "dash.drawer.gaming.item1",   "Power plan set to Balanced." },
            { "dash.drawer.gaming.item2",   "HUD overlay not displayed for FPS rates." },
            { "dash.card.health",           "PC Health" },
            { "dash.card.startup",          "Startup Impact" },
            { "dash.card.storage",          "Disk Cache" },
            { "dash.card.ram",              "RAM Load" },
            { "dash.card.gaming",           "Gaming Readiness" },
            { "dash.network",               "Network:" },
            { "log.dash.quickfix",          "Executing Quick Fix category: {0}" },
            { "log.dash.uac",               "Starting UAC prompt for elevated privileges..." },
            { "log.dash.startup",           "Redirecting to Startup Manager..." },
            { "log.dash.temp",              "Cleaning temporary files..." },

            // AI Optimizer
            { "ai.title",           "AI HARDWARE ANALYSIS" },
            { "ai.desc",            "Analyzes your hardware and suggests safe optimizations specific to your system." },
            { "ai.scan",            "Scan Hardware" },
            { "ai.hardware.info",   "Hardware Information" },
            { "ai.suggestions",     "AI Suggestions" },
            { "ai.warning.title",   "Confirm Optimization" },
            { "ai.warning.desc",    "You are about to apply a system change. The operation will be logged to allow rollback." },

            // Optimization items (English)
            { "opt.cpu_core_parking.title",   "Disable CPU Core Parking Tweak" },
            { "opt.cpu_core_parking.explain", "Your CPU ({0}) has {1} logical cores. Windows parks some cores to save power, causing micro-stuttering in games when they wake up. This tweak keeps all cores ready." },
            { "opt.cpu_core_parking.side",    "Slightly higher battery usage on laptops; no difference on desktops." },
            { "opt.gpu_hags.title",           "Enable Hardware Accelerated GPU Scheduling" },
            { "opt.gpu_hags.explain",         "Your graphics card ({0}) supports hardware-accelerated scheduling to reduce GPU latency and send video memory directly to game frame buffers." },
            { "opt.gpu_hags.side",            "May cause rare crashes with outdated drivers. Make sure to update drivers." },
            { "opt.gpu_nv_telemetry.title",   "Disable NVIDIA Telemetry Services" },
            { "opt.gpu_nv_telemetry.explain", "NVIDIA drivers contain a background telemetry daemon that collects and sends game data. Disabling it saves CPU cycles." },
            { "opt.gpu_nv_telemetry.side",    "None. GeForce Experience won't send statistical feedback to NVIDIA." },
            { "opt.ram_superfetch.title",     "SysMain Optimization for Low RAM" },
            { "opt.ram_superfetch.explain",   "Your PC has only {0:F1} GB of RAM. The SysMain (Superfetch) service pre-loads unused apps, saturating physical memory. We recommend disabling it." },
            { "opt.ram_superfetch.side",      "First-time app opening might take a second longer." },
            { "opt.ram_large_cache.title",    "Enable Large System Cache" },
            { "opt.ram_large_cache.explain",  "Your PC has {0:F1} GB of RAM (plenty). Windows can keep file allocation tables in memory instead of re-reading them, speeding up all OS loading." },
            { "opt.ram_large_cache.side",     "Consumes about 120 MB more of constant RAM in the background." },
            { "opt.storage_ssd_trim.title",   "Force Enable SSD TRIM Command" },
            { "opt.storage_ssd_trim.explain", "On drive C: (SSD), enabling TRIM ensures the flash controller cleans unused blocks immediately after deleting files, extending lifetime and speed." },
            { "opt.storage_ssd_trim.side",    "None. Valid for all modern SSDs." },
            { "opt.storage_hdd_comp.title",   "Disable Background NTFS Compression" },
            { "opt.storage_hdd_comp.explain", "Since your drive is an HDD (mechanical), dynamic background compression heavily stresses magnetic heads and slows down loading. Disabling compression reduces load." },
            { "opt.storage_hdd_comp.side",    "Files will occupy slightly more disk space." },
            { "opt.sys_process_grouping.title",   "Smart SvcHost Process Grouping" },
            { "opt.sys_process_grouping.explain", "On Windows 10/11, system services are split into dozens of separate svchost processes. This tweak safely merges svchost wrappers and pauses non-essential background services, reducing active background processes by up to 50." },
            { "opt.sys_process_grouping.side",      "None. Completely reversible and free of stability risks." },
            { "opt.status.optimized",         "Optimized" },
            { "opt.status.not_optimized",     "Not optimized" },

            // Pavo Game Optimizer (English)
            { "gaming.title",                   "PAVO GAME OPTIMIZER" },
            { "gaming.subtitle",                "Transparent and safe Windows optimization &amp; profiling system for maximum gaming performance." },
            { "gaming.mode.label",              "GAMING MODE" },
            { "gaming.mode.active",             "ACTIVE" },
            { "gaming.mode.inactive",           "DISABLED" },
            { "gaming.metric.cpu",              "LIVE CPU LOAD" },
            { "gaming.metric.ram",              "RAM MEMORY USAGE" },
            { "gaming.metric.processes",        "STARTUP &amp; PROCESSES" },
            { "gaming.metric.score",            "OPTIMIZER SCORE" },
            { "gaming.metric.cpu.sub",          "Real measured WMI data" },
            { "gaming.metric.ram.sub",          "Standby Cache included" },
            { "gaming.metric.gpu.protected",    "GPU drivers protected" },
            { "gaming.metric.os.sub",           "OS configuration status" },
            { "gaming.profiles.title",          "GAME PROFILES" },
            { "gaming.btn.addcustom",           "Add Custom Game (.exe)" },
            { "gaming.btn.hud.enable",          "Enable HUD Overlay" },
            { "gaming.btn.hud.disable",         "Disable HUD Overlay" },
            { "gaming.scan.title",              "WINDOWS DIAGNOSTICS RESULTS" },
            { "gaming.btn.scan",                "Scan Now" },
            { "gaming.btn.optimize",            "Optimize Now (1-Click)" },
            { "gaming.btn.restore",             "Restore Previous Settings" },
            { "gaming.grid.enable",             "Enable" },
            { "gaming.grid.category",           "Category" },
            { "gaming.grid.optimization",       "Optimization" },
            { "gaming.grid.status",             "Current Status" },
            { "gaming.grid.profile",            "Profile" },
            { "gaming.opt.category_header",     "CATEGORY" },
            { "gaming.opt.select_prompt",       "Select an optimization for details" },
            { "gaming.opt.select_desc",         "Click any row above to read the transparent technical explanation of the proposed change." },
            { "gaming.opt.safety_info",         "Safety: 100% reversible tweak with automatic registry backup before application." },
            { "profile.fivem.desc",             "Optimizes UDP packet latency, MMCSS audio/render priority, and clears Standby RAM cache before asset loading." },
            { "profile.fortnite.desc",          "Maximizes CPU clock frequency, unlocks HAGS scheduling, and disables background GameDVR recording." },
            { "profile.gtav.desc",              "Optimizes VRAM allocation, rendering thread priority, and frame time stability." },
            { "profile.cod.desc",               "Hardware-accelerated GPU scheduling (HAGS), high system responsiveness, and zero network throttling for responsive gunfights." },

            { "opt.game_mode.title",          "Windows Game Mode" },
            { "opt.game_mode.explain",        "Allocates CPU and GPU resources directly to active game windows and pauses background Windows updates during gameplay." },
            { "opt.game_mode.side",           "None. Native feature recommended by Microsoft for Windows 10 and 11." },
            { "opt.hags.title",               "Hardware-Accelerated GPU Scheduling (HAGS)" },
            { "opt.hags.explain",             "Allows the graphics card to directly manage its VRAM scheduling, reducing CPU overhead on frame times." },
            { "opt.hags.side",                "None on recent drivers. Improves stability in DirectX 12 and Vulkan titles." },
            { "opt.mmcss.title",              "MMCSS Gaming &amp; Rendering Priority" },
            { "opt.mmcss.explain",            "Configures Multimedia Class Scheduler (MMCSS) keys to grant maximum priority to game and audio threads over background tasks." },
            { "opt.mmcss.side",               "None. Reduces micro audio stutters and frame time fluctuations." },
            { "opt.net_throttling.title",     "Disable Network Throttling for Games" },
            { "opt.net_throttling.explain",   "Windows throttles non-multimedia network packets. Disabling throttling ensures instant transmission of game UDP packets." },
            { "opt.net_throttling.side",      "None for gaming. Reduces latency and ping spikes in online multiplayer games." },
            { "opt.sys_resp.title",           "System Responsiveness Optimization" },
            { "opt.sys_resp.explain",         "Sets SystemResponsiveness to 0 in registry so Windows allocates 100% of system resources to the active game application." },
            { "opt.sys_resp.side",            "None on modern PCs. Prevents system tasks from slowing down foreground games." },
            { "opt.gamedvr.title",            "Disable Background GameDVR Video Recording" },
            { "opt.gamedvr.explain",          "Xbox Game Bar background recording continuously consumes GPU encoder cycles and memory. Disabling DVR frees video resources." },
            { "opt.gamedvr.side",             "Game Bar automatic recording will be disabled (ShadowPlay/OBS continue to work normally)." },
            { "opt.power_plan.title",         "High Performance Gaming Power Plan" },
            { "opt.power_plan.explain",       "Forces CPU to remain at maximum clock speed (eliminating power state transition latency) and prevents core parking." },
            { "opt.power_plan.side",          "Slightly higher power consumption at idle on laptops." },
            { "opt.win32_priority.title",     "Windows Scheduler Quantum Boost (Win32PrioritySeparation 0x26)" },
            { "opt.win32_priority.explain",   "Assigns short, variable time quanta favored for the foreground process. Ensures CPU grants immediate priority to game logic." },
            { "opt.win32_priority.side",      "None. Standard performance optimization for gaming." },

            { "opt.disable_lastaccess.title", "Disk Write Optimization (Disable LastAccessUpdate)" },
            { "opt.disable_lastaccess.explain", "Disables the automatic update of the last accessed timestamp on NTFS files, reducing unnecessary background disk writes during gameplay." },
            { "opt.disable_lastaccess.side", "None. The last accessed file attribute will not be updated (creation and modification timestamps remain unaffected)." },
            { "opt.tcp_nodelay.title", "Network Latency Optimization (TCP NoDelay / Nagle)" },
            { "opt.tcp_nodelay.explain", "Disables Nagle's algorithm on all active network interfaces, immediately sending TCP/UDP packets. Minimizes latency and ping spikes." },
            { "opt.tcp_nodelay.side", "None. May slightly increase packet count, prioritizing lower ping over bandwidth saving." },
            { "opt.shader_cache.title", "DirectX Shader Cache Optimization & Clean" },
            { "opt.shader_cache.explain", "Cleans obsolete or corrupt DirectX shader cache files and configures NVIDIA/AMD shader cache size to 10GB to prevent stutters during texture compilation." },
            { "opt.shader_cache.side", "The very first launch of games after cleanup might take slightly longer as shaders compile." },

            // Settings
            { "settings.title",         "SETTINGS" },
            { "settings.general",       "General" },
            { "settings.appearance",    "Appearance" },
            { "settings.performance",   "Performance" },
            { "settings.audio",         "Audio" },
            { "settings.advanced",      "Advanced" },
            { "settings.language",      "Language" },
            { "settings.lang.it",       "🇮🇹 Italiano" },
            { "settings.lang.en",       "🇬🇧 English" },
            { "settings.startup",       "Start with Windows" },
            { "settings.tray",          "Minimize to Tray" },
            { "settings.updates",       "Check for Updates" },
            { "settings.notifications", "Notifications" },
            { "settings.theme",         "Theme" },
            { "settings.theme.dark",    "Dark" },
            { "settings.theme.soft",    "Soft Dark" },
            { "settings.theme.system",  "Automatic" },
            { "settings.accent",        "Accent Color" },
            { "settings.uiscale",       "UI Scale" },
            { "settings.animations",    "Animation Quality" },
            { "settings.anim.low",      "Low" },
            { "settings.anim.normal",   "Normal" },
            { "settings.anim.high",     "High" },
            { "settings.hwaccel",       "Hardware Acceleration" },
            { "settings.gpurender",     "GPU Rendering" },
            { "settings.memopt",        "Memory Optimization" },
            { "settings.fpslimit",      "FPS Limit" },
            { "settings.sounds",        "UI Sounds" },
            { "settings.clicksound",    "Click Sound" },
            { "settings.hoversound",    "Hover Sound" },
            { "settings.volume",        "Volume" },
            { "settings.reset",         "Restore Default Settings" },
            { "settings.clearcache",    "Clear Cache" },
            { "settings.restorepoint",  "Create Restore Point" },
            { "settings.export",        "Export Settings" },
            { "settings.import",        "Import Settings" },
            { "settings.devmode",       "Developer Mode" },
            { "settings.experimental",  "Experimental Features" },
            { "settings.saved",         "Settings saved!" },
            { "settings.reset.confirm", "All settings have been restored to defaults." },

            // Benchmark
            { "bench.cpu.title",    "CPU PROCESSOR BENCHMARK" },
            { "bench.cpu.desc",     "Parallel multi-thread prime number calculation to stress all cores." },
            { "bench.ram.title",    "RAM MEMORY BENCHMARK" },
            { "bench.ram.desc",     "Dynamic allocation and sequential read/write speed in virtual memory." },
            { "bench.disk.title",   "SYSTEM DISK BENCHMARK" },
            { "bench.disk.desc",    "Sequential write speed on C: partition." },
            { "bench.history",      "RESULTS HISTORY" },
            { "bench.clear",        "Clear History" },
            { "bench.start.cpu",    "Start CPU Test" },
            { "bench.start.ram",    "Start RAM Test" },
            { "bench.start.disk",   "Start Disk Test" },

            // Disk Tools
            { "disk.analyze.title", "DISK ANALYSIS" },
            { "disk.cache.title",   "CACHE &amp; JUNK FILE CLEANUP" },
            { "disk.cache.desc",    "Safely removes browser cache, temp files, crash logs and obsolete Windows Update files." },
            { "disk.clean.btn",     "Clean System Cache" },
            { "disk.analyze.btn",   "Analyze Disk" },

            // Driver Center
            { "driver.title",       "DRIVER CENTER" },
            { "driver.desc",        "Detects outdated GPU, chipset and network drivers and provides links to official download pages." },
            { "driver.scan.btn",    "Scan Drivers" },
            { "driver.nvidia",      "NVIDIA Drivers" },
            { "driver.amd",         "AMD Drivers" },
            { "driver.intel",       "Intel Drivers" },



            // RAM Manager
            { "ram.title",          "RAM MANAGER" },
            { "ram.free.btn",       "Free RAM" },
            { "ram.monitor",        "RAM Monitor" },
            { "ram.total",          "Total" },
            { "ram.used",           "In Use" },
            { "ram.available",      "Available" },
            { "ram.sysproc.title",       "SMART SYSTEM PROCESS OPTIMIZER" },
            { "ram.sysproc.desc",        "Analyzes system processes and safely merges svchost wrappers while pausing non-essential services. Reduces up to 50 active processes without touching drivers, kernel, or antivirus." },
            { "ram.sysproc.optimize",    "Optimize System Processes (-50)" },
            { "ram.sysproc.restore",     "Restore System Processes" },
            { "ram.sysproc.safe_badge",  "100% Safe & Reversible" },

            // Startup
            { "startup.title",      "STARTUP APPS" },
            { "startup.desc",       "Manage applications that start automatically with Windows." },
            { "startup.enable",     "Enable" },
            { "startup.disable",    "Disable" },
            { "startup.refresh",    "Refresh List" },

            // Restore
            { "restore.title",      "RESTORE CENTER" },
            { "restore.desc",       "Restore registry changes made by Pavo Tweak with a single click." },
            { "restore.backup",     "REGISTRY BACKUP" },
            { "restore.undo",       "Undo Change" },
            { "restore.undo.all",   "Undo All" },

            // Customization
            { "custom.accent",      "APPLICATION ACCENT COLOR" },
            { "custom.accent.desc", "Choose the primary color for the Pavo Tweak application." },
            { "custom.theme.packs", "THEME &amp; CURSOR PACKS" },
            { "custom.theme.packs.desc", "Apply mouse pointer schemes or Windows system folder icons." },
            { "custom.save.color",  "Save Color" },
            { "custom.taskbar.title",   "TASKBAR SETTINGS" },
            { "custom.taskbar.desc",    "Customize the taskbar alignment, style, and behavior." },
            { "custom.taskbar.align",   "Icon Alignment" },
            { "custom.taskbar.align.desc", "Move icons to the left or center of the taskbar." },
            { "custom.val.left",        "Left" },
            { "custom.val.center",      "Center" },
            { "custom.taskbar.search",  "Search Box Mode" },
            { "custom.taskbar.search.desc", "Show or hide the Windows search box." },
            { "custom.val.hidden",      "Hidden" },
            { "custom.val.icon",        "Icon" },
            { "custom.val.box",         "Search Box" },
            { "custom.taskbar.trans",   "Transparent Taskbar" },
            { "custom.taskbar.trans.desc", "Force glossy transparency (OLED tweak)." },
            { "custom.val.standard",    "Standard" },
            { "custom.val.transparent", "Transparent" },
            { "custom.taskbar.autohide", "Auto-Hide Taskbar" },
            { "custom.taskbar.autohide.desc", "Automatically hide the taskbar when not in use." },
            { "custom.val.disabled",    "Disabled" },
            { "custom.val.enabled",     "Enabled" },
            { "custom.explorer.title",  "FILE EXPLORER &amp; SHELL" },
            { "custom.explorer.desc",   "System tweaks for folders and legacy context menu." },
            { "custom.explorer.ext",    "File Extensions" },
            { "custom.explorer.ext.desc", "Show or hide known file extensions (.exe, .txt)." },
            { "custom.val.show",        "Show" },
            { "custom.explorer.menu",   "Classic Win10 Menu" },
            { "custom.explorer.menu.desc", "Restore the classic right-click context menu (Win 11)." },
            { "custom.val.default11",   "Default 11" },
            { "custom.val.classico10",  "Classic 10" },
            { "custom.btn.explorer",    "Restart File Explorer" },
            { "custom.theme.title",     "THEME STYLE &amp; TRANSPARENCY" },
            { "custom.theme.desc",      "Adjust operating system themes and blur effects." },
            { "custom.theme.system",    "System Theme" },
            { "custom.theme.system.desc", "Switch between dark and light themes for Windows and apps." },
            { "custom.val.dark",        "Dark" },
            { "custom.val.light",       "Light" },
            { "custom.theme.trans",     "Transparency Effects" },
            { "custom.theme.trans.desc", "Enable native acrylic and aesthetic transparency." },
            { "custom.cursor.title",    "MOUSE CURSOR OPTIONS" },
            { "custom.cursor.desc",     "Adjust mouse cursor size and color scheme." },
            { "custom.cursor.size",     "Cursor Size" },
            { "custom.cursor.size.desc", "Adjust the size of the mouse pointer." },
            { "custom.val.grande",      "Large" },
            { "custom.val.moltogrange", "Very Large" },
            { "custom.val.gigante",     "Huge" },
            { "custom.cursor.color",    "Cursor Color" },
            { "custom.cursor.color.desc", "Change the graphic scheme of pointers." },
            { "custom.val.defaultaero", "Default Aero" },
            { "custom.val.neroclassico", "Classic Black" },
            { "custom.val.neoninvertito", "Inverted Neon" },
            { "custom.btn.cursor",      "Apply Cursor Scheme" },

            // Marketplace
            { "market.title",       "MARKETPLACE" },
            { "market.desc",        "Browse themes, packs and additional tools for Pavo Tweak." },

            // Console
            { "console.title",      "OPERATIONS LOG — PAVO CONSOLE" },

            // Notifications / Toast
            { "toast.settings.saved",   "Settings saved!" },
            { "toast.lang.changed",     "Language changed!" },
            { "toast.cache.cleared",    "Cache cleared!" },
            { "toast.optimize.done",    "Optimization complete!" },
            { "toast.restore.done",     "Restore complete!" },

            // AI Optimizer log/confirm strings
            { "ai.warning.details",     "You are about to apply the following changes to the Windows Registry:\r\n\r\nTweak: {0}\r\nPath: {1}\r\nValue: {2} -> {3}\r\n\r\nTechnical Explanation:\r\n{4}\r\n\r\nSide Effects: {5}" },
            { "log.ai.approved",        "Registry optimization approved: {0}" },
            { "log.ai.success",         "Optimization '{0}' applied successfully." },
            { "log.ai.toast",           "Optimization applied!" },
            { "log.ai.error",           "Unable to apply optimization: {0}" },
            { "log.ai.error.dialog",    "Registry write error: {0}" },
        };
    }
}
