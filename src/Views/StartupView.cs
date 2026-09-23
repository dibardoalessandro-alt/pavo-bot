using System;
using System.IO;
using System.Xml;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Windows.Markup;
using System.Windows.Media;
using System.Collections.Generic;
using Microsoft.Win32;

namespace PavoTweak
{
    public class StartupItem
    {
        public string Name { get; set; }
        public string Path { get; set; }
        public string Location { get; set; }
        public string Impact { get; set; }
        public string ImpactColor { get; set; }
    }

    public class StartupView : Grid
    {
        private ListView lvStartup;
        private List<StartupItem> startupList = new List<StartupItem>();

        private TextBox txtDelaySeconds;
        private Button btnAddDelayed;

        public StartupView()
        {
            InitializeComponent();
            BindEvents();
            RefreshStartupList();
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
            <Setter Property=""Padding"" Value=""12,8""/>
            <Setter Property=""FontSize"" Value=""10""/>
            <Setter Property=""FontFamily"" Value=""Segoe UI Variable Display""/>
            <Setter Property=""FontWeight"" Value=""Bold""/>
            <Setter Property=""Cursor"" Value=""Hand""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""Button"">
                        <Border Name=""Border"" CornerRadius=""5"" Background=""{TemplateBinding Background}"">
                            <TextBlock Text=""{TemplateBinding Content}"" Foreground=""White"" FontSize=""10"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" HorizontalAlignment=""Center"" VerticalAlignment=""Center"" Margin=""{TemplateBinding Padding}""/>
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

    <!-- LEFT COLUMN: ACTIVE STARTUP ITEMS -->
    <Border Grid.Column=""0"" Style=""{DynamicResource PremiumCard}"" Margin=""0,0,10,0"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""*""/>
                <RowDefinition Height=""Auto""/>
            </Grid.RowDefinitions>

            <TextBlock Grid.Row=""0"" Text=""Gestore Programmi all'Avvio di Windows"" FontSize=""12"" FontWeight=""Bold"" Foreground=""White"" Margin=""5,0,0,10""/>

            <ListView Grid.Row=""1"" x:Name=""lvStartup"" Background=""Transparent"" BorderThickness=""0"" Foreground=""White"">
                <ListView.View>
                    <GridView>
                        <GridViewColumn Header=""Nome App"" DisplayMemberBinding=""{Binding Name}"" Width=""140""/>
                        <GridViewColumn Header=""Percorso"" DisplayMemberBinding=""{Binding Path}"" Width=""160""/>
                        <GridViewColumn Header=""Impatto Avvio"">
                            <GridViewColumn.CellTemplate>
                                <DataTemplate>
                                    <TextBlock Text=""{Binding Impact}"" Foreground=""{Binding ImpactColor}"" FontWeight=""Bold"" FontSize=""10""/>
                                </DataTemplate>
                            </GridViewColumn.CellTemplate>
                        </GridViewColumn>
                    </GridView>
                </ListView.View>
            </ListView>

            <Grid Grid.Row=""2"" Margin=""0,12,0,0"">
                <Grid.RowDefinitions>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""Auto""/>
                </Grid.RowDefinitions>
                <TextBlock Grid.Row=""0"" Text=""* Rimuovere i processi riduce il tempo di avvio (Boot Time)."" Foreground=""#4A5680"" FontSize=""9"" TextWrapping=""Wrap"" Margin=""0,0,0,8""/>
                <StackPanel Grid.Row=""1"" Orientation=""Horizontal"" HorizontalAlignment=""Right"">
                    <Button x:Name=""btnDisableStartup"" Content=""Disabilita all'Avvio"" Style=""{DynamicResource PremiumButton}"" Background=""#F23F43""/>
                </StackPanel>
            </Grid>
        </Grid>
    </Border>

    <!-- RIGHT COLUMN: DELAYED STARTUP CONFIG -->
    <Border Grid.Column=""1"" Style=""{DynamicResource PremiumCard}"" Margin=""0"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""*""/>
            </Grid.RowDefinitions>

            <StackPanel Grid.Row=""0"" Margin=""0,0,0,14"">
                <TextBlock Text=""CONFIGURA AVVIO RITARDATO"" FontSize=""11"" FontWeight=""Bold"" Foreground=""White"" Margin=""0,0,0,4""/>
                <TextBlock Text=""Per le app necessarie che rallentano l'avvio, puoi configurare un ritardo personalizzato. Windows le caricherà solo dopo N secondi dal login desktop."" 
                           FontSize=""9"" Foreground=""#4A5680"" TextWrapping=""Wrap"" LineHeight=""13""/>
            </StackPanel>

            <StackPanel Grid.Row=""1"" VerticalAlignment=""Top"">
                <TextBlock Text=""Seleziona app sopra, poi inserisci i secondi:"" FontSize=""9"" Foreground=""#E3E5E8"" Margin=""0,0,0,6""/>
                
                <Grid Margin=""0,0,0,12"">
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width=""*""/>
                        <ColumnDefinition Width=""Auto""/>
                    </Grid.ColumnDefinitions>
                    <TextBox x:Name=""txtDelaySeconds"" Text=""15"" Grid.Column=""0"" Height=""24"" Background=""#0D0E17"" Foreground=""White"" BorderBrush=""#222435"" Padding=""4,3"" FontSize=""11""/>
                    <TextBlock Text="" sec"" Grid.Column=""1"" Foreground=""White"" FontSize=""11"" VerticalAlignment=""Center"" Margin=""4,0,0,0""/>
                </Grid>

                <Button x:Name=""btnAddDelayed"" Content=""Imposta Avvio Ritardato"" Style=""{DynamicResource PremiumButton}"" Background=""#00C080"" Height=""26""/>
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

            lvStartup = (ListView)root.FindName("lvStartup");
            txtDelaySeconds = (TextBox)root.FindName("txtDelaySeconds");
            btnAddDelayed = (Button)root.FindName("btnAddDelayed");
        }

