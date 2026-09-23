using System;
using System.IO;
using System.Xml;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Windows.Markup;
using System.Windows.Media;
using Microsoft.Win32;

namespace PavoTweak
{
    public class AIOptimizerView : Grid
    {
        private TextBlock lblHardwareSummary;
        private ItemsControl icSuggestions;
        private Grid overlayWarning;
        private TextBlock lblWarningDetails;
        private Button btnWarningConfirm;
        private Button btnWarningCancel;

        private AIOptimizationItem targetItem;

        public AIOptimizerView()
        {
            InitializeComponent();
            BindEvents();
            Lang.LanguageChanged += RefreshLanguage;
        }

        private void RefreshLanguage()
        {
            this.Children.Clear();
            InitializeComponent();
            BindEvents();
            OnShow();
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
            <Setter Property=""Padding"" Value=""10,6""/>
            <Setter Property=""FontSize"" Value=""10""/>
            <Setter Property=""FontFamily"" Value=""Segoe UI Variable Small""/>
            <Setter Property=""FontWeight"" Value=""Bold""/>
            <Setter Property=""Cursor"" Value=""Hand""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""Button"">
                        <Border Name=""Border"" CornerRadius=""5"" Background=""{TemplateBinding Background}"">
                            <TextBlock Text=""{TemplateBinding Content}"" Foreground=""White"" FontSize=""10"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Text"" HorizontalAlignment=""Center"" VerticalAlignment=""Center"" Margin=""{TemplateBinding Padding}""/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property=""IsMouseOver"" Value=""True"">
                                <Setter TargetName=""Border"" Property=""Opacity"" Value=""0.8""/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </Grid.Resources>

    <Grid.RowDefinitions>
        <RowDefinition Height=""Auto""/>
        <RowDefinition Height=""*""/>
    </Grid.RowDefinitions>

    <!-- Header info -->
    <Border Grid.Row=""0"" Background=""#0C1020"" BorderThickness=""1"" BorderBrush=""#1C2040"" CornerRadius=""14"" Padding=""16,12"" Margin=""0,0,0,14"">
        <Grid>
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width=""*""/>
                <ColumnDefinition Width=""Auto""/>
            </Grid.ColumnDefinitions>
            
            <StackPanel Grid.Column=""0"">
                <TextBlock Text=""[[ai.hardware.info]]"" FontSize=""12"" FontWeight=""Bold"" Foreground=""White""/>
                <TextBlock x:Name=""lblHardwareSummary"" Text=""CPU: Scanning... | GPU: Scanning..."" FontSize=""10"" Foreground=""#7C5CFC"" Margin=""0,4,0,0"" FontWeight=""Bold""/>
            </StackPanel>
            <Button Grid.Column=""1"" x:Name=""btnScanHardware"" Content=""[[ai.scan]]"" Style=""{DynamicResource PremiumButton}"" Padding=""14,8""/>
        </Grid>
    </Border>

    <!-- Tweaks lists container -->
    <Border Grid.Row=""1"" Background=""#0C1020"" BorderThickness=""1"" BorderBrush=""#1C2040"" CornerRadius=""14"" Padding=""14"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""*""/>
            </Grid.RowDefinitions>
            
            <TextBlock Grid.Row=""0"" Text=""[[ai.suggestions]]"" FontSize=""11"" FontWeight=""Bold"" Foreground=""White"" Margin=""0,0,0,10""/>

            <ScrollViewer Grid.Row=""1"" VerticalScrollBarVisibility=""Auto"">
                <ItemsControl x:Name=""icSuggestions"">
                    <ItemsControl.ItemTemplate>
                        <DataTemplate>
                            <Border BorderThickness=""0,0,0,1"" BorderBrush=""#1F2130"" Padding=""0,8,0,10"">
                                <Grid>
                                    <Grid.ColumnDefinitions>
                                        <ColumnDefinition Width=""*""/>
                                        <ColumnDefinition Width=""120""/>
                                    </Grid.ColumnDefinitions>
                                    
                                    <StackPanel Grid.Column=""0"" Margin=""0,0,16,0"">
                                        <StackPanel Orientation=""Horizontal"">
                                            <Border CornerRadius=""4"" Background=""#1A00F2FE"" BorderThickness=""1"" BorderBrush=""#8000F2FE"" Padding=""6,2"">
                                                <TextBlock Text=""{Binding Category}"" FontSize=""8"" FontWeight=""Bold"" Foreground=""#7C5CFC""/>
                                            </Border>
                                            <TextBlock Text=""{Binding Title}"" FontSize=""11"" FontWeight=""Bold"" Foreground=""White"" Margin=""8,0,0,0"" VerticalAlignment=""Center""/>
                                        </StackPanel>
                                        <TextBlock Text=""{Binding Explanation}"" FontSize=""9"" Foreground=""#4A5680"" Margin=""0,6,0,0"" TextWrapping=""Wrap"" LineHeight=""14""/>
                                    </StackPanel>

                                    <StackPanel Grid.Column=""1"" VerticalAlignment=""Center"" HorizontalAlignment=""Right"">
                                        <TextBlock Text=""{Binding CurrentStatus}"" FontSize=""9"" FontWeight=""Bold"" Foreground=""#F23F43"" HorizontalAlignment=""Center"" Margin=""0,0,0,6""/>
                                        <Button Content=""{Binding ActionText}"" Width=""90"" Style=""{DynamicResource PremiumButton}"" Tag=""{Binding}""/>
                                    </StackPanel>
                                </Grid>
                            </Border>
                        </DataTemplate>
                    </ItemsControl.ItemTemplate>
                </ItemsControl>
            </ScrollViewer>
        </Grid>
    </Border>

    <!-- VERIFICATION OVERLAY DIALOG -->
    <Grid Grid.Row=""0"" Grid.RowSpan=""2"" x:Name=""overlayWarning"" Visibility=""Collapsed"" Background=""#B007080E"" Panel.ZIndex=""99"">
        <Border HorizontalAlignment=""Center"" VerticalAlignment=""Center"" Width=""460"" CornerRadius=""14"" Background=""#0E1230"" BorderBrush=""#E18F2E"" BorderThickness=""1.5"" Padding=""16"">
            <StackPanel>
                <StackPanel Orientation=""Horizontal"" Margin=""0,0,0,10"">
                    <TextBlock Text=""[[ai.warning.title]]"" Foreground=""#E18F2E"" FontSize=""12"" FontWeight=""Bold""/>
                </StackPanel>
                <TextBlock x:Name=""lblWarningDetails"" Text=""Questo tweak applicherà le seguenti modifiche nel Registro di Windows:\r\n\r\nPercorso: ..."" 
                           Foreground=""#D1D5DB"" FontSize=""10"" TextWrapping=""Wrap"" LineHeight=""14"" Margin=""0,0,0,16""/>
                <TextBlock Text=""[[ai.warning.desc]]"" 
                           Foreground=""#4A5680"" FontSize=""9"" FontStyle=""Italic"" Margin=""0,0,0,14""/>
                <StackPanel Orientation=""Horizontal"" HorizontalAlignment=""Right"">
                    <Button x:Name=""btnWarningCancel"" Content=""[[btn.cancel]]"" Width=""85"" Height=""26"" Margin=""0,0,8,0"" Cursor=""Hand"" Background=""#131832"" Foreground=""White"" BorderThickness=""0""/>
                    <Button x:Name=""btnWarningConfirm"" Content=""[[btn.confirm]]"" Width=""120"" Height=""26"" Cursor=""Hand"" Background=""#E18F2E"" Foreground=""White"" BorderThickness=""0""/>
                </StackPanel>
            </StackPanel>
        </Border>
    </Grid>

</Grid>
";

            ParserContext context = new ParserContext();
            context.XmlnsDictionary.Add("", "http://schemas.microsoft.com/winfx/2006/xaml/presentation");
            context.XmlnsDictionary.Add("x", "http://schemas.microsoft.com/winfx/2006/xaml");

            StringReader stringReader = new StringReader(Lang.Resolve(xaml));
            XmlReader xmlReader = XmlReader.Create(stringReader);
            Grid root = (Grid)XamlReader.Load(xmlReader);
            this.Children.Add(root);

            lblHardwareSummary = (TextBlock)root.FindName("lblHardwareSummary");
            icSuggestions = (ItemsControl)root.FindName("icSuggestions");
            overlayWarning = (Grid)root.FindName("overlayWarning");
            lblWarningDetails = (TextBlock)root.FindName("lblWarningDetails");
            btnWarningConfirm = (Button)root.FindName("btnWarningConfirm");
            btnWarningCancel = (Button)root.FindName("btnWarningCancel");
        }

