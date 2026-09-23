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
using System.Reflection;
using Microsoft.Win32;

namespace PavoSetup
{
    public class App : Application
    {
        [STAThread]
        public static void Main()
        {
            App app = new App();
            app.Run(new SetupWindow());
        }
    }

    public class SetupWindow : Window
    {
        private Grid mainGrid;
        
        private Grid screenWelcome;
        private Grid screenOptions;
        private Grid screenProgress;
        private Grid screenSuccess;

        private TextBox txtInstallDir;
        private CheckBox cbDesktopShortcut;
        private CheckBox cbStartShortcut;
        private CheckBox cbLaunchApp;

        private ProgressBar pbInstallProgress;
        private TextBlock lblProgressStatus;

        private string defaultInstallPath;

        public SetupWindow()
        {
            this.WindowStyle = WindowStyle.None;
            this.AllowsTransparency = true;
            this.Background = Brushes.Transparent;
            this.Width = 620;
            this.Height = 380;
            this.WindowStartupLocation = WindowStartupLocation.CenterScreen;

            defaultInstallPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PavoTweak");

            InitializeUI();
            BindEvents();
            ShowScreen(screenWelcome);
        }

        private void InitializeUI()
        {
            string xaml = @"
<Grid xmlns=""http://schemas.microsoft.com/winfx/2006/xaml/presentation""
      xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml"">
    
    <Border CornerRadius=""12"" BorderBrush=""#1F223B"" BorderThickness=""1"" ClipToBounds=""True"">
        <Border.Background>
            <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,1"">
                <GradientStop Color=""#07080E"" Offset=""0""/>
                <GradientStop Color=""#0E101D"" Offset=""1""/>
            </LinearGradientBrush>
        </Border.Background>
        
        <Grid>
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width=""180""/>
                <ColumnDefinition Width=""*""/>
            </Grid.ColumnDefinitions>

            <!-- LEFT BRANDING SIDEBAR -->
            <Grid Grid.Column=""0"" Background=""#0F1016"">
                <Grid.RowDefinitions>
                    <RowDefinition Height=""*""/>
                    <RowDefinition Height=""Auto""/>
                </Grid.RowDefinitions>
                <Border BorderBrush=""#1B1C26"" BorderThickness=""0,0,1,0"" Grid.RowSpan=""2""/>

                <StackPanel Grid.Row=""0"" VerticalAlignment=""Center"" HorizontalAlignment=""Center"">
                    <Border Width=""50"" Height=""50"" CornerRadius=""25"" BorderThickness=""2"" BorderBrush=""#5865F2"" Margin=""0,0,0,14"">
                        <Ellipse Width=""36"" Height=""36"" Fill=""#A855F7""/>
                    </Border>
                    <TextBlock Text=""PAVO TWEAK"" Foreground=""White"" FontWeight=""Bold"" FontSize=""14"" HorizontalAlignment=""Center""/>
                    <TextBlock Text=""INSTALLER"" Foreground=""#5865F2"" FontSize=""9"" FontWeight=""Black"" HorizontalAlignment=""Center"" Margin=""0,2,0,0""/>
                </StackPanel>

                <TextBlock Grid.Row=""1"" Text=""v1.0.0 (Premium)"" Foreground=""#6D737D"" FontSize=""9"" HorizontalAlignment=""Center"" Margin=""0,0,0,14""/>
            </Grid>

            <!-- RIGHT ACTION CONTAINER -->
            <Grid Grid.Column=""1"" Margin=""24"">
                <Grid.RowDefinitions>
                    <RowDefinition Height=""*""/>
                    <RowDefinition Height=""40""/>
                </Grid.RowDefinitions>

                <StackPanel HorizontalAlignment=""Right"" VerticalAlignment=""Top"" Orientation=""Horizontal"" Margin=""0,-18,-18,0"" Grid.RowSpan=""2"" Panel.ZIndex=""99"">
                    <Button x:Name=""btnClose"" Content=""&#xE711;"" FontFamily=""Segoe MDL2 Assets"" FontSize=""9"" Foreground=""#949BA4"" Width=""30"" Height=""24"" Background=""Transparent"" BorderBrush=""Transparent"" Cursor=""Hand""/>
                </StackPanel>

                <!-- VIEWPORT SCREENS -->
                <Grid Grid.Row=""0"">
                    
                    <!-- 1. Welcome Screen -->
                    <Grid x:Name=""screenWelcome"" Visibility=""Visible"">
                        <StackPanel VerticalAlignment=""Center"">
                            <TextBlock Text=""Benvenuto nell'Installer di Pavo Tweak"" FontSize=""16"" FontWeight=""Bold"" Foreground=""White"" Margin=""0,0,0,8""/>
                            <TextBlock Text=""Questo programma guiderà l'utente attraverso l'installazione guidata dell'applicazione Pavo Tweak sul computer.\r\n\r\nPavo Tweak è una suite completa per ottimizzare prestazioni, personalizzare il desktop, eseguire benchmarks e ripulire il disco dagli errori."" 
                                       Foreground=""#949BA4"" FontSize=""11"" TextWrapping=""Wrap"" LineHeight=""16"" Margin=""0,0,0,20""/>
                        </StackPanel>
                    </Grid>

                    <!-- 2. Options Screen -->
                    <Grid x:Name=""screenOptions"" Visibility=""Collapsed"">
                        <StackPanel VerticalAlignment=""Center"">
                            <TextBlock Text=""Configura Opzioni di Installazione"" FontSize=""14"" FontWeight=""Bold"" Foreground=""White"" Margin=""0,0,0,12""/>
                            
                            <TextBlock Text=""Cartella di installazione:"" FontSize=""10"" Foreground=""#949BA4"" Margin=""0,0,0,4""/>
                            <Grid Margin=""0,0,0,16"">
                                <TextBox x:Name=""txtInstallDir"" Background=""#0D0E17"" Foreground=""White"" BorderBrush=""#222435"" Padding=""8,6"" FontSize=""11""/>
                            </Grid>

                            <CheckBox x:Name=""cbDesktopShortcut"" Content=""Crea collegamento sul Desktop"" Foreground=""#E3E5E8"" IsChecked=""True"" Margin=""0,4""/>
                            <CheckBox x:Name=""cbStartShortcut"" Content=""Aggiungi al Menu Start"" Foreground=""#E3E5E8"" IsChecked=""True"" Margin=""0,4""/>
                        </StackPanel>
                    </Grid>

                    <!-- 3. Progress Screen -->
                    <Grid x:Name=""screenProgress"" Visibility=""Collapsed"">
                        <StackPanel VerticalAlignment=""Center"">
                            <TextBlock Text=""Installazione di Pavo Tweak..."" FontSize=""14"" FontWeight=""Bold"" Foreground=""White"" Margin=""0,0,0,10""/>
                            <TextBlock x:Name=""lblProgressStatus"" Text=""Estrazione file..."" FontSize=""10"" Foreground=""#949BA4"" Margin=""0,0,0,12""/>
                            
                            <ProgressBar x:Name=""pbInstallProgress"" Value=""0"" Height=""8"" Foreground=""#5865F2"" Background=""#1B1D27"" BorderThickness=""0""/>
                        </StackPanel>
                    </Grid>

                    <!-- 4. Success Screen -->
                    <Grid x:Name=""screenSuccess"" Visibility=""Collapsed"">
                        <StackPanel VerticalAlignment=""Center"">
                            <TextBlock Text=""Installazione Completata con Successo!"" FontSize=""16"" FontWeight=""Bold"" Foreground=""#23A55A"" Margin=""0,0,0,8""/>
                            <TextBlock Text=""Pavo Tweak è stato correttamente installato sul computer. Puoi avviarlo immediatamente cliccando su Fine."" 
                                       Foreground=""#949BA4"" FontSize=""11"" TextWrapping=""Wrap"" LineHeight=""16"" Margin=""0,0,0,20""/>
                            
                            <CheckBox x:Name=""cbLaunchApp"" Content=""Avvia Pavo Tweak ora"" Foreground=""#E3E5E8"" IsChecked=""True""/>
                        </StackPanel>
                    </Grid>

                </Grid>

                <!-- FOOTER NAVIGATION BUTTONS -->
                <Grid Grid.Row=""1"">
                    <StackPanel Orientation=""Horizontal"" HorizontalAlignment=""Right"" VerticalAlignment=""Bottom"">
                        <Button x:Name=""btnBack"" Content=""Indietro"" Width=""80"" Height=""28"" Margin=""0,0,8,0"" Cursor=""Hand"" Background=""#2A2C3F"" Foreground=""White"" BorderThickness=""0""/>
                        <Button x:Name=""btnNext"" Content=""Avanti"" Width=""80"" Height=""28"" Cursor=""Hand"" Background=""#5865F2"" Foreground=""White"" BorderThickness=""0""/>
                    </StackPanel>
                </Grid>

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
            this.Content = root;

            mainGrid = root;
            screenWelcome = (Grid)mainGrid.FindName("screenWelcome");
            screenOptions = (Grid)mainGrid.FindName("screenOptions");
            screenProgress = (Grid)mainGrid.FindName("screenProgress");
            screenSuccess = (Grid)mainGrid.FindName("screenSuccess");

            txtInstallDir = (TextBox)mainGrid.FindName("txtInstallDir");
            cbDesktopShortcut = (CheckBox)mainGrid.FindName("cbDesktopShortcut");
            cbStartShortcut = (CheckBox)mainGrid.FindName("cbStartShortcut");
            cbLaunchApp = (CheckBox)mainGrid.FindName("cbLaunchApp");

            pbInstallProgress = (ProgressBar)mainGrid.FindName("pbInstallProgress");
            lblProgressStatus = (TextBlock)mainGrid.FindName("lblProgressStatus");

            txtInstallDir.Text = defaultInstallPath;
        }

