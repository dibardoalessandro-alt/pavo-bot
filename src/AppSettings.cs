using System;
using System.IO;
using System.Windows;
using System.Windows.Media;
using Microsoft.Win32;

namespace PavoTweak
{
    public enum AppTheme { Dark, SoftDark, System }
    public enum AnimQuality { Low, Normal, High }

    /// <summary>
    /// Persists all user preferences to %LocalAppData%\PavoTweak\settings.json
    /// </summary>
    public static class AppSettings
    {
        public static event Action SettingsChanged;

        private static string _settingsPath;

        // ── General ────────────────────────────────────────────────
        private static AppLanguage _language = AppLanguage.Italian;
        private static bool _startWithWindows = false;
        private static bool _minimizeToTray = false;
        private static bool _checkUpdates = true;
        private static bool _notificationsEnabled = true;

        // ── Appearance ─────────────────────────────────────────────
        private static AppTheme _theme = AppTheme.Dark;
        private static string _accentHex = "#3B82F6";
        private static double _uiScale = 1.0;
        private static bool _roundedCorners = true;
        private static double _blurIntensity = 0.0;
        private static double _transparency = 1.0;

        // ── Performance ────────────────────────────────────────────
        private static AnimQuality _animationQuality = AnimQuality.Normal;
        private static bool _hardwareAcceleration = true;
        private static bool _gpuRendering = true;
        private static bool _memoryOptimization = false;
        private static int _fpsLimit = 60;

        // ── Audio ──────────────────────────────────────────────────
        private static bool _soundsEnabled = true;
        private static bool _clickSoundEnabled = true;
        private static bool _hoverSoundEnabled = false;
        private static double _volume = 0.7;

        // ── Advanced ───────────────────────────────────────────────
        private static bool _developerMode = false;
        private static bool _experimentalFeatures = false;

        // Properties
        public static AppLanguage Language          { get { return _language; }          set { _language = value; } }
        public static bool StartWithWindows         { get { return _startWithWindows; }  set { _startWithWindows = value; } }
        public static bool MinimizeToTray           { get { return _minimizeToTray; }    set { _minimizeToTray = value; } }
        public static bool CheckUpdates             { get { return _checkUpdates; }      set { _checkUpdates = value; } }
        public static bool NotificationsEnabled     { get { return _notificationsEnabled; } set { _notificationsEnabled = value; } }
        public static AppTheme Theme                { get { return _theme; }             set { _theme = value; } }
        public static string AccentHex              { get { return _accentHex; }         set { _accentHex = value; } }
        public static double UIScale                { get { return _uiScale; }           set { _uiScale = value; } }
        public static bool RoundedCorners           { get { return _roundedCorners; }    set { _roundedCorners = value; } }
        public static double BlurIntensity          { get { return _blurIntensity; }     set { _blurIntensity = value; } }
        public static double Transparency           { get { return _transparency; }      set { _transparency = value; } }
        public static AnimQuality AnimationQuality  { get { return _animationQuality; }  set { _animationQuality = value; } }
        public static bool HardwareAcceleration     { get { return _hardwareAcceleration; } set { _hardwareAcceleration = value; } }
        public static bool GpuRendering             { get { return _gpuRendering; }      set { _gpuRendering = value; } }
        public static bool MemoryOptimization       { get { return _memoryOptimization; } set { _memoryOptimization = value; } }
        public static int FpsLimit                  { get { return _fpsLimit; }          set { _fpsLimit = value; } }
        public static bool SoundsEnabled            { get { return _soundsEnabled; }     set { _soundsEnabled = value; } }
        public static bool ClickSoundEnabled        { get { return _clickSoundEnabled; } set { _clickSoundEnabled = value; } }
        public static bool HoverSoundEnabled        { get { return _hoverSoundEnabled; } set { _hoverSoundEnabled = value; } }
        public static double Volume                 { get { return _volume; }            set { _volume = value; } }
        public static bool DeveloperMode            { get { return _developerMode; }     set { _developerMode = value; } }
        public static bool ExperimentalFeatures     { get { return _experimentalFeatures; } set { _experimentalFeatures = value; } }

