using System;
using System.IO;
using System.Xml;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;
using System.Windows.Media;
using System.Diagnostics;
using Microsoft.Win32;

namespace PavoUninstall
{
    public class App : Application
    {
        [STAThread]
        public static void Main(string[] args)
        {
            if (args != null && args.Length >= 3 && args[0] == "--update")
            {
                RunUpdateProcess(args[1], args[2]);
                return;
            }

            App app = new App();
            app.Run(new UninstallWindow());
        }

        private static void RunUpdateProcess(string targetExe, string tempExe)
        {
            try
            {
                // Wait for the calling PavoTweak.exe process to release its write lock
                System.Threading.Thread.Sleep(2000);

                if (System.IO.File.Exists(tempExe))
                {
                    System.IO.File.Copy(tempExe, targetExe, true);
                    System.IO.File.Delete(tempExe);
                }

                // Relaunch updated executable
                System.Diagnostics.Process.Start(targetExe);
            }
            catch (Exception ex)
            {
                try { System.IO.File.WriteAllText("pavo_update_error.log", ex.ToString()); } catch {}
            }
        }
    }

    public class UninstallWindow : Window
    {
        public UninstallWindow()
        {
            this.Title = "Disinstallazione Pavo Tweak";
            this.Width = 400;
            this.Height = 220;
            this.WindowStartupLocation = WindowStartupLocation.CenterScreen;
            this.Background = new SolidColorBrush(Color.FromRgb(12, 13, 20));
            this.ResizeMode = ResizeMode.NoResize;

            InitializeUI();
        }

        private void InitializeUI()
        {
            string xaml = @"
<Grid xmlns=""http://schemas.microsoft.com/winfx/2006/xaml/presentation""
      xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml""
      Background=""#0C0D14"">
    
    <Grid.RowDefinitions>
        <RowDefinition Height=""*""/>
        <RowDefinition Height=""Auto""/>
    </Grid.RowDefinitions>

    <StackPanel Grid.Row=""0"" VerticalAlignment=""Center"" Margin=""20"">
        <TextBlock Text=""Disinstallazione Pavo Tweak"" FontSize=""16"" FontWeight=""Bold"" Foreground=""White"" Margin=""0,0,0,10""/>
        <TextBlock Text=""Sei sicuro di voler rimuovere Pavo Tweak dal computer? Verranno rimosse tutte le configurazioni e scorciatoie associati."" 
                   Foreground=""#949BA4"" FontSize=""11"" TextWrapping=""Wrap""/>
    </StackPanel>

    <Border Grid.Row=""1"" Background=""#08090E"" Padding=""15,10"">
        <StackPanel Orientation=""Horizontal"" HorizontalAlignment=""Right"">
            <Button x:Name=""btnCancel"" Content=""Annulla"" Width=""80"" Height=""28"" Margin=""0,0,8,0"" Cursor=""Hand"" Background=""#2A2C3F"" Foreground=""White"" BorderThickness=""0""/>
            <Button x:Name=""btnUninstall"" Content=""Disinstalla"" Width=""90"" Height=""28"" Cursor=""Hand"" Background=""#F23F43"" Foreground=""White"" BorderThickness=""0""/>
        </StackPanel>
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

            Button btnCancel = (Button)root.FindName("btnCancel");
            Button btnUninstall = (Button)root.FindName("btnUninstall");

            btnCancel.Click += (s, e) => this.Close();
            btnUninstall.Click += BtnUninstall_Click;
        }

        private void BtnUninstall_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                string installFolder = AppDomain.CurrentDomain.BaseDirectory;

                // 1. Desktop and Start Menu Shortcuts
                string desktopLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Pavo Tweak.lnk");
                if (File.Exists(desktopLnk)) File.Delete(desktopLnk);

                string startLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", "Pavo Tweak.lnk");
                if (File.Exists(startLnk)) File.Delete(startLnk);

                // 2. Registry Key
                try
                {
                    Registry.CurrentUser.DeleteSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\PavoTweak", false);
                }
                catch {}

                // 3. Safety Check: If ran from dev workspace directory containing build.bat or src, don't delete!
                if (File.Exists(Path.Combine(installFolder, "build.bat")) || Directory.Exists(Path.Combine(installFolder, "src")))
                {
                    MessageBox.Show("Disinstallazione completata. I collegamenti e il registro sono stati rimossi.\r\n\r\nI file sorgente di sviluppo in questa cartella non sono stati cancellati per sicurezza.", "Ambiente Sviluppo Rilevato", MessageBoxButton.OK, MessageBoxImage.Information);
                    this.Close();
                    return;
                }

                // 4. Delete non-running files immediately
                try
                {
                    string ptPath = Path.Combine(installFolder, "PavoTweak.exe");
                    if (File.Exists(ptPath)) File.Delete(ptPath);
                    
                    string logoPath = Path.Combine(installFolder, "pavo_logo.png");
                    if (File.Exists(logoPath)) File.Delete(logoPath);
                }
                catch {}

                // 5. Schedule the running uninstaller and folder for deletion at next reboot
                try
                {
                    string uninstallerPath = Process.GetCurrentProcess().MainModule.FileName;
                    MoveFileEx(uninstallerPath, null, MOVEFILE_DELAY_UNTIL_REBOOT);
                    MoveFileEx(installFolder, null, MOVEFILE_DELAY_UNTIL_REBOOT);
                }
                catch {}

                MessageBox.Show(
                    "Pavo Tweak è stato disinstallato con successo.\n\n" +
                    "I file rimasti verranno eliminati automaticamente al prossimo avvio del computer.", 
                    "Disinstallazione Completata", 
                    MessageBoxButton.OK, MessageBoxImage.Information);

                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Errore durante la disinstallazione: " + ex.Message, "Disinstallazione", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        [System.Runtime.InteropServices.DllImport("kernel32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode, SetLastError = true)]
        private static extern bool MoveFileEx(string lpExistingFileName, string lpNewFileName, uint dwFlags);

        private const uint MOVEFILE_DELAY_UNTIL_REBOOT = 0x00000004;
    }
}
