// WindowsApiHelper.cs
// Provides clean, direct Windows API calls to replace hidden process spawning.
// Using documented Win32 APIs and WMI is the transparent, AV-safe approach
// versus launching powercfg.exe or powershell.exe in hidden windows.

using System;
using System.Runtime.InteropServices;
using System.Management;
using System.Diagnostics;

namespace PavoTweak
{
    /// <summary>
    /// Wrapper around direct Windows APIs for power plan management.
    /// Replaces hidden powercfg.exe process spawning.
    /// </summary>
    public static class PowerPlanHelper
    {
        // Well-known Windows power plan GUIDs
        public static readonly Guid Balanced      = new Guid("381b4222-f694-41f0-9685-ff5bb260df2e");
        public static readonly Guid HighPerf      = new Guid("8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c");
        public static readonly Guid PowerSaver    = new Guid("a1841308-3541-4fab-bc81-f71556f20b4a");

        [DllImport("powrprof.dll")]
        private static extern uint PowerSetActiveScheme(IntPtr UserRootPowerKey, ref Guid SchemeGuid);

        [DllImport("powrprof.dll")]
        private static extern uint PowerGetActiveScheme(IntPtr UserRootPowerKey, out IntPtr ActivePolicyGuid);

        [DllImport("kernel32.dll")]
        private static extern IntPtr LocalFree(IntPtr hMem);

        /// <summary>
        /// Sets the Windows power plan using the direct Win32 API.
        /// No hidden process is spawned.
        /// </summary>
        public static bool SetPlan(Guid planGuid)
        {
            try
            {
                uint result = PowerSetActiveScheme(IntPtr.Zero, ref planGuid);
                return result == 0;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Returns the GUID of the currently active power plan.
        /// </summary>
        public static Guid GetActivePlan()
        {
            try
            {
                IntPtr ptr;
                uint result = PowerGetActiveScheme(IntPtr.Zero, out ptr);
                if (result != 0) return Guid.Empty;
                Guid guid = (Guid)Marshal.PtrToStructure(ptr, typeof(Guid));
                LocalFree(ptr);
                return guid;
            }
            catch
            {
                return Guid.Empty;
            }
        }

        /// <summary>
        /// Returns true if the current power plan is High Performance.
        /// </summary>
        public static bool IsHighPerformanceActive()
        {
            return GetActivePlan() == HighPerf;
        }
    }

    /// <summary>
    /// Creates Windows System Restore checkpoints via WMI.
    /// Replaces hidden powershell.exe -Command "Checkpoint-Computer ..." calls.
    /// </summary>
    public static class SystemRestoreHelper
    {
        /// <summary>
        /// Creates a system restore point using the SystemRestore WMI class.
        /// Returns true on success. errorMessage is set on failure.
        /// Requires Administrator privileges and System Protection enabled on C:.
        /// </summary>
        public static bool CreateRestorePoint(string description, out string errorMessage)
        {
            errorMessage = null;
            try
            {
                // Use WMI SystemRestore.CreateRestorePoint
                // This is the exact same API that powershell Checkpoint-Computer calls internally.
                var scope = new ManagementScope(@"\\localhost\root\default");
                var classInstance = new ManagementClass(scope, new ManagementPath("SystemRestore"), null);
                ManagementBaseObject inParams = classInstance.GetMethodParameters("CreateRestorePoint");
                inParams["Description"]      = description;
                inParams["RestorePointType"] = 12;  // MODIFY_SETTINGS
                inParams["EventType"]        = 100; // BEGIN_SYSTEM_CHANGE

                ManagementBaseObject outParams = classInstance.InvokeMethod("CreateRestorePoint", inParams, null);
                uint returnValue = (uint)outParams["ReturnValue"];

                if (returnValue == 0)
                    return true;

                errorMessage = string.Format("WMI CreateRestorePoint returned {0}.", returnValue);
                return false;
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return false;
            }
        }
    }

    /// <summary>
    /// Reads real-time system performance metrics using standard Windows APIs.
    /// Replaces all Random() simulated values in the dashboard.
    /// </summary>
    public static class SystemMetrics
    {
        private static PerformanceCounter _cpuCounter;
        private static bool _cpuInitialized = false;

        [StructLayout(LayoutKind.Sequential)]
        private struct MEMORYSTATUSEX
        {
            public uint dwLength;
            public uint dwMemoryLoad;         // 0-100 % usage
            public ulong ullTotalPhys;
            public ulong ullAvailPhys;
            public ulong ullTotalPageFile;
            public ulong ullAvailPageFile;
            public ulong ullTotalVirtual;
            public ulong ullAvailVirtual;
            public ulong ullAvailExtendedVirtual;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

        /// <summary>
        /// Returns real CPU usage percentage (0-100).
        /// First call may return 0 — call once at startup to warm up the counter.
        /// </summary>
        public static int GetCpuPercent()
        {
            try
            {
                if (!_cpuInitialized)
                {
                    _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
                    _cpuCounter.NextValue(); // first call always returns 0 — discard
                    _cpuInitialized = true;
                    return 0;
                }
                return (int)_cpuCounter.NextValue();
            }
            catch
            {
                return 0;
            }
        }

        /// <summary>
        /// Returns real RAM usage percentage (0-100) via GlobalMemoryStatusEx.
        /// </summary>
        public static int GetRamPercent()
        {
            try
            {
                var mem = new MEMORYSTATUSEX();
                mem.dwLength = (uint)Marshal.SizeOf(mem);
                if (GlobalMemoryStatusEx(ref mem))
                    return (int)mem.dwMemoryLoad;
                return 0;
            }
            catch
            {
                return 0;
            }
        }

        /// <summary>
        /// Returns total physical RAM in GB.
        /// </summary>
        public static double GetRamTotalGb()
        {
            try
            {
                var mem = new MEMORYSTATUSEX();
                mem.dwLength = (uint)Marshal.SizeOf(mem);
                if (GlobalMemoryStatusEx(ref mem))
                    return mem.ullTotalPhys / 1024.0 / 1024.0 / 1024.0;
                return 0;
            }
            catch
            {
                return 0;
            }
        }

        /// <summary>
        /// Returns free physical RAM in GB.
        /// </summary>
        public static double GetRamFreeGb()
        {
            try
            {
                var mem = new MEMORYSTATUSEX();
                mem.dwLength = (uint)Marshal.SizeOf(mem);
                if (GlobalMemoryStatusEx(ref mem))
                    return mem.ullAvailPhys / 1024.0 / 1024.0 / 1024.0;
                return 0;
            }
            catch
            {
                return 0;
            }
        }
    }
}
