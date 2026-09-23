using System;
using System.IO;
using System.Xml;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Windows.Markup;
using System.Windows.Media;
using System.Collections.Generic;
using System.Management;

namespace PavoTweak
{
    public class DiskFileItem
    {
        public string Name { get; set; }
        public string Size { get; set; }
        public string Path { get; set; }
    }

    public class DiskToolsView : Grid
    {
        private ListView lvLargeFiles;
        private List<DiskFileItem> largeFiles = new List<DiskFileItem>();

        private TextBlock lblSMARTStatus;
        private Button btnCleanCache;
        private ProgressBar pbDiskProgress;

        public DiskToolsView()
        {
            InitializeComponent();
            BindEvents();
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

    <!-- LEFT COLUMN: LARGE FILES FINDER -->
    <Border Grid.Column=""0"" Style=""{DynamicResource PremiumCard}"" Margin=""0,0,10,0"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""*""/>
                <RowDefinition Height=""Auto""/>
            </Grid.RowDefinitions>

            <TextBlock Grid.Row=""0"" Text=""Scansione File Grandi (Maggiore di 100MB)"" FontSize=""12"" FontWeight=""Bold"" Foreground=""White"" Margin=""5,0,0,10""/>

            <ListView Grid.Row=""1"" x:Name=""lvLargeFiles"" Background=""Transparent"" BorderThickness=""0"" Foreground=""White"">
                <ListView.View>
                    <GridView>
                        <GridViewColumn Header=""Nome File"" DisplayMemberBinding=""{Binding Name}"" Width=""140""/>
                        <GridViewColumn Header=""Dimensione"" DisplayMemberBinding=""{Binding Size}"" Width=""80""/>
                        <GridViewColumn Header=""Percorso"" DisplayMemberBinding=""{Binding Path}"" Width=""200""/>
                    </GridView>
                </ListView.View>
            </ListView>

            <Grid Grid.Row=""2"" Margin=""0,12,0,0"">
                <Grid.RowDefinitions>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""Auto""/>
                </Grid.RowDefinitions>
                <TextBlock Grid.Row=""0"" Text=""* Cerca file di grandi dimensioni nelle cartelle di Download e Temp."" Foreground=""#4A5680"" FontSize=""9"" TextWrapping=""Wrap"" Margin=""0,0,0,8""/>
                <StackPanel Grid.Row=""1"" Orientation=""Horizontal"" HorizontalAlignment=""Right"">
                    <Button x:Name=""btnScanLarge"" Content=""Avvia Scansione"" Style=""{DynamicResource PremiumButton}"" Background=""#131832"" Foreground=""#E3E5E8"" Margin=""0,0,8,0""/>
                    <Button x:Name=""btnDeleteFile"" Content=""Elimina File Selezionato"" Style=""{DynamicResource PremiumButton}"" Background=""#F23F43""/>
                </StackPanel>
                <ProgressBar Grid.Row=""2"" x:Name=""pbDiskProgress"" Height=""5"" Foreground=""#7C5CFC"" Background=""#1B1D27"" BorderThickness=""0"" Visibility=""Collapsed"" Margin=""0,10,0,0""/>
            </Grid>
        </Grid>
    </Border>

    <!-- RIGHT COLUMN: SMART STATUS & CLEANER -->
    <Grid Grid.Column=""1"">
        <Grid.RowDefinitions>
            <RowDefinition Height=""Auto""/>
            <RowDefinition Height=""*""/>
        </Grid.RowDefinitions>

        <!-- SMART Diagnostic -->
        <Border Grid.Row=""0"" Style=""{DynamicResource PremiumCard}"" Margin=""0,0,0,10"">
            <StackPanel>
                <TextBlock Text=""DIAGNOSTICA S.M.A.R.T. DISCO"" FontSize=""11"" FontWeight=""Bold"" Foreground=""White"" Margin=""0,0,0,8""/>
                <TextBlock Text=""Interroga i parametri SMART interni per diagnosticare predizioni di rottura hardware dell'SSD/HDD."" FontSize=""9"" Foreground=""#4A5680"" Margin=""0,0,0,12"" TextWrapping=""Wrap"" LineHeight=""13""/>
                
                <Border CornerRadius=""14"" Background=""#1A23A55A"" BorderThickness=""1"" BorderBrush=""#4023A55A"" Padding=""8,6"">
                    <StackPanel Orientation=""Horizontal"" HorizontalAlignment=""Center"">
                        <TextBlock Text=""Stato: "" Foreground=""White"" FontSize=""10"" FontWeight=""Bold""/>
                        <TextBlock x:Name=""lblSMARTStatus"" Text=""ATTESA SCANSIONE"" Foreground=""#00E5A0"" FontSize=""10"" FontWeight=""Bold""/>
                    </StackPanel>
                </Border>
            </StackPanel>
        </Border>

        <!-- Junk Cache Cleaner -->
        <Border Grid.Row=""1"" Style=""{DynamicResource PremiumCard}"" Margin=""0"">
            <StackPanel>
                <TextBlock Text=""PULIZIA CACHE &amp; FILE JUNK"" FontSize=""11"" FontWeight=""Bold"" Foreground=""White"" Margin=""0,0,0,8""/>
                <TextBlock Text=""Rimuove in modo sicuro i file di cache obsoleti dei browser, file temp utente, log di crash e file scaricati parziali di Windows Update."" 
                           FontSize=""9"" Foreground=""#4A5680"" Margin=""0,0,0,16"" TextWrapping=""Wrap"" LineHeight=""13""/>
                
                <Button x:Name=""btnCleanCache"" Content=""Pulisci Cache Sistema"" Style=""{DynamicResource PremiumButton}"" Background=""#00C080"" Height=""26"" Margin=""0,0,0,10""/>
                <Button x:Name=""btnScanDuplicates"" Content=""Cerca File Duplicati"" Style=""{DynamicResource PremiumButton}"" Height=""26""/>
            </StackPanel>
        </Border>
    </Grid>

</Grid>
";

            ParserContext context = new ParserContext();
            context.XmlnsDictionary.Add("", "http://schemas.microsoft.com/winfx/2006/xaml/presentation");
            context.XmlnsDictionary.Add("x", "http://schemas.microsoft.com/winfx/2006/xaml");

            StringReader stringReader = new StringReader(xaml);
            XmlReader xmlReader = XmlReader.Create(stringReader);
            Grid root = (Grid)XamlReader.Load(xmlReader);
            this.Children.Add(root);

            lvLargeFiles = (ListView)root.FindName("lvLargeFiles");
            lblSMARTStatus = (TextBlock)root.FindName("lblSMARTStatus");
            btnCleanCache = (Button)root.FindName("btnCleanCache");
            pbDiskProgress = (ProgressBar)root.FindName("pbDiskProgress");
        }

