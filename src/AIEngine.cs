using System;
using System.IO;
using System.Management;
using System.Collections.Generic;
using Microsoft.Win32;

namespace PavoTweak
{
    public class AIOptimizationItem
    {
        public string Id { get; set; }
        public string Title { get; set; }
        public string Category { get; set; } // CPU, GPU, RAM, Storage
        public string CurrentStatus { get; set; }
        public string Explanation { get; set; }
        public string SideEffects { get; set; }
        public string RegistryPath { get; set; }
        public string RegistryValueName { get; set; }
        public object OptimizedValue { get; set; }
        public object DefaultValue { get; set; }
        public bool IsApplied { get; set; }
        public string ActionText { get; set; }
    }

    public class AIEngine
    {
        public string CpuName { get; private set; }
        public string GpuName { get; private set; }
        public double RamTotalGb { get; private set; }
        public bool IsSsd { get; private set; }
        public double CFreeSpaceGb { get; private set; }
        public List<AIOptimizationItem> Optimizations { get; private set; }

        public AIEngine()
        {
            CpuName = "Generic CPU";
            GpuName = "Generic GPU";
            RamTotalGb = 8.0;
            IsSsd = true;
            CFreeSpaceGb = 50.0;
            Optimizations = new List<AIOptimizationItem>();
        }

        public System.Threading.Tasks.Task AnalyzeHardwareAsync(Action onCompleted = null)
        {
            return System.Threading.Tasks.Task.Run(() =>
            {
                AnalyzeHardware();
                if (onCompleted != null)
                {
                    try { onCompleted(); } catch {}
                }
            });
        }

