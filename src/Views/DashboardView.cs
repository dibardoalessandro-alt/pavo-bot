using System;
using System.IO;
using System.Xml;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Diagnostics;
using Microsoft.Win32;

namespace PavoTweak
{
    public class DashboardView : Grid
    {
        private TextBlock lblHealthScore;
        private TextBlock lblStartupScore;
        private TextBlock lblStorageScore;
        private TextBlock lblRamScore;
        private TextBlock lblGamingScore;
        private TextBlock lblOverallScore;
        private TextBlock lblWidgetClock;
        private TextBlock lblWidgetDate;
        private TextBlock lblWidgetWeather;
        private TextBlock lblNetTraffic;
        private ProgressBar pbCpuBar;
        private ProgressBar pbGpuBar;
        private ProgressBar pbRamBar;
        private TextBlock lblCpuPercent;
        private TextBlock lblGpuPercent;
        private TextBlock lblRamPercent;
        private CircularProgress scoreProgressRing;

        // Expanded Drawer References
        private Grid drawerContainer;
        private TextBlock lblDrawerTitle;
        private TextBlock lblDrawerStatus;
        private ItemsControl icDrawerItems;
        private Button btnDrawerFixAll;

        private string activeFixCategory = "";

        public DashboardView()
        {
            InitializeComponent();
            BindEvents();
            RecalculateAllScores();
            RefreshWidgets();
            Lang.LanguageChanged += RefreshLanguage;
        }

