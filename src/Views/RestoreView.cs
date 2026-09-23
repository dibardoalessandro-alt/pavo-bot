using System;
using System.IO;
using System.Xml;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Windows.Markup;
using System.Windows.Media;
using System.Collections.Generic;
using System.Diagnostics;
using Microsoft.Win32;
using System.Threading.Tasks;

namespace PavoTweak
{
    public class BackupEntry
    {
        public string Timestamp { get; set; }
        public string RegistryPath { get; set; }
        public string ValueName { get; set; }
        public string OriginalValue { get; set; }
    }

    public static class RegistryBackupManager
    {
        private static string backupFilePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PavoTweak", "pavo_revert_log.json");

        public static void RecordBackup(string path, string name, object originalValue)
        {
            try
            {
                var entries = GetEntries();
                
                // Do not overwrite initial backup of same registry key to prevent capturing optimized state as original
                if (entries.Exists(e => e.RegistryPath.Equals(path, StringComparison.OrdinalIgnoreCase) && 
                                        e.ValueName.Equals(name, StringComparison.OrdinalIgnoreCase)))
                {
                    return;
                }

                entries.Add(new BackupEntry {
                    Timestamp = DateTime.Now.ToString("dd MMM yyyy HH:mm"),
                    RegistryPath = path,
                    ValueName = name,
                    OriginalValue = originalValue != null ? originalValue.ToString() : ""
                });

                SaveEntries(entries);
            }
            catch {}
        }

        public static List<BackupEntry> GetEntries()
        {
            var list = new List<BackupEntry>();
            try
            {
                if (File.Exists(backupFilePath))
                {
                    string json = File.ReadAllText(backupFilePath);
                    int index = 0;
                    while (true)
                    {
                        int start = json.IndexOf("{", index);
                        if (start == -1) break;
                        int end = json.IndexOf("}", start);
                        if (end == -1) break;

                        string block = json.Substring(start, end - start + 1);
                        string timestamp = GetJsonValue(block, "Timestamp");
                        string path = GetJsonValue(block, "RegistryPath");
                        string name = GetJsonValue(block, "ValueName");
                        string val = GetJsonValue(block, "OriginalValue");

                        list.Add(new BackupEntry { Timestamp = timestamp, RegistryPath = path, ValueName = name, OriginalValue = val });
                        index = end + 1;
                    }
                }
            }
            catch {}
            return list;
        }

        private static string GetJsonValue(string block, string key)
        {
            string search = "\"" + key + "\":\"";
            int idx = block.IndexOf(search);
            if (idx == -1) return "";
            int start = idx + search.Length;
            int end = block.IndexOf("\"", start);
            return block.Substring(start, end - start).Replace("\\\\", "\\");
        }

        public static void SaveEntries(List<BackupEntry> list)
        {
            try
            {
                string dir = Path.GetDirectoryName(backupFilePath);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                string json = "[\r\n";
                for (int i = 0; i < list.Count; i++)
                {
                    var item = list[i];
                    string safePath = item.RegistryPath.Replace("\\", "\\\\");
                    string safeVal = item.OriginalValue.Replace("\\", "\\\\").Replace("\"", "\\\"");

                    json += string.Format("  {{\"Timestamp\":\"{0}\",\"RegistryPath\":\"{1}\",\"ValueName\":\"{2}\",\"OriginalValue\":\"{3}\"}}{4}\r\n",
                        item.Timestamp, safePath, item.ValueName, safeVal, i == list.Count - 1 ? "" : ",");
                }
                json += "]";
                File.WriteAllText(backupFilePath, json);
            }
            catch {}
        }

        public static void Clear()
        {
            try
            {
                if (File.Exists(backupFilePath)) File.Delete(backupFilePath);
            }
            catch {}
        }
    }

    public class RestoreView : Grid
    {
        private ListView lvBackups;
        private Button btnCreateCheckpoint;
        private Button btnRevertAll;
        private TextBlock lblBackupCount;

        public RestoreView()
        {
            InitializeComponent();
            BindEvents();
            RefreshBackups();
        }