        private void BindEvents()
        {
            Button btnClose = (Button)mainGrid.FindName("btnClose");
            btnClose.Click += (s, e) => this.Close();

            Button btnBack = (Button)mainGrid.FindName("btnBack");
            Button btnNext = (Button)mainGrid.FindName("btnNext");

            btnBack.Click += (s, e) => {
                if (screenOptions.Visibility == Visibility.Visible)
                {
                    ShowScreen(screenWelcome);
                }
            };

            btnNext.Click += (s, e) => {
                if (screenWelcome.Visibility == Visibility.Visible)
                {
                    ShowScreen(screenOptions);
                }
                else if (screenOptions.Visibility == Visibility.Visible)
                {
                    ShowScreen(screenProgress);
                    RunInstallationTask();
                }
                else if (screenSuccess.Visibility == Visibility.Visible)
                {
                    if (cbLaunchApp.IsChecked == true)
                    {
                        try
                        {
                            Process.Start(Path.Combine(txtInstallDir.Text, "PavoTweak.exe"));
                        }
                        catch {}
                    }
                    this.Close();
                }
            };
        }

        private void ShowScreen(Grid screen)
        {
            screenWelcome.Visibility = Visibility.Collapsed;
            screenOptions.Visibility = Visibility.Collapsed;
            screenProgress.Visibility = Visibility.Collapsed;
            screenSuccess.Visibility = Visibility.Collapsed;

            screen.Visibility = Visibility.Visible;

            Button btnBack = (Button)mainGrid.FindName("btnBack");
            Button btnNext = (Button)mainGrid.FindName("btnNext");

            if (screen == screenWelcome)
            {
                btnBack.IsEnabled = false;
                btnNext.Content = "Avanti";
                btnNext.IsEnabled = true;
            }
            else if (screen == screenOptions)
            {
                btnBack.IsEnabled = true;
                btnNext.Content = "Installa";
                btnNext.IsEnabled = true;
            }
            else if (screen == screenProgress)
            {
                btnBack.IsEnabled = false;
                btnNext.IsEnabled = false;
            }
            else if (screen == screenSuccess)
            {
                btnBack.IsEnabled = false;
                btnNext.Content = "Fine";
                btnNext.IsEnabled = true;
            }
        }