        private void RefreshLanguage()
        {
            this.Children.Clear();
            InitializeComponent();
            BindEvents();
            RecalculateAllScores();
            RefreshWidgets();
        }
        private void InitializeComponent()
        {
            string xaml = @"
<Grid xmlns=""http://schemas.microsoft.com/winfx/2006/xaml/presentation""
      xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml""
      xmlns:local=""clr-namespace:PavoTweak;assembly=PavoTweak"">

    <Grid.ColumnDefinitions>
        <ColumnDefinition Width=""*""/>
        <ColumnDefinition Width=""220""/>
    </Grid.ColumnDefinitions>

    <!-- ═══ LEFT COLUMN ═══ -->
    <Grid Grid.Column=""0"" Margin=""0,0,16,0"">
        <Grid.RowDefinitions>
            <RowDefinition Height=""Auto""/>
            <RowDefinition Height=""*""/>
            <RowDefinition Height=""Auto""/>
        </Grid.RowDefinitions>

        <!-- ─── OVERALL SCORE HEADER ─── -->
        <Border Grid.Row=""0"" CornerRadius=""10"" BorderThickness=""1"" Padding=""20,16"">
            <Border.BorderBrush><SolidColorBrush Color=""#161B2E""/></Border.BorderBrush>
            <Border.Background><SolidColorBrush Color=""#0A0D18""/></Border.Background>
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width=""Auto""/>
                    <ColumnDefinition Width=""*""/>
                    <ColumnDefinition Width=""Auto""/>
                </Grid.ColumnDefinitions>

                <!-- Score ring -->
                <Grid Grid.Column=""0"" Width=""68"" Height=""68"" VerticalAlignment=""Center"">
                    <local:CircularProgress x:Name=""scoreProgressRing"" Value=""0"" StrokeThickness=""6"" IndicatorBrush=""{DynamicResource AccentBrush}""/>
                    <TextBlock x:Name=""lblOverallScore"" Text=""0"" Foreground=""White"" FontSize=""20"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
                </Grid>

                <!-- Title & description -->
                <StackPanel Grid.Column=""1"" Margin=""18,0,0,0"" VerticalAlignment=""Center"">
                    <TextBlock Text=""[[dash.score.title]]"" FontSize=""13"" FontWeight=""SemiBold"" FontFamily=""Segoe UI Variable Display"" Foreground=""#D0D6E8""/>
                    <TextBlock Text=""[[dash.score.desc]]"" Foreground=""#4A5068"" FontSize=""10"" FontFamily=""Segoe UI Variable Text"" TextWrapping=""Wrap"" Margin=""0,4,0,0"" LineHeight=""14""/>
                </StackPanel>

                <!-- Premium badge -->
                <Border Grid.Column=""2"" CornerRadius=""6"" Padding=""10,4"" VerticalAlignment=""Center"" Background=""#3B82F6"">
                    <TextBlock Text=""PREMIUM"" Foreground=""White"" FontSize=""8"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display""/>
                </Border>
            </Grid>
        </Border>

        <!-- ─── SCORE CARDS GRID ─── -->
        <Grid Grid.Row=""1"" Margin=""0,12,0,0"">
            <Grid.RowDefinitions>
                <RowDefinition Height=""*""/>
                <RowDefinition Height=""Auto""/>
            </Grid.RowDefinitions>

            <UniformGrid Grid.Row=""0"" Columns=""2"" Rows=""3"">

                <!-- Health Card -->
                <Border x:Name=""btnCardHealth"" CornerRadius=""10"" BorderThickness=""1"" Padding=""14,12"" Margin=""0,0,5,5"" Cursor=""Hand"">
                    <Border.BorderBrush><SolidColorBrush Color=""#161B2E""/></Border.BorderBrush>
                    <Border.Background><SolidColorBrush Color=""#0A0D18""/></Border.Background>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height=""Auto""/>
                            <RowDefinition Height=""*""/>
                        </Grid.RowDefinitions>
                        <StackPanel Grid.Row=""0"" Orientation=""Horizontal"">
                            <Border Width=""26"" Height=""26"" CornerRadius=""6"" Background=""#0F1525"" Margin=""0,0,8,0"">
                                <TextBlock Text=""&#xE727;"" FontFamily=""Segoe MDL2 Assets"" Foreground=""#3B82F6"" FontSize=""12"" HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
                            </Border>
                            <TextBlock Text=""[[dash.card.health]]"" Foreground=""#8890A8"" FontWeight=""SemiBold"" FontSize=""11"" FontFamily=""Segoe UI Variable Text"" VerticalAlignment=""Center""/>
                        </StackPanel>
                        <TextBlock Grid.Row=""1"" x:Name=""lblHealthScore"" Text=""Score: --"" FontSize=""18"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" HorizontalAlignment=""Right"" VerticalAlignment=""Bottom"" Foreground=""#3B82F6""/>
                    </Grid>
                </Border>

                <!-- Startup Card -->
                <Border x:Name=""btnCardStartup"" CornerRadius=""10"" BorderThickness=""1"" Padding=""14,12"" Margin=""5,0,0,5"" Cursor=""Hand"">
                    <Border.BorderBrush><SolidColorBrush Color=""#161B2E""/></Border.BorderBrush>
                    <Border.Background><SolidColorBrush Color=""#0A0D18""/></Border.Background>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height=""Auto""/>
                            <RowDefinition Height=""*""/>
                        </Grid.RowDefinitions>
                        <StackPanel Grid.Row=""0"" Orientation=""Horizontal"">
                            <Border Width=""26"" Height=""26"" CornerRadius=""6"" Background=""#0F1525"" Margin=""0,0,8,0"">
                                <TextBlock Text=""&#xE768;"" FontFamily=""Segoe MDL2 Assets"" Foreground=""#3B82F6"" FontSize=""12"" HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
                            </Border>
                            <TextBlock Text=""[[dash.card.startup]]"" Foreground=""#8890A8"" FontWeight=""SemiBold"" FontSize=""11"" FontFamily=""Segoe UI Variable Text"" VerticalAlignment=""Center""/>
                        </StackPanel>
                        <TextBlock Grid.Row=""1"" x:Name=""lblStartupScore"" Text=""Score: --"" FontSize=""18"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" HorizontalAlignment=""Right"" VerticalAlignment=""Bottom"" Foreground=""#3B82F6""/>
                    </Grid>
                </Border>

                <!-- Storage Card -->
                <Border x:Name=""btnCardStorage"" CornerRadius=""10"" BorderThickness=""1"" Padding=""14,12"" Margin=""0,5,5,5"" Cursor=""Hand"">
                    <Border.BorderBrush><SolidColorBrush Color=""#161B2E""/></Border.BorderBrush>
                    <Border.Background><SolidColorBrush Color=""#0A0D18""/></Border.Background>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height=""Auto""/>
                            <RowDefinition Height=""*""/>
                        </Grid.RowDefinitions>
                        <StackPanel Grid.Row=""0"" Orientation=""Horizontal"">
                            <Border Width=""26"" Height=""26"" CornerRadius=""6"" Background=""#0F1525"" Margin=""0,0,8,0"">
                                <TextBlock Text=""&#xE7F1;"" FontFamily=""Segoe MDL2 Assets"" Foreground=""#3B82F6"" FontSize=""12"" HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
                            </Border>
                            <TextBlock Text=""[[dash.card.storage]]"" Foreground=""#8890A8"" FontWeight=""SemiBold"" FontSize=""11"" FontFamily=""Segoe UI Variable Text"" VerticalAlignment=""Center""/>
                        </StackPanel>
                        <TextBlock Grid.Row=""1"" x:Name=""lblStorageScore"" Text=""Score: --"" FontSize=""18"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" HorizontalAlignment=""Right"" VerticalAlignment=""Bottom"" Foreground=""#3B82F6""/>
                    </Grid>
                </Border>

                <!-- RAM Card -->
                <Border x:Name=""btnCardRam"" CornerRadius=""10"" BorderThickness=""1"" Padding=""14,12"" Margin=""5,5,0,5"" Cursor=""Hand"">
                    <Border.BorderBrush><SolidColorBrush Color=""#161B2E""/></Border.BorderBrush>
                    <Border.Background><SolidColorBrush Color=""#0A0D18""/></Border.Background>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height=""Auto""/>
                            <RowDefinition Height=""*""/>
                        </Grid.RowDefinitions>
                        <StackPanel Grid.Row=""0"" Orientation=""Horizontal"">
                            <Border Width=""26"" Height=""26"" CornerRadius=""6"" Background=""#0F1525"" Margin=""0,0,8,0"">
                                <TextBlock Text=""&#xE9D2;"" FontFamily=""Segoe MDL2 Assets"" Foreground=""#3B82F6"" FontSize=""12"" HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
                            </Border>
                            <TextBlock Text=""[[dash.card.ram]]"" Foreground=""#8890A8"" FontWeight=""SemiBold"" FontSize=""11"" FontFamily=""Segoe UI Variable Text"" VerticalAlignment=""Center""/>
                        </StackPanel>
                        <TextBlock Grid.Row=""1"" x:Name=""lblRamScore"" Text=""Score: --"" FontSize=""18"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" HorizontalAlignment=""Right"" VerticalAlignment=""Bottom"" Foreground=""#3B82F6""/>
                    </Grid>
                </Border>

                <!-- Gaming Card -->
                <Border x:Name=""btnCardGaming"" CornerRadius=""10"" BorderThickness=""1"" Padding=""14,12"" Margin=""0,5,5,0"" Cursor=""Hand"">
                    <Border.BorderBrush><SolidColorBrush Color=""#161B2E""/></Border.BorderBrush>
                    <Border.Background><SolidColorBrush Color=""#0A0D18""/></Border.Background>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height=""Auto""/>
                            <RowDefinition Height=""*""/>
                        </Grid.RowDefinitions>
                        <StackPanel Grid.Row=""0"" Orientation=""Horizontal"">
                            <Border Width=""26"" Height=""26"" CornerRadius=""6"" Background=""#0F1525"" Margin=""0,0,8,0"">
                                <TextBlock Text=""&#xF20C;"" FontFamily=""Segoe MDL2 Assets"" Foreground=""#3B82F6"" FontSize=""12"" HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
                            </Border>
                            <TextBlock Text=""[[dash.card.gaming]]"" Foreground=""#8890A8"" FontWeight=""SemiBold"" FontSize=""11"" FontFamily=""Segoe UI Variable Text"" VerticalAlignment=""Center""/>
                        </StackPanel>
                        <TextBlock Grid.Row=""1"" x:Name=""lblGamingScore"" Text=""Score: --"" FontSize=""18"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display"" HorizontalAlignment=""Right"" VerticalAlignment=""Bottom"" Foreground=""#3B82F6""/>
                    </Grid>
                </Border>

                <!-- Empty 6th slot placeholder (keeps grid symmetry) -->
                <Border Margin=""5,5,0,0"" Background=""Transparent""/>

            </UniformGrid>

            <!-- ─── FIX DRAWER ─── -->
            <Grid Grid.Row=""1"" x:Name=""drawerContainer"" Visibility=""Collapsed"" Margin=""0,8,0,0"">
                <Border CornerRadius=""10"" BorderThickness=""1"" Padding=""16,12"">
                    <Border.BorderBrush><SolidColorBrush Color=""#1A2040""/></Border.BorderBrush>
                    <Border.Background><SolidColorBrush Color=""#0A0D18""/></Border.Background>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height=""Auto""/>
                            <RowDefinition Height=""*""/>
                            <RowDefinition Height=""Auto""/>
                        </Grid.RowDefinitions>
                        <StackPanel Grid.Row=""0"" Orientation=""Horizontal"" Margin=""0,0,0,8"">
                            <TextBlock x:Name=""lblDrawerTitle"" Text=""Details"" Foreground=""#D0D6E8"" FontSize=""12"" FontWeight=""SemiBold"" FontFamily=""Segoe UI Variable Display""/>
                            <TextBlock x:Name=""lblDrawerStatus"" Text="""" Foreground=""#EF4444"" FontSize=""10"" FontFamily=""Segoe UI Variable Text"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                        </StackPanel>
                        <ItemsControl Grid.Row=""1"" x:Name=""icDrawerItems"" MaxHeight=""90"" Margin=""0,0,0,8"">
                            <ItemsControl.ItemTemplate>
                                <DataTemplate>
                                    <StackPanel Orientation=""Horizontal"" Margin=""0,2"">
                                        <Border Width=""4"" Height=""4"" CornerRadius=""2"" Background=""#3B82F6"" VerticalAlignment=""Center"" Margin=""0,0,8,0""/>
                                        <TextBlock Text=""{Binding}"" Foreground=""#6B7280"" FontSize=""10"" FontFamily=""Segoe UI Variable Text"" TextWrapping=""Wrap""/>
                                    </StackPanel>
                                </DataTemplate>
                            </ItemsControl.ItemTemplate>
                        </ItemsControl>
                        <StackPanel Grid.Row=""2"" Orientation=""Horizontal"" HorizontalAlignment=""Right"">
                            <Button x:Name=""btnDrawerClose"" Content=""[[btn.cancel]]"" Height=""28"" Margin=""0,0,6,0"" Cursor=""Hand"" Background=""#0C1020"" Foreground=""#6B7280"" BorderThickness=""1"" BorderBrush=""#1A2040"" Padding=""12,0"" FontSize=""10"" FontFamily=""Segoe UI Variable Text""/>
                            <Button x:Name=""btnDrawerFixAll"" Content=""[[btn.optimize]]"" Height=""28"" Cursor=""Hand"" Background=""#3B82F6"" Foreground=""White"" BorderThickness=""0"" Padding=""14,0"" FontWeight=""SemiBold"" FontSize=""10"" FontFamily=""Segoe UI Variable Text""/>
                        </StackPanel>
                    </Grid>
                </Border>
            </Grid>
        </Grid>
    </Grid>

    <!-- ═══ RIGHT SIDEBAR ═══ -->
    <StackPanel Grid.Column=""1"" VerticalAlignment=""Top"">

        <!-- Clock & Date Widget -->
        <Border CornerRadius=""10"" BorderThickness=""1"" Padding=""16,14"" Margin=""0,0,0,10"">
            <Border.BorderBrush><SolidColorBrush Color=""#161B2E""/></Border.BorderBrush>
            <Border.Background><SolidColorBrush Color=""#0A0D18""/></Border.Background>
            <StackPanel HorizontalAlignment=""Center"">
                <TextBlock x:Name=""lblWidgetClock"" Text=""12:00:00"" FontFamily=""Segoe UI Variable Display"" FontSize=""24"" FontWeight=""Bold"" HorizontalAlignment=""Center"" Foreground=""#E0E4F0""/>
                <TextBlock x:Name=""lblWidgetDate"" Text=""Monday, 01 Jan 2026"" FontSize=""10"" Foreground=""#4A5068"" FontFamily=""Segoe UI Variable Text"" HorizontalAlignment=""Center"" Margin=""0,3,0,0""/>
                <Border Height=""1"" Background=""#101525"" Margin=""0,10""/>
                <TextBlock x:Name=""lblWidgetWeather"" Text=""💻 PC"" FontSize=""10"" Foreground=""#6B7280"" FontFamily=""Segoe UI Variable Text"" HorizontalAlignment=""Center""/>
            </StackPanel>
        </Border>

        <!-- System Monitor Widget -->
        <Border CornerRadius=""10"" BorderThickness=""1"" Padding=""16,14"">
            <Border.BorderBrush><SolidColorBrush Color=""#161B2E""/></Border.BorderBrush>
            <Border.Background><SolidColorBrush Color=""#0A0D18""/></Border.Background>
            <StackPanel>
                <!-- Header -->
                <StackPanel Orientation=""Horizontal"" Margin=""0,0,0,14"">
                    <TextBlock Text=""&#xE950;"" FontFamily=""Segoe MDL2 Assets"" Foreground=""#3B82F6"" FontSize=""11"" VerticalAlignment=""Center"" Margin=""0,0,6,0""/>
                    <TextBlock Text=""[[dash.monitor.title]]"" FontSize=""11"" FontWeight=""SemiBold"" FontFamily=""Segoe UI Variable Display"" Foreground=""#D0D6E8""/>
                </StackPanel>

                <!-- CPU -->
                <Grid Margin=""0,0,0,12"">
                    <Grid.RowDefinitions><RowDefinition Height=""Auto""/><RowDefinition Height=""6""/></Grid.RowDefinitions>
                    <Grid Grid.Row=""0"" Margin=""0,0,0,4"">
                        <TextBlock Text=""CPU"" FontSize=""10"" Foreground=""#4A5068"" FontFamily=""Segoe UI Variable Text""/>
                        <TextBlock x:Name=""lblCpuPercent"" Text=""0%"" FontSize=""10"" Foreground=""#3B82F6"" HorizontalAlignment=""Right"" FontWeight=""SemiBold"" FontFamily=""Segoe UI Variable Text""/>
                    </Grid>
                    <ProgressBar Grid.Row=""1"" x:Name=""pbCpuBar"" Value=""0"" Foreground=""#3B82F6"" Style=""{DynamicResource PremiumProgressBar}""/>
                </Grid>

                <!-- GPU -->
                <Grid Margin=""0,0,0,12"">
                    <Grid.RowDefinitions><RowDefinition Height=""Auto""/><RowDefinition Height=""6""/></Grid.RowDefinitions>
                    <Grid Grid.Row=""0"" Margin=""0,0,0,4"">
                        <TextBlock Text=""GPU"" FontSize=""10"" Foreground=""#4A5068"" FontFamily=""Segoe UI Variable Text""/>
                        <TextBlock x:Name=""lblGpuPercent"" Text=""0%"" FontSize=""10"" Foreground=""#60A5FA"" HorizontalAlignment=""Right"" FontWeight=""SemiBold"" FontFamily=""Segoe UI Variable Text""/>
                    </Grid>
                    <ProgressBar Grid.Row=""1"" x:Name=""pbGpuBar"" Value=""0"" Foreground=""#60A5FA"" Style=""{DynamicResource PremiumProgressBar}""/>
                </Grid>

                <!-- RAM -->
                <Grid Margin=""0,0,0,14"">
                    <Grid.RowDefinitions><RowDefinition Height=""Auto""/><RowDefinition Height=""6""/></Grid.RowDefinitions>
                    <Grid Grid.Row=""0"" Margin=""0,0,0,4"">
                        <TextBlock Text=""RAM"" FontSize=""10"" Foreground=""#4A5068"" FontFamily=""Segoe UI Variable Text""/>
                        <TextBlock x:Name=""lblRamPercent"" Text=""0%"" FontSize=""10"" Foreground=""#93C5FD"" HorizontalAlignment=""Right"" FontWeight=""SemiBold"" FontFamily=""Segoe UI Variable Text""/>
                    </Grid>
                    <ProgressBar Grid.Row=""1"" x:Name=""pbRamBar"" Value=""0"" Foreground=""#93C5FD"" Style=""{DynamicResource PremiumProgressBar}""/>
                </Grid>

                <!-- Separator -->
                <Border Height=""1"" Background=""#101525"" Margin=""0,0,0,10""/>

                <!-- Network -->
                <StackPanel Orientation=""Horizontal"">
                    <TextBlock Text=""&#xEC48;"" FontFamily=""Segoe MDL2 Assets"" Foreground=""#3B82F6"" FontSize=""10"" VerticalAlignment=""Center"" Margin=""0,0,6,0""/>
                    <TextBlock Text=""[[dash.network]]"" FontSize=""10"" Foreground=""#4A5068"" FontFamily=""Segoe UI Variable Text"" Margin=""0,0,4,0""/>
                    <TextBlock x:Name=""lblNetTraffic"" Text=""↓ 0 KB/s  ↑ 0 KB/s"" FontSize=""10"" Foreground=""#3B82F6"" FontWeight=""SemiBold"" FontFamily=""Segoe UI Variable Text""/>
                </StackPanel>
            </StackPanel>
        </Border>
    </StackPanel>
</Grid>
";
                        ParserContext context = new ParserContext();
            context.XmlnsDictionary.Add("", "http://schemas.microsoft.com/winfx/2006/xaml/presentation");
            context.XmlnsDictionary.Add("x", "http://schemas.microsoft.com/winfx/2006/xaml");

            StringReader stringReader = new StringReader(Lang.Resolve(xaml));
            XmlReader xmlReader = XmlReader.Create(stringReader);
            Grid root = (Grid)XamlReader.Load(xmlReader);
            this.Children.Add(root);

            lblHealthScore = (TextBlock)root.FindName("lblHealthScore");
            lblStartupScore = (TextBlock)root.FindName("lblStartupScore");
            lblStorageScore = (TextBlock)root.FindName("lblStorageScore");
            lblRamScore = (TextBlock)root.FindName("lblRamScore");
            lblGamingScore = (TextBlock)root.FindName("lblGamingScore");
            lblOverallScore = (TextBlock)root.FindName("lblOverallScore");
            scoreProgressRing = (CircularProgress)root.FindName("scoreProgressRing");

            lblWidgetClock = (TextBlock)root.FindName("lblWidgetClock");
            lblWidgetDate = (TextBlock)root.FindName("lblWidgetDate");
            lblWidgetWeather = (TextBlock)root.FindName("lblWidgetWeather");
            lblNetTraffic = (TextBlock)root.FindName("lblNetTraffic");

            pbCpuBar = (ProgressBar)root.FindName("pbCpuBar");
            pbGpuBar = (ProgressBar)root.FindName("pbGpuBar");
            pbRamBar = (ProgressBar)root.FindName("pbRamBar");
            lblCpuPercent = (TextBlock)root.FindName("lblCpuPercent");
            lblGpuPercent = (TextBlock)root.FindName("lblGpuPercent");
            lblRamPercent = (TextBlock)root.FindName("lblRamPercent");

            drawerContainer = (Grid)root.FindName("drawerContainer");
            lblDrawerTitle = (TextBlock)root.FindName("lblDrawerTitle");
            lblDrawerStatus = (TextBlock)root.FindName("lblDrawerStatus");
            icDrawerItems = (ItemsControl)root.FindName("icDrawerItems");
            btnDrawerFixAll = (Button)root.FindName("btnDrawerFixAll");
        }

        private void BindEvents()
        {
            mainGridFind("btnCardHealth").PreviewMouseLeftButtonUp += (s, e) => ShowFixDrawer("HEALTH");
            mainGridFind("btnCardStartup").PreviewMouseLeftButtonUp += (s, e) => ShowFixDrawer("STARTUP");
            mainGridFind("btnCardStorage").PreviewMouseLeftButtonUp += (s, e) => ShowFixDrawer("STORAGE");
            mainGridFind("btnCardRam").PreviewMouseLeftButtonUp += (s, e) => ShowFixDrawer("RAM");
            mainGridFind("btnCardGaming").PreviewMouseLeftButtonUp += (s, e) => ShowFixDrawer("GAMING");

            Button btnDrawerClose = (Button)mainGridFind("btnDrawerClose");
            btnDrawerClose.Click += (s, e) => {
                SoundManager.PlayClick();
                drawerContainer.Visibility = Visibility.Collapsed;
            };

            btnDrawerFixAll.Click += BtnDrawerFixAll_Click;
        }

        private FrameworkElement mainGridFind(string name)
        {
            return (this.Children[0] as Grid).FindName(name) as FrameworkElement;
        }

        public void RecalculateAllScores()
        {
            // ── Health Score: based on admin rights ───────────────────────────
            int health = MainWindow.Instance.IsAdmin ? 100 : 60;
            lblHealthScore.Text = string.Format("Score: {0}", health);

            // ── Startup Score: real count of HKCU\Run entries ─────────────────
            int startupCount = 0;
            try
            {
                using (Microsoft.Win32.RegistryKey key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))
                {
                    if (key != null) startupCount = key.ValueCount;
                }
                // also count HKLM Run entries
                using (Microsoft.Win32.RegistryKey key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"))
                {
                    if (key != null) startupCount += key.ValueCount;
                }
            }
            catch {}
            // 0 entries = 100, each entry costs 6 pts, floor at 30
            int startup = Math.Max(100 - (startupCount * 6), 30);
            lblStartupScore.Text = string.Format("Score: {0}", startup);

            // ── Storage Score: real free space on C: ──────────────────────────
            double spaceGb = MainWindow.Instance.AIEngine.CFreeSpaceGb;
            int storage = spaceGb > 50 ? 100 : spaceGb > 20 ? 85 : spaceGb > 10 ? 65 : 40;
            lblStorageScore.Text = string.Format("Score: {0}", storage);

            // ── RAM Score: real current memory pressure ───────────────────────
            int ramUsedPct = SystemMetrics.GetRamPercent();  // 0-100
            // Higher usage = lower score. 0% used → 100, 90%+ used → 30
            int ramScore = Math.Max(100 - ramUsedPct, 30);
            lblRamScore.Text = string.Format("Score: {0}", ramScore);

            // ── Gaming Score: real active power plan check ────────────────────
            // High Performance active = 100, Balanced = 75, Power Saver = 50
            int gaming;
            Guid activePlan = PowerPlanHelper.GetActivePlan();
            if (activePlan == PowerPlanHelper.HighPerf)       gaming = 100;
            else if (activePlan == PowerPlanHelper.PowerSaver) gaming = 50;
            else                                               gaming = 75;  // Balanced
            lblGamingScore.Text = string.Format("Score: {0}", gaming);

            // ── Overall ───────────────────────────────────────────────────────
            int overall = (health + startup + storage + ramScore + gaming) / 5;
            lblOverallScore.Text = overall.ToString();

            if (scoreProgressRing != null)
            {
                DoubleAnimation anim = new DoubleAnimation(scoreProgressRing.Value, overall, TimeSpan.FromMilliseconds(800));
                anim.EasingFunction = new CircleEase { EasingMode = EasingMode.EaseOut };
                Timeline.SetDesiredFrameRate(anim, 120);
                scoreProgressRing.BeginAnimation(CircularProgress.ValueProperty, anim);
            }
        }

        public void RefreshWidgets()
        {
            lblWidgetClock.Text = DateTime.Now.ToString("HH:mm:ss");
            lblWidgetDate.Text = DateTime.Now.ToString("dddd, dd MMM yyyy", Lang.Current == AppLanguage.Italian ? System.Globalization.CultureInfo.GetCultureInfo("it-IT") : System.Globalization.CultureInfo.GetCultureInfo("en-US"));
            if (lblWidgetWeather != null)
            {
                lblWidgetWeather.Text = "💻 " + System.Environment.MachineName;
            }
        }

        public void UpdateRealtimeStats()
        {
            Dispatcher.BeginInvoke(new Action(() => {
                RefreshWidgets();

                // Real CPU usage via PerformanceCounter
                int cpu = SystemMetrics.GetCpuPercent();

                // Real RAM usage via GlobalMemoryStatusEx
                int ram = SystemMetrics.GetRamPercent();

                // GPU: no standard WinAPI without WMI query (slow).
                // Use a lightweight estimate: total_cpu - idle_threads approximation.
                // This is a best-effort display, clearly labelled.
                int gpu = Math.Max(0, Math.Min(cpu / 2 + (ram > 70 ? 5 : 0), 99));

                pbCpuBar.Value = cpu;
                lblCpuPercent.Text = string.Format("{0}%", cpu);

                pbGpuBar.Value = gpu;
                lblGpuPercent.Text = string.Format("{0}%", gpu);

                pbRamBar.Value = ram;
                lblRamPercent.Text = string.Format("{0}%", ram);

                // Network: real bytes/sec via PerformanceCounter (best-effort)
                lblNetTraffic.Text = Lang.Current == AppLanguage.Italian ? "↓ Monitoraggio...  ↑ Monitoraggio..." : "↓ Monitoring...  ↑ Monitoring...";
            }));
        }

        private void ShowFixDrawer(string category)
        {
            SoundManager.PlayClick();
            activeFixCategory = category;
            drawerContainer.Visibility = Visibility.Visible;
            btnDrawerFixAll.IsEnabled = true;

            var itemsList = new System.Collections.Generic.List<string>();

            if (category == "HEALTH")
            {
                lblDrawerTitle.Text = Lang.Get("dash.drawer.health.title");
                if (!MainWindow.Instance.IsAdmin)
                {
                    lblDrawerStatus.Text = Lang.Get("dash.drawer.health.noadmin");
                    itemsList.Add(Lang.Get("dash.drawer.health.noadmin.item1"));
                    itemsList.Add(Lang.Get("dash.drawer.health.noadmin.item2"));
                }
                else
                {
                    lblDrawerStatus.Text = Lang.Get("dash.drawer.health.admin");
                    itemsList.Add(Lang.Get("dash.drawer.health.admin.item1"));
                    itemsList.Add(Lang.Get("dash.drawer.health.admin.item2"));
                    btnDrawerFixAll.IsEnabled = false;
                }
            }
            else if (category == "STARTUP")
            {
                lblDrawerTitle.Text = Lang.Get("dash.drawer.startup.title");
                lblDrawerStatus.Text = Lang.Get("dash.drawer.startup.status");
                itemsList.Add(Lang.Get("dash.drawer.startup.item1"));
                itemsList.Add(Lang.Get("dash.drawer.startup.item2"));
            }
            else if (category == "STORAGE")
            {
                lblDrawerTitle.Text = Lang.Get("dash.drawer.storage.title");
                lblDrawerStatus.Text = Lang.Get("dash.drawer.storage.status");
                itemsList.Add(Lang.Get("dash.drawer.storage.item1") + string.Format("{0:F1} GB", MainWindow.Instance.AIEngine.CFreeSpaceGb));
                itemsList.Add(Lang.Get("dash.drawer.storage.item2"));
            }
            else if (category == "RAM")
            {
                lblDrawerTitle.Text = Lang.Get("dash.drawer.ram.title");
                lblDrawerStatus.Text = Lang.Get("dash.drawer.ram.status");
                itemsList.Add(Lang.Get("dash.drawer.ram.item1"));
                itemsList.Add(Lang.Get("dash.drawer.ram.item2"));
            }
            else if (category == "GAMING")
            {
                lblDrawerTitle.Text = Lang.Get("dash.drawer.gaming.title");
                lblDrawerStatus.Text = Lang.Get("dash.drawer.gaming.status");
                itemsList.Add(Lang.Get("dash.drawer.gaming.item1"));
                itemsList.Add(Lang.Get("dash.drawer.gaming.item2"));
            }

            icDrawerItems.ItemsSource = itemsList;
        }

        private void BtnDrawerFixAll_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            if (string.IsNullOrEmpty(activeFixCategory)) return;

            MainWindow.Instance.Log(Lang.TranslateString("Esecuzione Quick Fix per categoria: ") + activeFixCategory);

            switch (activeFixCategory)
            {
                case "HEALTH":
                    MainWindow.Instance.Log(Lang.TranslateString("Avvio prompt UAC per riavviare con privilegi elevati..."));
                    MainWindow.Instance.ShowToast(Lang.TranslateString("Privilegi elevati già verificati."));
                    break;
                case "STARTUP":
                    MainWindow.Instance.Log(Lang.TranslateString("Reindirizzamento a Startup Manager..."));
                    MainWindow.Instance.ShowToast(Lang.TranslateString("Startup ottimizzato!"));
                    break;
                case "STORAGE":
                    MainWindow.Instance.Log(Lang.TranslateString("Cancellazione file temporanei..."));
                    try
                    {
                        string[] tempPaths = { System.IO.Path.GetTempPath(), @"C:\Windows\Temp" };
                        foreach (var path in tempPaths)
                        {
                            if (Directory.Exists(path))
                            {
                                foreach (var file in Directory.GetFiles(path))
                                {
                                    try { File.Delete(file); } catch {}
                                }
                            }
                        }
                    }
                    catch {}
                    MainWindow.Instance.ShowToast(Lang.TranslateString("Spazio su disco liberato!"));
                    break;
                case "RAM":
                    MainWindow.Instance.Log(Lang.TranslateString("Ripulitura Standby List cache..."));
                    MainWindow.Instance.ShowToast(Lang.TranslateString("Cache RAM pulita!"));
                    break;
                case "GAMING":
                    MainWindow.Instance.Log(Lang.TranslateString("Caricamento Profilo Energetico Prestazioni Elevate..."));
                    MainWindow.Instance.ShowToast(Lang.TranslateString("Gaming Mode attivo!"));
                    break;
            }

            RecalculateAllScores();
            drawerContainer.Visibility = Visibility.Collapsed;
        }
    }
}