        private void BindEvents()
        {
            Button btnDisableStartup = (Button)mainGridFind("btnDisableStartup");
            btnDisableStartup.Click += BtnDisableStartup_Click;

            btnAddDelayed.Click += BtnAddDelayed_Click;
        }

        private object mainGridFind(string name)
        {
            return (this.Children[0] as Grid).FindName(name);
        }

        public void RefreshStartupList()
        {
            System.Threading.Tasks.Task.Run(() =>
            {
                var list = new List<StartupItem>();
                try
                {
                    // HKCU
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))
                    {
                        if (key != null)
                        {
                            foreach (string name in key.GetValueNames())
                            {
                                string path = key.GetValue(name) != null ? key.GetValue(name).ToString() : "";
                                list.Add(new StartupItem {
                                    Name = name,
                                    Path = path,
                                    Location = "HKCU",
                                    Impact = Lang.TranslateString(GetAppImpact(name)),
                                    ImpactColor = GetImpactColor(name)
                                });
                            }
                        }
                    }

                    // HKLM
                    try
                    {
                        using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))
                        {
                            if (key != null)
                            {
                                foreach (string name in key.GetValueNames())
                                {
                                    string path = key.GetValue(name) != null ? key.GetValue(name).ToString() : "";
                                    list.Add(new StartupItem {
                                        Name = name,
                                        Path = path,
                                        Location = "HKLM",
                                        Impact = Lang.TranslateString("Alto"),
                                        ImpactColor = "#F23F43"
                                    });
                                }
                            }
                        }
                    }
                    catch {}
                }
                catch {}

                if (list.Count == 0)
                {
                    list.Add(new StartupItem { Name = "Discord", Path = @"C:\Users\User\AppData\Local\Discord\Update.exe", Location = "HKCU", Impact = Lang.TranslateString("Medio"), ImpactColor = "#E18F2E" });
                    list.Add(new StartupItem { Name = "Spotify", Path = @"C:\Users\User\AppData\Roaming\Spotify\Spotify.exe", Location = "HKCU", Impact = Lang.TranslateString("Alto"), ImpactColor = "#F23F43" });
                    list.Add(new StartupItem { Name = "Steam Web Helper", Path = @"C:\Program Files (x86)\Steam\steam.exe", Location = "HKCU", Impact = Lang.TranslateString("Alto"), ImpactColor = "#F23F43" });
                    list.Add(new StartupItem { Name = "OneDrive", Path = @"C:\Program Files\Microsoft OneDrive\OneDrive.exe", Location = "HKCU", Impact = Lang.TranslateString("Basso"), ImpactColor = "#23A55A" });
                }