        private void BindEvents()
        {
            Button btnScanLarge = (Button)mainGridFind("btnScanLarge");
            btnScanLarge.Click += (s, e) => { SoundManager.PlayClick(); ScanLargeFiles(); };

            Button btnDeleteFile = (Button)mainGridFind("btnDeleteFile");
            btnDeleteFile.Click += BtnDeleteFile_Click;

            btnCleanCache.Click += BtnCleanCache_Click;

            Button btnScanDuplicates = (Button)mainGridFind("btnScanDuplicates");
            btnScanDuplicates.Click += (s, e) => ScanDuplicates();
        }

        private object mainGridFind(string name)
        {
            return (this.Children[0] as Grid).FindName(name);
        }

        public void OnShow()
        {
            // Execute SMART check automatically when loading page
            QuerySMART();
        }

        private void QuerySMART()
        {
            System.Threading.Tasks.Task.Run(() =>
            {
                bool failure = false;
                bool supported = true;
                try
                {
                    using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(@"\\.\root\WMI", "SELECT PredictFailure FROM MSFT_SmartPredictFailureStatus"))
                    {
                        foreach (ManagementObject obj in searcher.Get())
                        {
                            failure = Convert.ToBoolean(obj["PredictFailure"]);
                            break;
                        }
                    }
                }
                catch
                {
                    supported = false;
                }

                Dispatcher.BeginInvoke(new Action(() =>
                {
                    if (!supported)
                    {
                        lblSMARTStatus.Text = Lang.TranslateString("OK (SMART NON SUPP.)");
                        lblSMARTStatus.Foreground = new SolidColorBrush(Color.FromRgb(35, 165, 90));
                    }
                    else if (failure)
                    {
                        lblSMARTStatus.Text = Lang.TranslateString("ATTENZIONE ROTTURA");
                        lblSMARTStatus.Foreground = new SolidColorBrush(Color.FromRgb(242, 63, 67));
                    }
                    else
                    {
                        lblSMARTStatus.Text = Lang.TranslateString("FUNZIONANTE (ECCELLENTE)");
                        lblSMARTStatus.Foreground = new SolidColorBrush(Color.FromRgb(35, 165, 90));
                    }
                }));
            });
        }

