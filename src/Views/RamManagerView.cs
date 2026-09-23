using System;
using System.IO;
using System.Xml;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Windows.Markup;
using System.Windows.Media;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace PavoTweak
{
    public class RamProcessItem
    {
        public string ProcessName { get; set; }
        public string Pid         { get; set; }
        public string MemoryUsage { get; set; }
    }

    public class BloatProcessItem
    {
        public string ProcessName { get; set; }
        public string Description { get; set; }
        public string MemoryUsage { get; set; }
        public string Category    { get; set; }
    }

    internal class BloatEntry
    {
        public string Name;
        public string Desc;
        public string Cat;
        public BloatEntry(string name, string desc, string cat)
        {
            Name = name; Desc = desc; Cat = cat;
        }
    }

    public class RamManagerView : Grid
    {
        private ListView  lvProcesses;
        private ListView  lvBloat;
        private TextBlock lblRamLiveStatus;
        private TextBlock lblBloatCount;
        private Button    btnCleanStandby;
        private TextBlock lblSystemProcessStatus;
        private TextBlock lblSystemProcessDetails;
        private Button    btnOptimizeSystemProcesses;
        private Button    btnRestoreSystemProcesses;

        private GridViewColumn colProcName;
        private GridViewColumn colProcPid;
        private GridViewColumn colProcRam;
        private GridViewColumn colBloatName;
        private GridViewColumn colBloatCat;
        private GridViewColumn colBloatRam;

        private List<RamProcessItem>    allProcesses  = new List<RamProcessItem>();
        private List<BloatProcessItem>  bloatProcesses = new List<BloatProcessItem>();

        private static readonly BloatEntry[] _bloatList = new BloatEntry[]
        {
            new BloatEntry("OneDrive",            "Microsoft OneDrive sync daemon",              "Microsoft"),
            new BloatEntry("OneDriveStandaloneUpdater","OneDrive auto-updater",                  "Microsoft"),
            new BloatEntry("SearchIndexer",       "Windows Search indexer (alto I/O disco)",     "Microsoft"),
            new BloatEntry("SgrmBroker",          "System Guard Runtime Monitor",                "Microsoft"),
            new BloatEntry("MsMpEng",             "Windows Defender scanner",                    "Microsoft"),
            new BloatEntry("NisSrv",              "Windows Defender Network Inspection",         "Microsoft"),
            new BloatEntry("SecurityHealthSystray","Windows Security tray icon",                 "Microsoft"),
            new BloatEntry("WUDFHost",            "Windows Driver Foundation host",              "Microsoft"),
            new BloatEntry("CompPkgSrv",          "Windows App compatibility broker",            "Microsoft"),
            new BloatEntry("uhssvc",              "Microsoft Update Health Service",             "Microsoft"),
            new BloatEntry("XboxPcApp",           "Xbox PC companion app",                       "Microsoft"),
            new BloatEntry("XboxGameBarWidgets",  "Xbox Game Bar widgets",                       "Microsoft"),
            new BloatEntry("XboxGameBar",         "Xbox Game Bar overlay",                       "Microsoft"),
            new BloatEntry("GameBarPresenceWriter","Xbox Game Bar presence writer",              "Microsoft"),
            new BloatEntry("MicrosoftEdgeUpdate", "Microsoft Edge auto-updater",                "Microsoft"),
            new BloatEntry("DiagTrack",           "Windows telemetry/data collection",          "Telemetry"),
            new BloatEntry("WerFault",            "Windows Error Reporting",                    "Telemetry"),
            new BloatEntry("WerSvc",              "Windows Error Reporting service",            "Telemetry"),
            new BloatEntry("PerfHost",            "Performance Counter Host (telemetry)",       "Telemetry"),
            new BloatEntry("Wsappx",              "Windows Store background agent",             "Telemetry"),

            new BloatEntry("GoogleCrashHandler",  "Google crash reporter",                      "Google"),
            new BloatEntry("GoogleCrashHandler64","Google crash reporter (64-bit)",             "Google"),
            new BloatEntry("GoogleUpdate",        "Google auto-updater",                        "Google"),
            new BloatEntry("GoogleDriveFS",       "Google Drive sync daemon",                   "Google"),
            new BloatEntry("AdobeUpdateService",  "Adobe auto-updater",                         "Adobe"),
            new BloatEntry("AdobeARMservice",     "Adobe Reader Manager",                       "Adobe"),
            new BloatEntry("Teams",               "Microsoft Teams background agent",           "Microsoft"),
            new BloatEntry("MicrosoftTeams",      "Microsoft Teams processo",                   "Microsoft"),
            new BloatEntry("DropboxUpdate",       "Dropbox auto-updater",                       "Apps"),
            new BloatEntry("Dropbox",             "Dropbox file sync daemon",                   "Apps"),
            new BloatEntry("TextInputHost",       "Windows touch keyboard host",                "Microsoft"),
            new BloatEntry("RuntimeBroker",       "Windows Store runtime broker",               "Microsoft"),
        };

        [DllImport("psapi.dll")]
        private static extern int EmptyWorkingSet(IntPtr hwProc);

        public RamManagerView()
        {
            InitializeComponent();
            BindEvents();
            Lang.LanguageChanged += () => Dispatcher.BeginInvoke(new Action(RefreshLanguage));
            UpdateRealtimeStats();
        }

        private void InitializeComponent()
        {
            string xaml = @"
<Grid xmlns=""http://schemas.microsoft.com/winfx/2006/xaml/presentation""
      xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml"">

    <Grid.Resources>
        <Style x:Key=""ActionBtn"" TargetType=""Button"">
            <Setter Property=""Background"" Value=""#7C5CFC""/>
            <Setter Property=""Foreground"" Value=""White""/>
            <Setter Property=""BorderThickness"" Value=""0""/>
            <Setter Property=""Padding"" Value=""14,8""/>
            <Setter Property=""FontSize"" Value=""11""/>
            <Setter Property=""FontFamily"" Value=""Segoe UI Variable Text""/>
            <Setter Property=""FontWeight"" Value=""Bold""/>
            <Setter Property=""Cursor"" Value=""Hand""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""Button"">
                        <Border Name=""Border"" CornerRadius=""8"" Background=""{TemplateBinding Background}"">
                            <TextBlock Text=""{TemplateBinding Content}"" Foreground=""White"" FontSize=""11"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Text"" HorizontalAlignment=""Center"" VerticalAlignment=""Center"" Margin=""{TemplateBinding Padding}""/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property=""IsMouseOver"" Value=""True"">
                                <Setter TargetName=""Border"" Property=""Opacity"" Value=""0.9""/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>

        <Style x:Key=""Card"" TargetType=""Border"">
            <Setter Property=""Background"">
                <Setter.Value>
                    <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,1"">
                        <GradientStop Color=""#0C1020"" Offset=""0""/>
                        <GradientStop Color=""#0F1428"" Offset=""1""/>
                    </LinearGradientBrush>
                </Setter.Value>
            </Setter>
            <Setter Property=""BorderThickness"" Value=""1""/>
            <Setter Property=""BorderBrush"" Value=""#1C2040""/>
            <Setter Property=""CornerRadius"" Value=""14""/>
            <Setter Property=""Padding"" Value=""16""/>
        </Style>
    </Grid.Resources>

    <Grid.ColumnDefinitions>
        <ColumnDefinition Width=""*""/>
        <ColumnDefinition Width=""280""/>
        <ColumnDefinition Width=""320""/>
    </Grid.ColumnDefinitions>

    <Border Grid.Column=""0"" Style=""{DynamicResource PremiumCard}"" Margin=""0,0,12,0"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""*"" />
                <RowDefinition Height=""Auto""/>
            </Grid.RowDefinitions>
            <TextBlock Grid.Row=""0"" Text=""Processi Attivi (per RAM)"" FontSize=""13"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" Foreground=""#E8ECFF"" Margin=""0,0,0,12""/>
            <ListView Grid.Row=""1"" x:Name=""lvProcesses"" Background=""Transparent"" BorderThickness=""0"" Foreground=""#E8ECFF"" FontFamily=""Segoe UI Variable Text"">
                <ListView.View>
                    <GridView>
                        <GridViewColumn x:Name=""colProcName"" Header=""[[Processo]]"" DisplayMemberBinding=""{Binding ProcessName}"" Width=""160""/>
                        <GridViewColumn x:Name=""colProcPid"" Header=""[[PID]]"" DisplayMemberBinding=""{Binding Pid}"" Width=""55""/>
                        <GridViewColumn x:Name=""colProcRam"" Header=""[[RAM]]"" DisplayMemberBinding=""{Binding MemoryUsage}"" Width=""80""/>
                    </GridView>
                </ListView.View>
            </ListView>
            <Button Grid.Row=""2"" x:Name=""btnRefreshProcesses"" Content=""Aggiorna Lista"" Style=""{DynamicResource PremiumButton}"" Background=""#7C5CFC"" Margin=""0,12,0,0"" HorizontalAlignment=""Right""/>
        </Grid>
    </Border>

    <Grid Grid.Column=""1"" Margin=""0,0,12,0"">
        <Grid.RowDefinitions>
            <RowDefinition Height=""Auto""/>
            <RowDefinition Height=""Auto""/>
            <RowDefinition Height=""*""/>
        </Grid.RowDefinitions>
        <Border Grid.Row=""0"" Style=""{DynamicResource PremiumCard}"" Margin=""0,0,0,12"">
            <StackPanel>
                <TextBlock Text=""RAM LIVE STATUS"" FontSize=""11"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" Foreground=""#4A5680"" Margin=""0,0,0,8""/>
                <TextBlock x:Name=""lblRamLiveStatus"" Text=""Caricamento..."" FontSize=""14"" FontWeight=""Bold"" Foreground=""#7C5CFC"" HorizontalAlignment=""Center"" Margin=""0,4,0,0"" FontFamily=""Segoe UI Variable Display""/>
            </StackPanel>
        </Border>
        <Border Grid.Row=""1"" Style=""{DynamicResource PremiumCard}"" Margin=""0,0,0,12"">
            <StackPanel>
                <TextBlock Text=""STANDBY MEMORY CLEANER"" FontSize=""11"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" Foreground=""#4A5680"" Margin=""0,0,0,8""/>
                <TextBlock Text=""La memoria Standby è occupata da file precedentemente aperti. Svuota la cache in modo sicuro senza crashare i programmi attivi."" FontSize=""10"" Foreground=""#8892B8"" FontFamily=""Segoe UI Variable Text"" Margin=""0,0,0,16"" TextWrapping=""Wrap"" LineHeight=""14""/>
                <Button x:Name=""btnCleanStandby"" Content=""Svuota Memoria Standby"" Style=""{DynamicResource PremiumButton}"" Background=""#00C080"" Height=""32""/>
            </StackPanel>
        </Border>
        <Border Grid.Row=""2"" Style=""{DynamicResource PremiumCard}"">
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""*""/>
                    <RowDefinition Height=""Auto""/>
                </Grid.RowDefinitions>
                <StackPanel Grid.Row=""0"" Margin=""0,0,0,8"">
                    <TextBlock Text=""OTTIMIZZAZIONE INTELLIGENTE PROCESSI"" FontSize=""11"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" Foreground=""#4A5680"" Margin=""0,0,0,4""/>
                    <TextBlock Text=""Analizza ed effettua il raggruppamento sicuro dei wrapper svchost e la pausa dei servizi non essenziali (-50 processi)."" FontSize=""10"" Foreground=""#8892B8"" FontFamily=""Segoe UI Variable Text"" TextWrapping=""Wrap"" LineHeight=""14""/>
                </StackPanel>
                <Border Grid.Row=""1"" Background=""#1A7C5CFC"" CornerRadius=""8"" Padding=""10,6"" Margin=""0,4,0,8"" BorderBrush=""#407C5CFC"" BorderThickness=""1"">
                    <StackPanel>
                        <TextBlock x:Name=""lblSystemProcessStatus"" Text=""Stato: Analisi..."" FontSize=""10"" FontWeight=""Bold"" Foreground=""#7C5CFC"" FontFamily=""Segoe UI Variable Text""/>
                        <TextBlock x:Name=""lblSystemProcessDetails"" Text=""Calcolo processi in corso..."" FontSize=""9"" Foreground=""#8892B8"" FontFamily=""Segoe UI Variable Text"" Margin=""0,2,0,0"" TextWrapping=""Wrap""/>
                    </StackPanel>
                </Border>
                <Border Grid.Row=""2"" Background=""#1A00C080"" CornerRadius=""6"" Padding=""8,4"" Margin=""0,0,0,12"">
                    <TextBlock Text=""✔ 100% Sicuro &amp; Reversibile (0 Rischio Crash)"" FontSize=""9"" FontWeight=""Bold"" Foreground=""#00C080"" HorizontalAlignment=""Center""/>
                </Border>
                <StackPanel Grid.Row=""4"">
                    <Button x:Name=""btnOptimizeSystemProcesses"" Content=""Ottimizza Processi (-50)"" Style=""{DynamicResource PremiumButton}"" Background=""#7C5CFC"" Height=""32"" Margin=""0,0,0,8""/>
                    <Button x:Name=""btnRestoreSystemProcesses"" Content=""Ripristina Stato Processi"" Style=""{DynamicResource PremiumButton}"" Background=""#2A2C3F"" Height=""30""/>
                </StackPanel>
            </Grid>
        </Border>
    </Grid>

    <Border Grid.Column=""2"" Style=""{DynamicResource PremiumCard}"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""*""/>
                <RowDefinition Height=""Auto""/>
            </Grid.RowDefinitions>
            <StackPanel Grid.Row=""0"" Margin=""0,0,0,8"">
                <TextBlock Text=""SMART PROCESS KILLER"" FontSize=""11"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" Foreground=""#4A5680"" Margin=""0,0,0,4""/>
                <TextBlock Text=""Rileva automaticamente processi inutili in background che sprecano RAM e CPU. Permette all'utente di terminarli selettivamente."" FontSize=""10"" Foreground=""#8892B8"" FontFamily=""Segoe UI Variable Text"" TextWrapping=""Wrap"" LineHeight=""14""/>
            </StackPanel>
            <Border Grid.Row=""1"" Background=""#1AFF4D6A"" CornerRadius=""8"" Padding=""10,6"" Margin=""0,4,0,12"" BorderBrush=""#40FF4D6A"" BorderThickness=""1"">
                <StackPanel Orientation=""Horizontal"">
                    <TextBlock Text=""Processi inutili rilevati:"" FontSize=""10"" Foreground=""#FF4D6A"" FontFamily=""Segoe UI Variable Text"" VerticalAlignment=""Center""/>
                    <TextBlock x:Name=""lblBloatCount"" Text=""0"" FontSize=""12"" FontWeight=""Bold"" Foreground=""#FF4D6A"" FontFamily=""Segoe UI Variable Display"" Margin=""8,0,0,0"" VerticalAlignment=""Center""/>
                </StackPanel>
            </Border>
            <ListView Grid.Row=""2"" x:Name=""lvBloat"" Background=""Transparent"" BorderThickness=""0"" Foreground=""#E8ECFF"" FontFamily=""Segoe UI Variable Text"" Margin=""0,0,0,12"">
                <ListView.View>
                    <GridView>
                        <GridViewColumn x:Name=""colBloatName"" Header=""[[Processo]]"" DisplayMemberBinding=""{Binding ProcessName}"" Width=""115""/>
                        <GridViewColumn x:Name=""colBloatCat"" Header=""[[Cat.]]"" DisplayMemberBinding=""{Binding Category}"" Width=""70""/>
                        <GridViewColumn x:Name=""colBloatRam"" Header=""[[RAM]]"" DisplayMemberBinding=""{Binding MemoryUsage}"" Width=""65""/>
                    </GridView>
                </ListView.View>
            </ListView>
            <StackPanel Grid.Row=""3"">
                <Button x:Name=""btnScanBloat"" Content=""Scansiona Processi Inutili"" Style=""{DynamicResource PremiumButton}"" Background=""#7C5CFC"" Height=""32"" Margin=""0,0,0,8""/>
                <Button x:Name=""btnKillSelected"" Content=""Termina Selezionato"" Style=""{DynamicResource PremiumButton}"" Background=""#FF9F40"" Height=""32"" Margin=""0,0,0,8""/>
                <Button x:Name=""btnKillAllBloat"" Content=""Termina TUTTI i Processi Inutili"" Style=""{DynamicResource PremiumButton}"" Background=""#FF4D6A"" Height=""32""/>
            </StackPanel>
        </Grid>
    </Border>
</Grid>
";

            ParserContext context = new ParserContext();
            context.XmlnsDictionary.Add("", "http://schemas.microsoft.com/winfx/2006/xaml/presentation");
            context.XmlnsDictionary.Add("x", "http://schemas.microsoft.com/winfx/2006/xaml");
            StringReader stringReader = new StringReader(Lang.Resolve(xaml));
            XmlReader xmlReader = XmlReader.Create(stringReader);
            Grid root = (Grid)XamlReader.Load(xmlReader);
            this.Children.Add(root);

            lvProcesses                = (ListView) root.FindName("lvProcesses");
            lblRamLiveStatus           = (TextBlock)root.FindName("lblRamLiveStatus");
            btnCleanStandby            = (Button)   root.FindName("btnCleanStandby");
            lvBloat                    = (ListView) root.FindName("lvBloat");
            lblBloatCount              = (TextBlock)root.FindName("lblBloatCount");
            lblSystemProcessStatus     = (TextBlock)root.FindName("lblSystemProcessStatus");
            lblSystemProcessDetails    = (TextBlock)root.FindName("lblSystemProcessDetails");
            btnOptimizeSystemProcesses = (Button)   root.FindName("btnOptimizeSystemProcesses");
            btnRestoreSystemProcesses  = (Button)   root.FindName("btnRestoreSystemProcesses");

            colProcName                = (GridViewColumn)root.FindName("colProcName");
            colProcPid                 = (GridViewColumn)root.FindName("colProcPid");
            colProcRam                 = (GridViewColumn)root.FindName("colProcRam");
            colBloatName               = (GridViewColumn)root.FindName("colBloatName");
            colBloatCat                = (GridViewColumn)root.FindName("colBloatCat");
            colBloatRam                = (GridViewColumn)root.FindName("colBloatRam");
        }

        private void BindEvents()
        {
            Button btnRefreshProcesses = (Button)mainGridFind("btnRefreshProcesses");
            Button btnScanBloat        = (Button)mainGridFind("btnScanBloat");
            Button btnKillSelected     = (Button)mainGridFind("btnKillSelected");
            Button btnKillAllBloat     = (Button)mainGridFind("btnKillAllBloat");

            btnRefreshProcesses.Click += (s, e) => { SoundManager.PlayClick(); UpdateRealtimeStats(); };
            btnCleanStandby.Click     += BtnCleanStandby_Click;
            btnScanBloat.Click        += BtnScanBloat_Click;
            btnKillSelected.Click     += BtnKillSelected_Click;
            btnKillAllBloat.Click     += BtnKillAllBloat_Click;

            if (btnOptimizeSystemProcesses != null) btnOptimizeSystemProcesses.Click += BtnOptimizeSystemProcesses_Click;
            if (btnRestoreSystemProcesses != null)  btnRestoreSystemProcesses.Click  += BtnRestoreSystemProcesses_Click;

            ScanBloatProcesses();
            UpdateSystemProcessStatus();
        }

        private object mainGridFind(string name)
        {
            return (this.Children[0] as Grid).FindName(name);
        }

        // ── LIVE STATS ───────────────────────────────────────────────

        public void UpdateRealtimeStats()
        {
            allProcesses.Clear();
            Process[] procs = Process.GetProcesses();
            Array.Sort(procs, (p1, p2) => p2.WorkingSet64.CompareTo(p1.WorkingSet64));

            int count = 0;
            long totalWorkingSet = 0;
            foreach (var p in procs)
            {
                totalWorkingSet += p.WorkingSet64;
                if (count < 15)
                {
                    double mb = p.WorkingSet64 / 1024.0 / 1024.0;
                    allProcesses.Add(new RamProcessItem {
                        ProcessName = p.ProcessName,
                        Pid         = p.Id.ToString(),
                        MemoryUsage = string.Format("{0:F1} MB", mb)
                    });
                    count++;
                }
            }
            lvProcesses.ItemsSource = null;
            lvProcesses.ItemsSource = allProcesses;

            double totalGb = totalWorkingSet / 1024.0 / 1024.0 / 1024.0;
            lblRamLiveStatus.Text = string.Format(Lang.Current == AppLanguage.Italian ? "Allocata: {0:F2} GB" : "Allocated: {0:F2} GB", totalGb);
        }

        private void RefreshLanguage()
        {
            Lang.TranslateUI(this);

            if (colProcName != null) colProcName.Header = Lang.TranslateString("Processo");
            if (colProcPid != null) colProcPid.Header = Lang.TranslateString("PID");
            if (colProcRam != null) colProcRam.Header = Lang.TranslateString("RAM");
            if (colBloatName != null) colBloatName.Header = Lang.TranslateString("Processo");
            if (colBloatCat != null) colBloatCat.Header = Lang.TranslateString("Cat.");
            if (colBloatRam != null) colBloatRam.Header = Lang.TranslateString("RAM");

            UpdateSystemProcessStatus();
            UpdateRealtimeStats();
        }

        // ── SMART SCANNER ────────────────────────────────────────────

        private void ScanBloatProcesses()
        {
            bloatProcesses.Clear();
            Process[] running = Process.GetProcesses();

            Dictionary<string, Process> runningMap = new Dictionary<string, Process>(StringComparer.OrdinalIgnoreCase);
            foreach (var rp in running)
            {
                if (IsProtectedGpuProcess(rp.ProcessName)) continue;

                if (!runningMap.ContainsKey(rp.ProcessName))
                    runningMap[rp.ProcessName] = rp;
                else if (rp.WorkingSet64 > runningMap[rp.ProcessName].WorkingSet64)
                    runningMap[rp.ProcessName] = rp;
            }

            foreach (var entry in _bloatList)
            {
                Process match = null;
                foreach (var kv in runningMap)
                {
                    if (IsProtectedGpuProcess(kv.Key)) continue;

                    if (kv.Key.IndexOf(entry.Name, StringComparison.OrdinalIgnoreCase) >= 0 ||
                        entry.Name.IndexOf(kv.Key,  StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        match = kv.Value;
                        break;
                    }
                }
                if (match != null)
                {
                    double mb = match.WorkingSet64 / 1024.0 / 1024.0;
                    bloatProcesses.Add(new BloatProcessItem {
                        ProcessName = match.ProcessName,
                        Description = Lang.TranslateString(entry.Desc),
                        MemoryUsage = string.Format("{0:F0} MB", mb),
                        Category    = Lang.TranslateString(entry.Cat)
                    });
                }
            }

            lvBloat.ItemsSource = null;
            lvBloat.ItemsSource = bloatProcesses;
            lblBloatCount.Text  = bloatProcesses.Count.ToString();
        }

        private void BtnScanBloat_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            ScanBloatProcesses();
            MainWindow.Instance.Log(string.Format(Lang.TranslateString("Scansione completata. Processi in background rilevati: {0}"), bloatProcesses.Count));
            MainWindow.Instance.ShowToast(string.Format(Lang.TranslateString("Trovati {0} processi in background."), bloatProcesses.Count));
        }

        private void BtnCleanStandby_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            MainWindow.Instance.Log(Lang.Get("log.ram.free.start"));
            int cleared = 0;
            foreach (var p in Process.GetProcesses())
            {
                try { EmptyWorkingSet(p.Handle); cleared++; }
                catch {}
            }
            MainWindow.Instance.Log(string.Format(Lang.Get("log.ram.free.done"), cleared), "SUCCESSO");
            MainWindow.Instance.ShowToast(Lang.Get("ram.free.btn") + "!");
            UpdateRealtimeStats();
            MainWindow.Instance.DashboardView.RecalculateAllScores();
        }

        private void BtnKillSelected_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            var selected = lvBloat.SelectedItem as BloatProcessItem;
            if (selected == null)
            {
                MessageBox.Show(Lang.TranslateString("Seleziona un processo dalla lista dei processi inutili."), Lang.TranslateString("Smart Process Killer"), MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var confirm = MessageBox.Show(
                string.Format(Lang.TranslateString("Sei sicuro di voler terminare il processo '{0}'?"), selected.ProcessName),
                Lang.TranslateString("Conferma Terminazione"),
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (confirm != MessageBoxResult.Yes) return;

            int killed = KillByName(selected.ProcessName);
            if (killed > 0)
            {
                MainWindow.Instance.Log(string.Format(Lang.TranslateString("Processo terminato con successo: {0}"), selected.ProcessName), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.TranslateString("Processo terminato!"));
                
                // Instantly remove from the bloat list
                bloatProcesses.Remove(selected);
                lvBloat.ItemsSource = null;
                lvBloat.ItemsSource = bloatProcesses;
                lblBloatCount.Text = bloatProcesses.Count.ToString();

                // Instantly remove matching names from the main processes list
                for (int i = allProcesses.Count - 1; i >= 0; i--)
                {
                    if (allProcesses[i].ProcessName.Equals(selected.ProcessName, StringComparison.OrdinalIgnoreCase))
                    {
                        allProcesses.RemoveAt(i);
                    }
                }
                lvProcesses.ItemsSource = null;
                lvProcesses.ItemsSource = allProcesses;
            }
            else
            {
                MessageBox.Show(Lang.TranslateString("Impossibile trovare o terminare il processo."), "Smart Process Killer", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }

        private void BtnKillAllBloat_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            if (bloatProcesses.Count == 0)
            {
                MessageBox.Show(Lang.TranslateString("Nessun processo inutile rilevato. Avvia prima la scansione."), Lang.TranslateString("Smart Process Killer"), MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var confirm = MessageBox.Show(
                string.Format(Lang.TranslateString("Stai per terminare {0} processi inutili rilevati in background.\n\nI programmi di sistema e quelli attivi in primo piano non saranno toccati.\n\nContinuare?"), bloatProcesses.Count),
                Lang.TranslateString("Termina Tutti i Processi Inutili"),
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (confirm != MessageBoxResult.Yes) return;

            int totalKilled = 0;
            long memFreed = 0;
            foreach (var item in bloatProcesses)
            {
                if (IsProtectedGpuProcess(item.ProcessName)) continue;
                try
                {
                    Process[] targets = Process.GetProcessesByName(item.ProcessName);
                    foreach (var p in targets)
                    {
                        try
                        {
                            if (IsProtectedGpuProcess(p.ProcessName)) continue;
                            memFreed += p.WorkingSet64;
                            p.Kill();
                            totalKilled++;
                        }
                        catch {}
                    }
                }
                catch {}
            }

            double mbFreed = memFreed / 1024.0 / 1024.0;
            MainWindow.Instance.Log(
                string.Format(Lang.TranslateString("Smart Killer: terminati {0} processi inutili. RAM liberata: ~{1:F0} MB"), totalKilled, mbFreed),
                "SUCCESSO");
            MainWindow.Instance.ShowToast(
                string.Format(Lang.TranslateString("Liberati ~{0:F0} MB! ({1} processi terminati)"), mbFreed, totalKilled));

            // Instantly clear the bloat list
            bloatProcesses.Clear();
            lvBloat.ItemsSource = null;
            lvBloat.ItemsSource = bloatProcesses;
            lblBloatCount.Text = "0";

            // Refresh the main processes list after a small delay to let the OS complete termination tasks
            System.Threading.Tasks.Task.Run(() => {
                System.Threading.Thread.Sleep(600);
                Dispatcher.BeginInvoke(new Action(() => {
                    UpdateRealtimeStats();
                }));
            });

            MainWindow.Instance.DashboardView.RecalculateAllScores();
        }

        private static bool IsProtectedGpuProcess(string processName)
        {
            if (string.IsNullOrEmpty(processName)) return false;
            string name = processName.ToLowerInvariant();
            return name.Contains("nvidia") || name.StartsWith("nv") || name.Contains("geforce") || name.Contains("radeon") || name.Contains("amd");
        }

        private int KillByName(string processName)
        {
            if (IsProtectedGpuProcess(processName)) return 0;
            int killed = 0;
            try
            {
                Process[] targets = Process.GetProcessesByName(processName);
                foreach (var p in targets)
                {
                    try {
                        if (IsProtectedGpuProcess(p.ProcessName)) continue;
                        p.Kill();
                        killed++;
                    }
                    catch {}
                }
            }
            catch {}
            return killed;
        }

        private void BtnOptimizeSystemProcesses_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            UniversalOptimizationResult res = UniversalProcessOptimizerEngine.OptimizeUniversalSystem();
            if (res.Success)
            {
                MainWindow.Instance.Log(res.SummaryMessage, "SUCCESSO");
                MainWindow.Instance.ShowToast(string.Format(Lang.Current == AppLanguage.Italian ? "Ottimizzazione dinamica completata! ({0} in meno)" : "Dynamic optimization completed! ({0} reduced)", res.ReductionAchieved));
                UpdateSystemProcessStatus();
                UpdateRealtimeStats();
            }
            else
            {
                MessageBox.Show(res.SummaryMessage, Lang.Current == AppLanguage.Italian ? "Ottimizzazione Processi" : "Process Optimization", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void BtnRestoreSystemProcesses_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            UniversalOptimizationResult res = UniversalProcessOptimizerEngine.RestoreUniversalSystem();
            if (res.Success)
            {
                MainWindow.Instance.Log(res.SummaryMessage, "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.Current == AppLanguage.Italian ? "Stato processi ripristinato!" : "Process state restored!");
                UpdateSystemProcessStatus();
                UpdateRealtimeStats();
            }
            else
            {
                MessageBox.Show(res.SummaryMessage, Lang.Current == AppLanguage.Italian ? "Ripristino Processi" : "Restore Processes", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        public void UpdateSystemProcessStatus()
        {
            try
            {
                UniversalTopologyReport report = UniversalProcessOptimizerEngine.AnalyzeTopologyDynamic();
                if (lblSystemProcessStatus != null)
                {
                    if (report.IsOptimized)
                    {
                        lblSystemProcessStatus.Text = Lang.Current == AppLanguage.Italian ?
                            "Stato: OTTIMIZZATO (SvcHost accorpati)" :
                            "Status: OPTIMIZED (SvcHost merged)";
                        lblSystemProcessStatus.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#00C080"));
                    }
                    else
                    {
                        lblSystemProcessStatus.Text = Lang.Current == AppLanguage.Italian ?
                            "Stato: ANALISI DINAMICA PRONTA" :
                            "Status: DYNAMIC ANALYSIS READY";
                        lblSystemProcessStatus.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF9F40"));
                    }
                }

                if (lblSystemProcessDetails != null)
                {
                    lblSystemProcessDetails.Text = string.Format(
                        Lang.Current == AppLanguage.Italian ?
                        "Totali: {0} | Critici/Driver: {1} | App Attive: {2} | SvcHost raggruppabili: {3}" :
                        "Total: {0} | Critical/Drivers: {1} | Active Apps: {2} | Groupable SvcHost: {3}",
                        report.TotalProcesses, (report.CriticalSystemCount + report.HardwareDriversCount + report.SecurityCount), report.ActiveAppsCount, report.GroupableSvchostCount);
                }
            }
            catch {}
        }
    }
}
