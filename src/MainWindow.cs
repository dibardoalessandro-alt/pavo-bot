using System;
using System.IO;
using System.Xml;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Threading;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Collections.Generic;
using System.Security.Principal;
using System.Runtime.InteropServices;

namespace PavoTweak
{
    public class MainWindow : Window
    {
        public static MainWindow Instance { get; private set; }

        public bool IsAdmin { get; private set; }
        public AIEngine AIEngine { get; private set; }

        // UI references
        private Grid mainGrid;
        private Grid gridLoading;
        private Grid gridToast;
        private TextBlock lblToastText;
        private Border borderToastIcon;
        private TextBox txtConsoleLog;
        private Grid viewportContainer;

        // Views
        public DashboardView DashboardView { get; private set; }
        public AIOptimizerView AIOptimizerView { get; private set; }
        public CustomizationView CustomizationView { get; private set; }
        public GamingHubView GamingHubView { get; private set; }
        public DriverCenterView DriverCenterView { get; private set; }
        public BenchmarkView BenchmarkView { get; private set; }
        public DiskToolsView DiskToolsView { get; private set; }
        public RamManagerView RamManagerView { get; private set; }
        public StartupView StartupView { get; private set; }
        public RestoreView RestoreView { get; private set; }
        public MarketplaceView MarketplaceView { get; private set; }
        public SettingsView SettingsView { get; private set; }

        // Sidebar label references (for live language update)
        private TextBlock _lblSidebarDashboard, _lblSidebarAI, _lblSidebarCustom,
            _lblSidebarGaming, _lblSidebarDriver, _lblSidebarBenchmark, _lblSidebarDisk,
            _lblSidebarRAM, _lblSidebarStartup, _lblSidebarRestore, _lblSidebarMarket,
            _lblSidebarSettings, _lblAdminBadge;

        // Sidebar Navigation Buttons
        private Dictionary<Button, Grid> navigationViews = new Dictionary<Button, Grid>();
        private DispatcherTimer globalStatsTimer;
        private DispatcherTimer _licenseHeartbeatTimer;

        public MainWindow()
        {
            Instance = this;
            AIEngine = new AIEngine();

            // Initialize settings (load persisted preferences)
            AppSettings.Initialize();
            Lang.Current = AppSettings.Language;
            SoundManager.Enabled = AppSettings.SoundsEnabled;

            // Window Setup
            this.WindowStyle = WindowStyle.None;
            this.AllowsTransparency = true;
            this.Background = null;
            this.Width = 1180;
            this.Height = 820;
            this.WindowStartupLocation = WindowStartupLocation.CenterScreen;

            IsAdmin = CheckAdminPrivileges();
            AIEngine.AnalyzeHardwareAsync();
            this.SourceInitialized += (s, e) => WindowHelper.DisableWindowShadow(this);

            // Setup Shell Layout
            InitializeShellComponent();

            // Instantiate Views
            InstantiateViews();

            // Bind Navigation Events
            BindShellEvents();

            // Force initial refresh of sidebar labels and view translations at startup
            RefreshSidebarLabels();

            // Setup Background Timer (1.5s interval for live monitor widgets)
            globalStatsTimer = new DispatcherTimer();
            globalStatsTimer.Interval = TimeSpan.FromMilliseconds(1500);
            globalStatsTimer.Tick += (s, e) => {
                System.Threading.Tasks.Task.Run(() => {
                    try
                    {
                        DashboardView.UpdateRealtimeStats();
                        RamManagerView.UpdateRealtimeStats();
                    }
                    catch {}
                });
            };
            globalStatsTimer.Start();

            // ── License heartbeat — re-validate with Online API periodically ───
            // If the key gets banned/revoked while the user is inside the app,
            // this will catch it in real-time, wipe the session, and force them to the login screen.
            _licenseHeartbeatTimer = new DispatcherTimer();
            _licenseHeartbeatTimer.Interval = TimeSpan.FromSeconds(60);
            _licenseHeartbeatTimer.Tick += LicenseHeartbeat_Tick;
            _licenseHeartbeatTimer.Start();

            // Trigger Fade-out loading overlay
            this.ContentRendered += MainWindow_ContentRendered;
            this.Loaded += (s, e) =>
            {
                var btnTabDashboard = (Button)mainGrid.FindName("btnTabDashboard");
                if (btnTabDashboard != null) MoveSidebarIndicator(btnTabDashboard);
            };
        }

        // ── License heartbeat handler ─────────────────────────────────────────
        private void LicenseHeartbeat_Tick(object sender, EventArgs e)
        {
            // Run the network call on a background thread so the UI never freezes
            System.Threading.Tasks.Task.Run(() =>
            {
                string savedKey = PavoTweak.Auth.LicenseClient.LoadSavedToken();
                if (string.IsNullOrEmpty(savedKey)) return; // no key saved — skip

                var res = PavoTweak.Auth.LicenseClient.Heartbeat(savedKey);

                if (res != null && !res.Valid) // key is now banned / expired / revoked
                {
                    string denyReason = App.TranslateDenyReason(res.Code, res.Message);
                    PavoTweak.Auth.LicenseClient.ClearSavedToken();

                    Dispatcher.Invoke(() =>
                    {
                        _licenseHeartbeatTimer.Stop();
                        globalStatsTimer.Stop();

                        // Show the login window with the deny reason, then close
                        var login = new LoginWindow(denyReason);
                        login.Show();

                        this.Close();
                    });
                }
            });
        }

        private bool CheckAdminPrivileges()
        {
            var identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }

        private List<TextBlock> sidebarLabels = new List<TextBlock>();

