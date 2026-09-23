using System;
using System.IO;
using System.Net;
using System.Text;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using Microsoft.Win32;

namespace PavoTweak.Auth
{
    [DataContract]
    public class LicensePayload
    {
        [DataMember(Name = "licenseKey")]
        public string LicenseKey { get; set; }

        [DataMember(Name = "hwid")]
        public string Hwid { get; set; }
    }

    [DataContract]
    public class LicenseResponse
    {
        [DataMember(Name = "valid")]
        public bool Valid { get; set; }

        [DataMember(Name = "code")]
        public string Code { get; set; }

        [DataMember(Name = "message")]
        public string Message { get; set; }

        [DataMember(Name = "license_key")]
        public string LicenseKey { get; set; }

        [DataMember(Name = "status")]
        public string Status { get; set; }

        [DataMember(Name = "expires_at")]
        public string ExpiresAt { get; set; }

        [DataMember(Name = "activated_at")]
        public string ActivatedAt { get; set; }

        [DataMember(Name = "reason")]
        public string Reason { get; set; }

        [DataMember(Name = "signature")]
        public string Signature { get; set; }
    }

    public static class LicenseClient
    {
        // Default API Endpoint. Can be overridden in license_api.json or via ApiBaseUrl property.
        private static string _apiBaseUrl = "http://localhost:5000";
        private const string RegPath = @"Software\PavoTweak\Session";
        private const string RegKey = "LicenseKey";

        static LicenseClient()
        {
            // Initialize TLS 1.2
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | SecurityProtocolType.Tls | SecurityProtocolType.Tls11;
            }
            catch { }

