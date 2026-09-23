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
using System.Threading.Tasks;

namespace PavoTweak
{
    public class BenchmarkResult
    {
        public string Date { get; set; }
        public string CpuScore { get; set; }
        public string RamScore { get; set; }
        public string DiskScore { get; set; }
    }

    public class BenchmarkView : Grid
    {
        private TextBlock lblCpuScore;
        private TextBlock lblRamSpeed;
        private TextBlock lblDiskSpeed;
        private ListView lvHistory;
        private ProgressBar pbProgress;

        private Button btnStartCpu;
        private Button btnStartRam;
        private Button btnStartDisk;

        private List<BenchmarkResult> benchHistory = new List<BenchmarkResult>();
        private string historyFilePath;

        public BenchmarkView()
        {
            historyFilePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PavoTweak", "pavo_benchmarks.json");
            InitializeComponent();
            BindEvents();
            LoadHistory();
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
            <Setter Property=""Padding"" Value=""12,6""/>
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
            <Setter Property=""Margin"" Value=""0,0,0,10""/>
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

    <!-- LEFT COLUMN: BENCHMARKS SECTIONS -->
    <Grid Grid.Column=""0"" Margin=""0,0,10,0"">
        <Grid.RowDefinitions>
            <RowDefinition Height=""*""/>
            <RowDefinition Height=""*""/>
            <RowDefinition Height=""*""/>
            <RowDefinition Height=""Auto""/>
        </Grid.RowDefinitions>

        <!-- CPU Benchmark -->
        <Border Grid.Row=""0"" Style=""{DynamicResource PremiumCard}"">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width=""*""/>
                    <ColumnDefinition Width=""135""/>
                </Grid.ColumnDefinitions>
                <StackPanel Grid.Column=""0"" VerticalAlignment=""Center"">
                    <TextBlock Text=""1. BENCHMARK PROCESSORE CPU"" FontSize=""11"" FontWeight=""Bold"" Foreground=""White""/>
                    <TextBlock Text=""Risoluzione parallela multi-thread di numeri primi complessi per sollecitare i core a pieno carico."" FontSize=""9"" Foreground=""#4A5680"" TextWrapping=""Wrap"" Margin=""0,3,0,0""/>
                </StackPanel>
                <StackPanel Grid.Column=""1"" VerticalAlignment=""Center"" HorizontalAlignment=""Right"">
                    <TextBlock x:Name=""lblCpuScore"" Text=""Score: -- Pts"" FontSize=""12"" FontWeight=""Bold"" Foreground=""#7C5CFC"" HorizontalAlignment=""Center"" Margin=""0,0,0,6""/>
                    <Button x:Name=""btnStartCpu"" Content=""Avvia CPU Test"" Style=""{DynamicResource PremiumButton}"" Width=""120""/>
                </StackPanel>
            </Grid>
        </Border>

        <!-- RAM Benchmark -->
        <Border Grid.Row=""1"" Style=""{DynamicResource PremiumCard}"">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width=""*""/>
                    <ColumnDefinition Width=""135""/>
                </Grid.ColumnDefinitions>
                <StackPanel Grid.Column=""0"" VerticalAlignment=""Center"">
                    <TextBlock Text=""2. BENCHMARK MEMORIA RAM"" FontSize=""11"" FontWeight=""Bold"" Foreground=""White""/>
                    <TextBlock Text=""Calcola la velocità di allocazione dinamica e lettura/scrittura di blocchi sequenziali in memoria virtuale."" FontSize=""9"" Foreground=""#4A5680"" TextWrapping=""Wrap"" Margin=""0,3,0,0""/>
                </StackPanel>
                <StackPanel Grid.Column=""1"" VerticalAlignment=""Center"" HorizontalAlignment=""Right"">
                    <TextBlock x:Name=""lblRamSpeed"" Text=""-- GB/s"" FontSize=""12"" FontWeight=""Bold"" Foreground=""#7C5CFC"" HorizontalAlignment=""Center"" Margin=""0,0,0,6""/>
                    <Button x:Name=""btnStartRam"" Content=""Avvia RAM Test"" Style=""{DynamicResource PremiumButton}"" Width=""120""/>
                </StackPanel>
            </Grid>
        </Border>

        <!-- Disk Benchmark -->
        <Border Grid.Row=""2"" Style=""{DynamicResource PremiumCard}"" Margin=""0"">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width=""*""/>
                    <ColumnDefinition Width=""135""/>
                </Grid.ColumnDefinitions>
                <StackPanel Grid.Column=""0"" VerticalAlignment=""Center"">
                    <TextBlock Text=""3. BENCHMARK DISCO DI SISTEMA"" FontSize=""11"" FontWeight=""Bold"" Foreground=""White""/>
                    <TextBlock Text=""Misura la velocità di scrittura sequenziale scrivendo un file temporaneo criptato da 200MB su partizione C:."" FontSize=""9"" Foreground=""#4A5680"" TextWrapping=""Wrap"" Margin=""0,3,0,0""/>
                </StackPanel>
                <StackPanel Grid.Column=""1"" VerticalAlignment=""Center"" HorizontalAlignment=""Right"">
                    <TextBlock x:Name=""lblDiskSpeed"" Text=""-- MB/s"" FontSize=""12"" FontWeight=""Bold"" Foreground=""#7C5CFC"" HorizontalAlignment=""Center"" Margin=""0,0,0,6""/>
                    <Button x:Name=""btnStartDisk"" Content=""Avvia Disco Test"" Style=""{DynamicResource PremiumButton}"" Width=""120""/>
                </StackPanel>
            </Grid>
        </Border>

        <!-- Global Progress Bar -->
        <ProgressBar Grid.Row=""3"" x:Name=""pbProgress"" Height=""5"" Foreground=""#7C5CFC"" Background=""#1B1D27"" BorderThickness=""0"" Visibility=""Collapsed"" Margin=""0,10,0,0""/>
    </Grid>

    <!-- RIGHT COLUMN: HISTORY DATABASE -->
    <Border Grid.Column=""1"" Style=""{DynamicResource PremiumCard}"" Margin=""0"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""*""/>
                <RowDefinition Height=""Auto""/>
            </Grid.RowDefinitions>

            <TextBlock Grid.Row=""0"" Text=""CRONOLOGIA RISULTATI"" FontSize=""11"" FontWeight=""Bold"" Foreground=""White"" Margin=""0,0,0,10""/>

            <ListView Grid.Row=""1"" x:Name=""lvHistory"" Background=""Transparent"" BorderThickness=""0"" Foreground=""White"">
                <ListView.View>
                    <GridView>
                        <GridViewColumn Header=""Data"" DisplayMemberBinding=""{Binding Date}"" Width=""65""/>
                        <GridViewColumn Header=""CPU"" DisplayMemberBinding=""{Binding CpuScore}"" Width=""45""/>
                        <GridViewColumn Header=""RAM"" DisplayMemberBinding=""{Binding RamScore}"" Width=""55""/>
                        <GridViewColumn Header=""Disk"" DisplayMemberBinding=""{Binding DiskScore}"" Width=""55""/>
                    </GridView>
                </ListView.View>
            </ListView>

            <Button Grid.Row=""2"" x:Name=""btnClearHistory"" Content=""Cancella Archivio"" Style=""{DynamicResource PremiumButton}"" Background=""#F23F43"" HorizontalAlignment=""Right"" Margin=""0,10,0,0"" Height=""24"" Width=""115""/>
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

            lblCpuScore = (TextBlock)root.FindName("lblCpuScore");
            lblRamSpeed = (TextBlock)root.FindName("lblRamSpeed");
            lblDiskSpeed = (TextBlock)root.FindName("lblDiskSpeed");
            lvHistory = (ListView)root.FindName("lvHistory");
            pbProgress = (ProgressBar)root.FindName("pbProgress");

            btnStartCpu = (Button)root.FindName("btnStartCpu");
            btnStartRam = (Button)root.FindName("btnStartRam");
            btnStartDisk = (Button)root.FindName("btnStartDisk");
        }