        private void InitializeShellComponent()
        {
            string xaml = @"
<Grid xmlns=""http://schemas.microsoft.com/winfx/2006/xaml/presentation""
      xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml""
      xmlns:local=""clr-namespace:PavoTweak;assembly=PavoTweak"">

    <Grid.Resources>
        <SolidColorBrush x:Key=""AccentBrush"" Color=""#3B82F6""/>

        <!-- Shared iOS Toggle Switch Style -->
        <Style x:Key=""iOSSwitch"" TargetType=""ToggleButton"">
            <Setter Property=""Width"" Value=""44""/>
            <Setter Property=""Height"" Value=""22""/>
            <Setter Property=""Background"" Value=""#101428""/>
            <Setter Property=""BorderBrush"" Value=""#1C2040""/>
            <Setter Property=""BorderThickness"" Value=""1""/>
            <Setter Property=""Cursor"" Value=""Hand""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""ToggleButton"">
                        <Border Name=""BgBorder"" Background=""{TemplateBinding Background}"" BorderBrush=""{TemplateBinding BorderBrush}"" BorderThickness=""{TemplateBinding BorderThickness}"" CornerRadius=""11"">
                            <Grid>
                                <Border Name=""Glow"" Background=""#3B82F6"" CornerRadius=""11"" Opacity=""0""/>
                                <Border Name=""Handle"" Width=""16"" Height=""16"" Background=""White"" CornerRadius=""8"" HorizontalAlignment=""Left"" Margin=""2,0,0,0"">
                                    <Border.RenderTransform>
                                        <TranslateTransform X=""0""/>
                                    </Border.RenderTransform>
                                    <Border.Effect>
                                        <DropShadowEffect Color=""Black"" BlurRadius=""4"" ShadowDepth=""1"" Opacity=""0.3""/>
                                    </Border.Effect>
                                </Border>
                            </Grid>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property=""IsChecked"" Value=""True"">
                                <Trigger.EnterActions>
                                    <BeginStoryboard>
                                        <Storyboard>
                                            <DoubleAnimation Storyboard.TargetName=""Handle"" Storyboard.TargetProperty=""(UIElement.RenderTransform).(TranslateTransform.X)"" To=""22"" Duration=""0:0:0.2"">
                                                <DoubleAnimation.EasingFunction>
                                                    <CircleEase EasingMode=""EaseOut""/>
                                                </DoubleAnimation.EasingFunction>
                                            </DoubleAnimation>
                                            <DoubleAnimation Storyboard.TargetName=""Glow"" Storyboard.TargetProperty=""Opacity"" To=""1"" Duration=""0:0:0.2""/>
                                        </Storyboard>
                                    </BeginStoryboard>
                                </Trigger.EnterActions>
                                <Trigger.ExitActions>
                                    <BeginStoryboard>
                                        <Storyboard>
                                            <DoubleAnimation Storyboard.TargetName=""Handle"" Storyboard.TargetProperty=""(UIElement.RenderTransform).(TranslateTransform.X)"" To=""0"" Duration=""0:0:0.2"">
                                                <DoubleAnimation.EasingFunction>
                                                    <CircleEase EasingMode=""EaseOut""/>
                                                </DoubleAnimation.EasingFunction>
                                            </DoubleAnimation>
                                            <DoubleAnimation Storyboard.TargetName=""Glow"" Storyboard.TargetProperty=""Opacity"" To=""0"" Duration=""0:0:0.2""/>
                                        </Storyboard>
                                    </BeginStoryboard>
                                </Trigger.ExitActions>
                                <Setter TargetName=""BgBorder"" Property=""BorderBrush"" Value=""#3B82F6""/>
                            </Trigger>
                            <Trigger Property=""IsMouseOver"" Value=""True"">
                                <Setter Property=""Opacity"" Value=""0.9""/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>

        <!-- Shared iOS Toggle CheckBox Style -->
        <Style x:Key=""iOSCheckBox"" TargetType=""CheckBox"">
            <Setter Property=""Height"" Value=""26""/>
            <Setter Property=""Background"" Value=""#101428""/>
            <Setter Property=""BorderBrush"" Value=""#1C2040""/>
            <Setter Property=""BorderThickness"" Value=""1""/>
            <Setter Property=""Cursor"" Value=""Hand""/>
            <Setter Property=""HorizontalAlignment"" Value=""Stretch""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""CheckBox"">
                        <Grid Background=""Transparent"">
                            <Grid.ColumnDefinitions>
                                <ColumnDefinition Width=""*""/>
                                <ColumnDefinition Width=""Auto""/>
                            </Grid.ColumnDefinitions>
                            
                            <!-- Label Content -->
                            <ContentPresenter Grid.Column=""0"" VerticalAlignment=""Center"" HorizontalAlignment=""Left""/>
                            
                            <!-- Toggle switch graphic -->
                            <Border Grid.Column=""1"" Name=""BgBorder"" Width=""44"" Height=""22"" Background=""{TemplateBinding Background}"" BorderBrush=""{TemplateBinding BorderBrush}"" BorderThickness=""{TemplateBinding BorderThickness}"" CornerRadius=""11"" VerticalAlignment=""Center"">
                                <Grid>
                                    <Border Name=""Glow"" Background=""#3B82F6"" CornerRadius=""11"" Opacity=""0""/>
                                    <Border Name=""Handle"" Width=""16"" Height=""16"" Background=""White"" CornerRadius=""8"" HorizontalAlignment=""Left"" Margin=""2,0,0,0"">
                                        <Border.RenderTransform>
                                            <TranslateTransform X=""0""/>
                                        </Border.RenderTransform>
                                        <Border.Effect>
                                            <DropShadowEffect Color=""Black"" BlurRadius=""4"" ShadowDepth=""1"" Opacity=""0.3""/>
                                        </Border.Effect>
                                    </Border>
                                </Grid>
                            </Border>
                        </Grid>
                        <ControlTemplate.Triggers>
                            <Trigger Property=""IsChecked"" Value=""True"">
                                <Trigger.EnterActions>
                                    <BeginStoryboard>
                                        <Storyboard>
                                            <DoubleAnimation Storyboard.TargetName=""Handle"" Storyboard.TargetProperty=""(UIElement.RenderTransform).(TranslateTransform.X)"" To=""22"" Duration=""0:0:0.2"">
                                                <DoubleAnimation.EasingFunction>
                                                    <CircleEase EasingMode=""EaseOut""/>
                                                </DoubleAnimation.EasingFunction>
                                            </DoubleAnimation>
                                            <DoubleAnimation Storyboard.TargetName=""Glow"" Storyboard.TargetProperty=""Opacity"" To=""1"" Duration=""0:0:0.2""/>
                                        </Storyboard>
                                    </BeginStoryboard>
                                </Trigger.EnterActions>
                                <Trigger.ExitActions>
                                    <BeginStoryboard>
                                        <Storyboard>
                                            <DoubleAnimation Storyboard.TargetName=""Handle"" Storyboard.TargetProperty=""(UIElement.RenderTransform).(TranslateTransform.X)"" To=""0"" Duration=""0:0:0.2"">
                                                <DoubleAnimation.EasingFunction>
                                                    <CircleEase EasingMode=""EaseOut""/>
                                                </DoubleAnimation.EasingFunction>
                                            </DoubleAnimation>
                                            <DoubleAnimation Storyboard.TargetName=""Glow"" Storyboard.TargetProperty=""Opacity"" To=""0"" Duration=""0:0:0.2""/>
                                        </Storyboard>
                                    </BeginStoryboard>
                                </Trigger.ExitActions>
                                <Setter TargetName=""BgBorder"" Property=""BorderBrush"" Value=""#3B82F6""/>
                            </Trigger>
                            <Trigger Property=""IsMouseOver"" Value=""True"">
                                <Setter Property=""Opacity"" Value=""0.9""/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>

        <!-- Shared Premium Card Style -->
        <Style x:Key=""PremiumCard"" TargetType=""Border"">
            <Setter Property=""Background"">
                <Setter.Value>
                    <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,1"">
                        <GradientStop Color=""#C80C1020"" Offset=""0""/>
                        <GradientStop Color=""#C80F1428"" Offset=""1""/>
                    </LinearGradientBrush>
                </Setter.Value>
            </Setter>
            <Setter Property=""BorderBrush"">
                <Setter.Value>
                    <SolidColorBrush Color=""#1C2040""/>
                </Setter.Value>
            </Setter>
            <Setter Property=""BorderThickness"" Value=""1""/>
            <Setter Property=""CornerRadius"" Value=""14""/>
            <Setter Property=""Padding"" Value=""16""/>
            <Setter Property=""Margin"" Value=""0,0,0,12""/>
            <Setter Property=""RenderTransformOrigin"" Value=""0.5,0.5""/>
            <Setter Property=""RenderTransform"">
                <Setter.Value>
                    <ScaleTransform ScaleX=""1"" ScaleY=""1""/>
                </Setter.Value>
            </Setter>
            <Setter Property=""Effect"">
                <Setter.Value>
                    <DropShadowEffect Color=""#000000"" BlurRadius=""15"" Opacity=""0.15"" ShadowDepth=""2""/>
                </Setter.Value>
            </Setter>
            <Style.Triggers>
                <EventTrigger RoutedEvent=""MouseEnter"">
                    <BeginStoryboard>
                        <Storyboard>
                            <DoubleAnimation Storyboard.TargetProperty=""(UIElement.RenderTransform).(ScaleTransform.ScaleX)"" To=""1.02"" Duration=""0:0:0.25"">
                                <DoubleAnimation.EasingFunction>
                                    <CubicEase EasingMode=""EaseOut""/>
                                </DoubleAnimation.EasingFunction>
                            </DoubleAnimation>
                            <DoubleAnimation Storyboard.TargetProperty=""(UIElement.RenderTransform).(ScaleTransform.ScaleY)"" To=""1.02"" Duration=""0:0:0.25"">
                                <DoubleAnimation.EasingFunction>
                                    <CubicEase EasingMode=""EaseOut""/>
                                </DoubleAnimation.EasingFunction>
                            </DoubleAnimation>
                            <ColorAnimation Storyboard.TargetProperty=""(Border.BorderBrush).(SolidColorBrush.Color)"" To=""#3B82F6"" Duration=""0:0:0.25""/>
                            <DoubleAnimation Storyboard.TargetProperty=""(Border.Effect).(DropShadowEffect.BlurRadius)"" To=""25"" Duration=""0:0:0.25""/>
                            <DoubleAnimation Storyboard.TargetProperty=""(Border.Effect).(DropShadowEffect.Opacity)"" To=""0.25"" Duration=""0:0:0.25""/>
                            <ColorAnimation Storyboard.TargetProperty=""(Border.Effect).(DropShadowEffect.Color)"" To=""#3B82F6"" Duration=""0:0:0.25""/>
                        </Storyboard>
                    </BeginStoryboard>
                </EventTrigger>
                <EventTrigger RoutedEvent=""MouseLeave"">
                    <BeginStoryboard>
                        <Storyboard>
                            <DoubleAnimation Storyboard.TargetProperty=""(UIElement.RenderTransform).(ScaleTransform.ScaleX)"" To=""1"" Duration=""0:0:0.2"">
                                <DoubleAnimation.EasingFunction>
                                    <CubicEase EasingMode=""EaseOut""/>
                                </DoubleAnimation.EasingFunction>
                            </DoubleAnimation>
                            <DoubleAnimation Storyboard.TargetProperty=""(UIElement.RenderTransform).(ScaleTransform.ScaleY)"" To=""1"" Duration=""0:0:0.2"">
                                <DoubleAnimation.EasingFunction>
                                    <CubicEase EasingMode=""EaseOut""/>
                                </DoubleAnimation.EasingFunction>
                            </DoubleAnimation>
                            <ColorAnimation Storyboard.TargetProperty=""(Border.BorderBrush).(SolidColorBrush.Color)"" To=""#1C2040"" Duration=""0:0:0.2""/>
                            <DoubleAnimation Storyboard.TargetProperty=""(Border.Effect).(DropShadowEffect.BlurRadius)"" To=""15"" Duration=""0:0:0.2""/>
                            <DoubleAnimation Storyboard.TargetProperty=""(Border.Effect).(DropShadowEffect.Opacity)"" To=""0.15"" Duration=""0:0:0.2""/>
                            <ColorAnimation Storyboard.TargetProperty=""(Border.Effect).(DropShadowEffect.Color)"" To=""#000000"" Duration=""0:0:0.2""/>
                        </Storyboard>
                    </BeginStoryboard>
                </EventTrigger>
            </Style.Triggers>
        </Style>

        <!-- Shared Premium Button Style -->
        <Style x:Key=""PremiumButton"" TargetType=""Button"">
            <Setter Property=""Background"" Value=""#1A2040""/>
            <Setter Property=""Foreground"" Value=""White""/>
            <Setter Property=""BorderThickness"" Value=""1""/>
            <Setter Property=""BorderBrush"" Value=""#2D3560""/>
            <Setter Property=""Padding"" Value=""12,3""/>
            <Setter Property=""FontSize"" Value=""11""/>
            <Setter Property=""FontFamily"" Value=""Segoe UI Variable Text""/>
            <Setter Property=""FontWeight"" Value=""Bold""/>
            <Setter Property=""Cursor"" Value=""Hand""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""Button"">
                        <Border Name=""Border"" CornerRadius=""8"" Background=""{TemplateBinding Background}"" BorderBrush=""{TemplateBinding BorderBrush}"" BorderThickness=""{TemplateBinding BorderThickness}"">
                            <ContentPresenter HorizontalAlignment=""Center"" VerticalAlignment=""Center"" Margin=""{TemplateBinding Padding}""/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property=""IsMouseOver"" Value=""True"">
                                <Setter Property=""Background"" Value=""#3B82F6""/>
                                <Setter Property=""BorderBrush"" Value=""#60A5FA""/>
                            </Trigger>
                            <Trigger Property=""IsPressed"" Value=""True"">
                                <Setter Property=""Opacity"" Value=""0.8""/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>

        <!-- Shared Premium Progress Bar Style -->
        <Style x:Key=""PremiumProgressBar"" TargetType=""ProgressBar"">
            <Setter Property=""Height"" Value=""8""/>
            <Setter Property=""Background"" Value=""#101428""/>
            <Setter Property=""BorderThickness"" Value=""0""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""ProgressBar"">
                        <Grid Name=""TemplateRoot"">
                            <Border CornerRadius=""4"" Background=""{TemplateBinding Background}"" BorderBrush=""{TemplateBinding BorderBrush}"" BorderThickness=""{TemplateBinding BorderThickness}""/>
                            <Border Name=""PART_Indicator"" CornerRadius=""4"" Background=""{TemplateBinding Foreground}"" HorizontalAlignment=""Left""/>
                        </Grid>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>

        <!-- Premium Sidebar Button -->
        <Style x:Key=""SidebarBtn"" TargetType=""Button"">
            <Setter Property=""OverridesDefaultStyle"" Value=""True""/>
            <Setter Property=""Background"" Value=""Transparent""/>
            <Setter Property=""Foreground"" Value=""#70799C""/>
            <Setter Property=""BorderThickness"" Value=""0""/>
            <Setter Property=""BorderBrush"" Value=""Transparent""/>
            <Setter Property=""FocusVisualStyle"" Value=""{x:Null}""/>
            <Setter Property=""HorizontalContentAlignment"" Value=""Left""/>
            <Setter Property=""Padding"" Value=""20,0,12,0""/>
            <Setter Property=""FontSize"" Value=""12""/>
            <Setter Property=""FontFamily"" Value=""Segoe UI Variable Text""/>
            <Setter Property=""FontWeight"" Value=""SemiBold""/>
            <Setter Property=""Cursor"" Value=""Hand""/>
            <Setter Property=""Height"" Value=""40""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""Button"">
                        <Grid>
                            <Border Name=""BtnBg"" CornerRadius=""8"" Margin=""6,2,8,2""
                                    Background=""#00FFFFFF""
                                    BorderThickness=""0""/>
                            <ContentPresenter Margin=""{TemplateBinding Padding}""
                                              VerticalAlignment=""Center""
                                              HorizontalAlignment=""Left""
                                              TextElement.Foreground=""{TemplateBinding Foreground}""/>
                        </Grid>
                        <ControlTemplate.Triggers>
                            <Trigger Property=""IsMouseOver"" Value=""True"">
                                <Setter TargetName=""BtnBg"" Property=""Background"" Value=""#12FFFFFF""/>
                                <Setter Property=""Foreground"" Value=""#DDE2FF""/>
                            </Trigger>
                            <Trigger Property=""IsPressed"" Value=""True"">
                                <Setter TargetName=""BtnBg"" Property=""Background"" Value=""#1CFFFFFF""/>
                            </Trigger>
                            <Trigger Property=""IsFocused"" Value=""True"">
                                <Setter TargetName=""BtnBg"" Property=""Background"" Value=""#00FFFFFF""/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>

        <!-- Category Label Style -->
        <Style x:Key=""SidebarCategory"" TargetType=""TextBlock"">
            <Setter Property=""Foreground"" Value=""#465074""/>
            <Setter Property=""FontSize"" Value=""9.5""/>
            <Setter Property=""FontWeight"" Value=""ExtraBold""/>
            <Setter Property=""FontFamily"" Value=""Segoe UI Variable Display""/>
            <Setter Property=""Margin"" Value=""20,16,0,6""/>
            <Setter Property=""TextOptions.TextFormattingMode"" Value=""Display""/>
        </Style>
    </Grid.Resources>

    <Grid Margin=""24"">
        <!-- Main window border -->
        <Border CornerRadius=""20"" BorderBrush=""#2A3B82F6"" BorderThickness=""1"" ClipToBounds=""True"">
            <Border.Clip>
                <RectangleGeometry RadiusX=""20"" RadiusY=""20"" Rect=""0,0,1132,772""/>
            </Border.Clip>
            <Grid>
                <!-- Interactive Dynamic Spotlight Background -->
                <!-- PremiumBackground is injected into spotlightBg as first child in code-behind -->
                <local:DynamicSpotlightGrid x:Name=""spotlightBg""/>

                <!-- Main Layout -->
                <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height=""44""/>
                    <RowDefinition Height=""*"" />
                </Grid.RowDefinitions>

                <!-- TITLEBAR -->
                <Grid Grid.Row=""0"" x:Name=""titleBar"" Cursor=""SizeAll"">
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width=""*""/>
                        <ColumnDefinition Width=""Auto""/>
                    </Grid.ColumnDefinitions>

                    <Border BorderBrush=""#0E1428"" BorderThickness=""0,0,0,1"" Grid.ColumnSpan=""2"" CornerRadius=""20,20,0,0"">
                        <Border.Background>
                            <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,0"">
                                <GradientStop Color=""#06080F"" Offset=""0""/>
                                <GradientStop Color=""#080B18"" Offset=""1""/>
                            </LinearGradientBrush>
                        </Border.Background>
                    </Border>

                    <!-- App title -->
                    <StackPanel Grid.Column=""0"" Orientation=""Horizontal"" Margin=""22,0,0,0"" VerticalAlignment=""Center"">
                        <Border Width=""22"" Height=""22"" CornerRadius=""6"" Margin=""0,0,10,0"">
                            <Border.Background>
                                <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,1"">
                                    <GradientStop Color=""#3B82F6"" Offset=""0""/>
                                    <GradientStop Color=""#60A5FA"" Offset=""1""/>
                                </LinearGradientBrush>
                            </Border.Background>
                            <Image Source=""pavo_logo.png"" Width=""14"" Height=""14"" RenderOptions.BitmapScalingMode=""HighQuality""/>
                        </Border>
                        <TextBlock Text=""Pavo Tweak"" Foreground=""#E8ECFF"" FontWeight=""Bold"" FontSize=""13"" FontFamily=""Segoe UI Variable Display"" VerticalAlignment=""Center""/>
                        <Border CornerRadius=""4"" Margin=""8,0,0,0"" Padding=""6,2"" VerticalAlignment=""Center"">
                            <Border.Background>
                                <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,0"">
                                    <GradientStop Color=""#3B82F6"" Offset=""0""/>
                                    <GradientStop Color=""#60A5FA"" Offset=""1""/>
                                </LinearGradientBrush>
                            </Border.Background>
                            <TextBlock Text=""PREMIUM"" Foreground=""White"" FontSize=""8"" FontWeight=""Black"" FontFamily=""Segoe UI Variable Display""/>
                        </Border>
                    </StackPanel>

                    <!-- Window controls -->
                    <StackPanel Grid.Column=""1"" Orientation=""Horizontal"" VerticalAlignment=""Stretch"">
                        <Button x:Name=""btnMinimize"" Width=""46"" Background=""Transparent"" BorderBrush=""Transparent"" Cursor=""Hand"">
                            <Button.Template>
                                <ControlTemplate TargetType=""Button"">
                                    <Border Name=""Bg"" Background=""{TemplateBinding Background}"">
                                        <TextBlock Text=""&#xE921;"" FontFamily=""Segoe MDL2 Assets"" FontSize=""10"" Foreground=""#5B6380"" HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
                                    </Border>
                                    <ControlTemplate.Triggers>
                                        <Trigger Property=""IsMouseOver"" Value=""True"">
                                            <Setter TargetName=""Bg"" Property=""Background"" Value=""#12FFFFFF""/>
                                            <Setter Property=""Foreground"" Value=""#A0AACC""/>
                                        </Trigger>
                                    </ControlTemplate.Triggers>
                                </ControlTemplate>
                            </Button.Template>
                        </Button>
                        <Button x:Name=""btnClose"" Width=""46"" Background=""Transparent"" BorderBrush=""Transparent"" Cursor=""Hand"">
                            <Button.Template>
                                <ControlTemplate TargetType=""Button"">
                                    <Border Name=""Bg"" Background=""{TemplateBinding Background}"" CornerRadius=""0,20,0,0"">
                                        <TextBlock Text=""&#xE711;"" FontFamily=""Segoe MDL2 Assets"" FontSize=""10"" Foreground=""#5B6380"" HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
                                    </Border>
                                    <ControlTemplate.Triggers>
                                        <Trigger Property=""IsMouseOver"" Value=""True"">
                                            <Setter TargetName=""Bg"" Property=""Background"" Value=""#CCFF3B5E""/>
                                            <Setter Property=""Foreground"" Value=""White""/>
                                        </Trigger>
                                    </ControlTemplate.Triggers>
                                </ControlTemplate>
                            </Button.Template>
                        </Button>
                    </StackPanel>
                </Grid>

                <!-- BODY -->
                <Grid Grid.Row=""1"">
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width=""64""/>
                        <ColumnDefinition Width=""*"" />
                    </Grid.ColumnDefinitions>

                    <!-- SIDEBAR -->
                    <Grid Grid.Column=""0"" Grid.ColumnSpan=""2"" x:Name=""sidebarGrid"" Width=""218"" ClipToBounds=""True"" HorizontalAlignment=""Left"" Panel.ZIndex=""99"">
                        <!-- Sidebar glass background -->
                        <Border BorderBrush=""#141F3D"" BorderThickness=""0,0,1,0"" CornerRadius=""0,0,0,20"">
                            <Border.Background>
                                <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,0"">
                                    <GradientStop Color=""#06080F"" Offset=""0""/>
                                    <GradientStop Color=""#080C1B"" Offset=""0.8""/>
                                    <GradientStop Color=""#0A0E22"" Offset=""1""/>
                                </LinearGradientBrush>
                            </Border.Background>
                            <Border.Effect>
                                <DropShadowEffect Color=""#000000"" BlurRadius=""15"" Opacity=""0.4"" ShadowDepth=""4""/>
                            </Border.Effect>
                        </Border>

                        <Grid>
                            <Grid.RowDefinitions>
                                <RowDefinition Height=""Auto""/>
                                <RowDefinition Height=""*""/>
                                <RowDefinition Height=""Auto""/>
                            </Grid.RowDefinitions>

                            <!-- Admin badge -->
                            <Border Grid.Row=""0"" x:Name=""borderAdminBadge"" CornerRadius=""10"" Margin=""14,14,14,8"" Padding=""10,7"">
                                <Border.Background>
                                    <SolidColorBrush Color=""#1A23A55A""/>
                                </Border.Background>
                                <Border.BorderBrush>
                                    <SolidColorBrush Color=""#3523A55A""/>
                                </Border.BorderBrush>
                                <Border.BorderThickness>
                                    <Thickness>1</Thickness>
                                </Border.BorderThickness>
                                <StackPanel Orientation=""Horizontal"" HorizontalAlignment=""Center"" VerticalAlignment=""Center"">
                                    <TextBlock x:Name=""adminIcon"" Text=""&#xE727;"" FontFamily=""Segoe MDL2 Assets"" Foreground=""#23A55A"" FontSize=""11"" VerticalAlignment=""Center"" Margin=""0,0,7,0""/>
                                    <TextBlock x:Name=""lblAdminText"" Text=""VERIFICA..."" Foreground=""#23A55A"" FontSize=""10"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Text"" VerticalAlignment=""Center""/>
                                </StackPanel>
                            </Border>

                            <!-- Navigation -->
                            <ScrollViewer Grid.Row=""1"" VerticalScrollBarVisibility=""Hidden"" HorizontalScrollBarVisibility=""Disabled"">
                                <Grid Width=""218"" HorizontalAlignment=""Left"">
                                    <!-- Sliding Active Indicator -->
                                    <Border x:Name=""sidebarActiveIndicator"" Height=""36"" Width=""204"" HorizontalAlignment=""Left"" CornerRadius=""8"" Margin=""6,0,0,0"" VerticalAlignment=""Top"">
                                        <Border.Background>
                                            <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,0"">
                                                <GradientStop Color=""#1C3B82F6"" Offset=""0""/>
                                                <GradientStop Color=""#083B82F6"" Offset=""1""/>
                                            </LinearGradientBrush>
                                        </Border.Background>
                                        <Border.BorderBrush>
                                            <SolidColorBrush Color=""#353B82F6""/>
                                        </Border.BorderBrush>
                                        <Border.BorderThickness>1</Border.BorderThickness>
                                        <Border.Effect>
                                            <DropShadowEffect Color=""#3B82F6"" BlurRadius=""14"" Opacity=""0.35"" ShadowDepth=""0""/>
                                        </Border.Effect>
                                        <Border.RenderTransform>
                                            <TranslateTransform x:Name=""indicatorTranslate"" Y=""0""/>
                                        </Border.RenderTransform>
                                        <!-- Neon left accent bar -->
                                        <Border Width=""3.5"" HorizontalAlignment=""Left"" CornerRadius=""2"" Margin=""0,6,0,6"">
                                            <Border.Background>
                                                <LinearGradientBrush StartPoint=""0,0"" EndPoint=""0,1"">
                                                    <GradientStop Color=""#60A5FA"" Offset=""0""/>
                                                    <GradientStop Color=""#3B82F6"" Offset=""0.5""/>
                                                    <GradientStop Color=""#2563EB"" Offset=""1""/>
                                                </LinearGradientBrush>
                                            </Border.Background>
                                            <Border.Effect>
                                                <DropShadowEffect Color=""#60A5FA"" BlurRadius=""8"" Opacity=""0.85"" ShadowDepth=""0""/>
                                            </Border.Effect>
                                        </Border>
                                    </Border>

                                    <!-- Navigation stack -->
                                    <StackPanel x:Name=""sidebarButtonsPanel"" Background=""Transparent"" Margin=""0,4,0,8"">

                                    <TextBlock x:Name=""lblCat1"" Text=""PRINCIPALE"" Style=""{StaticResource SidebarCategory}""/>
                                    <Button x:Name=""btnTabDashboard"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xE80F;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarDashboard"" Text=""Dashboard"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>
                                    <Button x:Name=""btnTabAIOpt"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xE7E8;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarAIOpt"" Text=""AI Optimization"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>
                                    <Button x:Name=""btnTabCustom"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xE790;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarCustom"" Text=""Windows Custom"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>

                                    <TextBlock x:Name=""lblCat2"" Text=""PERFORMANCE"" Style=""{StaticResource SidebarCategory}""/>
                                    <Button x:Name=""btnTabGaming"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xF20C;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarGaming"" Text=""Gaming Hub"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>
                                    <Button x:Name=""btnTabBenchmark"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xF116;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarBenchmark"" Text=""Benchmarks"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>
                                    <Button x:Name=""btnTabRAM"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xE9D2;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarRAM"" Text=""RAM Manager"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>

                                    <TextBlock x:Name=""lblCat3"" Text=""SISTEMA"" Style=""{StaticResource SidebarCategory}""/>
                                    <Button x:Name=""btnTabDriver"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xEC4A;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarDriver"" Text=""Driver Center"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>
                                    <Button x:Name=""btnTabDisk"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xE7F1;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarDisk"" Text=""Disk Tools"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>
                                    <Button x:Name=""btnTabStartup"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xE768;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarStartup"" Text=""Startup Apps"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>
                                    <Button x:Name=""btnTabRestore"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xE72C;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarRestore"" Text=""Restore Center"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>

                                    <TextBlock x:Name=""lblCat4"" Text=""ALTRO"" Style=""{StaticResource SidebarCategory}""/>
                                    <Button x:Name=""btnTabMarket"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xE719;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarMarket"" Text=""Marketplace"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>
                                    <Button x:Name=""btnTabSettings"" Style=""{StaticResource SidebarBtn}"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <TextBlock Text=""&#xE713;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center""/>
                                            <TextBlock x:Name=""lblSidebarSettings"" Text=""Impostazioni"" Margin=""10,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                    </Button>
                                </StackPanel>
                            </Grid>
                        </ScrollViewer>

                            <!-- Discord footer -->
                            <Border Grid.Row=""2"" BorderBrush=""#0D1428"" BorderThickness=""0,1,0,0"" Width=""218"" HorizontalAlignment=""Left"" Background=""Transparent"">
                                <Button x:Name=""btnJoinDiscord"" Style=""{StaticResource SidebarBtn}"">
                                    <StackPanel Orientation=""Horizontal"">
                                        <TextBlock Text=""&#xE8F2;"" FontFamily=""Segoe MDL2 Assets"" Width=""18"" FontSize=""13"" VerticalAlignment=""Center"" Foreground=""#3B82F6""/>
                                        <TextBlock x:Name=""lblDiscordText"" Text=""Supporto Discord"" Margin=""10,0,0,0"" VerticalAlignment=""Center"" Foreground=""#C8CEFF""/>
                                    </StackPanel>
                                </Button>
                            </Border>
                        </Grid>
                    </Grid>

                    <!-- â•â•â•â•â•â•â•â•â•â•â•â• MAIN CONTENT â•â•â•â•â•â•â•â•â•â•â•â• -->
                    <Grid Grid.Column=""1"">
                        <Grid.RowDefinitions>
                            <RowDefinition Height=""*""/>
                            <RowDefinition Height=""110""/>
                        </Grid.RowDefinitions>

                        <!-- Particle canvas -->
                        <Grid Grid.Row=""0"" Grid.RowSpan=""2"" ClipToBounds=""True"">
                            <ContentControl x:Name=""particleContainer""/>
                        </Grid>

                        <!-- View container -->
                        <Grid Grid.Row=""0"" x:Name=""viewportContainer"" Margin=""22,18,22,8""/>

                        <!-- â•â•â•â• CONSOLE LOG â•â•â•â• -->
                        <Grid Grid.Row=""1"">
                            <Border BorderBrush=""#0C1020"" BorderThickness=""0,1,0,0"" CornerRadius=""0,0,20,0"" ClipToBounds=""True"">
                                <Border.Background>
                                    <LinearGradientBrush StartPoint=""0,0"" EndPoint=""0,1"">
                                        <GradientStop Color=""#040508"" Offset=""0""/>
                                        <GradientStop Color=""#03040A"" Offset=""1""/>
                                    </LinearGradientBrush>
                                </Border.Background>
                                <Grid>
                                    <Grid.RowDefinitions>
                                        <RowDefinition Height=""24""/>
                                        <RowDefinition Height=""*""/>
                                    </Grid.RowDefinitions>

                                    <!-- Console header -->
                                    <Border Grid.Row=""0"" Padding=""16,0"" BorderBrush=""#0C1020"" BorderThickness=""0,0,0,1"">
                                        <Border.Background>
                                            <SolidColorBrush Color=""#03040A""/>
                                        </Border.Background>
                                        <Grid>
                                            <StackPanel Orientation=""Horizontal"" HorizontalAlignment=""Left"" VerticalAlignment=""Center"" Margin=""0,0,0,0"">
                                                <Ellipse Width=""7"" Height=""7"" Fill=""#FF5F56"" Margin=""0,0,5,0""/>
                                                <Ellipse Width=""7"" Height=""7"" Fill=""#FFBD2E"" Margin=""0,0,5,0""/>
                                                <Ellipse Width=""7"" Height=""7"" Fill=""#27C93F""/>
                                            </StackPanel>
                                            <TextBlock x:Name=""lblConsoleTitle"" Text=""PAVO CONSOLE"" FontSize=""9"" FontWeight=""Bold"" Foreground=""#2D3560"" FontFamily=""Consolas"" HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
                                        </Grid>
                                    </Border>

                                    <TextBox Grid.Row=""1"" x:Name=""txtConsoleLog"" IsReadOnly=""True"" Background=""Transparent""
                                             Foreground=""#3B82F6"" BorderThickness=""0""
                                             FontFamily=""Consolas"" FontSize=""10"" Padding=""16,6""
                                             Margin=""0,0,12,12""
                                             VerticalScrollBarVisibility=""Auto""
                                             AcceptsReturn=""True"" TextWrapping=""Wrap""/>
                                </Grid>
                            </Border>
                        </Grid>
                    </Grid>
                </Grid>

                <!-- â•â•â•â• TOAST â•â•â•â• -->
                <Grid Grid.Row=""1"" x:Name=""gridToast"" Visibility=""Collapsed"" Panel.ZIndex=""99999""
                      Margin=""0,16,20,0"" HorizontalAlignment=""Right"" VerticalAlignment=""Top"">
                    <Border BorderThickness=""1"" CornerRadius=""12"" Padding=""14,10"" Width=""280"">
                        <Border.BorderBrush>
                            <SolidColorBrush Color=""#2D3560""/>
                        </Border.BorderBrush>
                        <Border.Background>
                            <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,1"">
                                <GradientStop Color=""#10142A"" Offset=""0""/>
                                <GradientStop Color=""#0D1020"" Offset=""1""/>
                            </LinearGradientBrush>
                        </Border.Background>
                        <Border.Effect>
                            <DropShadowEffect Color=""#3B82F6"" BlurRadius=""20"" Opacity=""0.2"" ShadowDepth=""0""/>
                        </Border.Effect>
                        <StackPanel Orientation=""Horizontal"">
                            <Border x:Name=""borderToastIcon"" Width=""22"" Height=""22"" CornerRadius=""11"" Background=""#00E5A0"" Margin=""0,0,10,0"">
                                <TextBlock Text=""&#xE73E;"" FontFamily=""Segoe MDL2 Assets"" Foreground=""White"" FontSize=""11"" HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
                            </Border>
                            <TextBlock x:Name=""lblToastText"" Text=""Completato!"" Foreground=""#E8ECFF"" FontSize=""12"" FontWeight=""SemiBold"" FontFamily=""Segoe UI Variable Text"" VerticalAlignment=""Center"" TextWrapping=""Wrap"" Width=""210""/>
                        </StackPanel>
                    </Border>
                </Grid>

                <!-- â•â•â•â• LOADING OVERLAY â•â•â•â• -->
                <Grid Grid.Row=""0"" Grid.RowSpan=""2"" x:Name=""gridLoading"" Panel.ZIndex=""99999"">
                    <Grid.Background>
                        <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,1"">
                            <GradientStop Color=""#06080F"" Offset=""0""/>
                            <GradientStop Color=""#080B18"" Offset=""1""/>
                        </LinearGradientBrush>
                    </Grid.Background>
                    <StackPanel VerticalAlignment=""Center"" HorizontalAlignment=""Center"">
                        <Border Width=""56"" Height=""56"" CornerRadius=""16"" Margin=""0,0,0,20"" HorizontalAlignment=""Center"">
                            <Border.Background>
                                <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,1"">
                                    <GradientStop Color=""#3B82F6"" Offset=""0""/>
                                    <GradientStop Color=""#60A5FA"" Offset=""1""/>
                                </LinearGradientBrush>
                            </Border.Background>
                            <Border.Effect>
                                <DropShadowEffect Color=""#3B82F6"" BlurRadius=""30"" Opacity=""0.6"" ShadowDepth=""0""/>
                            </Border.Effect>
                            <Image Source=""pavo_logo.png"" Width=""30"" Height=""30"" RenderOptions.BitmapScalingMode=""HighQuality""/>
                        </Border>
                        <TextBlock Text=""PAVO TWEAK"" FontSize=""22"" FontWeight=""Black"" FontFamily=""Segoe UI Variable Display""
                                   HorizontalAlignment=""Center"" Margin=""0,0,0,4"">
                            <TextBlock.Foreground>
                                <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,0"">
                                    <GradientStop Color=""#E8ECFF"" Offset=""0""/>
                                    <GradientStop Color=""#A090FF"" Offset=""1""/>
                                </LinearGradientBrush>
                            </TextBlock.Foreground>
                        </TextBlock>
                        <TextBlock Text=""PREMIUM"" FontSize=""10"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display""
                                   Foreground=""#3B82F6"" HorizontalAlignment=""Center"" Margin=""0,0,0,14""/>
                        <TextBlock Text=""Caricamento moduli e telemetria..."" FontSize=""11"" Foreground=""#3D4560""
                                   FontFamily=""Segoe UI Variable Text"" HorizontalAlignment=""Center"">
                            <TextBlock.Triggers>
                                <EventTrigger RoutedEvent=""Loaded"">
                                    <BeginStoryboard>
                                        <Storyboard RepeatBehavior=""Forever"">
                                            <DoubleAnimation Storyboard.TargetProperty=""Opacity"" From=""0.3"" To=""1.0"" Duration=""0:0:1.2"" AutoReverse=""True""/>
                                        </Storyboard>
                                    </BeginStoryboard>
                                </EventTrigger>
                            </TextBlock.Triggers>
                        </TextBlock>
                    </StackPanel>
                </Grid>
                </Grid>
            </Grid>
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
            this.Content = root;

            // Bind controls
            mainGrid = root;
            gridLoading = (Grid)mainGrid.FindName("gridLoading");
            gridToast = (Grid)mainGrid.FindName("gridToast");
            lblToastText = (TextBlock)mainGrid.FindName("lblToastText");
            borderToastIcon = (Border)mainGrid.FindName("borderToastIcon");
            txtConsoleLog = (TextBox)mainGrid.FindName("txtConsoleLog");
            viewportContainer = (Grid)mainGrid.FindName("viewportContainer");

            Application.Current.Resources["AccentBrush"] = mainGrid.FindResource("AccentBrush");
            Application.Current.Resources["iOSSwitch"] = mainGrid.FindResource("iOSSwitch");
            Application.Current.Resources["iOSCheckBox"] = mainGrid.FindResource("iOSCheckBox");
            Application.Current.Resources["PremiumCard"] = mainGrid.FindResource("PremiumCard");
            Application.Current.Resources["PremiumButton"] = mainGrid.FindResource("PremiumButton");
            Application.Current.Resources["PremiumProgressBar"] = mainGrid.FindResource("PremiumProgressBar");

            ContentControl particleContainer = (ContentControl)mainGrid.FindName("particleContainer");
            var canvas = new ParticleCanvas();
            particleContainer.Content = canvas;

            // ── Inject PremiumBackground into spotlightBg as its FIRST child ────────────
            // spotlightBg is the solid-dark Grid that covers the entire window,
            // so inserting PremiumBackground here guarantees the hexagon image
            // and animations are visible behind ALL sections and pages.
            DynamicSpotlightGrid spotlightBgGrid = (DynamicSpotlightGrid)mainGrid.FindName("spotlightBg");
            if (spotlightBgGrid != null)
                spotlightBgGrid.Children.Insert(0, PremiumBackground.GetInstance());

            TextBlock lblAdminText = (TextBlock)mainGrid.FindName("lblAdminText");
            Border borderAdminBadge = (Border)mainGrid.FindName("borderAdminBadge");
            _lblAdminBadge = lblAdminText;
            if (IsAdmin)
            {
                lblAdminText.Text = Lang.Get("status.admin");
                lblAdminText.Foreground = new SolidColorBrush(Color.FromRgb(35, 165, 90));
                borderAdminBadge.Background = new SolidColorBrush(Color.FromArgb(26, 35, 165, 90));
                borderAdminBadge.BorderBrush = new SolidColorBrush(Color.FromArgb(64, 35, 165, 90));
            }
            else
            {
                lblAdminText.Text = Lang.Get("status.user");
                lblAdminText.Foreground = new SolidColorBrush(Color.FromRgb(240, 178, 50));
                borderAdminBadge.Background = new SolidColorBrush(Color.FromArgb(26, 240, 178, 50));
                borderAdminBadge.BorderBrush = new SolidColorBrush(Color.FromArgb(64, 240, 178, 50));
            }

            // Cache sidebar label references for language refresh
            _lblSidebarSettings = (TextBlock)mainGrid.FindName("lblSidebarSettings");
            _lblSidebarMarket   = (TextBlock)mainGrid.FindName("lblSidebarMarket");

            // Cache all labels for hover expand/collapse opacity animations
            sidebarLabels.Clear();
            string[] names = {
                "lblSidebarDashboard", "lblSidebarAIOpt", "lblSidebarCustom",
                "lblSidebarGaming", "lblSidebarBenchmark", "lblSidebarRAM",
                "lblSidebarDriver", "lblSidebarDisk", "lblSidebarStartup",
                "lblSidebarRestore", "lblSidebarMarket", "lblSidebarSettings",
                "lblCat1", "lblCat2", "lblCat3", "lblCat4", "lblDiscordText", "lblAdminText"
            };
            foreach (var name in names)
            {
                var tb = (TextBlock)mainGrid.FindName(name);
                if (tb != null) sidebarLabels.Add(tb);
            }

            // Hook sidebar hover actions
            Grid sidebarGrid = (Grid)mainGrid.FindName("sidebarGrid");
            sidebarGrid.MouseEnter += (s, e) => ExpandSidebar();
            sidebarGrid.MouseLeave += (s, e) => CollapseSidebar();

            // Set initial state (start as collapsed to be clean)
            sidebarGrid.Width = 64;
            foreach (var tb in sidebarLabels)
            {
                tb.Opacity = 0;
            }

            Border adminBadge = (Border)mainGrid.FindName("borderAdminBadge");
            if (adminBadge != null)
            {
                adminBadge.Width = 32;
                adminBadge.Height = 32;
                adminBadge.Padding = new Thickness(0);
                adminBadge.Margin = new Thickness(16, 14, 16, 8);
            }
            TextBlock adminIcon = (TextBlock)mainGrid.FindName("adminIcon");
            if (adminIcon != null)
            {
                adminIcon.Margin = new Thickness(0);
            }

            // Subscribe to language changes
            Lang.LanguageChanged += RefreshSidebarLabels;
            ThemeManager.ApplyAccent(AppSettings.AccentHex);
        }