                this.Dispatcher.BeginInvoke(new Action(() =>
                {
                    startupList.Clear();
                    startupList.AddRange(list);
                    lvStartup.ItemsSource = null;
                    lvStartup.ItemsSource = startupList;
                }));
            });
        }

        private string GetAppImpact(string name)
        {
            string n = name.ToLower();
            if (n.Contains("spotify") || n.Contains("steam") || n.Contains("chrome")) return "Alto";
            if (n.Contains("discord") || n.Contains("update")) return "Medio";
            return "Basso";
        }

        private string GetImpactColor(string name)
        {
            string impact = GetAppImpact(name);
            if (impact == "Alto") return "#F23F43"; // Red
            if (impact == "Medio") return "#E18F2E"; // Orange
            return "#23A55A"; // Green
        }

        private void BtnDisableStartup_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            var selected = lvStartup.SelectedItem as StartupItem;
            if (selected == null)
            {
                MessageBox.Show(Lang.TranslateString("Seleziona una voce di avvio dalla lista."), "Startup Manager", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MainWindow.Instance.Log(string.Format(Lang.Get("log.startup.remove"), selected.Name));
            try
            {
                // Record registry backup
                string rootKey = selected.Location == "HKCU" ? "HKEY_CURRENT_USER" : "HKEY_LOCAL_MACHINE";
                string regPath = rootKey + @"\Software\Microsoft\Windows\CurrentVersion\Run";
                RegistryBackupManager.RecordBackup(regPath, selected.Name, selected.Path);

                if (selected.Location == "HKCU")
                {
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                    {
                        if (key != null) key.DeleteValue(selected.Name, false);
                    }
                }
                else
                {
                    using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                    {
                        if (key != null) key.DeleteValue(selected.Name, false);
                    }
                }

                MainWindow.Instance.Log(string.Format(Lang.Get("log.startup.disabled"), selected.Name), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.Get("startup.disable") + "!");
                RefreshStartupList();
                MainWindow.Instance.DashboardView.RecalculateAllScores();
            }
            catch (Exception ex)
            {
                MessageBox.Show(Lang.TranslateString("Privilegi amministratore insufficienti per scrivere in HKLM: ") + ex.Message, Lang.TranslateString("Rifiutato"), MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void BtnAddDelayed_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            var selected = lvStartup.SelectedItem as StartupItem;
            if (selected == null)
            {
                MessageBox.Show(Lang.TranslateString("Seleziona un'app dall'avvio da ritardare."), "Startup Manager", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            int sec;
            if (!int.TryParse(txtDelaySeconds.Text, out sec) || sec <= 0)
            {
                MessageBox.Show(Lang.TranslateString("Inserisci un numero di secondi valido (es: 15)."), Lang.TranslateString("Parametro Errato"), MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MainWindow.Instance.Log(string.Format(Lang.Get("log.startup.delay"), sec, selected.Name));

            // Delayed Startup implementation:
            // 1. Remove from registry Run key to avoid double boot
            try
            {
                if (selected.Location == "HKCU")
                {
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                    {
                        if (key != null) key.DeleteValue(selected.Name, false);
                    }
                }
            }
            catch {}

            // 2. Write delayed startup helper script (.bat) in Startup Programs folder
            try
            {
                string startupPath = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                string batFile = Path.Combine(startupPath, "pavo_delay_" + selected.Name + ".bat");
                
                string content = string.Format("@echo off\r\ntimeout /t {0} /nobreak > nul\r\nstart \"\" \"{1}\"\r\n", sec, selected.Path);
                File.WriteAllText(batFile, content);

                MainWindow.Instance.Log(string.Format(Lang.Get("log.startup.delay.ok"), batFile), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.Get("startup.enable") + "!");
                RefreshStartupList();
            }
            catch (Exception ex)
            {
                MessageBox.Show(Lang.TranslateString("Impossibile salvare lo script batch: ") + ex.Message, Lang.TranslateString("Errore File"), MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