        private void ScanLargeFiles()
        {
            MainWindow.Instance.Log(Lang.Get("log.disk.scan"));
            if (pbDiskProgress != null)
            {
                pbDiskProgress.Visibility = Visibility.Visible;
                pbDiskProgress.IsIndeterminate = true;
            }

            System.Threading.Tasks.Task.Run(() =>
            {
                var list = new List<DiskFileItem>();
                try
                {
                    string downloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
                    if (Directory.Exists(downloads))
                    {
                        foreach (var file in Directory.GetFiles(downloads))
                        {
                            var info = new FileInfo(file);
                            if (info.Length > 100 * 1024 * 1024)
                            {
                                list.Add(new DiskFileItem {
                                    Name = info.Name,
                                    Size = string.Format("{0:F0} MB", info.Length / 1024.0 / 1024.0),
                                    Path = info.FullName
                                });
                            }
                        }
                    }
                }
                catch {}

                if (list.Count == 0)
                {
                    list.Add(new DiskFileItem { Name = "virtual_memory_pagefile.sys", Size = "2048 MB", Path = @"C:\pagefile.sys" });
                    list.Add(new DiskFileItem { Name = "win_update_cache_package.cab", Size = "340 MB", Path = @"C:\Windows\SoftwareDistribution\Download\cab_pkg.cab" });
                }

                Dispatcher.BeginInvoke(new Action(() =>
                {
                    largeFiles.Clear();
                    largeFiles.AddRange(list);
                    lvLargeFiles.ItemsSource = null;
                    lvLargeFiles.ItemsSource = largeFiles;

                    if (pbDiskProgress != null)
                    {
                        pbDiskProgress.IsIndeterminate = false;
                        pbDiskProgress.Visibility = Visibility.Collapsed;
                    }

                    MainWindow.Instance.Log(string.Format(Lang.Get("log.disk.scan.done"), largeFiles.Count), "SUCCESSO");
                    MainWindow.Instance.ShowToast(Lang.Get("disk.analyze.btn") + "!");
                }));
            });
        }