        private void ExpandSidebar()
        {
            Grid sidebarGrid = (Grid)mainGrid.FindName("sidebarGrid");
            if (sidebarGrid == null) return;

            double currentWidth = sidebarGrid.ActualWidth > 0 ? sidebarGrid.ActualWidth : 64;
            double targetWidth = 218;
            double distance = Math.Abs(targetWidth - currentWidth);
            if (distance < 0.5) return;

            double durationMs = Math.Max(60, 220 * (distance / (218 - 64)));

            DoubleAnimation widthAnim = new DoubleAnimation(currentWidth, targetWidth, TimeSpan.FromMilliseconds(durationMs));
            widthAnim.EasingFunction = new QuarticEase { EasingMode = EasingMode.EaseOut };
            Timeline.SetDesiredFrameRate(widthAnim, 120);
            sidebarGrid.BeginAnimation(Grid.WidthProperty, widthAnim);

            Border adminBadge = (Border)mainGrid.FindName("borderAdminBadge");
            if (adminBadge != null)
            {
                adminBadge.Width = double.NaN;
                adminBadge.Height = double.NaN;
                adminBadge.Padding = new Thickness(10, 7, 10, 7);
                adminBadge.Margin = new Thickness(14, 14, 14, 8);
            }
            TextBlock adminIcon = (TextBlock)mainGrid.FindName("adminIcon");
            if (adminIcon != null)
            {
                adminIcon.Margin = new Thickness(0, 0, 7, 0);
            }

            AnimateTextOpacity(1);
        }

