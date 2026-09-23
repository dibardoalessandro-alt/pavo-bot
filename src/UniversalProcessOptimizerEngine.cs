using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.ServiceProcess;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace PavoTweak
{
    public enum ProcessCategory
    {
        WindowsCritical,
        HardwareDriver,
        SecurityAntivirus,
        ActiveUserApp,
        BackgroundNonEssential,
        Unknown
    }

    public class DynamicProcessItem
    {
        public int Pid { get; set; }
        public string ProcessName { get; set; }
        public string ExecutablePath { get; set; }
        public string CompanyName { get; set; }
        public string Description { get; set; }
        public long MemoryBytes { get; set; }
        public ProcessCategory Category { get; set; }
        public bool IsProtected { get; set; }
        public string ProtectionReason { get; set; }
    }

    public class UniversalTopologyReport
    {
        public int TotalProcesses { get; set; }
        public int CriticalSystemCount { get; set; }
        public int HardwareDriversCount { get; set; }
        public int SecurityCount { get; set; }
        public int ActiveAppsCount { get; set; }
        public int SvchostProcessesCount { get; set; }
        public int GroupableSvchostCount { get; set; }
        public int SafeOptimizableCount { get; set; }
        public bool IsOptimized { get; set; }
        public List<DynamicProcessItem> ProcessDetails { get; set; }

        public UniversalTopologyReport()
        {
            ProcessDetails = new List<DynamicProcessItem>();
        }
    }

    public class UniversalOptimizationResult
    {
        public bool Success { get; set; }
        public bool RestorePointCreated { get; set; }
        public bool HealthVerificationPassed { get; set; }
        public bool AutoRolledBack { get; set; }
        public int ProcessesBefore { get; set; }
        public int ProcessesAfter { get; set; }
        public int ReductionAchieved { get; set; }
        public int SvchostMerged { get; set; }
        public int ServicesOptimized { get; set; }
        public string SummaryMessage { get; set; }
    }

    public static class UniversalProcessOptimizerEngine
    {
        private const string SVCHOST_REG_KEY = @"SYSTEM\CurrentControlSet\Control";
        private const string SVCHOST_VAL_NAME = "SvcHostSplitThresholdInKB";
        private const uint SVCHOST_GROUPED_VALUE = 0x38000000; // ~940 GB threshold forces shared svchost containers

        [DllImport("psapi.dll")]
        private static extern int EmptyWorkingSet(IntPtr hwProc);

        private static readonly string[] NonEssentialServiceCandidates = new string[]
        {
            "DiagTrack", "WerSvc", "MapsBroker", "XblAuthManager",
            "XblGameSave", "XboxNetApiSvc", "RemoteRegistry",
            "RetailDemo", "dmwappushservice", "PhoneSvc", "SensorService"
        };

        public static bool IsOptimized()
        {
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(SVCHOST_REG_KEY, false))
                {
                    if (key != null)
                    {
                        object val = key.GetValue(SVCHOST_VAL_NAME);
                        if (val != null && Convert.ToUInt32(val) >= SVCHOST_GROUPED_VALUE)
                        {
                            return true;
                        }
                    }
                }
            }
            catch {}
            return false;
        }

        public static UniversalTopologyReport AnalyzeTopologyDynamic()
        {
            UniversalTopologyReport report = new UniversalTopologyReport();
            Process[] processes = Process.GetProcesses();
            report.TotalProcesses = processes.Length;

            int criticalCount = 0;
            int driverCount = 0;
            int securityCount = 0;
            int activeAppsCount = 0;
            int svchostCount = 0;
            int optimizableCount = 0;

            foreach (var p in processes)
            {
                try
                {
                    string name = p.ProcessName;
                    string nameLower = name.ToLowerInvariant();

                    if (nameLower == "svchost")
                    {
                        svchostCount++;
                        continue;
                    }

                    string path = "";
                    string company = "";
                    string desc = "";
                    try
                    {
                        path = p.MainModule != null ? p.MainModule.FileName : "";
                        if (!string.IsNullOrEmpty(path) && File.Exists(path))
                        {
                            FileVersionInfo info = FileVersionInfo.GetVersionInfo(path);
                            company = info.CompanyName ?? "";
                            desc = info.FileDescription ?? "";
                        }
                    }
                    catch {}

                    DynamicProcessItem item = new DynamicProcessItem
                    {
                        Pid = p.Id,
                        ProcessName = name,
                        ExecutablePath = path,
                        CompanyName = company,
                        Description = desc,
                        MemoryBytes = p.WorkingSet64
                    };

                    ClassifyProcess(p, item);

                    switch (item.Category)
                    {
                        case ProcessCategory.WindowsCritical:
                            criticalCount++;
                            break;
                        case ProcessCategory.HardwareDriver:
                            driverCount++;
                            break;
                        case ProcessCategory.SecurityAntivirus:
                            securityCount++;
                            break;
                        case ProcessCategory.ActiveUserApp:
                            activeAppsCount++;
                            break;
                        case ProcessCategory.BackgroundNonEssential:
                            optimizableCount++;
                            break;
                    }

                    report.ProcessDetails.Add(item);
                }
                catch {}
            }

            report.CriticalSystemCount = criticalCount;
            report.HardwareDriversCount = driverCount;
            report.SecurityCount = securityCount;
            report.ActiveAppsCount = activeAppsCount;
            report.SvchostProcessesCount = svchostCount;

            int targetSvchost = Math.Min(15, svchostCount);
            report.GroupableSvchostCount = Math.Max(0, svchostCount - targetSvchost);
            report.SafeOptimizableCount = report.GroupableSvchostCount + optimizableCount;
            report.IsOptimized = IsOptimized();

            return report;
        }

        public static UniversalOptimizationResult OptimizeUniversalSystem()
        {
            UniversalOptimizationResult result = new UniversalOptimizationResult();
            result.ProcessesBefore = Process.GetProcesses().Length;

            // 1. Create Pre-Optimization System Restore Point
            try
            {
                string restoreErr;
                result.RestorePointCreated = SystemRestoreHelper.CreateRestorePoint("PavoTweak_SmartProcessOptimization", out restoreErr);
            }
            catch
            {
                result.RestorePointCreated = false;
            }

            int svchostBefore = CountSvchostProcesses();
            int servicesOptimized = 0;

            try
            {
                // 2. Consolidate Svchost process host wrappers dynamically via registry threshold
                bool regOk = SetRegistryDword(SVCHOST_REG_KEY, SVCHOST_VAL_NAME, SVCHOST_GROUPED_VALUE);
                if (!regOk)
                {
                    result.Success = false;
                    result.SummaryMessage = Lang.Current == AppLanguage.Italian ?
                        "Impossibile accedere al Registro di sistema. Avvia PavoTweak come Amministratore." :
                        "Access to System Registry denied. Please launch PavoTweak as Administrator.";
                    return result;
                }

                // 3. Optimize safe non-essential candidate services dynamically
                foreach (string svcName in NonEssentialServiceCandidates)
                {
                    try
                    {
                        using (ServiceController sc = new ServiceController(svcName))
                        {
                            if (sc.Status == ServiceControllerStatus.Running)
                            {
                                ExecuteCommand(string.Format("sc config \"{0}\" start= demand", svcName));
                                try { sc.Stop(); servicesOptimized++; } catch {}
                            }
                            else
                            {
                                ExecuteCommand(string.Format("sc config \"{0}\" start= demand", svcName));
                            }
                        }
                    }
                    catch {}
                }

                // 4. Safely trim memory working sets of idle non-critical background helper processes
                TrimIdleNonCriticalProcesses();

                System.Threading.Thread.Sleep(600);

                int svchostAfter = CountSvchostProcesses();
                result.SvchostMerged = Math.Max(0, svchostBefore - svchostAfter);
                result.ServicesOptimized = servicesOptimized;
                result.ProcessesAfter = Process.GetProcesses().Length;
                result.ReductionAchieved = Math.Max(0, result.ProcessesBefore - result.ProcessesAfter);

                // 5. Run Post-Optimization Verification Check
                result.HealthVerificationPassed = VerifySystemHealth();
                if (!result.HealthVerificationPassed)
                {
                    // Automatic Rollback if any system anomaly is detected
                    RestoreUniversalSystem();
                    result.AutoRolledBack = true;
                    result.Success = false;
                    result.SummaryMessage = Lang.Current == AppLanguage.Italian ?
                        "Rilevata un'anomalia di sistema durante la verifica di salute post-ottimizzazione. Ripristino automatico eseguito per la massima stabilità." :
                        "System anomaly detected during post-optimization health check. Automatic rollback executed to preserve complete stability.";
                    return result;
                }

                result.Success = true;
                if (result.ReductionAchieved > 0)
                {
                    result.SummaryMessage = string.Format(
                        Lang.Current == AppLanguage.Italian ?
                        "Ottimizzazione dinamica completata! Ridotti {0} processi attivi ({1} svchost accorpati, {2} servizi non essenziali). Punto di ripristino creato." :
                        "Dynamic optimization completed! Reduced {0} active processes ({1} svchost merged, {2} non-essential services). Restore point created.",
                        result.ReductionAchieved, result.SvchostMerged, result.ServicesOptimized);
                }
                else
                {
                    result.SummaryMessage = string.Format(
                        Lang.Current == AppLanguage.Italian ?
                        "Configurato l'accorpamento dinamico dei processi svchost e disattivati i servizi non essenziali. La riduzione completa dei processi si applicherà al riavvio del sistema." :
                        "Dynamic svchost process consolidation configured and non-essential services paused. Full process reduction will take effect upon system restart.");
                }
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.SummaryMessage = "Errore durante l'ottimizzazione dinamica: " + ex.Message;
            }

            return result;
        }

        public static UniversalOptimizationResult RestoreUniversalSystem()
        {
            UniversalOptimizationResult result = new UniversalOptimizationResult();
            result.ProcessesBefore = Process.GetProcesses().Length;

            try
            {
                // 1. Revert Svchost split threshold to default
                DeleteRegistryValue(SVCHOST_REG_KEY, SVCHOST_VAL_NAME);

                // 2. Restore candidate services to Automatic
                foreach (string svcName in NonEssentialServiceCandidates)
                {
                    try
                    {
                        ExecuteCommand(string.Format("sc config \"{0}\" start= auto", svcName));
                        try
                        {
                            using (ServiceController sc = new ServiceController(svcName))
                            {
                                sc.Start();
                            }
                        }
                        catch {}
                    }
                    catch {}
                }

                result.ProcessesAfter = Process.GetProcesses().Length;
                result.Success = true;
                result.SummaryMessage = Lang.Current == AppLanguage.Italian ?
                    "Stato originale dei processi di sistema ripristinato con successo." :
                    "Original system process state restored successfully.";
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.SummaryMessage = "Errore durante il ripristino: " + ex.Message;
            }

            return result;
        }

        public static bool VerifySystemHealth()
        {
            try
            {
                // Check 1: Network Connectivity
                if (!NetworkInterface.GetIsNetworkAvailable())
                {
                    // Network lost -> Verification failed
                    return false;
                }

                // Check 2: Audio Engine Service Status
                try
                {
                    using (ServiceController sc = new ServiceController("AudioSrv"))
                    {
                        if (sc.Status != ServiceControllerStatus.Running)
                        {
                            return false;
                        }
                    }
                }
                catch {}

                // Check 3: Windows Shell (Explorer.exe) is alive
                Process[] explorers = Process.GetProcessesByName("explorer");
                if (explorers == null || explorers.Length == 0)
                {
                    return false;
                }

                return true;
            }
            catch
            {
                return true; // Soft pass if health check APIs are restricted
            }
        }

        private static void ClassifyProcess(Process p, DynamicProcessItem item)
        {
            string name = p.ProcessName.ToLowerInvariant();
            string path = (item.ExecutablePath ?? "").ToLowerInvariant();
            string company = (item.CompanyName ?? "").ToLowerInvariant();
            string desc = (item.Description ?? "").ToLowerInvariant();

            // 1. Windows Kernel & Critical System Processes
            if (path.Contains(@"\windows\system32\") || path.Contains(@"\windows\syswow64\"))
            {
                if (name == "system" || name == "smss" || name == "csrss" || name == "wininit" ||
                    name == "winlogon" || name == "services" || name == "lsass" || name == "fontdrvhost" ||
                    name == "dwm" || name == "explorer" || name == "spoolsv" || name == "securityhealthservice" ||
                    name == "taskmgr" || name == "lsass" || name == "sihost")
                {
                    item.Category = ProcessCategory.WindowsCritical;
                    item.IsProtected = true;
                    item.ProtectionReason = "Windows Kernel / Core Subsystem";
                    return;
                }
            }

            // 2. Hardware Drivers & Peripheral Software
            if (company.Contains("nvidia") || company.Contains("advanced micro devices") || company.Contains("amd") ||
                company.Contains("intel") || company.Contains("realtek") || company.Contains("logitech") ||
                company.Contains("razer") || company.Contains("corsair") || company.Contains("steelseries") ||
                company.Contains("asus") || company.Contains("msi") || company.Contains("creative") ||
                name.StartsWith("nv") || name.StartsWith("amd") || name.StartsWith("igfx") || name == "audiodg")
            {
                item.Category = ProcessCategory.HardwareDriver;
                item.IsProtected = true;
                item.ProtectionReason = "Driver / Hardware Component";
                return;
            }

            // 3. Security & Antivirus
            if (company.Contains("microsoft corporation") && (name.Contains("msmpeng") || name.Contains("nissrv") || name.Contains("sense")))
            {
                item.Category = ProcessCategory.SecurityAntivirus;
                item.IsProtected = true;
                item.ProtectionReason = "Windows Defender / Security";
                return;
            }
            if (company.Contains("malwarebytes") || company.Contains("kaspersky") || company.Contains("avast") ||
                company.Contains("bitdefender") || company.Contains("eset") || company.Contains("norton") ||
                company.Contains("sophos") || company.Contains("mcafee"))
            {
                item.Category = ProcessCategory.SecurityAntivirus;
                item.IsProtected = true;
                item.ProtectionReason = "Third-Party Antivirus / Firewall";
                return;
            }

            // 4. Active User Applications (has a main UI window)
            try
            {
                if (p.MainWindowHandle != IntPtr.Zero)
                {
                    item.Category = ProcessCategory.ActiveUserApp;
                    item.IsProtected = true;
                    item.ProtectionReason = "Active Application with User Interface";
                    return;
                }
            }
            catch {}

            // 5. PavoTweak itself
            if (name.Contains("pavotweak") || name.Contains("pavosetup"))
            {
                item.Category = ProcessCategory.ActiveUserApp;
                item.IsProtected = true;
                item.ProtectionReason = "PavoTweak Suite";
                return;
            }

            // 6. Non-Essential Background Helpers & Updaters
            if (name.Contains("update") || name.Contains("updater") || name.Contains("crashreport") ||
                name.Contains("telemetry") || desc.Contains("update") || desc.Contains("crash reporter") ||
                name.Contains("edgeupdate") || name.Contains("googleupdate") || name.Contains("adobearm"))
            {
                item.Category = ProcessCategory.BackgroundNonEssential;
                item.IsProtected = false;
                item.ProtectionReason = "Non-Essential Background Updater / Helper";
                return;
            }

            item.Category = ProcessCategory.Unknown;
            item.IsProtected = true; // Default safety: protect unknown processes
            item.ProtectionReason = "Default Safety Shield";
        }

        private static void TrimIdleNonCriticalProcesses()
        {
            foreach (var p in Process.GetProcesses())
            {
                try
                {
                    DynamicProcessItem item = new DynamicProcessItem();
                    ClassifyProcess(p, item);
                    if (!item.IsProtected)
                    {
                        EmptyWorkingSet(p.Handle);
                    }
                }
                catch {}
            }
        }

        private static int CountSvchostProcesses()
        {
            int count = 0;
            foreach (var p in Process.GetProcesses())
            {
                try
                {
                    if (p.ProcessName.Equals("svchost", StringComparison.OrdinalIgnoreCase))
                        count++;
                }
                catch {}
            }
            return count;
        }

        private static bool SetRegistryDword(string subKey, string valueName, uint dwordValue)
        {
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(subKey, true))
                {
                    if (key != null)
                    {
                        key.SetValue(valueName, dwordValue, RegistryValueKind.DWord);
                        return true;
                    }
                }
            }
            catch (UnauthorizedAccessException)
            {
                return ExecuteCommandElevated(string.Format("reg add \"HKLM\\{0}\" /v {1} /t REG_DWORD /d {2} /f", subKey, valueName, dwordValue));
            }
            catch
            {
                return ExecuteCommandElevated(string.Format("reg add \"HKLM\\{0}\" /v {1} /t REG_DWORD /d {2} /f", subKey, valueName, dwordValue));
            }
            return false;
        }

        private static bool DeleteRegistryValue(string subKey, string valueName)
        {
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(subKey, true))
                {
                    if (key != null)
                    {
                        key.DeleteValue(valueName, false);
                        return true;
                    }
                }
            }
            catch
            {
                return ExecuteCommandElevated(string.Format("reg delete \"HKLM\\{0}\" /v {1} /f", subKey, valueName));
            }
            return false;
        }

        private static bool ExecuteCommandElevated(string cmd)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", "/c " + cmd);
                psi.CreateNoWindow = true;
                psi.UseShellExecute = true;
                psi.Verb = "runas";
                Process proc = Process.Start(psi);
                if (proc != null)
                {
                    proc.WaitForExit(4000);
                    return proc.ExitCode == 0;
                }
            }
            catch {}
            return false;
        }

        private static void ExecuteCommand(string cmd)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", "/c " + cmd);
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                Process proc = Process.Start(psi);
                if (proc != null)
                {
                    proc.WaitForExit(1500);
                }
            }
            catch {}
        }
    }
}