        private void InitializeComponent()
        {
            string xaml = @"
<Grid xmlns=""http://schemas.microsoft.com/winfx/2006/xaml/presentation""
      xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml"">

    <Grid.Resources>
        <Style x:Key=""ActionBtn"" TargetType=""Button"">
            <Setter Property=""Background"" Value=""#5865F2""/>
            <Setter Property=""Foreground"" Value=""White""/>
            <Setter Property=""BorderThickness"" Value=""0""/>
            <Setter Property=""Padding"" Value=""14,8""/>
            <Setter Property=""FontSize"" Value=""11""/>
            <Setter Property=""FontFamily"" Value=""Segoe UI Variable Display""/>
            <Setter Property=""FontWeight"" Value=""Bold""/>
            <Setter Property=""Cursor"" Value=""Hand""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""Button"">
                        <Border Name=""Border"" CornerRadius=""14"" Background=""{TemplateBinding Background}"">
                            <TextBlock Text=""{TemplateBinding Content}"" Foreground=""White"" FontSize=""11"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" HorizontalAlignment=""Center"" VerticalAlignment=""Center"" Margin=""{TemplateBinding Padding}""/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property=""IsMouseOver"" Value=""True"">
                                <Setter TargetName=""Border"" Property=""Opacity"" Value=""0.85""/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
        <Style x:Key=""CardBorder"" TargetType=""Border"">
            <Setter Property=""Background"" Value=""#121320""/>
            <Setter Property=""BorderThickness"" Value=""1""/>
            <Setter Property=""BorderBrush"" Value=""#222435""/>
            <Setter Property=""CornerRadius"" Value=""10""/>
            <Setter Property=""Padding"" Value=""14""/>
            <Setter Property=""CacheMode"">
                <Setter.Value>
                    <BitmapCache EnableClearType=""True"" RenderAtScale=""1""/>
                </Setter.Value>
            </Setter>
        </Style>
    </Grid.Resources>

    <Grid.ColumnDefinitions>
        <ColumnDefinition Width=""*""/>
        <ColumnDefinition Width=""240""/>
    </Grid.ColumnDefinitions>

    <!-- LEFT COLUMN: REGISTRY TWEAKS BACKUP HISTORY -->
    <Border Grid.Column=""0"" Style=""{DynamicResource PremiumCard}"" Margin=""0,0,10,0"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""*"" />
                <RowDefinition Height=""Auto""/>
            </Grid.RowDefinitions>

            <TextBlock Grid.Row=""0"" Text=""Stato Modifiche Registro e Punti di Ripristino"" FontSize=""12"" FontWeight=""Bold"" Foreground=""White"" Margin=""5,0,0,10""/>

            <ListView Grid.Row=""1"" x:Name=""lvBackups"" Background=""Transparent"" BorderThickness=""0"" Foreground=""White"">
                <ListView.View>
                    <GridView>
                        <GridViewColumn Header=""Data Backup"" DisplayMemberBinding=""{Binding Timestamp}"" Width=""100""/>
                        <GridViewColumn Header=""Chiave Registro"" DisplayMemberBinding=""{Binding RegistryPath}"" Width=""240""/>
                        <GridViewColumn Header=""Valore"" DisplayMemberBinding=""{Binding ValueName}"" Width=""90""/>
                        <GridViewColumn Header=""Valore Originale"" DisplayMemberBinding=""{Binding OriginalValue}"" Width=""90""/>
                    </GridView>
                </ListView.View>
            </ListView>

            <Grid Grid.Row=""2"" Margin=""0,12,0,0"">
                <Grid.RowDefinitions>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""Auto""/>
                </Grid.RowDefinitions>
                <TextBlock Grid.Row=""0"" x:Name=""lblBackupCount"" Text=""0 Chiavi Backup"" Foreground=""#4A5680"" FontSize=""10"" TextWrapping=""Wrap"" Margin=""0,0,0,8""/>
                <StackPanel Grid.Row=""1"" Orientation=""Horizontal"" HorizontalAlignment=""Right"">
                    <Button x:Name=""btnRevertAll"" Content=""Ripristina Tutto (Revert)"" Style=""{DynamicResource PremiumButton}"" Background=""#E18F2E""/>
                </StackPanel>
            </Grid>
        </Grid>
    </Border>

    <!-- RIGHT COLUMN: SYSTEM RESTORE SYSTEM -->
    <Border Grid.Column=""1"" Style=""{DynamicResource PremiumCard}"" Margin=""0"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""*""/>
            </Grid.RowDefinitions>

            <StackPanel Grid.Row=""0"" Margin=""0,0,0,14"">
                <TextBlock Text=""RIPRISTINO DI SISTEMA WINDOWS"" FontSize=""11"" FontWeight=""Bold"" Foreground=""White"" Margin=""0,0,0,4""/>
                <TextBlock Text=""Prima di applicare qualsiasi tweak di registro, si consiglia vivamente di generare un Punto di Ripristino (System Restore Point) ufficiale di Windows, per consentire il rollback completo del sistema in caso di errori."" 
                           FontSize=""9"" Foreground=""#4A5680"" TextWrapping=""Wrap"" LineHeight=""13""/>
            </StackPanel>

            <StackPanel Grid.Row=""1"" VerticalAlignment=""Top"">
                <Button x:Name=""btnCreateCheckpoint"" Content=""Crea Ripristino di Sistema"" Style=""{DynamicResource PremiumButton}"" Background=""#00C080"" Height=""26"" Margin=""0,0,0,10""/>
            </StackPanel>
        </Grid>
    </Border>

</Grid>
";

            ParserContext context = new ParserContext();
            context.XmlnsDictionary.Add("", "http://schemas.microsoft.com/winfx/2006/xaml/presentation");
            context.XmlnsDictionary.Add("x", "http://schemas.microsoft.com/winfx/2006/xaml");

            StringReader stringReader = new StringReader(xaml);
            XmlReader xmlReader = XmlReader.Create(stringReader);
            Grid root = (Grid)XamlReader.Load(xmlReader);
            this.Children.Add(root);

            lvBackups = (ListView)root.FindName("lvBackups");
            btnCreateCheckpoint = (Button)root.FindName("btnCreateCheckpoint");
            btnRevertAll = (Button)root.FindName("btnRevertAll");
            lblBackupCount = (TextBlock)root.FindName("lblBackupCount");
        }