        private void CollapseSidebar()
        {
            Grid sidebarGrid = (Grid)mainGrid.FindName("sidebarGrid");
            if (sidebarGrid == null) return;

            double currentWidth = sidebarGrid.ActualWidth > 0 ? sidebarGrid.ActualWidth : 218;
            double targetWidth = 64;
            double distance = Math.Abs(targetWidth - currentWidth);
            if (distance < 0.5) return;

            double durationMs = Math.Max(60, 220 * (distance / (218 - 64)));

            DoubleAnimation widthAnim = new DoubleAnimation(currentWidth, targetWidth, TimeSpan.FromMilliseconds(durationMs));
            widthAnim.EasingFunction = new QuarticEase { EasingMode = EasingMode.EaseOut };
            Timeline.SetDesiredFrameRate(widthAnim, 120);
            sidebarGrid.BeginAnimation(Grid.WidthProperty, widthAnim);

            Border adminBadge = (Border)mainGrid.FindName("borderAdminBadge");
            if (adminBadge != null)
            {
                adminBadge.Width = 32;
                adminBadge.Height = 32;
                adminBadge.Padding = new Thickness(0);
                adminBadge.Margin = new Thickness(16, 14, 16, 8);
            }
            TextBlock adminIcon = (TextBlock)mainGrid.FindName("adminIcon");
            if (adminIcon != null)
            {
                adminIcon.Margin = new Thickness(0);
            }

            AnimateTextOpacity(0);
        }