        private void BindEvents()
        {
            Button btnScanHardware = (Button)mainGridFind("btnScanHardware");
            btnScanHardware.Click += (s, e) => {
                SoundManager.PlayClick();
                MainWindow.Instance.AIEngine.AnalyzeHardware();
                OnShow();
            };

            btnWarningCancel.Click += (s, e) => {
                SoundManager.PlayClick();
                overlayWarning.Visibility = Visibility.Collapsed;
            };

            btnWarningConfirm.Click += BtnWarningConfirm_Click;

            // Wire DataTemplate button clicks via bubbling - Click attribute can't be used with dynamic XamlReader.Load
            icSuggestions.AddHandler(Button.ClickEvent, new RoutedEventHandler(BtnTweakAction_Click));
        }

        private object mainGridFind(string name)
        {
            return (this.Children[0] as Grid).FindName(name);
        }

        public void OnShow()
        {
            var engine = MainWindow.Instance.AIEngine;
            engine.LocalizeItems();
            lblHardwareSummary.Text = string.Format(Lang.TranslateString("CPU: {0} | GPU: {1} | RAM: {2:F1} GB | DISCO C: {3} ({4:F1} GB Liberi)"),
                engine.CpuName, engine.GpuName, engine.RamTotalGb, engine.IsSsd ? "SSD" : "HDD", engine.CFreeSpaceGb);

            icSuggestions.ItemsSource = null;
            icSuggestions.ItemsSource = engine.Optimizations;
        }

