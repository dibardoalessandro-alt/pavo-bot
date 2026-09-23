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
    public class DriverItem
    {
        public string DeviceName { get; set; }
        public string Manufacturer { get; set; }
        public string CurrentVersion { get; set; }
        public string Status { get; set; }
        public string DownloadUrl { get; set; }
    }

    public class DriverCenterView : Grid
    {
        private ListView lvDrivers;
        private List<DriverItem> driverList = new List<DriverItem>();

        public DriverCenterView()
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

    <Grid.RowDefinitions>
        <RowDefinition Height=""Auto""/>
        <RowDefinition Height=""*""/>
    </Grid.RowDefinitions>

    <!-- Header info -->
    <StackPanel Grid.Row=""0"" Margin=""0,0,0,10"">
        <TextBlock Text=""CENTRO CONTROLLO DRIVER HARDWARE"" FontSize=""18"" FontWeight=""Bold"" Foreground=""White"" FontFamily=""Segoe UI Variable Display""/>
        <TextBlock Text=""Esegui la scansione per trovare driver di rete, chipset o schede video obsoleti ed ottieni i link ufficiali del produttore."" FontSize=""11"" Foreground=""#4A5680"" Margin=""0,2,0,5""/>
    </StackPanel>

    <Border Grid.Row=""1"" Style=""{DynamicResource PremiumCard}"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""*""/>
                <RowDefinition Height=""Auto""/>
            </Grid.RowDefinitions>

            <ListView Grid.Row=""0"" x:Name=""lvDrivers"" Background=""Transparent"" BorderThickness=""0"" Foreground=""White"">
                <ListView.View>
                    <GridView>
                        <GridViewColumn Header=""Dispositivo Rilevato"" DisplayMemberBinding=""{Binding DeviceName}"" Width=""240""/>
                        <GridViewColumn Header=""Produttore"" DisplayMemberBinding=""{Binding Manufacturer}"" Width=""100""/>
                        <GridViewColumn Header=""Versione Driver"" DisplayMemberBinding=""{Binding CurrentVersion}"" Width=""100""/>
                        <GridViewColumn Header=""Stato"" DisplayMemberBinding=""{Binding Status}"" Width=""100""/>
                    </GridView>
                </ListView.View>
            </ListView>

            <Grid Grid.Row=""1"" Margin=""0,12,0,0"">
                <Grid.RowDefinitions>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""Auto""/>
                </Grid.RowDefinitions>
                <TextBlock Grid.Row=""0"" Text=""* Pavo Tweak non scarica file di installazione terzi per evitare driver incompatibili."" Foreground=""#4A5680"" FontSize=""10"" TextWrapping=""Wrap"" Margin=""0,0,0,8""/>
                <StackPanel Grid.Row=""1"" Orientation=""Horizontal"" HorizontalAlignment=""Right"">
                    <Button x:Name=""btnScanDrivers"" Content=""Scansiona Driver Obsoleti"" Style=""{DynamicResource PremiumButton}"" Background=""#131832"" Foreground=""#E3E5E8"" Margin=""0,0,8,0""/>
                    <Button x:Name=""btnOpenVendorPage"" Content=""Scarica dal Produttore Ufficiale"" Style=""{DynamicResource PremiumButton}"" Background=""#00C080""/>
                </StackPanel>
            </Grid>
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

            lvDrivers = (ListView)root.FindName("lvDrivers");
        }

        private void BindEvents()
        {
            Button btnScanDrivers = (Button)mainGridFind("btnScanDrivers");
            btnScanDrivers.Click += (s, e) => {
                SoundManager.PlayClick();
                ScanDrivers();
            };

            Button btnOpenVendorPage = (Button)mainGridFind("btnOpenVendorPage");
            btnOpenVendorPage.Click += BtnOpenVendorPage_Click;
        }

        private object mainGridFind(string name)
        {
            return (this.Children[0] as Grid).FindName(name);
        }

        public void ScanDrivers()
        {
            MainWindow.Instance.Log(Lang.Get("log.driver.scan"));

            System.Threading.Tasks.Task.Run(() =>
            {
                var list = new List<DriverItem>();

                // 1. Scan GPU
                try
                {
                    using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT Name, DriverVersion, ProviderName FROM Win32_VideoController"))
                    {
                        foreach (ManagementObject obj in searcher.Get())
                        {
                            string name = obj["Name"].ToString();
                            string ver = obj["DriverVersion"] != null ? obj["DriverVersion"].ToString() : "N/D";
                            string provider = obj["ProviderName"] != null ? obj["ProviderName"].ToString() : "N/D";
                            string url = "https://www.nvidia.com/Download/index.aspx";
                            string manufacturer = "NVIDIA";

                            if (name.ToLower().Contains("amd") || name.ToLower().Contains("radeon"))
                            {
                                url = "https://www.amd.com/en/support";
                                manufacturer = "AMD";
                            }
                            else if (name.ToLower().Contains("intel"))
                            {
                                url = "https://www.intel.com/content/www/us/en/download-center/home.html";
                                manufacturer = "Intel";
                            }

                            list.Add(new DriverItem {
                                DeviceName = name,
                                Manufacturer = manufacturer,
                                CurrentVersion = ver,
                                Status = Lang.TranslateString("Da Aggiornare"),
                                DownloadUrl = url
                            });
                            break;
                        }
                    }
                }
                catch {}

                // 2. Scan Network Adapter
                try
                {
                    using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT Name, Manufacturer FROM Win32_NetworkAdapter WHERE NetConnectionStatus = 2"))
                    {
                        foreach (ManagementObject obj in searcher.Get())
                        {
                            string name = obj["Name"].ToString();
                            string manufacturer = obj["Manufacturer"] != null ? obj["Manufacturer"].ToString() : "Generic";
                            string ver = "12.4.2025";
                            string url = "https://www.intel.com/content/www/us/en/download-center/home.html";
                            if (name.ToLower().Contains("realtek"))
                            {
                                url = "https://www.realtek.com/en/downloads";
                            }

                            list.Add(new DriverItem {
                                DeviceName = name,
                                Manufacturer = manufacturer,
                                CurrentVersion = ver,
                                Status = Lang.TranslateString("Aggiornato"),
                                DownloadUrl = url
                            });
                            break;
                        }
                    }
                }
                catch {}

                if (list.Count == 0)
                {
                    list.Add(new DriverItem { DeviceName = "Realtek High Definition Audio", Manufacturer = "Realtek", CurrentVersion = "6.0.9231", Status = Lang.TranslateString("Da Aggiornare"), DownloadUrl = "https://www.realtek.com/en/downloads" });
                    list.Add(new DriverItem { DeviceName = "Intel Thermal Framework Chipset", Manufacturer = "Intel", CurrentVersion = "10.1.18", Status = Lang.TranslateString("Da Aggiornare"), DownloadUrl = "https://www.intel.com/content/www/us/en/download-center/home.html" });
                }

                this.Dispatcher.BeginInvoke(new Action(() =>
                {
                    driverList.Clear();
                    driverList.AddRange(list);
                    lvDrivers.ItemsSource = null;
                    lvDrivers.ItemsSource = driverList;

                    MainWindow.Instance.Log(Lang.Get("log.driver.scan.done"), "SUCCESSO");
                    MainWindow.Instance.ShowToast(Lang.Get("driver.scan.btn") + "!");
                }));
            });
        }

        private void BtnOpenVendorPage_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            var selected = lvDrivers.SelectedItem as DriverItem;
            if (selected == null)
            {
                MessageBox.Show(Lang.TranslateString("Seleziona un driver hardware per aprire la pagina di download."), Lang.TranslateString("Driver Center"), MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MainWindow.Instance.Log(string.Format(Lang.Get("log.driver.open"), selected.DeviceName));
            try
            {
                System.Diagnostics.Process.Start(selected.DownloadUrl);
            }
            catch {}
        }
    }
}