        private void AnimateTextOpacity(double targetOpacity)
        {
            if (sidebarLabels == null || sidebarLabels.Count == 0) return;

            double currentOpacity = sidebarLabels[0].Opacity;
            double opacityDiff = Math.Abs(targetOpacity - currentOpacity);
            if (opacityDiff < 0.05) return;

            double durationMs = Math.Max(50, 180 * opacityDiff);
            var anim = new DoubleAnimation(currentOpacity, targetOpacity, TimeSpan.FromMilliseconds(durationMs));
            anim.EasingFunction = new QuarticEase { EasingMode = EasingMode.EaseOut };
            Timeline.SetDesiredFrameRate(anim, 120);

            foreach (var tb in sidebarLabels)
            {
                if (tb != null) tb.BeginAnimation(TextBlock.OpacityProperty, anim);
            }
        }

                private void InstantiateViews()
        {
            DashboardView = new DashboardView();
            AIOptimizerView = new AIOptimizerView();
            CustomizationView = new CustomizationView();
            GamingHubView = new GamingHubView();
            DriverCenterView = new DriverCenterView();
            BenchmarkView = new BenchmarkView();
            DiskToolsView = new DiskToolsView();
            RamManagerView = new RamManagerView();
            StartupView = new StartupView();
            RestoreView = new RestoreView();
            MarketplaceView = new MarketplaceView();

            SettingsView = new SettingsView();

            viewportContainer.Children.Add(DashboardView);
            viewportContainer.Children.Add(AIOptimizerView);
            viewportContainer.Children.Add(CustomizationView);
            viewportContainer.Children.Add(GamingHubView);
            viewportContainer.Children.Add(DriverCenterView);
            viewportContainer.Children.Add(BenchmarkView);
            viewportContainer.Children.Add(DiskToolsView);
            viewportContainer.Children.Add(RamManagerView);
            viewportContainer.Children.Add(StartupView);
            viewportContainer.Children.Add(RestoreView);
            viewportContainer.Children.Add(MarketplaceView);
            viewportContainer.Children.Add(SettingsView);

            AIOptimizerView.Visibility = Visibility.Collapsed;
            CustomizationView.Visibility = Visibility.Collapsed;
            GamingHubView.Visibility = Visibility.Collapsed;
            DriverCenterView.Visibility = Visibility.Collapsed;
            BenchmarkView.Visibility = Visibility.Collapsed;
            DiskToolsView.Visibility = Visibility.Collapsed;
            RamManagerView.Visibility = Visibility.Collapsed;
            StartupView.Visibility = Visibility.Collapsed;
            RestoreView.Visibility = Visibility.Collapsed;
            MarketplaceView.Visibility = Visibility.Collapsed;
            SettingsView.Visibility = Visibility.Collapsed;
        }