        private void BtnTweakAction_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            Button btn = e.OriginalSource as Button;
            if (btn == null) return;
            var item = btn.DataContext as AIOptimizationItem;
            if (item == null) return;

            targetItem = item;

            lblWarningDetails.Text = string.Format(
                Lang.Get("ai.warning.details"),
                item.Title, item.RegistryPath, item.RegistryValueName, item.OptimizedValue, item.Explanation, item.SideEffects);

            overlayWarning.Visibility = Visibility.Visible;
        }

        private void BtnWarningConfirm_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            overlayWarning.Visibility = Visibility.Collapsed;

            if (targetItem == null) return;

            MainWindow.Instance.Log(string.Format(Lang.Get("log.ai.approved"), targetItem.Title));

            // Record backup values before writing
            try
            {
                object current = null;
                if (targetItem.RegistryPath.StartsWith("HKEY_LOCAL_MACHINE\\"))
                {
                    current = Registry.GetValue(targetItem.RegistryPath, targetItem.RegistryValueName, targetItem.DefaultValue);
                }
                else if (targetItem.RegistryPath.StartsWith("HKEY_CURRENT_USER\\"))
                {
                    current = Registry.GetValue(targetItem.RegistryPath, targetItem.RegistryValueName, targetItem.DefaultValue);
                }
                RegistryBackupManager.RecordBackup(targetItem.RegistryPath, targetItem.RegistryValueName, current);
            }
            catch {}

            string err;
            if (MainWindow.Instance.AIEngine.ApplyOptimization(targetItem, true, out err))
            {
                MainWindow.Instance.Log(string.Format(Lang.Get("log.ai.success"), targetItem.Title), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.Get("log.ai.toast"));
                OnShow();
                MainWindow.Instance.DashboardView.RecalculateAllScores();
            }
            else
            {
                MainWindow.Instance.Log(string.Format(Lang.Get("log.ai.error"), err), "ERRORE");
                MessageBox.Show(string.Format(Lang.Get("log.ai.error.dialog"), err), "AI Optimizer error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
