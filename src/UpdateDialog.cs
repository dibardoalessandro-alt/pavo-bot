using System;
using System.IO;
using System.Net;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Diagnostics;
using System.Xml;

namespace PavoTweak
{
    [DataContract]
    public class UpdateInfo
    {
        [DataMember]
        public string version { get; set; }

        [DataMember]
        public string url { get; set; }

        [DataMember]
        public string changelog { get; set; }
    }

    public class UpdateDialog : Window
    {
        private Grid _root;
        private TextBlock _lblTitle;
        private TextBlock _lblChangelog;
        private ProgressBar _pbDownload;
        private TextBlock _lblStatus;
        private Border _btnUpdateBorder;
        private TextBlock _btnUpdateText;
        private Border _btnCancelBorder;

        private readonly UpdateInfo _info;
        private bool _isDownloading = false;

        public UpdateDialog(UpdateInfo info)
        {
            _info = info;

            WindowStyle = WindowStyle.None;
            AllowsTransparency = true;
            Background = null;
            Width = 500;
            Height = 360;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            Topmost = true;
            ResizeMode = ResizeMode.NoResize;
            ShowInTaskbar = true;
            Title = Lang.TranslateString("Pavo Tweak – Aggiornamento Disponibile");

            BuildUI();
            Lang.TranslateUI(this);

            this.SourceInitialized += (s, e) =>
            {
                WindowHelper.DisableWindowShadow(this);
                ApplyRoundedClip();
            };

            Loaded += (s, e) =>
            {
                var anim = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(300));
                _root.BeginAnimation(UIElement.OpacityProperty, anim);
            };

            this.MouseLeftButtonDown += (s, e) =>
            {
                if (e.ButtonState == System.Windows.Input.MouseButtonState.Pressed) DragMove();
            };
        }

        private void ApplyRoundedClip()
        {
            SizeChanged += (s, e) =>
            {
                Clip = new RectangleGeometry(new Rect(0, 0, ActualWidth, ActualHeight), 18, 18);
            };
            Clip = new RectangleGeometry(new Rect(0, 0, Width, Height), 18, 18);
        }