        public static void Initialize()
        {
            string folder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "PavoTweak");
            if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);
            _settingsPath = Path.Combine(folder, "settings.json");
            Load();
        }

        public static void Save()
        {
            try
            {
                string json =
                    "{\n" +
                    "  \"Language\": \"" + _language + "\",\n" +
                    "  \"StartWithWindows\": " + _startWithWindows.ToString().ToLower() + ",\n" +
                    "  \"MinimizeToTray\": " + _minimizeToTray.ToString().ToLower() + ",\n" +
                    "  \"CheckUpdates\": " + _checkUpdates.ToString().ToLower() + ",\n" +
                    "  \"Notifications\": " + _notificationsEnabled.ToString().ToLower() + ",\n" +
                    "  \"Theme\": \"" + _theme + "\",\n" +
                    "  \"AccentHex\": \"" + _accentHex + "\",\n" +
                    "  \"UIScale\": " + _uiScale.ToString(System.Globalization.CultureInfo.InvariantCulture) + ",\n" +
                    "  \"RoundedCorners\": " + _roundedCorners.ToString().ToLower() + ",\n" +
                    "  \"BlurIntensity\": " + _blurIntensity.ToString(System.Globalization.CultureInfo.InvariantCulture) + ",\n" +
                    "  \"Transparency\": " + _transparency.ToString(System.Globalization.CultureInfo.InvariantCulture) + ",\n" +
                    "  \"AnimationQuality\": \"" + _animationQuality + "\",\n" +
                    "  \"HardwareAcceleration\": " + _hardwareAcceleration.ToString().ToLower() + ",\n" +
                    "  \"GpuRendering\": " + _gpuRendering.ToString().ToLower() + ",\n" +
                    "  \"MemoryOptimization\": " + _memoryOptimization.ToString().ToLower() + ",\n" +
                    "  \"FpsLimit\": " + _fpsLimit + ",\n" +
                    "  \"SoundsEnabled\": " + _soundsEnabled.ToString().ToLower() + ",\n" +
                    "  \"ClickSoundEnabled\": " + _clickSoundEnabled.ToString().ToLower() + ",\n" +
                    "  \"HoverSoundEnabled\": " + _hoverSoundEnabled.ToString().ToLower() + ",\n" +
                    "  \"Volume\": " + _volume.ToString(System.Globalization.CultureInfo.InvariantCulture) + ",\n" +
                    "  \"DeveloperMode\": " + _developerMode.ToString().ToLower() + ",\n" +
                    "  \"ExperimentalFeatures\": " + _experimentalFeatures.ToString().ToLower() + "\n" +
                    "}";
                File.WriteAllText(_settingsPath, json);
                ApplyStartupRegistry();
            }
            catch { }
        }

        public static void Load()
        {
            try
            {
                if (!File.Exists(_settingsPath)) return;
                string json = File.ReadAllText(_settingsPath);

                _language             = ReadEnum(json, "Language", AppLanguage.Italian);
                _startWithWindows     = ReadBool(json, "StartWithWindows", false);
                _minimizeToTray       = ReadBool(json, "MinimizeToTray", false);
                _checkUpdates         = ReadBool(json, "CheckUpdates", true);
                _notificationsEnabled = ReadBool(json, "Notifications", true);
                _theme                = ReadEnum(json, "Theme", AppTheme.Dark);
                _accentHex            = ReadString(json, "AccentHex", "#5865F2");
                _uiScale              = ReadDouble(json, "UIScale", 1.0);
                _roundedCorners       = ReadBool(json, "RoundedCorners", true);
                _blurIntensity        = ReadDouble(json, "BlurIntensity", 0.0);
                _transparency         = ReadDouble(json, "Transparency", 1.0);
                _animationQuality     = ReadEnum(json, "AnimationQuality", AnimQuality.Normal);
                _hardwareAcceleration = ReadBool(json, "HardwareAcceleration", true);
                _gpuRendering         = ReadBool(json, "GpuRendering", true);
                _memoryOptimization   = ReadBool(json, "MemoryOptimization", false);
                _fpsLimit             = ReadInt(json, "FpsLimit", 60);
                _soundsEnabled        = ReadBool(json, "SoundsEnabled", true);
                _clickSoundEnabled    = ReadBool(json, "ClickSoundEnabled", true);
                _hoverSoundEnabled    = ReadBool(json, "HoverSoundEnabled", false);
                _volume               = ReadDouble(json, "Volume", 0.7);
                _developerMode        = ReadBool(json, "DeveloperMode", false);
                _experimentalFeatures = ReadBool(json, "ExperimentalFeatures", false);
            }
            catch { }
        }

        public static void ResetToDefaults()
        {
            _language             = AppLanguage.Italian;
            _startWithWindows     = false;
            _minimizeToTray       = false;
            _checkUpdates         = true;
            _notificationsEnabled = true;
            _theme                = AppTheme.Dark;
            _accentHex            = "#5865F2";
            _uiScale              = 1.0;
            _roundedCorners       = true;
            _blurIntensity        = 0.0;
            _transparency         = 1.0;
            _animationQuality     = AnimQuality.Normal;
            _hardwareAcceleration = true;
            _gpuRendering         = true;
            _memoryOptimization   = false;
            _fpsLimit             = 60;
            _soundsEnabled        = true;
            _clickSoundEnabled    = true;
            _hoverSoundEnabled    = false;
            _volume               = 0.7;
            _developerMode        = false;
            _experimentalFeatures = false;
            Save();
            FireChanged();
        }

        public static void FireChanged()
        {
            if (SettingsChanged != null) SettingsChanged();
        }

        private static void ApplyStartupRegistry()
        {
            try
            {
                RegistryKey key = Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\Run", true);
                if (key == null) return;
                if (_startWithWindows)
                {
                    string exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
                    key.SetValue("PavoTweak", "\"" + exePath + "\"");
                }
                else
                {
                    key.DeleteValue("PavoTweak", false);
                }
                key.Close();
            }
            catch { }
        }

        // ── JSON helpers ───────────────────────────────────────────
        private static string ReadString(string json, string key, string def)
        {
            string search = "\"" + key + "\": \"";
            int idx = json.IndexOf(search);
            if (idx < 0) return def;
            int start = idx + search.Length;
            int end   = json.IndexOf("\"", start);
            return end < 0 ? def : json.Substring(start, end - start);
        }
        private static bool ReadBool(string json, string key, bool def)
        {
            string s = ReadRaw(json, key);
            if (s == null) return def;
            return s.Trim() == "true";
        }
        private static int ReadInt(string json, string key, int def)
        {
            string s = ReadRaw(json, key);
            int v; return (s != null && int.TryParse(s.Trim(), out v)) ? v : def;
        }
        private static double ReadDouble(string json, string key, double def)
        {
            string s = ReadRaw(json, key);
            double v; return (s != null && double.TryParse(s.Trim(),
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out v)) ? v : def;
        }
        private static T ReadEnum<T>(string json, string key, T def) where T : struct
        {
            string s = ReadString(json, key, null);
            if (s == null) return def;
            T v; return Enum.TryParse(s, out v) ? v : def;
        }
        private static string ReadRaw(string json, string key)
        {
            string search = "\"" + key + "\": ";
            int idx = json.IndexOf(search);
            if (idx < 0) return null;
            int start = idx + search.Length;
            int end   = json.IndexOfAny(new char[]{',','\n','}'}, start);
            return end < 0 ? null : json.Substring(start, end - start);
        }
    }
}