            // Load API URL from optional local config file if it exists
            try
            {
                string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "license_api.json");
                if (File.Exists(configPath))
                {
                    string content = File.ReadAllText(configPath);
                    // Simple parsing for "apiUrl": "..."
                    int idx = content.IndexOf("\"apiUrl\"", StringComparison.OrdinalIgnoreCase);
                    if (idx >= 0)
                    {
                        int colon = content.IndexOf(':', idx);
                        int startQuote = content.IndexOf('"', colon + 1);
                        int endQuote = content.IndexOf('"', startQuote + 1);
                        if (startQuote >= 0 && endQuote > startQuote)
                        {
                            string url = content.Substring(startQuote + 1, endQuote - startQuote - 1).Trim();
                            if (!string.IsNullOrEmpty(url)) _apiBaseUrl = url.TrimEnd('/');
                        }
                    }
                }
            }
            catch { }
        }

        public static string ApiBaseUrl
        {
            get { return _apiBaseUrl; }
            set { if (!string.IsNullOrEmpty(value)) _apiBaseUrl = value.TrimEnd('/'); }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Hardware Identification (HWID)
        // ─────────────────────────────────────────────────────────────────────
        private static string _cachedHwid = null;

        public static string GetHwid()
        {
            if (!string.IsNullOrEmpty(_cachedHwid))
                return _cachedHwid;

            try
            {
                StringBuilder raw = new StringBuilder();

                // 1. Windows Machine GUID
                try
                {
                    using (var rk = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64)
                                                .OpenSubKey(@"SOFTWARE\Microsoft\Cryptography"))
                    {
                        if (rk != null)
                        {
                            object guid = rk.GetValue("MachineGuid");
                            if (guid != null) raw.Append(guid.ToString());
                        }
                    }
                }
                catch { }

                // 2. Windows User SID
                try
                {
                    var user = WindowsIdentity.GetCurrent().User;
                    if (user != null) raw.Append(user.Value);
                }
                catch { }

                // 3. Machine Name + OS Version fallback
                raw.Append(Environment.MachineName);
                raw.Append(Environment.OSVersion.VersionString);

                // Compute SHA-256 hash
                using (SHA256 sha = SHA256.Create())
                {
                    byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw.ToString()));
                    StringBuilder sb = new StringBuilder("PAVO-HWID-");
                    for (int i = 0; i < 16; i++)
                    {
                        sb.Append(bytes[i].ToString("X2"));
                    }
                    _cachedHwid = sb.ToString();
                    return _cachedHwid;
                }
            }
            catch
            {
                _cachedHwid = "PAVO-HWID-FALLBACK-" + Environment.MachineName.ToUpperInvariant();
                return _cachedHwid;
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // API Calls: Validate, Activate, Heartbeat
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Validates a license key against the online server without binding.
        /// </summary>
        public static LicenseResponse Validate(string key)
        {
            return SendRequest("/api/license/validate", key);
        }

        /// <summary>
        /// Activates a license key on the current machine and binds the HWID.
        /// </summary>
        public static LicenseResponse Activate(string key)
        {
            return SendRequest("/api/license/activate", key);
        }

        /// <summary>
        /// Periodic heartbeat to verify active status and detect bans in real-time.
        /// </summary>
        public static LicenseResponse Heartbeat(string key)
        {
            return SendRequest("/api/license/heartbeat", key);
        }

        // ─────────────────────────────────────────────────────────────────────
        // HTTP Communication
        // ─────────────────────────────────────────────────────────────────────
        private static LicenseResponse SendRequest(string endpoint, string licenseKey)
        {
            if (string.IsNullOrEmpty(licenseKey))
            {
                return new LicenseResponse
                {
                    Valid = false,
                    Code = "EMPTY_KEY",
                    Message = "Please enter a valid license key."
                };
            }

            string url = _apiBaseUrl + endpoint;
            string hwid = GetHwid();

            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "POST";
                req.ContentType = "application/json; charset=utf-8";
                req.UserAgent = "PavoTweakClient/1.0";
                req.Timeout = 8000; // 8 seconds timeout
                req.ReadWriteTimeout = 8000;

                string jsonBody = string.Format("{{\"licenseKey\":\"{0}\",\"hwid\":\"{1}\"}}",
                    EscapeJson(licenseKey.Trim().ToUpperInvariant()),
                    EscapeJson(hwid));

                byte[] postBytes = Encoding.UTF8.GetBytes(jsonBody);
                req.ContentLength = postBytes.Length;

                using (Stream stream = req.GetRequestStream())
                {
                    stream.Write(postBytes, 0, postBytes.Length);
                }

                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                using (Stream stream = res.GetResponseStream())
                using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
                {
                    string responseJson = reader.ReadToEnd();
                    return DeserializeJson<LicenseResponse>(responseJson);
                }
            }
            catch (WebException webEx)
            {
                if (webEx.Response != null)
                {
                    try
                    {
                        using (Stream stream = webEx.Response.GetResponseStream())
                        using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
                        {
                            string responseJson = reader.ReadToEnd();
                            LicenseResponse errRes = DeserializeJson<LicenseResponse>(responseJson);
                            if (errRes != null) return errRes;
                        }
                    }
                    catch { }
                }

                return new LicenseResponse
                {
                    Valid = false,
                    Code = "NETWORK_ERROR",
                    Message = "Could not reach the authentication server.\nPlease check your internet connection and try again.\n\nOffline access is not permitted."
                };
            }
            catch (Exception ex)
            {
                return new LicenseResponse
                {
                    Valid = false,
                    Code = "ERROR",
                    Message = "Authentication error: " + ex.Message
                };
            }
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        private static T DeserializeJson<T>(string json) where T : class
        {
            try
            {
                using (MemoryStream ms = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                {
                    DataContractJsonSerializer ser = new DataContractJsonSerializer(typeof(T));
                    return (T)ser.ReadObject(ms);
                }
            }
            catch
            {
                return null;
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Registry Session Token Management
        // ─────────────────────────────────────────────────────────────────────
        public static string LoadSavedToken()
        {
            try
            {
                using (var rk = Registry.CurrentUser.OpenSubKey(RegPath))
                {
                    if (rk == null) return null;
                    return rk.GetValue(RegKey) as string;
                }
            }
            catch { return null; }
        }

        public static void SaveToken(string token)
        {
            try
            {
                using (var rk = Registry.CurrentUser.CreateSubKey(RegPath))
                {
                    if (rk != null)
                    {
                        rk.SetValue(RegKey, token.Trim().ToUpperInvariant());
                    }
                }
            }
            catch { }
        }

        public static void ClearSavedToken()
        {
            try
            {
                Registry.CurrentUser.DeleteSubKey(RegPath, false);
            }
            catch { }
        }
    }
}