        private void BindEvents()
        {
            btnStartCpu.Click += async (s, e) => { SoundManager.PlayClick(); await RunCpuBenchmark(); };
            btnStartRam.Click += async (s, e) => { SoundManager.PlayClick(); await RunRamBenchmark(); };
            btnStartDisk.Click += async (s, e) => { SoundManager.PlayClick(); await RunDiskBenchmark(); };

            Button btnClearHistory = (Button)mainGridFind("btnClearHistory");
            btnClearHistory.Click += (s, e) => {
                SoundManager.PlayClick();
                DeleteHistory();
            };
        }

        private object mainGridFind(string name)
        {
            return (this.Children[0] as Grid).FindName(name);
        }

        private void SetButtonsEnabled(bool enabled)
        {
            btnStartCpu.IsEnabled = enabled;
            btnStartRam.IsEnabled = enabled;
            btnStartDisk.IsEnabled = enabled;
        }

        private async Task RunCpuBenchmark()
        {
            SetButtonsEnabled(false);
            pbProgress.Visibility = Visibility.Visible;
            pbProgress.Value = 20;
            lblCpuScore.Text = Lang.TranslateString("Calcolo...");
            MainWindow.Instance.Log("Avvio benchmark CPU (Calcolo numeri primi parallelo)...");

            Stopwatch sw = Stopwatch.StartNew();
            
            await Task.Run(() => {
                // Prime search simulation to put heavy load on multiple threads
                Parallel.For(2, 450000, i => {
                    IsPrime(i);
                });
            });

            sw.Stop();
            pbProgress.Value = 100;

            // Pts Calculation: shorter elapsed time equals higher score
            double sec = sw.Elapsed.TotalSeconds;
            int score = (int)(25000.0 / Math.Max(sec, 0.1));

            lblCpuScore.Text = string.Format("{0} Pts", score);
            MainWindow.Instance.Log(string.Format("Benchmark CPU completato in {0:F2}s. Score ottenuto: {1} Pts.", sec, score), "SUCCESSO");
            MainWindow.Instance.ShowToast(Lang.TranslateString("Benchmark CPU completato!"));

            SetButtonsEnabled(true);
            pbProgress.Visibility = Visibility.Collapsed;

            SaveResult(score.ToString(), "N/D", "N/D");
        }