        private void BindEvents()
        {
            btnCreateCheckpoint.Click += BtnCreateCheckpoint_Click;
            btnRevertAll.Click += BtnRevertAll_Click;
        }

        private void RefreshBackups()
        {
            var entries = RegistryBackupManager.GetEntries();
            lvBackups.ItemsSource = null;
            lvBackups.ItemsSource = entries;
            lblBackupCount.Text = string.Format(Lang.Current == AppLanguage.Italian ? "{0} Chiavi Backup" : "{0} Backup Keys", entries.Count);
        }

        private void BtnCreateCheckpoint_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            if (!MainWindow.Instance.IsAdmin)
            {
                MessageBox.Show(Lang.TranslateString("Sono necessari privilegi di amministratore per creare punti di ripristino del sistema."), "Restore Center", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MainWindow.Instance.Log(Lang.Get("log.restore.backup.start"));
            btnCreateCheckpoint.IsEnabled = false;

            // Create restore point via WMI SystemRestore — no powershell.exe spawning
            Task.Run(() => {
                string errMsg;
                bool ok = SystemRestoreHelper.CreateRestorePoint("PavoTweakRestorePoint", out errMsg);
                Dispatcher.BeginInvoke(new Action(() => {
                    btnCreateCheckpoint.IsEnabled = true;
                    if (ok)
                    {
                        MainWindow.Instance.Log(Lang.Get("log.restore.backup.ok"), "SUCCESSO");
                        MainWindow.Instance.ShowToast(Lang.Get("toast.restore.done"));
                    }
                    else
                    {
                        MainWindow.Instance.Log(string.Format(Lang.Get("log.restore.backup.err"), errMsg), "ERRORE");
                        MessageBox.Show(
                            Lang.TranslateString("Creazione punto di ripristino non riuscita.\r\n" +
                            "Assicurarsi che la protezione del sistema sia abilitata per il disco C: in Windows.\r\n\r\n" +
                            "Dettaglio: ") + errMsg,
                            Lang.TranslateString("Errore Restore Point"),
                            MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }));
            });
        }

        private void BtnRevertAll_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            var entries = RegistryBackupManager.GetEntries();
            if (entries.Count == 0)
            {
                MessageBox.Show(Lang.TranslateString("Nessun backup memorizzato. Nessuna modifica da ripristinare."), "Restore Center", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var confirm = MessageBox.Show(
                string.Format(Lang.TranslateString("Sei sicuro di voler ripristinare i valori predefiniti per {0} chiavi di registro modificate?"), entries.Count),
                Lang.TranslateString("Ripristino Registro"), MessageBoxButton.YesNo, MessageBoxImage.Question);

            if (confirm == MessageBoxResult.Yes)
            {
                MainWindow.Instance.Log(Lang.Get("log.restore.undo.start"));
                int success = 0;
                foreach (var entry in entries)
                {
                    if (RevertKey(entry)) success++;
                }

                MainWindow.Instance.Log(string.Format(Lang.Get("log.restore.undo.done"), success, entries.Count), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.Get("toast.restore.done"));

                RegistryBackupManager.Clear();
                RefreshBackups();
                MainWindow.Instance.DashboardView.RecalculateAllScores();
            }
        }

        private bool RevertKey(BackupEntry entry)
        {
            try
            {
                string keyPath = entry.RegistryPath;
                string valueName = entry.ValueName;
                object originalValue = entry.OriginalValue;

                // Deduce type
                object typedValue = originalValue;
                int intVal;
                if (int.TryParse(originalValue.ToString(), out intVal))
                {
                    typedValue = intVal;
                }

                if (keyPath.StartsWith("HKEY_LOCAL_MACHINE\\"))
                {
                    string sub = keyPath.Substring("HKEY_LOCAL_MACHINE\\".Length);
                    using (RegistryKey key = Registry.LocalMachine.OpenSubKey(sub, true))
                    {
                        if (key != null) key.SetValue(valueName, typedValue);
                    }
                }
                else if (keyPath.StartsWith("HKEY_CURRENT_USER\\"))
                {
                    string sub = keyPath.Substring("HKEY_CURRENT_USER\\".Length);
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(sub, true))
                    {
                        if (key != null) key.SetValue(valueName, typedValue);
                    }
                }
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