        private void BindShellEvents()
        {
            Grid titleBar = (Grid)mainGrid.FindName("titleBar");
            titleBar.MouseLeftButtonDown += (s, e) => { try { this.DragMove(); } catch {} };

            Button btnMinimize = (Button)mainGrid.FindName("btnMinimize");
            btnMinimize.Click += (s, e) => this.WindowState = WindowState.Minimized;

            Button btnClose = (Button)mainGrid.FindName("btnClose");
            btnClose.Click += (s, e) => this.Close();

            Button btnTabDashboard = (Button)mainGrid.FindName("btnTabDashboard");
            Button btnTabAIOpt = (Button)mainGrid.FindName("btnTabAIOpt");
            Button btnTabCustom = (Button)mainGrid.FindName("btnTabCustom");
            Button btnTabGaming = (Button)mainGrid.FindName("btnTabGaming");
            Button btnTabDriver = (Button)mainGrid.FindName("btnTabDriver");
            Button btnTabBenchmark = (Button)mainGrid.FindName("btnTabBenchmark");
            Button btnTabDisk = (Button)mainGrid.FindName("btnTabDisk");
            Button btnTabRAM = (Button)mainGrid.FindName("btnTabRAM");
            Button btnTabStartup = (Button)mainGrid.FindName("btnTabStartup");
            Button btnTabRestore = (Button)mainGrid.FindName("btnTabRestore");
            Button btnTabMarket   = (Button)mainGrid.FindName("btnTabMarket");
            Button btnTabSettings = (Button)mainGrid.FindName("btnTabSettings");

            navigationViews[btnTabDashboard] = DashboardView;
            navigationViews[btnTabAIOpt]     = AIOptimizerView;
            navigationViews[btnTabCustom]    = CustomizationView;
            navigationViews[btnTabGaming]    = GamingHubView;
            navigationViews[btnTabDriver]    = DriverCenterView;
            navigationViews[btnTabBenchmark] = BenchmarkView;
            navigationViews[btnTabDisk]      = DiskToolsView;
            navigationViews[btnTabRAM]       = RamManagerView;
            navigationViews[btnTabStartup]   = StartupView;
            navigationViews[btnTabRestore]   = RestoreView;
            navigationViews[btnTabMarket]    = MarketplaceView;
            navigationViews[btnTabSettings]  = SettingsView;

            foreach (var btn in navigationViews.Keys)
            {
                btn.Click += (s, e) => ShowView(btn);
            }

            Button btnJoinDiscord = (Button)mainGrid.FindName("btnJoinDiscord");
            btnJoinDiscord.Click += (s, e) => {
                SoundManager.PlayClick();
                Log(Lang.Get("nav.discord") + "...");
                try { System.Diagnostics.Process.Start("https://discord.gg/aCDYVdzrXb"); } catch {}
            };

            HighlightNavigationButton(btnTabDashboard);
            Log("Pavo Tweak " + (Lang.Current == AppLanguage.Italian ? "avviato. Pronto." : "started. Ready."));
        }