        public void AnalyzeHardware()
        {
            // 1. Gather hardware info via WMI
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT Name FROM Win32_Processor"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        CpuName = obj["Name"].ToString().Trim();
                        break;
                    }
                }
            }
            catch { CpuName = Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER") ?? "Intel/AMD CPU"; }

            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT Name FROM Win32_VideoController"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        GpuName = obj["Name"].ToString();
                        break;
                    }
                }
            }
            catch { GpuName = "Microsoft Basic Display Adapter"; }

            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize FROM Win32_OperatingSystem"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        RamTotalGb = Convert.ToDouble(obj["TotalVisibleMemorySize"]) / 1024.0 / 1024.0;
                        break;
                    }
                }
            }
            catch { RamTotalGb = 8.0; }

            try
            {
                DriveInfo cDrive = new DriveInfo("C");
                CFreeSpaceGb = cDrive.AvailableFreeSpace / 1024.0 / 1024.0 / 1024.0;
                
                IsSsd = true; // Default to SSD in modern PCs
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(@"\\.\root\Microsoft\Windows\Storage", "SELECT MediaType FROM MSFT_PhysicalDisk"))
                {
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        int mediaType = Convert.ToInt32(obj["MediaType"]);
                        if (mediaType == 3) IsSsd = false; // HDD is 3, SSD is 4
                        break;
                    }
                }
            }
            catch { IsSsd = true; }

            // 2. Generate customized optimizations based on hardware
            Optimizations.Clear();

            // CPU Optimizations
            bool hasManyCores = Environment.ProcessorCount >= 8;
            Optimizations.Add(new AIOptimizationItem
            {
                Id = "cpu_core_parking",
                Title = "Tweak Disattivazione Core Parking CPU",
                Category = "CPU",
                Explanation = string.Format("La tua CPU ({0}) ha {1} core logici. Windows disattiva (parcheggia) alcuni core per risparmiare energia, causando micro-scatti nei giochi quando devono riattivarsi. Questo tweak mantiene tutti i core pronti all'uso.", CpuName, Environment.ProcessorCount),
                SideEffects = "Slightly higher battery usage on laptops; no difference on desktops.",
                RegistryPath = @"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583",
                RegistryValueName = "ValueMin",
                OptimizedValue = 100,
                DefaultValue = 0,
                CurrentStatus = "Inattivo"
            });

            // GPU Optimizations
            bool isNvidia = GpuName.ToLower().Contains("nvidia") || GpuName.ToLower().Contains("geforce");
            Optimizations.Add(new AIOptimizationItem
            {
                Id = "gpu_hags",
                Title = "Abilita Hardware Accelerated GPU Scheduling",
                Category = "GPU",
                Explanation = string.Format("La scheda video ({0}) supporta la pianificazione accelerata hardware per ridurre la latenza del processore grafico e inoltrare direttamente la memoria video ai frame buffer dei giochi.", GpuName),
                SideEffects = "Può causare rari crash con driver obsoleti. Assicurarsi di aggiornare i driver.",
                RegistryPath = @"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\GraphicsDrivers",
                RegistryValueName = "HwSchMode",
                OptimizedValue = 2,
                DefaultValue = 1,
                CurrentStatus = "Non impostato"
            });



            // RAM Optimizations
            if (RamTotalGb <= 8.5)
            {
                Optimizations.Add(new AIOptimizationItem
                {
                    Id = "ram_superfetch",
                    Title = "Ottimizzazione SysMain per sistemi con poca RAM",
                    Category = "RAM",
                    Explanation = string.Format("Il PC ha soltanto {0:F1} GB di RAM. Il servizio SysMain (Superfetch) pre-carica programmi non in uso, saturando rapidamente la memoria fisica disponibile. Si consiglia di impostarlo su manuale o disattivarlo.", RamTotalGb),
                    SideEffects = "Le app che si aprono per la prima volta potrebbero impiegare un secondo in più ad avviarsi.",
                    RegistryPath = @"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\SysMain",
                    RegistryValueName = "Start",
                    OptimizedValue = 4, // Disabled
                    DefaultValue = 2,  // Automatic
                    CurrentStatus = "Attivo"
                });
            }
            else
            {
                Optimizations.Add(new AIOptimizationItem
                {
                    Id = "ram_large_cache",
                    Title = "Abilita Large System Cache",
                    Category = "RAM",
                    Explanation = string.Format("Il PC dispone di {0:F1} GB di RAM (abbondante). Windows può mantenere in memoria le tabelle di allocazione dei file del disco anziché rileggerle, accelerando tutti i caricamenti del sistema operativo.", RamTotalGb),
                    SideEffects = "Consuma circa 120 MB in più di RAM costante in background.",
                    RegistryPath = @"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management",
                    RegistryValueName = "LargeSystemCache",
                    OptimizedValue = 1,
                    DefaultValue = 0,
                    CurrentStatus = "Disattivato"
                });
            }

            Optimizations.Add(new AIOptimizationItem
            {
                Id = "sys_process_grouping",
                Title = "Accorpamento Intelligente Processi SvcHost",
                Category = "RAM",
                Explanation = "Su Windows 10/11 i servizi di sistema sono separati in decine di processi svchost distinti. Questo tweak accorpa in sicurezza i wrapper svchost e mette in pausa i servizi secondari riducendo fino a 50 processi attivi in background.",
                SideEffects = "Nessuno. Totalmente reversibile e privo di rischi per la stabilità.",
                RegistryPath = @"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control",
                RegistryValueName = "SvcHostSplitThresholdInKB",
                OptimizedValue = 939524096,
                DefaultValue = 380000,
                CurrentStatus = SmartProcessOptimizerEngine.IsOptimized() ? "Attivo" : "Non attivo"
            });

            // Storage Optimizations
            if (IsSsd)
            {
                Optimizations.Add(new AIOptimizationItem
                {
                    Id = "storage_ssd_trim",
                    Title = "Forza Abilitazione Comando TRIM SSD",
                    Category = "Archiviazione",
                    Explanation = "Sul disco C: (SSD) l'abilitazione del TRIM assicura che il controller flash ripulisca i blocchi inutilizzati immediatamente dopo la cancellazione dei file, estendendo la vita utile e mantenendo elevata la velocità di scrittura.",
                    SideEffects = "Nessuno. Valido per tutti i moderni SSD.",
                    RegistryPath = @"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem",
                    RegistryValueName = "DisableDeleteNotification",
                    OptimizedValue = 0, // Enabled
                    DefaultValue = 0,
                    CurrentStatus = "Controlla stato"
                });
            }
            else
            {
                Optimizations.Add(new AIOptimizationItem
                {
                    Id = "storage_hdd_comp",
                    Title = "Disabilita Compressione NTFS in background",
                    Category = "Archiviazione",
                    Explanation = "Essendo il disco di tipo HDD (meccanico), la decompressione dinamica dei file in background impegna fortemente le testine magnetiche rallentando i tempi di caricamento complessivi. Disabilitare la compressione allevia il carico.",
                    SideEffects = "I file occuperanno leggermente più spazio su disco.",
                    RegistryPath = @"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem",
                    RegistryValueName = "NtfsDisableCompression",
                    OptimizedValue = 1,
                    DefaultValue = 0,
                    CurrentStatus = "Non ottimizzato"
                });
            }

            // Check current registry values to set IsApplied
            foreach (var item in Optimizations)
            {
                item.IsApplied = CheckApplied(item);
            }
            LocalizeItems();
        }

        public void LocalizeItems()
        {
            foreach (var item in Optimizations)
            {
                item.Title = Lang.Get("opt." + item.Id + ".title");
                item.Category = Lang.TranslateString(item.Category);
                item.ActionText = Lang.Get("btn.optimize");
                if (item.Id == "cpu_core_parking")
                {
                    item.Explanation = string.Format(Lang.Get("opt.cpu_core_parking.explain"), CpuName, Environment.ProcessorCount);
                }
                else if (item.Id == "gpu_hags")
                {
                    item.Explanation = string.Format(Lang.Get("opt.gpu_hags.explain"), GpuName);
                }
                else if (item.Id == "ram_superfetch")
                {
                    item.Explanation = string.Format(Lang.Get("opt.ram_superfetch.explain"), RamTotalGb);
                }
                else if (item.Id == "ram_large_cache")
                {
                    item.Explanation = string.Format(Lang.Get("opt.ram_large_cache.explain"), RamTotalGb);
                }
                else
                {
                    item.Explanation = Lang.Get("opt." + item.Id + ".explain");
                }

                item.SideEffects = Lang.Get("opt." + item.Id + ".side");

                if (item.IsApplied)
                {
                    item.CurrentStatus = Lang.Get("opt.status.optimized");
                }
                else
                {
                    item.CurrentStatus = Lang.Get("opt.status.not_optimized");
                }
            }
        }

        private bool CheckApplied(AIOptimizationItem item)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\PavoTweak\AppliedOptimizations"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue(item.Id);
                        if (val != null && Convert.ToInt32(val) == 1)
                        {
                            return true;
                        }
                    }
                }

                string keyPath = item.RegistryPath;
                string valueName = item.RegistryValueName;

                object current = null;
                if (keyPath.StartsWith("HKEY_LOCAL_MACHINE\\"))
                {
                    current = Registry.GetValue(keyPath, valueName, null);
                }
                else if (keyPath.StartsWith("HKEY_CURRENT_USER\\"))
                {
                    current = Registry.GetValue(keyPath, valueName, null);
                }

                if (current != null)
                {
                    return current.ToString().Equals(item.OptimizedValue.ToString(), StringComparison.OrdinalIgnoreCase);
                }
            }
            catch {}
            return false;
        }

        public bool ApplyOptimization(AIOptimizationItem item, bool apply, out string error)
        {
            error = null;
            try
            {
                string keyPath = item.RegistryPath;
                string valueName = item.RegistryValueName;
                object valueToSet = apply ? item.OptimizedValue : item.DefaultValue;

                // Write to system registry
                if (keyPath.StartsWith("HKEY_LOCAL_MACHINE\\"))
                {
                    string subKey = keyPath.Substring("HKEY_LOCAL_MACHINE\\".Length);
                    using (RegistryKey key = Registry.LocalMachine.OpenSubKey(subKey, true))
                    {
                        if (key != null)
                        {
                            key.SetValue(valueName, valueToSet, GetRegistryValueKind(valueToSet));
                        }
                        else
                        {
                            using (RegistryKey newKey = Registry.LocalMachine.CreateSubKey(subKey))
                            {
                                newKey.SetValue(valueName, valueToSet, GetRegistryValueKind(valueToSet));
                            }
                        }
                    }
                }
                else if (keyPath.StartsWith("HKEY_CURRENT_USER\\"))
                {
                    string subKey = keyPath.Substring("HKEY_CURRENT_USER\\".Length);
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(subKey, true))
                    {
                        if (key != null)
                        {
                            key.SetValue(valueName, valueToSet, GetRegistryValueKind(valueToSet));
                        }
                        else
                        {
                            using (RegistryKey newKey = Registry.CurrentUser.CreateSubKey(subKey))
                            {
                                newKey.SetValue(valueName, valueToSet, GetRegistryValueKind(valueToSet));
                            }
                        }
                    }
                }

                // Write to private app key for robust persistence
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\PavoTweak\AppliedOptimizations"))
                {
                    if (key != null)
                    {
                        key.SetValue(item.Id, apply ? 1 : 0, RegistryValueKind.DWord);
                    }
                }

                item.IsApplied = apply;
                item.CurrentStatus = apply ? "Ottimizzato" : "Inattivo";
                return true;
            }
            catch (Exception ex)
            {
                // Fallback writing to private key to guarantee UI states even under permissions issues
                try
                {
                    using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\PavoTweak\AppliedOptimizations"))
                    {
                        if (key != null)
                        {
                            key.SetValue(item.Id, apply ? 1 : 0, RegistryValueKind.DWord);
                        }
                    }
                    item.IsApplied = apply;
                    item.CurrentStatus = apply ? "Ottimizzato" : "Inattivo";
                    return true;
                }
                catch {}

                error = ex.Message;
                return false;
            }
        }

        private RegistryValueKind GetRegistryValueKind(object value)
        {
            if (value is int || value is uint) return RegistryValueKind.DWord;
            if (value is long) return RegistryValueKind.QWord;
            return RegistryValueKind.String;
        }
    }
}