        private void RunInstallationTask()
        {
            string targetFolder = txtInstallDir.Text;
            bool createDesktop = cbDesktopShortcut.IsChecked ?? true;
            bool createStart = cbStartShortcut.IsChecked ?? true;

            System.Threading.Tasks.Task.Run(() => {
                try
                {
                    UpdateProgress(5, "Chiusura processi attivi...");
                    try
                    {
                        foreach (var proc in Process.GetProcessesByName("PavoTweak"))
                        {
                            try { proc.Kill(); proc.WaitForExit(2000); } catch {}
                        }
                        foreach (var proc in Process.GetProcessesByName("Uninstall"))
                        {
                            try { proc.Kill(); proc.WaitForExit(2000); } catch {}
                        }
                    }
                    catch {}

                    UpdateProgress(15, "Creazione directory di destinazione...");
                    if (!Directory.Exists(targetFolder))
                    {
                        Directory.CreateDirectory(targetFolder);
                    }
                    System.Threading.Thread.Sleep(300);

                    UpdateProgress(40, "Estrazione dell'eseguibile PavoTweak.exe...");
                    ExtractEmbeddedFile("PavoTweak.gz", Path.Combine(targetFolder, "PavoTweak.exe"));
                    System.Threading.Thread.Sleep(300);

                    UpdateProgress(60, "Estrazione del modulo di disinstallazione...");
                    ExtractEmbeddedFile("Uninstall.gz", Path.Combine(targetFolder, "Uninstall.exe"));
                    System.Threading.Thread.Sleep(300);

                    UpdateProgress(75, "Estrazione icone ed asset grafiche...");
                    ExtractEmbeddedFile("pavo_logo.png", Path.Combine(targetFolder, "pavo_logo.png"));
                    System.Threading.Thread.Sleep(200);

                    UpdateProgress(85, "Configurazione collegamenti sul sistema...");
                    string targetExe = Path.Combine(targetFolder, "PavoTweak.exe");
                    if (createDesktop)
                    {
                        string desktopLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Pavo Tweak.lnk");
                        CreateShortcut(desktopLnk, targetExe, "Pavo Tweak Suite");
                    }
                    if (createStart)
                    {
                        string startFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs");
                        if (!Directory.Exists(startFolder)) Directory.CreateDirectory(startFolder);
                        string startLnk = Path.Combine(startFolder, "Pavo Tweak.lnk");
                        CreateShortcut(startLnk, targetExe, "Pavo Tweak Suite");
                    }

                    UpdateProgress(95, "Registrazione del disinstallatore...");
                    RegisterUninstaller(targetFolder);
                    System.Threading.Thread.Sleep(200);

                    UpdateProgress(100, "Completato!");
                    Dispatcher.BeginInvoke(new Action(() => ShowScreen(screenSuccess)));
                }
                catch (Exception ex)
                {
                    Dispatcher.BeginInvoke(new Action(() => {
                        MessageBox.Show("Errore di installazione: " + ex.Message, "Pavo Tweak Installer", MessageBoxButton.OK, MessageBoxImage.Error);
                        ShowScreen(screenOptions);
                    }));
                }
            });
        }