        private bool IsPrime(int number)
        {
            if (number <= 1) return false;
            if (number == 2) return true;
            if (number % 2 == 0) return false;
            var boundary = (int)Math.Floor(Math.Sqrt(number));
            for (int i = 3; i <= boundary; i += 2)
            {
                if (number % i == 0) return false;
            }
            return true;
        }

        private async Task RunRamBenchmark()
        {
            SetButtonsEnabled(false);
            pbProgress.Visibility = Visibility.Visible;
            pbProgress.Value = 20;
            lblRamSpeed.Text = Lang.TranslateString("Allocazione...");
            MainWindow.Instance.Log("Avvio benchmark RAM (Scrittura sequenziale array di dati)...");

            Stopwatch sw = Stopwatch.StartNew();

            double speedGb = 0;
            await Task.Run(() => {
                try
                {
                    // Allocate and touch memory blocks
                    int size = 60 * 1024 * 1024; // 60MB * 4 bytes per int = 240MB
                    int[] data = new int[size];
                    for (int i = 0; i < size; i += 4)
                    {
                        data[i] = i;
                    }
                    sw.Stop();
                    // GB/s
                    double bytes = size * 4.0;
                    double sec = sw.Elapsed.TotalSeconds;
                    speedGb = (bytes / 1024.0 / 1024.0 / 1024.0) / Math.Max(sec, 0.05);
                }
                catch {}
            });

            pbProgress.Value = 100;
            lblRamSpeed.Text = string.Format("{0:F1} GB/s", speedGb);
            MainWindow.Instance.Log(string.Format("Benchmark RAM completato. Velocità di trasferimento stimata: {0:F1} GB/s.", speedGb), "SUCCESSO");
            MainWindow.Instance.ShowToast(Lang.TranslateString("Benchmark RAM completato!"));

            SetButtonsEnabled(true);
            pbProgress.Visibility = Visibility.Collapsed;

            SaveResult("N/D", string.Format("{0:F1} GB/s", speedGb), "N/D");
        }

