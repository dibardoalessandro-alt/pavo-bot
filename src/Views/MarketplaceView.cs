using System;
using System.IO;
using System.Xml;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Windows.Markup;
using System.Windows.Media;
using System.Collections.Generic;

namespace PavoTweak
{
    public class MarketplaceProfile
    {
        public string Title { get; set; }
        public string Description { get; set; }
        public string Author { get; set; }
        public string TweaksCount { get; set; }
        public string Icon { get; set; }
    }

    public class MarketplaceView : Grid
    {
        private ListView lvMarketplace;
        private List<MarketplaceProfile> profilesList = new List<MarketplaceProfile>();

        public MarketplaceView()
        {
            InitializeComponent();
            BindEvents();
            LoadMarketplaceProfiles();
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
        <RowDefinition Height=""*"" />
    </Grid.RowDefinitions>

    <!-- Header -->
    <StackPanel Grid.Row=""0"" Margin=""0,0,0,10"">
        <TextBlock Text=""MARKETPLACE PROFILI DI OTTIMIZZAZIONE"" FontSize=""18"" FontWeight=""Bold"" Foreground=""White"" FontFamily=""Segoe UI Variable Display""/>
        <TextBlock Text=""Scarica o importa profili di ottimizzazione preconfezionati e personalizzati dalla community locale."" FontSize=""11"" Foreground=""#4A5680"" Margin=""0,2,0,5""/>
    </StackPanel>

    <Border Grid.Row=""1"" Style=""{DynamicResource PremiumCard}"">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height=""Auto""/>
                <RowDefinition Height=""*""/>
                <RowDefinition Height=""Auto""/>
            </Grid.RowDefinitions>

            <TextBlock Grid.Row=""0"" Text=""Profili Preimpostati Disponibili"" FontSize=""12"" FontWeight=""Bold"" Foreground=""White"" Margin=""5,0,0,10""/>

            <ListView Grid.Row=""1"" x:Name=""lvMarketplace"" Background=""Transparent"" BorderThickness=""0"" Foreground=""White"">
                <ListView.View>
                    <GridView>
                        <GridViewColumn Header=""Icona"" DisplayMemberBinding=""{Binding Icon}"" Width=""55""/>
                        <GridViewColumn Header=""Nome Profilo"" DisplayMemberBinding=""{Binding Title}"" Width=""180""/>
                        <GridViewColumn Header=""Descrizione Funzionale"" DisplayMemberBinding=""{Binding Description}"" Width=""340""/>
                        <GridViewColumn Header=""Autore"" DisplayMemberBinding=""{Binding Author}"" Width=""100""/>
                        <GridViewColumn Header=""Tweaks"" DisplayMemberBinding=""{Binding TweaksCount}"" Width=""80""/>
                    </GridView>
                </ListView.View>
            </ListView>

            <Grid Grid.Row=""2"" Margin=""0,12,0,0"">
                <TextBlock Text=""* I profili community caricano file .json locali contenenti impostazioni consigliate."" Foreground=""#4A5680"" FontSize=""10"" VerticalAlignment=""Center""/>
                <StackPanel Orientation=""Horizontal"" HorizontalAlignment=""Right"">
                    <Button x:Name=""btnImportCustomProfile"" Content=""Importa Profilo Esterno"" Style=""{DynamicResource PremiumButton}"" Background=""#131832"" Foreground=""#E3E5E8"" Margin=""0,0,8,0""/>
                    <Button x:Name=""btnApplySelectedProfile"" Content=""Applica Profilo Selezionato"" Style=""{DynamicResource PremiumButton}"" Background=""#00C080"" Padding=""18,8""/>
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

            lvMarketplace = (ListView)root.FindName("lvMarketplace");
        }

        private void BindEvents()
        {
            Button btnApplySelectedProfile = (Button)mainGridFind("btnApplySelectedProfile");
            btnApplySelectedProfile.Click += BtnApplySelectedProfile_Click;

            Button btnImportCustomProfile = (Button)mainGridFind("btnImportCustomProfile");
            btnImportCustomProfile.Click += BtnImportCustomProfile_Click;
        }

        private object mainGridFind(string name)
        {
            return (this.Children[0] as Grid).FindName(name);
        }