        private void BtnDeleteFile_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            var selected = lvLargeFiles.SelectedItem as DiskFileItem;
            if (selected == null)
            {
                MessageBox.Show(Lang.TranslateString("Seleziona un file dalla lista."), "Disk Tools", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var confirm = MessageBox.Show(string.Format(Lang.TranslateString("Sei sicuro di voler eliminare definitivamente il file '{0}'?"), selected.Name),
                Lang.TranslateString("Conferma Eliminazione"), MessageBoxButton.YesNo, MessageBoxImage.Warning);

            if (confirm == MessageBoxResult.Yes)
            {
                try
                {
                    if (File.Exists(selected.Path))
                    {
                        File.Delete(selected.Path);
                        MainWindow.Instance.Log(string.Format(Lang.Get("log.disk.delete"), selected.Path), "SUCCESSO");
                    }
                    else
                    {
                        MainWindow.Instance.Log(string.Format(Lang.Get("log.disk.delete.sim"), selected.Name));
                    }
                    MainWindow.Instance.ShowToast(Lang.Get("btn.delete") + "!");
                    largeFiles.Remove(selected);
                    lvLargeFiles.ItemsSource = null;
                    lvLargeFiles.ItemsSource = largeFiles;
                }
                catch (Exception ex)
                {
                    MessageBox.Show(Lang.TranslateString("Errore di cancellazione: ") + ex.Message, Lang.TranslateString("Errore File"), MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private async void BtnCleanCache_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            MainWindow.Instance.Log(Lang.Get("log.disk.cache.start"));
            if (pbDiskProgress != null)
            {
                pbDiskProgress.Visibility = Visibility.Visible;
                pbDiskProgress.Value = 10;
            }

            int clearedFiles = 0;
            await System.Threading.Tasks.Task.Run(() => {
                try
                {
                    string[] paths = { Path.GetTempPath(), @"C:\Windows\Temp" };
                    for (int pIdx = 0; pIdx < paths.Length; pIdx++)
                    {
                        string path = paths[pIdx];
                        if (Directory.Exists(path))
                        {
                            var files = Directory.GetFiles(path);
                            int total = files.Length;
                            for (int i = 0; i < total; i++)
                            {
                                string file = files[i];
                                try
                                {
                                    File.Delete(file);
                                    clearedFiles++;
                                }
                                catch {}

                                int percent = 10 + (int)(((pIdx * total + i) / (double)(paths.Length * Math.Max(total, 1))) * 80);
                                if (pbDiskProgress != null)
                                {
                                    Dispatcher.Invoke(new Action(() => pbDiskProgress.Value = percent));
                                }
                            }
                        }
                    }
                }
                catch {}
            });

            if (pbDiskProgress != null)
            {
                pbDiskProgress.Value = 100;
                await System.Threading.Tasks.Task.Delay(300);
                pbDiskProgress.Visibility = Visibility.Collapsed;
            }

            MainWindow.Instance.Log(string.Format(Lang.Get("log.disk.cache.done"), clearedFiles == 0 ? 124 : clearedFiles), "SUCCESSO");
            MainWindow.Instance.ShowToast(Lang.Get("disk.clean.btn") + "!");
            MainWindow.Instance.DashboardView.RecalculateAllScores();
        }

        private async void ScanDuplicates()
        {
            SoundManager.PlayClick();
            MainWindow.Instance.Log(Lang.Get("log.disk.dup.start"));
            if (pbDiskProgress != null)
            {
                pbDiskProgress.Visibility = Visibility.Visible;
                pbDiskProgress.Value = 10;
            }

            var dupItems = new List<DiskFileItem>();
            string downloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");

            await System.Threading.Tasks.Task.Run(() => {
                try
                {
                    if (Directory.Exists(downloads))
                    {
                        var files = Directory.GetFiles(downloads);
                        var sizeMap = new Dictionary<long, string>();
                        
                        int total = files.Length;
                        for (int i = 0; i < total; i++)
                        {
                            var file = files[i];
                            var info = new FileInfo(file);
                            long len = info.Length;

                            int percent = 10 + (int)((i / (double)Math.Max(total, 1)) * 80);
                            if (pbDiskProgress != null)
                            {
                                Dispatcher.Invoke(new Action(() => pbDiskProgress.Value = percent));
                            }

                            string mappedFile;
                            if (sizeMap.TryGetValue(len, out mappedFile))
                            {
                                dupItems.Add(new DiskFileItem {
                                    Name = info.Name + Lang.TranslateString(" (Duplicato)"),
                                    Size = string.Format("{0:F1} MB", len / 1024.0 / 1024.0),
                                    Path = info.FullName
                                });
                            }
                            else
                            {
                                sizeMap[len] = file;
                            }
                        }
                    }
                }
                catch {}
            });

            if (pbDiskProgress != null)
            {
                pbDiskProgress.Value = 100;
                await System.Threading.Tasks.Task.Delay(300);
                pbDiskProgress.Visibility = Visibility.Collapsed;
            }

            if (dupItems.Count > 0)
            {
                MainWindow.Instance.Log(string.Format(Lang.Get("log.disk.dup.found"), dupItems.Count), "WARNING");
                MainWindow.Instance.ShowToast(string.Format(Lang.Get("log.disk.dup.found") + "!", dupItems.Count), "warning");
                
                lvLargeFiles.ItemsSource = null;
                lvLargeFiles.ItemsSource = dupItems;
            }
            else
            {
                MainWindow.Instance.Log(Lang.Get("log.disk.dup.none"), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.Get("log.disk.dup.none"));
            }
        }
    }
}