        private void BuildUI()
        {
            string cleanChangelog = string.IsNullOrEmpty(_info.changelog) 
                ? Lang.TranslateString("Nessun dettaglio specificato per questa versione.") 
                : _info.changelog.Replace("\\n", "\n");

            string xaml = string.Format(@"
<Grid xmlns=""http://schemas.microsoft.com/winfx/2006/xaml/presentation""
      xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml""
      Opacity=""0"">
  <Border CornerRadius=""18"" BorderBrush=""#1A7C5CFC"" BorderThickness=""1.5"">
    <Border.Background>
      <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,1"">
        <GradientStop Color=""#070914"" Offset=""0""/>
        <GradientStop Color=""#0C0E22"" Offset=""1""/>
      </LinearGradientBrush>
    </Border.Background>
    <Grid Margin=""28"">
      <Grid.RowDefinitions>
        <RowDefinition Height=""Auto""/>
        <RowDefinition Height=""12""/>
        <RowDefinition Height=""Auto""/>
        <RowDefinition Height=""14""/>
        <RowDefinition Height=""*"" MinHeight=""100""/>
        <RowDefinition Height=""16""/>
        <RowDefinition Height=""Auto""/>
        <RowDefinition Height=""16""/>
        <RowDefinition Height=""Auto""/>
      </Grid.RowDefinitions>

      <!-- Title & Version Info -->
      <StackPanel Grid.Row=""0"" Orientation=""Horizontal"">
        <Border Width=""32"" Height=""32"" CornerRadius=""8"" Background=""#7C5CFC"" Margin=""0,0,12,0"">
          <TextBlock Text=""↑"" Foreground=""White"" FontSize=""18"" FontWeight=""Bold""
                     HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
        </Border>
        <StackPanel VerticalAlignment=""Center"">
          <TextBlock Text=""AGGIORNAMENTO DISPONIBILE"" Foreground=""#E8ECFF"" FontSize=""13"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display""/>
          <TextBlock Text=""Nuova versione disponibile per il download"" Foreground=""#7C5CFC"" FontSize=""9"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display""/>
        </StackPanel>
      </StackPanel>

      <!-- Version badge -->
      <StackPanel Grid.Row=""2"" Orientation=""Horizontal"">
        <TextBlock Text=""Versione installata: "" Foreground=""#6B738D"" FontSize=""11"" FontFamily=""Segoe UI Variable Text""/>
        <TextBlock Text=""{0}"" Foreground=""#8E96B3"" FontSize=""11"" FontWeight=""Bold"" Margin=""0,0,16,0"" FontFamily=""Segoe UI Variable Text""/>
        <TextBlock Text=""Nuova versione: "" Foreground=""#6B738D"" FontSize=""11"" FontFamily=""Segoe UI Variable Text""/>
        <TextBlock Text=""{1}"" Foreground=""#4ADE80"" FontSize=""11"" FontWeight=""Bold"" FontFamily=""Segoe UI Variable Text""/>
      </StackPanel>

      <!-- Changelog box -->
      <Border Grid.Row=""4"" Background=""#0B0D19"" CornerRadius=""10"" Padding=""12"" BorderBrush=""#14252B4D"" BorderThickness=""1"">
        <ScrollViewer VerticalScrollBarVisibility=""Auto"" HorizontalScrollBarVisibility=""Disabled"">
          <TextBlock x:Name=""lblChangelog"" Text=""{2}"" Foreground=""#A5ACCD"" FontSize=""11"" TextWrapping=""Wrap"" LineHeight=""16"" FontFamily=""Segoe UI Variable Text""/>
        </ScrollViewer>
      </Border>

      <!-- Download Progress Bar -->
      <StackPanel Grid.Row=""6"" x:Name=""pnlProgress"" Visibility=""Collapsed"">
        <ProgressBar x:Name=""pbDownload"" Height=""6"" Background=""#111322"" Foreground=""#7C5CFC"" BorderThickness=""0"" Margin=""0,0,0,6""/>
        <TextBlock x:Name=""lblStatus"" Text=""Avvio del download..."" Foreground=""#8E96B3"" FontSize=""10"" HorizontalAlignment=""Center"" FontFamily=""Segoe UI Variable Text""/>
      </StackPanel>

      <!-- Navigation buttons -->
      <Grid Grid.Row=""8"" x:Name=""pnlButtons"">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width=""*""/>
          <ColumnDefinition Width=""10""/>
          <ColumnDefinition Width=""120""/>
          <ColumnDefinition Width=""10""/>
          <ColumnDefinition Width=""120""/>
        </Grid.ColumnDefinitions>
        
        <TextBlock Text=""Vuoi procedere all'aggiornamento?"" Foreground=""#5E657D"" FontSize=""10"" VerticalAlignment=""Center"" FontFamily=""Segoe UI Variable Text""/>

        <Border Grid.Column=""2"" x:Name=""btnCancelBorder"" Background=""#1D2033"" CornerRadius=""10"" Cursor=""Hand"">
          <TextBlock Text=""Più Tardi"" Foreground=""#E3E5E8"" FontSize=""11"" FontWeight=""Bold"" HorizontalAlignment=""Center"" VerticalAlignment=""Center"" Padding=""0,8"" FontFamily=""Segoe UI Variable Display""/>
        </Border>

        <Border Grid.Column=""4"" x:Name=""btnUpdateBorder"" Background=""#7C5CFC"" CornerRadius=""10"" Cursor=""Hand"">
          <TextBlock x:Name=""btnUpdateText"" Text=""Aggiorna Ora"" Foreground=""White"" FontSize=""11"" FontWeight=""Bold"" HorizontalAlignment=""Center"" VerticalAlignment=""Center"" Padding=""0,8"" FontFamily=""Segoe UI Variable Display""/>
        </Border>
      </Grid>
    </Grid>
  </Border>
</Grid>
", UpdateConfig.CurrentVersion, _info.version, cleanChangelog);

            ParserContext context = new ParserContext();
            context.XmlnsDictionary.Add("", "http://schemas.microsoft.com/winfx/2006/xaml/presentation");
            context.XmlnsDictionary.Add("x", "http://schemas.microsoft.com/winfx/2006/xaml");

            StringReader stringReader = new StringReader(xaml);
            XmlReader xmlReader = XmlReader.Create(stringReader);
            Grid root = (Grid)XamlReader.Load(xmlReader);
            this.Content = root;
            _root = root;

            _lblTitle = (TextBlock)root.FindName("lblTitle");
            _lblChangelog = (TextBlock)root.FindName("lblChangelog");
            _pbDownload = (ProgressBar)root.FindName("pbDownload");
            _lblStatus = (TextBlock)root.FindName("lblStatus");
            _btnUpdateBorder = (Border)root.FindName("btnUpdateBorder");
            _btnUpdateText = (TextBlock)root.FindName("btnUpdateText");
            _btnCancelBorder = (Border)root.FindName("btnCancelBorder");

            BindEvents();
        }

        private void BindEvents()
        {
            _btnCancelBorder.MouseLeftButtonUp += (s, e) =>
            {
                if (_isDownloading) return;
                SoundManager.PlayClick();
                this.Close();
            };

            _btnUpdateBorder.MouseLeftButtonUp += (s, e) =>
            {
                if (_isDownloading) return;
                SoundManager.PlayClick();
                StartDownload();
            };
        }

        private void StartDownload()
        {
            _isDownloading = true;
            _btnCancelBorder.Opacity = 0.4;
            _btnUpdateBorder.Opacity = 0.4;

            // Show progress panel
            var pnlProgress = (StackPanel)_root.FindName("pnlProgress");
            if (pnlProgress != null) pnlProgress.Visibility = Visibility.Visible;

            string targetFolder = AppDomain.CurrentDomain.BaseDirectory;
            string tempFile = Path.Combine(targetFolder, "PavoTweak.tmp");

            try
            {
                using (WebClient client = new WebClient())
                {
                    client.Proxy = null;
                    client.DownloadProgressChanged += (s, e) =>
                    {
                        Dispatcher.BeginInvoke(new Action(() =>
                        {
                            _pbDownload.Value = e.ProgressPercentage;
                            _lblStatus.Text = string.Format(Lang.Current == AppLanguage.Italian ? "Scaricamento aggiornamento: {0}% ({1:F1} MB / {2:F1} MB)" : "Downloading update: {0}% ({1:F1} MB / {2:F1} MB)", 
                                e.ProgressPercentage, 
                                e.BytesReceived / 1024.0 / 1024.0, 
                                e.TotalBytesToReceive / 1024.0 / 1024.0);
                        }));
                    };

                    client.DownloadFileCompleted += (s, e) =>
                    {
                        Dispatcher.BeginInvoke(new Action(() =>
                        {
                            if (e.Error != null)
                            {
                                MessageBox.Show(Lang.TranslateString("Errore di download: ") + e.Error.Message, "Pavo Tweak Update", MessageBoxButton.OK, MessageBoxImage.Error);
                                _isDownloading = false;
                                _btnCancelBorder.Opacity = 1.0;
                                _btnUpdateBorder.Opacity = 1.0;
                                if (pnlProgress != null) pnlProgress.Visibility = Visibility.Collapsed;
                            }
                            else
                            {
                                _lblStatus.Text = Lang.TranslateString("Download completato! Avvio installazione in corso...");
                                PerformUpdateInstall(tempFile);
                            }
                        }));
                    };

                    client.DownloadFileAsync(new Uri(_info.url), tempFile);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(Lang.TranslateString("Errore di inizializzazione download: ") + ex.Message, "Pavo Tweak Update", MessageBoxButton.OK, MessageBoxImage.Error);
                _isDownloading = false;
                _btnCancelBorder.Opacity = 1.0;
                _btnUpdateBorder.Opacity = 1.0;
                if (pnlProgress != null) pnlProgress.Visibility = Visibility.Collapsed;
            }
        }

        private void PerformUpdateInstall(string tempFile)
        {
            try
            {
                string targetFolder = AppDomain.CurrentDomain.BaseDirectory;
                string currentExe = Process.GetCurrentProcess().MainModule.FileName;
                string uninstaller = Path.Combine(targetFolder, "Uninstall.exe");

                if (!File.Exists(uninstaller))
                {
                    // Fallback to direct replacement if Uninstall.exe is missing (unlikely, but safe)
                    MessageBox.Show(Lang.TranslateString("Impossibile trovare il modulo di aggiornamento (Uninstall.exe).\nSi prega di reinstallare l'applicazione."), "Pavo Tweak Update", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }

                // Launch Uninstall.exe with --update argument, which will copy the temp file over our current locked EXE
                var psi = new ProcessStartInfo(uninstaller)
                {
                    Arguments = string.Format(@"--update ""{0}"" ""{1}""", currentExe, tempFile),
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                Process.Start(psi);
                
                // Shutdown the current process immediately so that Uninstall.exe can overwrite it
                Application.Current.Shutdown();
            }
            catch (Exception ex)
            {
                MessageBox.Show(Lang.TranslateString("Errore durante la preparazione dell'aggiornamento: ") + ex.Message, "Pavo Tweak Update", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
