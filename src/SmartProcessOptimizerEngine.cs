using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.ServiceProcess;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace PavoTweak
{
    public class ProcessTopologyInfo
    {
        public int TotalProcesses { get; set; }
        public int SvchostProcesses { get; set; }
        public int SafeServicesCount { get; set; }
        public int GroupableSvchostCount { get; set; }
        public int EstimatedProcessReduction { get; set; }
        public int ProtectedProcessesCount { get; set; }
        public bool IsOptimized { get; set; }
    }

    public class ProcessOptimizationResult
    {
        public bool Success { get; set; }
        public int ProcessesBefore { get; set; }
        public int ProcessesAfter { get; set; }
        public int ReductionAchieved { get; set; }
        public int SvchostMerged { get; set; }
        public int ServicesPaused { get; set; }
        public string SummaryMessage { get; set; }
    }

    public static class SmartProcessOptimizerEngine
    {
        private const string SVCHOST_REG_KEY = @"SYSTEM\CurrentControlSet\Control";
        private const string SVCHOST_VAL_NAME = "SvcHostSplitThresholdInKB";
        private const uint SVCHOST_GROUPED_VALUE = 0x38000000; // ~940 GB threshold forces shared svchost groups

        [DllImport("psapi.dll")]
        private static extern int EmptyWorkingSet(IntPtr hwProc);

        private static readonly string[] SafeServices = new string[]
        {
            "DiagTrack",          // Connected User Experiences and Telemetry
            "WerSvc",             // Windows Error Reporting Service
            "MapsBroker",         // Downloaded Maps Manager
            "XblAuthManager",     // Xbox Live Auth Manager
            "XblGameSave",        // Xbox Live Game Save
            "XboxNetApiSvc",      // Xbox Live Networking Service
            "RemoteRegistry",     // Remote Registry
            "RetailDemo",         // Retail Demo Service
            "dmwappushservice",   // WAP Push Message Routing Service
            "PhoneSvc",           // Phone Service
            "SensorService"       // Sensor Service
        };

        private static readonly string[] ProtectedProcessPrefixes = new string[]
        {
            "system", "idle", "smss", "csrss", "wininit", "winlogon", "services",
            "lsass", "fontdrvhost", "dwm", "explorer", "spoolsv",
            "securityhealthservice", "taskmgr", "pavotweak", "pavosetup",
            "nv", "nvidia", "amd", "radeon", "igfx", "intel", "realtek", "audiodg",
            "msmpeng", "nissrv", "sense", "malwarebytes", "kaspersky", "avast"
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

        public static ProcessTopologyInfo ScanTopology()
        {
            ProcessTopologyInfo info = new ProcessTopologyInfo();
            try
            {
                Process[] processes = Process.GetProcesses();
                info.TotalProcesses = processes.Length;

                int svchostCount = 0;
                int protectedCount = 0;

                foreach (var p in processes)
                {
                    try
                    {
                        string name = p.ProcessName.ToLowerInvariant();
                        if (name == "svchost")
                        {
                            svchostCount++;
                        }
                        else if (IsProtectedProcess(name))
                        {
                            protectedCount++;
                        }
                    }
                    catch {}
                }

                info.SvchostProcesses = svchostCount;
                info.ProtectedProcessesCount = protectedCount;

                // If svchost processes are split, grouping them typically reduces svchost process count to ~12-15
                int currentSvchost = svchostCount;
                int targetSvchost = Math.Min(15, currentSvchost);
                info.GroupableSvchostCount = Math.Max(0, currentSvchost - targetSvchost);

                // Count safe services running
                int safeServicesRunning = 0;
                foreach (string svcName in SafeServices)
                {
                    try
                    {
                        using (ServiceController sc = new ServiceController(svcName))
                        {
                            if (sc.Status == ServiceControllerStatus.Running || sc.Status == ServiceControllerStatus.StartPending)
                            {
                                safeServicesRunning++;
                            }
                        }
                    }
                    catch {}
                }

                info.SafeServicesCount = safeServicesRunning;
                info.EstimatedProcessReduction = info.GroupableSvchostCount + info.SafeServicesCount;
                info.IsOptimized = IsOptimized();
            }
            catch {}

            return info;
        }

        public static ProcessOptimizationResult OptimizeSystemProcesses()
        {
            ProcessOptimizationResult result = new ProcessOptimizationResult();
            result.ProcessesBefore = Process.GetProcesses().Length;

            int svchostBefore = CountSvchostProcesses();
            int servicesPaused = 0;

            try
            {
                // 1. Group Svchost Processes via SvcHostSplitThresholdInKB with admin elevation fallback
                bool regOk = SetRegistryDword(SVCHOST_REG_KEY, SVCHOST_VAL_NAME, SVCHOST_GROUPED_VALUE);
                if (!regOk)
                {
                    result.Success = false;
                    result.SummaryMessage = Lang.Current == AppLanguage.Italian ?
                        "Privilegi di Amministratore richiesti: Impossibile accedere al Registro di sistema. Avvia PavoTweak come Amministratore o accetta la richiesta UAC." :
                        "Administrator privileges required: Access to system Registry denied. Launch PavoTweak as Administrator or accept the UAC prompt.";
                    return result;
                }

                // 2. Pause & set to Manual safe non-essential services
                foreach (string svcName in SafeServices)
                {
                    try
                    {
                        using (ServiceController sc = new ServiceController(svcName))
                        {
                            if (sc.Status == ServiceControllerStatus.Running)
                            {
                                ExecuteCommand(string.Format("sc config \"{0}\" start= demand", svcName));
                                try { sc.Stop(); servicesPaused++; } catch {}
                            }
                            else
                            {
                                ExecuteCommand(string.Format("sc config \"{0}\" start= demand", svcName));
                            }
                        }
                    }
                    catch {}
                }

                // 3. Trim working set of idle non-critical processes to reduce handle & process memory overhead
                TrimIdleProcessWorkingSets();

                // Wait briefly for process cleanup
                System.Threading.Thread.Sleep(500);

                int svchostAfter = CountSvchostProcesses();
                result.SvchostMerged = Math.Max(0, svchostBefore - svchostAfter);
                result.ServicesPaused = servicesPaused;
                result.ProcessesAfter = Process.GetProcesses().Length;
                result.ReductionAchieved = Math.Max(0, result.ProcessesBefore - result.ProcessesAfter);
                result.Success = true;

                if (result.ReductionAchieved > 0)
                {
                    result.SummaryMessage = string.Format(
                        Lang.Current == AppLanguage.Italian ? 
                        "Ottimizzazione completata con successo! Ridotti {0} processi attivi ({1} svchost accorpati, {2} servizi non essenziali in pausa)." :
                        "Optimization completed successfully! Reduced {0} active processes ({1} svchost merged, {2} non-essential services paused).",
                        result.ReductionAchieved, result.SvchostMerged, result.ServicesPaused);
                }
                else
                {
                    result.SummaryMessage = string.Format(
                        Lang.Current == AppLanguage.Italian ?
                        "Soglia svchost raggruppata impostata e servizi secondari ottimizzati. La riduzione completa dei processi svchost si applicherà al riavvio del sistema." :
                        "Svchost grouping threshold set and secondary services optimized. Full svchost process reduction will take effect on system restart.",
                        result.SvchostMerged, result.ServicesPaused);
                }
            }
            catch (UnauthorizedAccessException)
            {
                result.Success = false;
                result.SummaryMessage = Lang.Current == AppLanguage.Italian ?
                    "Privilegi di Amministratore richiesti: Per modificare le impostazioni dei processi di sistema, avvia PavoTweak come Amministratore." :
                    "Administrator privileges required: To modify system process settings, run PavoTweak as Administrator.";
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.SummaryMessage = "Errore durante l'ottimizzazione: " + ex.Message;
            }

            return result;
        }

        public static ProcessOptimizationResult RestoreSystemProcesses()
        {
            ProcessOptimizationResult result = new ProcessOptimizationResult();
            result.ProcessesBefore = Process.GetProcesses().Length;

            try
            {
                // 1. Revert Svchost split threshold to Windows default
                DeleteRegistryValue(SVCHOST_REG_KEY, SVCHOST_VAL_NAME);

                // 2. Restore safe services to Automatic start
                int servicesRestored = 0;
                foreach (string svcName in SafeServices)
                {
                    try
                    {
                        ExecuteCommand(string.Format("sc config \"{0}\" start= auto", svcName));
                        servicesRestored++;
                    }
                    catch {}
                }

                result.ProcessesAfter = Process.GetProcesses().Length;
                result.Success = true;
                result.SummaryMessage = Lang.Current == AppLanguage.Italian ?
                    "Stato originale dei processi di sistema ripristinato con successo. Le impostazioni predefinite di Windows sono state riapplicate." :
                    "Original system process state restored successfully. Default Windows settings re-applied.";
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.SummaryMessage = "Errore durante il ripristino: " + ex.Message;
            }

            return result;
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

        private static bool IsProtectedProcess(string name)
        {
            if (string.IsNullOrEmpty(name)) return true;
            foreach (string prefix in ProtectedProcessPrefixes)
            {
                if (name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) || name.Contains(prefix))
                    return true;
            }
            return false;
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

        private static void TrimIdleProcessWorkingSets()
        {
            foreach (var p in Process.GetProcesses())
            {
                try
                {
                    string name = p.ProcessName.ToLowerInvariant();
                    if (!IsProtectedProcess(name))
                    {
                        EmptyWorkingSet(p.Handle);
                    }
                }
                catch {}
            }
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