        private void ShowView(Button clickedButton)
        {
            SoundManager.PlayClick();
            HighlightNavigationButton(clickedButton);
            MoveSidebarIndicator(clickedButton);

            Grid targetView = navigationViews[clickedButton];

            foreach (var view in navigationViews.Values)
            {
                if (view == targetView)
                {
                    view.Visibility = Visibility.Visible;

                    var translate = new TranslateTransform(0, 12);
                    view.RenderTransform = translate;
                    view.RenderTransformOrigin = new Point(0.5, 0.5);

                    var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(220));
                    var slideUp = new DoubleAnimation(12, 0, TimeSpan.FromMilliseconds(220));

                    var ease = new QuarticEase { EasingMode = EasingMode.EaseOut };
                    fadeIn.EasingFunction = ease;
                    slideUp.EasingFunction = ease;

                    Timeline.SetDesiredFrameRate(fadeIn, 120);
                    Timeline.SetDesiredFrameRate(slideUp, 120);

                    view.BeginAnimation(UIElement.OpacityProperty, fadeIn);
                    translate.BeginAnimation(TranslateTransform.YProperty, slideUp);

                    Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() => {
                        try
                        {
                            if (view == DashboardView) DashboardView.RefreshWidgets();
                            else if (view == AIOptimizerView) AIOptimizerView.OnShow();
                            else if (view == DriverCenterView) DriverCenterView.ScanDrivers();
                            else if (view == DiskToolsView) DiskToolsView.OnShow();
                            else if (view == StartupView) StartupView.RefreshStartupList();
                        }
                        catch {}
                    }));
                }
                else
                {
                    view.Visibility = Visibility.Collapsed;
                    view.Opacity = 0;
                    view.RenderTransform = null;
                }
            }
        }

        private void HighlightNavigationButton(Button activeBtn)
        {
            Brush activeIconBrush = new SolidColorBrush(Color.FromRgb(96, 165, 250)); // Vibrant Accent #60A5FA
            Brush inactiveIconBrush = new SolidColorBrush(Color.FromRgb(107, 115, 153)); // #6B7399
            Brush activeLabelBrush = Brushes.White;
            Brush inactiveLabelBrush = new SolidColorBrush(Color.FromRgb(142, 151, 184)); // #8E97B8

            foreach (var btn in navigationViews.Keys)
            {
                bool isActive = (btn == activeBtn);
                var sp = btn.Content as StackPanel;
                if (sp != null && sp.Children.Count >= 2)
                {
                    var iconTb = sp.Children[0] as TextBlock;
                    var labelTb = sp.Children[1] as TextBlock;

                    if (iconTb != null)
                    {
                        iconTb.Foreground = isActive ? activeIconBrush : inactiveIconBrush;
                    }
                    if (labelTb != null)
                    {
                        labelTb.Foreground = isActive ? activeLabelBrush : inactiveLabelBrush;
                        labelTb.FontWeight = isActive ? FontWeights.Bold : FontWeights.SemiBold;
                    }
                }
                else
                {
                    btn.Foreground = isActive ? activeLabelBrush : inactiveLabelBrush;
                }
            }
        }

        private void MoveSidebarIndicator(Button clickedButton)
        {
            try
            {
                var stackPanel = (StackPanel)mainGrid.FindName("sidebarButtonsPanel");
                var indicator = (Border)mainGrid.FindName("sidebarActiveIndicator");
                var translate = (TranslateTransform)mainGrid.FindName("indicatorTranslate");

                if (stackPanel != null && indicator != null && translate != null)
                {
                    // Find relative Y position of the button inside the stack panel
                    Point relativePoint = clickedButton.TranslatePoint(new Point(0, 0), stackPanel);
                    double targetY = relativePoint.Y + 2; // Center 36px indicator inside 40px button row

                    // Animate indicator Y position smoothly with fluid spring easing curve
                    DoubleAnimation anim = new DoubleAnimation(translate.Y, targetY, TimeSpan.FromMilliseconds(260));
                    anim.EasingFunction = new BackEase { EasingMode = EasingMode.EaseOut, Amplitude = 0.22 };
                    
                    // Hardware accelerated frame rate desired
                    Timeline.SetDesiredFrameRate(anim, 120);

                    translate.BeginAnimation(TranslateTransform.YProperty, anim);
                }
            }
            catch {}
        }

        private void MainWindow_ContentRendered(object sender, EventArgs e)
        {
            DoubleAnimation fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromSeconds(1));
            fadeOut.Completed += (s, ev) => {
                gridLoading.Visibility = Visibility.Collapsed;
                CheckForUpdatesAsync();
            };
            gridLoading.BeginAnimation(Grid.OpacityProperty, fadeOut);
        }

        private void CheckForUpdatesAsync()
        {
            System.Threading.Tasks.Task.Run(() =>
            {
                try
                {
                    using (var client = new System.Net.WebClient())
                    {
                        client.Proxy = null;
                        client.Headers[System.Net.HttpRequestHeader.CacheControl] = "no-cache";
                        
                        string jsonStr = client.DownloadString(UpdateConfig.UpdateUrl);
                        using (var ms = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(jsonStr)))
                        {
                            var serializer = new System.Runtime.Serialization.Json.DataContractJsonSerializer(typeof(UpdateInfo));
                            var info = (UpdateInfo)serializer.ReadObject(ms);

                            if (info != null && !string.IsNullOrEmpty(info.version))
                            {
                                Version current = new Version(UpdateConfig.CurrentVersion);
                                Version server = new Version(info.version);

                                if (server > current)
                                {
                                    Dispatcher.BeginInvoke(new Action(() =>
                                    {
                                        UpdateDialog dialog = new UpdateDialog(info);
                                        dialog.Owner = this;
                                        dialog.ShowDialog();
                                    }));
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Log(Lang.TranslateString("Errore controllo aggiornamenti: ") + ex.Message, "INFO");
                }
            });
        }

        private void RefreshSidebarLabels()
        {
            // Update sidebar buttons
            var lblDash = (TextBlock)mainGrid.FindName("lblSidebarDashboard");
            if (lblDash != null) lblDash.Text = Lang.Get("nav.dashboard");

            var lblAI = (TextBlock)mainGrid.FindName("lblSidebarAIOpt");
            if (lblAI != null) lblAI.Text = Lang.Get("nav.ai");

            var lblCustom = (TextBlock)mainGrid.FindName("lblSidebarCustom");
            if (lblCustom != null) lblCustom.Text = Lang.Get("nav.custom");

            var lblGaming = (TextBlock)mainGrid.FindName("lblSidebarGaming");
            if (lblGaming != null) lblGaming.Text = Lang.Get("nav.gaming");

            var lblBenchmark = (TextBlock)mainGrid.FindName("lblSidebarBenchmark");
            if (lblBenchmark != null) lblBenchmark.Text = Lang.Get("nav.benchmark");

            var lblRAM = (TextBlock)mainGrid.FindName("lblSidebarRAM");
            if (lblRAM != null) lblRAM.Text = Lang.Get("nav.ram");

            var lblDriver = (TextBlock)mainGrid.FindName("lblSidebarDriver");
            if (lblDriver != null) lblDriver.Text = Lang.Get("nav.driver");

            var lblDisk = (TextBlock)mainGrid.FindName("lblSidebarDisk");
            if (lblDisk != null) lblDisk.Text = Lang.Get("nav.disk");

            var lblStartup = (TextBlock)mainGrid.FindName("lblSidebarStartup");
            if (lblStartup != null) lblStartup.Text = Lang.Get("nav.startup");

            var lblRestore = (TextBlock)mainGrid.FindName("lblSidebarRestore");
            if (lblRestore != null) lblRestore.Text = Lang.Get("nav.restore");

            var lblMarket = (TextBlock)mainGrid.FindName("lblSidebarMarket");
            if (lblMarket != null) lblMarket.Text = Lang.Get("nav.market");

            var lblSettings = (TextBlock)mainGrid.FindName("lblSidebarSettings");
            if (lblSettings != null) lblSettings.Text = Lang.Get("nav.settings");

            var lblDiscord = (TextBlock)mainGrid.FindName("lblDiscordText");
            if (lblDiscord != null) lblDiscord.Text = Lang.Get("nav.discord");

            if (_lblAdminBadge != null) _lblAdminBadge.Text = IsAdmin ? Lang.Get("status.admin") : Lang.Get("status.user");
            
            // Refresh category headers in sidebar
            var lblCat1 = (TextBlock)mainGrid.FindName("lblCat1");
            if (lblCat1 != null) lblCat1.Text = Lang.Current == AppLanguage.Italian ? "NAVIGAZIONE" : "NAVIGATION";
            
            var lblCat2 = (TextBlock)mainGrid.FindName("lblCat2");
            if (lblCat2 != null) lblCat2.Text = Lang.Current == AppLanguage.Italian ? "PRESTAZIONI" : "PERFORMANCE";
            
            var lblCat3 = (TextBlock)mainGrid.FindName("lblCat3");
            if (lblCat3 != null) lblCat3.Text = Lang.Current == AppLanguage.Italian ? "SISTEMA" : "SYSTEM";
            
            var lblCat4 = (TextBlock)mainGrid.FindName("lblCat4");
            if (lblCat4 != null) lblCat4.Text = Lang.Current == AppLanguage.Italian ? "ALTRO" : "OTHER";

            var lblConsoleTitle = (TextBlock)mainGrid.FindName("lblConsoleTitle");
            if (lblConsoleTitle != null) lblConsoleTitle.Text = Lang.Get("console.title");

            // Re-instantiate views to apply translation dynamically
            RecreateViews();
        }

        private void RecreateViews()
        {
            try
            {
                // Save which view is currently visible
                Button activeBtn = null;
                foreach (var kvp in navigationViews)
                {
                    if (kvp.Value != null && kvp.Value.Visibility == Visibility.Visible)
                    {
                        activeBtn = kvp.Key;
                        break;
                    }
                }

                viewportContainer.Children.Clear();

                // Re-instantiate
                DashboardView = new DashboardView();
                AIOptimizerView = new AIOptimizerView();
                CustomizationView = new CustomizationView();
                GamingHubView = new GamingHubView();
                DriverCenterView = new DriverCenterView();
                BenchmarkView = new BenchmarkView();
                DiskToolsView = new DiskToolsView();
                RamManagerView = new RamManagerView();
                StartupView = new StartupView();
                RestoreView = new RestoreView();
                MarketplaceView = new MarketplaceView();
                SettingsView = new SettingsView();

                // Translate all views recursively
                Lang.TranslateUI(DashboardView);
                Lang.TranslateUI(AIOptimizerView);
                Lang.TranslateUI(CustomizationView);
                Lang.TranslateUI(GamingHubView);
                Lang.TranslateUI(DriverCenterView);
                Lang.TranslateUI(BenchmarkView);
                Lang.TranslateUI(DiskToolsView);
                Lang.TranslateUI(RamManagerView);
                Lang.TranslateUI(StartupView);
                Lang.TranslateUI(RestoreView);
                Lang.TranslateUI(MarketplaceView);
                Lang.TranslateUI(SettingsView);

                // Re-add to viewport
                viewportContainer.Children.Add(DashboardView);
                viewportContainer.Children.Add(AIOptimizerView);
                viewportContainer.Children.Add(CustomizationView);
                viewportContainer.Children.Add(GamingHubView);
                viewportContainer.Children.Add(DriverCenterView);
                viewportContainer.Children.Add(BenchmarkView);
                viewportContainer.Children.Add(DiskToolsView);
                viewportContainer.Children.Add(RamManagerView);
                viewportContainer.Children.Add(StartupView);
                viewportContainer.Children.Add(RestoreView);
                viewportContainer.Children.Add(MarketplaceView);
                viewportContainer.Children.Add(SettingsView);

                // Re-map navigation views
                var btnTabDashboard = (Button)mainGrid.FindName("btnTabDashboard");
                var btnTabAIOpt = (Button)mainGrid.FindName("btnTabAIOpt");
                var btnTabCustom = (Button)mainGrid.FindName("btnTabCustom");
                var btnTabGaming = (Button)mainGrid.FindName("btnTabGaming");
                var btnTabDriver = (Button)mainGrid.FindName("btnTabDriver");
                var btnTabBenchmark = (Button)mainGrid.FindName("btnTabBenchmark");
                var btnTabDisk = (Button)mainGrid.FindName("btnTabDisk");
                var btnTabRAM = (Button)mainGrid.FindName("btnTabRAM");
                var btnTabStartup = (Button)mainGrid.FindName("btnTabStartup");
                var btnTabRestore = (Button)mainGrid.FindName("btnTabRestore");
                var btnTabMarket = (Button)mainGrid.FindName("btnTabMarket");
                var btnTabSettings = (Button)mainGrid.FindName("btnTabSettings");

                navigationViews[btnTabDashboard] = DashboardView;
                navigationViews[btnTabAIOpt]     = AIOptimizerView;
                navigationViews[btnTabCustom]    = CustomizationView;
                navigationViews[btnTabGaming]    = GamingHubView;
                navigationViews[btnTabDriver]    = DriverCenterView;
                navigationViews[btnTabBenchmark] = BenchmarkView;
                navigationViews[btnTabDisk]      = DiskToolsView;
                navigationViews[btnTabRAM]       = RamManagerView;
                navigationViews[btnTabStartup]   = StartupView;
                navigationViews[btnTabRestore]   = RestoreView;
                navigationViews[btnTabMarket]    = MarketplaceView;
                navigationViews[btnTabSettings]  = SettingsView;

                // Collapse all
                foreach (var view in navigationViews.Values)
                {
                    view.Visibility = Visibility.Collapsed;
                    view.Opacity = 0;
                }

                // Show active view
                if (activeBtn != null)
                {
                    ShowView(activeBtn);
                }
                else
                {
                    ShowView(btnTabDashboard);
                }
            }
            catch {}
        }

        public void Log(string text, string status = "INFO")
        {
            if (!Dispatcher.CheckAccess())
            {
                Dispatcher.BeginInvoke(new Action(() => Log(text, status)));
                return;
            }
            string time = DateTime.Now.ToString("HH:mm:ss");
            string line = string.Format("[{0}] [{1}] {2}\r\n", time, status, text);
            txtConsoleLog.AppendText(line);
            txtConsoleLog.ScrollToEnd();
        }

        public void ShowToast(string message, string type = "success")
        {
            if (!Dispatcher.CheckAccess())
            {
                Dispatcher.BeginInvoke(new Action(() => ShowToast(message, type)));
                return;
            }
            lblToastText.Text = message;
            if (type == "success")
            {
                borderToastIcon.Background = new SolidColorBrush(Color.FromRgb(35, 165, 90));
            }
            else
            {
                borderToastIcon.Background = new SolidColorBrush(Color.FromRgb(242, 63, 67));
            }

            gridToast.Visibility = Visibility.Visible;
            DoubleAnimation fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(200));
            gridToast.BeginAnimation(Grid.OpacityProperty, fadeIn);

            DispatcherTimer timer = new DispatcherTimer();
            timer.Interval = TimeSpan.FromSeconds(3);
            timer.Tick += (s, e) => {
                timer.Stop();
                DoubleAnimation fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(200));
                fadeOut.Completed += (sa, ea) => gridToast.Visibility = Visibility.Collapsed;
                gridToast.BeginAnimation(Grid.OpacityProperty, fadeOut);
            };
            timer.Start();
        }
    }
}
