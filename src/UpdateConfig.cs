namespace PavoTweak
{
    /// <summary>
    /// Configuration for Pavo Tweak Update System.
    /// Change Version, UpdateUrl and configure your server update.json payload.
    /// </summary>
    public static class UpdateConfig
    {
        /// <summary>
        /// Current version of this executable build.
        /// </summary>
        public const string CurrentVersion = "2.4.0";

        /// <summary>
        /// The server endpoint returning the update JSON payload.
        /// Example JSON layout:
        /// {
        ///   "version": "1.0.1",
        ///   "url": "https://example.com/downloads/PavoTweak.exe",
        ///   "changelog": "- Risolti falsi positivi antivirus\n- Velocizzato caricamento iniziale"
        /// }
        /// </summary>
        public const string UpdateUrl = "https://raw.githubusercontent.com/dilaragionni-design/pavo-updates/main/update.json";
    }
}