        private async Task RunDiskBenchmark()
        {
            SetButtonsEnabled(false);
            pbProgress.Visibility = Visibility.Visible;
            pbProgress.Value = 20;
            lblDiskSpeed.Text = Lang.TranslateString("Scrittura...");
            MainWindow.Instance.Log("Avvio benchmark Disco (Scrittura sequenziale file temporaneo C:\\pavo_temp_bench)...");

            string path = Path.Combine(Environment.CurrentDirectory, "pavo_temp_bench.tmp");
            int size = 200 * 1024 * 1024; // 200 MB
            byte[] block = new byte[1024 * 1024]; // 1MB blocks
            new Random().NextBytes(block);

            Stopwatch sw = Stopwatch.StartNew();
            
            try
            {
                await Task.Run(() => {
                    using (FileStream fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 4096, true))
                    {
                        int blocksCount = size / block.Length;
                        for (int i = 0; i < blocksCount; i++)
                        {
                            fs.Write(block, 0, block.Length);
                        }
                    }
                });

                sw.Stop();
                pbProgress.Value = 100;

                double sec = sw.Elapsed.TotalSeconds;
                double speedMb = 200.0 / Math.Max(sec, 0.1);

                lblDiskSpeed.Text = string.Format("{0:F0} MB/s", speedMb);
                MainWindow.Instance.Log(string.Format("Benchmark Disco completato. Velocità di scrittura sequenziale: {0:F0} MB/s.", speedMb), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.TranslateString("Benchmark Disco completato!"));

                // Clean up file
                if (File.Exists(path)) File.Delete(path);

                SaveResult("N/D", "N/D", string.Format("{0:F0} MB/s", speedMb));
            }
            catch (Exception ex)
            {
                lblDiskSpeed.Text = Lang.TranslateString("Errore IO");
                MainWindow.Instance.Log("Impossibile eseguire benchmark disco: " + ex.Message, "ERRORE");
            }
            finally
            {
                SetButtonsEnabled(true);
                pbProgress.Visibility = Visibility.Collapsed;
            }
        }

        private void SaveResult(string cpu, string ram, string disk)
        {
            var res = new BenchmarkResult
            {
                Date = DateTime.Now.ToString("dd/MM HH:mm"),
                CpuScore = cpu,
                RamScore = ram,
                DiskScore = disk
            };

            benchHistory.Add(res);
            UpdateHistoryUI();

            // Save history file
            try
            {
                string dir = Path.GetDirectoryName(historyFilePath);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                // Simple JSON serialize
                string json = "[\r\n";
                for (int i = 0; i < benchHistory.Count; i++)
                {
                    var item = benchHistory[i];
                    json += string.Format("  {{\"Date\":\"{0}\",\"CpuScore\":\"{1}\",\"RamScore\":\"{2}\",\"DiskScore\":\"{3}\"}}{4}\r\n",
                        item.Date, item.CpuScore, item.RamScore, item.DiskScore, i == benchHistory.Count - 1 ? "" : ",");
                }
                json += "]";
                File.WriteAllText(historyFilePath, json);
            }
            catch {}
        }

        private void LoadHistory()
        {
            benchHistory.Clear();
            try
            {
                if (File.Exists(historyFilePath))
                {
                    string json = File.ReadAllText(historyFilePath);
                    // Extremely basic JSON parser
                    int index = 0;
                    while (true)
                    {
                        int start = json.IndexOf("{", index);
                        if (start == -1) break;
                        int end = json.IndexOf("}", start);
                        if (end == -1) break;

                        string block = json.Substring(start, end - start + 1);
                        string date = GetJsonValue(block, "Date");
                        string cpu = GetJsonValue(block, "CpuScore");
                        string ram = GetJsonValue(block, "RamScore");
                        string disk = GetJsonValue(block, "DiskScore");

                        benchHistory.Add(new BenchmarkResult { Date = date, CpuScore = cpu, RamScore = ram, DiskScore = disk });
                        index = end + 1;
                    }
                }
            }
            catch {}

            UpdateHistoryUI();
        }

        private string GetJsonValue(string block, string key)
        {
            string search = "\"" + key + "\":\"";
            int idx = block.IndexOf(search);
            if (idx == -1) return "N/D";
            int start = idx + search.Length;
            int end = block.IndexOf("\"", start);
            return block.Substring(start, end - start);
        }

        private void UpdateHistoryUI()
        {
            lvHistory.ItemsSource = null;
            lvHistory.ItemsSource = benchHistory;
        }

        private void DeleteHistory()
        {
            try
            {
                if (File.Exists(historyFilePath)) File.Delete(historyFilePath);
            }
            catch {}
            benchHistory.Clear();
            UpdateHistoryUI();
            MainWindow.Instance.Log("Archivio cronologia benchmark cancellato.");
        }
    }
}
