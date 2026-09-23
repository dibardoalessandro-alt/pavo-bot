using System;
using System.Threading;
using System.Windows;
using PavoTweak.Auth;

namespace PavoTweak
{
    public class App : Application
    {
        [STAThread]
        public static void Main()
        {
            try
            {
                App app = new App();
                app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
                app.Startup += App_Startup;
                app.Run();
            }
            catch (Exception ex)
            {
                try { System.IO.File.WriteAllText("pavo_crash.log", ex.ToString()); }
                catch { }
                MessageBox.Show(
                    "Errore irreversibile durante l'avvio di Pavo Tweak.\n\n" +
                    "I dettagli sono stati salvati in 'pavo_crash.log'.\n\n" +
                    "Errore:\n" + ex.Message,
                    "Pavo Tweak - Errore Fatale",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Startup: ALWAYS validate with KeyAuth — no offline bypass ever.
        // ─────────────────────────────────────────────────────────────────────
        private static void App_Startup(object sender, StartupEventArgs e)
        {
            App app = (App)sender;

            string savedKey = PavoTweak.Auth.LicenseClient.LoadSavedToken();

            // ── Case A: We have a saved key — validate it with the server ────
            if (!string.IsNullOrEmpty(savedKey))
            {
                string denyReason = ValidateKeyOnline(savedKey);

                if (denyReason == null)
                {
                    // Key confirmed valid → launch immediately, skip login window
                    LaunchMainApp(app);
                    return;
                }

                // Key is banned / expired / revoked / unreachable — wipe it
                PavoTweak.Auth.LicenseClient.ClearSavedToken();

                // Show login window with the exact deny reason pre-filled
                ShowLoginAndLaunch(app, denyReason);
                return;
            }

            // ── Case B: No saved key — show login window ──────────────────────
            ShowLoginAndLaunch(app, null);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Contacts the Online Backend API and validates the given key.
        // Returns null on success, or a user-friendly error string on failure.
        // ─────────────────────────────────────────────────────────────────────
        internal static string ValidateKeyOnline(string key)
        {
            if (string.IsNullOrEmpty(key))
                return "Please enter a valid license key.";

            LicenseResponse res = null;
            bool done = false;

            Thread bgThread = new Thread(() =>
            {
                try
                {
                    res = LicenseClient.Validate(key);
                }
                catch (Exception ex)
                {
                    res = new LicenseResponse
                    {
                        Valid = false,
                        Code = "NETWORK_ERROR",
                        Message = "Could not reach the authentication server: " + ex.Message
                    };
                }
                finally
                {
                    done = true;
                }
            });
            bgThread.IsBackground = true;
            bgThread.Start();

            // Wait up to 8 seconds for the server to respond
            DateTime deadline = DateTime.UtcNow.AddSeconds(8);
            while (!done && DateTime.UtcNow < deadline)
                Thread.Sleep(50);

            if (!done || res == null)
            {
                // Timeout — treat as a network failure, deny offline access
                return "Could not reach the authentication server.\n" +
                       "Please check your internet connection and try again.\n\n" +
                       "Offline access is not permitted.";
            }

            if (res.Valid)
                return null; // success

            return TranslateDenyReason(res.Code, res.Message);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Shows the login window, optionally pre-displaying an error message.
        // Shuts the app down if the user closes the window without authenticating.
        // ─────────────────────────────────────────────────────────────────────
        private static void ShowLoginAndLaunch(App app, string preMessage)
        {
            LoginWindow login = new LoginWindow(preMessage);
            login.ShowDialog();

            if (!login.Authenticated)
            {
                app.Shutdown(0);
                return;
            }

            LaunchMainApp(app);
        }

        // ─────────────────────────────────────────────────────────────────────
        private static void LaunchMainApp(App app)
        {
            app.ShutdownMode = ShutdownMode.OnMainWindowClose;
            SplashWindow splash = new SplashWindow();
            app.MainWindow = splash;
            splash.Show();
        }

        // ─────────────────────────────────────────────────────────────────────
        // Converts backend API response codes into user-friendly strings.
        // ─────────────────────────────────────────────────────────────────────
        internal static string TranslateDenyReason(string code, string message)
        {
            if (string.IsNullOrEmpty(code))
                return string.IsNullOrEmpty(message)
                    ? "Invalid license. Please enter a valid license key."
                    : message;

            switch (code.ToUpperInvariant())
            {
                case "BANNED":
                    return "License banned. This license is no longer valid. Please enter a new license.";
                case "NOT_FOUND":
                case "INVALID":
                case "EMPTY_KEY":
                    return "Invalid license. Please enter a valid license key.";
                case "EXPIRED":
                    return "Your license has expired. Please renew your subscription.";
                case "REVOKED":
                    return "License revoked. Please contact support.";
                case "HWID_MISMATCH":
                    return "Hardware ID mismatch. This license is registered on another device.";
                case "NETWORK_ERROR":
                    return "Could not reach the authentication server.\nPlease check your internet connection and try again.\n\nOffline access is not permitted.";
                case "RATE_LIMITED":
                    return "Too many requests. Please wait a few minutes before trying again.";
                default:
                    return !string.IsNullOrEmpty(message) ? message : "Authentication failed.";
            }
        }
    }
}