        private void UpdateProgress(int val, string text)
        {
            Dispatcher.BeginInvoke(new Action(() => {
                pbInstallProgress.Value = val;
                lblProgressStatus.Text = text;
            }));
        }

        private void ExtractEmbeddedFile(string resourceName, string outputPath)
        {
            var assembly = Assembly.GetExecutingAssembly();
            using (Stream src = assembly.GetManifestResourceStream(resourceName))
            {
                if (src == null) throw new Exception("Risorsa embedded non trovata nel manifest: " + resourceName);
                
                if (resourceName.EndsWith(".gz", StringComparison.OrdinalIgnoreCase))
                {
                    using (var zipStream = new System.IO.Compression.GZipStream(src, System.IO.Compression.CompressionMode.Decompress))
                    {
                        using (FileStream dest = new FileStream(outputPath, FileMode.Create, FileAccess.Write))
                        {
                            zipStream.CopyTo(dest);
                        }
                    }
                }
                else
                {
                    using (FileStream dest = new FileStream(outputPath, FileMode.Create, FileAccess.Write))
                    {
                        src.CopyTo(dest);
                    }
                }
            }
        }

        private void CreateShortcut(string shortcutPath, string targetPath, string description)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    object shell = Activator.CreateInstance(shellType);
                    object shortcut = shellType.InvokeMember("CreateShortcut", 
                        System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                    
                    if (shortcut != null)
                    {
                        Type shortcutType = shortcut.GetType();
                        shortcutType.InvokeMember("TargetPath", 
                            System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
                        shortcutType.InvokeMember("Description", 
                            System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { description });
                        shortcutType.InvokeMember("Save", 
                            System.Reflection.BindingFlags.InvokeMethod, null, shortcut, null);
                    }
                }
            }
            catch {}
        }

        private void RegisterUninstaller(string installFolder)
        {
            try
            {
                string keyPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\PavoTweak";
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(keyPath))
                {
                    key.SetValue("DisplayName", "Pavo Tweak");
                    key.SetValue("UninstallString", "\"" + Path.Combine(installFolder, "Uninstall.exe") + "\"");
                    key.SetValue("DisplayIcon", "\"" + Path.Combine(installFolder, "PavoTweak.exe") + "\",0");
                    key.SetValue("Publisher", "Pavo Software");
                    key.SetValue("DisplayVersion", "1.0.0");
                }
            }
            catch {}
        }
    }
}