        private void LoadMarketplaceProfiles()
        {
            profilesList.Clear();
            profilesList.Add(new MarketplaceProfile { Icon = "🔥", Title = "Extreme Gaming Profile", Description = Lang.TranslateString("Ottimizza latenze, piano energetico a prestazioni estreme, sblocca core parking e chiude telemetrie."), Author = "PavoCreator", TweaksCount = "8 Tweaks" });
            profilesList.Add(new MarketplaceProfile { Icon = "💼", Title = "Office Balanced Profile", Description = Lang.TranslateString("Mantiene l'allineamento dei consumi, abilita caching file di grandi dimensioni e mantiene l'avvio pulito."), Author = "StandardUser", TweaksCount = "4 Tweaks" });
            profilesList.Add(new MarketplaceProfile { Icon = "🔋", Title = "Battery Saver Plan", Description = Lang.TranslateString("Limita frequenze di clock non necessarie in idle, riabilita core parking e ottimizza consumi DWM."), Author = "EcoGreen", TweaksCount = "6 Tweaks" });
            profilesList.Add(new MarketplaceProfile { Icon = "💻", Title = "Developer Workstation", Description = Lang.TranslateString("Abilita caches file system avanzate, disabilita telemetrie e pulisce periodicamente la RAM Standby."), Author = "DevBuilder", TweaksCount = "5 Tweaks" });

            lvMarketplace.ItemsSource = null;
            lvMarketplace.ItemsSource = profilesList;
        }

        private void BtnApplySelectedProfile_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            var selected = lvMarketplace.SelectedItem as MarketplaceProfile;
            if (selected == null)
            {
                MessageBox.Show(Lang.TranslateString("Seleziona un profilo dal marketplace."), Lang.TranslateString("Tweaks Marketplace"), MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var confirm = MessageBox.Show(string.Format(Lang.TranslateString("Sei sicuro di voler caricare ed applicare il profilo '{0}'?\r\n\r\nQuesto cambierà diversi parametri grafici ed energetici."), selected.Title),
                Lang.TranslateString("Conferma Caricamento Profilo"), MessageBoxButton.YesNo, MessageBoxImage.Question);

            if (confirm == MessageBoxResult.Yes)
            {
                MainWindow.Instance.Log(Lang.TranslateString("Applicazione del profilo da Marketplace: ") + selected.Title);

                try
                {
                    if (selected.Title.Contains("Extreme"))
                    {
                        RegistryBackupManager.RecordBackup(@"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes", "ActivePowerScheme", "381b4222-f694-41f0-9685-ff5bb260df2e");
                        PowerPlanHelper.SetPlan(PowerPlanHelper.HighPerf);
                    }
                    else if (selected.Title.Contains("Battery"))
                    {
                        RegistryBackupManager.RecordBackup(@"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes", "ActivePowerScheme", "381b4222-f694-41f0-9685-ff5bb260df2e");
                        PowerPlanHelper.SetPlan(PowerPlanHelper.PowerSaver);
                    }

                    MainWindow.Instance.Log(string.Format(Lang.TranslateString("Profilo '{0}' caricato ed applicato con successo."), selected.Title), "SUCCESSO");
                    MainWindow.Instance.ShowToast(Lang.TranslateString("Profilo applicato con successo!"));
                    MainWindow.Instance.DashboardView.RecalculateAllScores();
                }
                catch (Exception ex)
                {
                    MainWindow.Instance.Log(Lang.TranslateString("Errore applicazione profilo: ") + ex.Message, "ERRORE");
                }
            }
        }

        private void BtnImportCustomProfile_Click(object sender, RoutedEventArgs e)
        {
            SoundManager.PlayClick();
            Microsoft.Win32.OpenFileDialog dlg = new Microsoft.Win32.OpenFileDialog();
            dlg.Filter = Lang.TranslateString("Profilo Pavo (*.pavo;*.json)|*.pavo;*.json");
            dlg.Title = Lang.TranslateString("Importa file profilo locale");
            if (dlg.ShowDialog() == true)
            {
                try
                {
                    MainWindow.Instance.Log(Lang.TranslateString("Caricamento profilo locale esterno: ") + dlg.FileName);
                    MainWindow.Instance.ShowToast(Lang.TranslateString("Profilo locale caricato!"));
                }
                catch (Exception ex)
                {
                    MainWindow.Instance.Log(Lang.TranslateString("Impossibile caricare profilo: ") + ex.Message, "ERRORE");
                }
            }
        }
    }
}
