using System;
using System.IO;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using System.Xml;
using PavoTweak.Auth;

namespace PavoTweak
{
    /// <summary>
    /// Premium glassmorphism login window shown before the main application.
    /// Validates license keys via KeyAuth and persists successful sessions.
    /// </summary>
    public class LoginWindow : Window
    {
        // ── UI references ─────────────────────────────────────────────
        private Grid        _root;
        private TextBox     _keyBox;
        private TextBlock   _statusText;
        private Border      _btnBorder;
        private TextBlock   _btnText;
        private StackPanel  _spinner;
        private DispatcherTimer _dotTimer;
        private int         _dotCount;

        public bool Authenticated { get; private set; }

        // Optional message to display when the window first opens
        // (e.g. "Your license has been banned.")
        private readonly string _initialMessage;

        public LoginWindow(string initialMessage = null)
        {
            _initialMessage = initialMessage;
            WindowStyle             = WindowStyle.None;
            AllowsTransparency      = true;
            Background              = null;
            Width                   = 480;
            Height                  = 340;
            WindowStartupLocation   = WindowStartupLocation.CenterScreen;
            Topmost                 = true;
            ResizeMode              = ResizeMode.NoResize;
            ShowInTaskbar           = true;
            Title                   = "Pavo Tweak – License";

            BuildUI();

            this.SourceInitialized += (s, e) =>
            {
                WindowHelper.DisableWindowShadow(this);
                ApplyRoundedClip();
            };

            // Fade in, then show initial deny message if provided
            Loaded += (s, e) =>
            {
                var anim = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(350));
                _root.BeginAnimation(UIElement.OpacityProperty, anim);

                if (!string.IsNullOrEmpty(_initialMessage))
                    SetStatus(_initialMessage, true);
            };

            // Allow dragging
            this.MouseLeftButtonDown += (s, e) =>
            {
                if (e.ButtonState == MouseButtonState.Pressed) DragMove();
            };
        }

        // ── Round clip ────────────────────────────────────────────────
        private void ApplyRoundedClip()
        {
            SizeChanged += (s, e) =>
            {
                var geo = new RectangleGeometry(
                    new Rect(0, 0, ActualWidth, ActualHeight), 20, 20);
                Clip = geo;
            };
            var geo2 = new RectangleGeometry(new Rect(0, 0, Width, Height), 20, 20);
            Clip = geo2;
        }

        // ── UI builder ────────────────────────────────────────────────
        private void BuildUI()
        {
            string xaml = @"
<Grid xmlns=""http://schemas.microsoft.com/winfx/2006/xaml/presentation""
      xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml""
      Opacity=""0"">
  <Border CornerRadius=""20"" BorderBrush=""#1A3B82F6"" BorderThickness=""1.5"">
    <Border.Background>
      <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,1"">
        <GradientStop Color=""#06080F"" Offset=""0""/>
        <GradientStop Color=""#0A0E1C"" Offset=""1""/>
      </LinearGradientBrush>
    </Border.Background>
    <Grid Margin=""36,32,36,32"">
      <Grid.RowDefinitions>
        <RowDefinition Height=""Auto""/>
        <RowDefinition Height=""16""/>
        <RowDefinition Height=""Auto""/>
        <RowDefinition Height=""12""/>
        <RowDefinition Height=""Auto""/>
        <RowDefinition Height=""10""/>
        <RowDefinition Height=""Auto""/>
        <RowDefinition Height=""14""/>
        <RowDefinition Height=""Auto""/>
        <RowDefinition Height=""*""/>
        <RowDefinition Height=""Auto""/>
      </Grid.RowDefinitions>

      <!-- Logo row -->
      <StackPanel Grid.Row=""0"" Orientation=""Horizontal"" HorizontalAlignment=""Center"">
        <Border Width=""36"" Height=""36"" CornerRadius=""10"" Margin=""0,0,10,0"">
          <Border.Background>
            <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,1"">
              <GradientStop Color=""#3B82F6"" Offset=""0""/>
              <GradientStop Color=""#60A5FA"" Offset=""1""/>
            </LinearGradientBrush>
          </Border.Background>
          <Border.Effect>
            <DropShadowEffect Color=""#3B82F6"" BlurRadius=""20"" Opacity=""0.5"" ShadowDepth=""0""/>
          </Border.Effect>
          <TextBlock Text=""P"" Foreground=""White"" FontSize=""18"" FontWeight=""Black""
                     HorizontalAlignment=""Center"" VerticalAlignment=""Center""
                     FontFamily=""Segoe UI Variable Display""/>
        </Border>
        <StackPanel VerticalAlignment=""Center"">
          <TextBlock Text=""PAVO TWEAK"" Foreground=""#E8ECFF"" FontSize=""17""
                     FontWeight=""Black"" FontFamily=""Segoe UI Variable Display""/>
          <TextBlock Text=""LICENSE ACTIVATION"" Foreground=""#3B82F6"" FontSize=""8.5""
                     FontWeight=""Bold"" FontFamily=""Segoe UI Variable Display""/>
        </StackPanel>
      </StackPanel>

      <!-- Separator -->
      <Border Grid.Row=""2"" Height=""1"" Background=""#12283C60""/>

      <!-- Label -->
      <TextBlock Grid.Row=""4"" Text=""Enter your license key to continue""
                 Foreground=""#8892B8"" FontSize=""11.5""
                 FontFamily=""Segoe UI Variable Text""
                 HorizontalAlignment=""Center""/>

      <!-- Key Input -->
      <Border Grid.Row=""6"" CornerRadius=""10"" BorderBrush=""#1E3B82F6"" BorderThickness=""1.5""
              Background=""#07101E"" x:Name=""keyBoxBorder"">
        <Grid>
          <TextBox x:Name=""keyBox""
                   Background=""Transparent""
                   Foreground=""#D0D8FF""
                   CaretBrush=""#3B82F6""
                   BorderThickness=""0""
                   Padding=""14,10""
                   FontSize=""12.5""
                   FontFamily=""Consolas""
                   FontWeight=""SemiBold""
                   SelectionBrush=""#553B82F6""
                   VerticalContentAlignment=""Center""
                   MaxLength=""64"">
            <TextBox.Resources>
              <Style TargetType=""Border"">
                <Setter Property=""CornerRadius"" Value=""10""/>
              </Style>
            </TextBox.Resources>
          </TextBox>
          <TextBlock x:Name=""placeholder"" Text=""XXXX-XXXX-XXXX-XXXX""
                     Foreground=""#2A3A5E"" FontSize=""12.5""
                     FontFamily=""Consolas"" Margin=""14,0,0,0""
                     VerticalAlignment=""Center"" IsHitTestVisible=""False""/>
        </Grid>
      </Border>

      <!-- Activate Button -->
      <Border Grid.Row=""8"" CornerRadius=""10"" x:Name=""btnBorder"" Cursor=""Hand"">
        <Border.Background>
          <LinearGradientBrush StartPoint=""0,0"" EndPoint=""1,0"">
            <GradientStop Color=""#2563EB"" Offset=""0""/>
            <GradientStop Color=""#3B82F6"" Offset=""1""/>
          </LinearGradientBrush>
        </Border.Background>
        <Border.Effect>
          <DropShadowEffect Color=""#3B82F6"" BlurRadius=""16"" Opacity=""0.4"" ShadowDepth=""0""/>
        </Border.Effect>
        <Grid Height=""40"">
          <TextBlock x:Name=""btnText"" Text=""ACTIVATE LICENSE""
                     Foreground=""White"" FontSize=""12"" FontWeight=""Bold""
                     FontFamily=""Segoe UI Variable Display""
                     HorizontalAlignment=""Center"" VerticalAlignment=""Center""/>
          <!-- Spinner dots (hidden by default) -->
          <StackPanel x:Name=""spinner"" Orientation=""Horizontal""
                      HorizontalAlignment=""Center"" VerticalAlignment=""Center""
                      Visibility=""Collapsed"">
            <Ellipse Width=""6"" Height=""6"" Fill=""White"" Margin=""3,0"" Opacity=""0.3"" x:Name=""d1""/>
            <Ellipse Width=""6"" Height=""6"" Fill=""White"" Margin=""3,0"" Opacity=""0.3"" x:Name=""d2""/>
            <Ellipse Width=""6"" Height=""6"" Fill=""White"" Margin=""3,0"" Opacity=""0.3"" x:Name=""d3""/>
          </StackPanel>
        </Grid>
      </Border>

      <!-- Status message -->
      <TextBlock Grid.Row=""10"" x:Name=""statusText""
                 Text="""" Foreground=""#8892B8"" FontSize=""10.5""
                 FontFamily=""Segoe UI Variable Text""
                 HorizontalAlignment=""Center"" TextWrapping=""Wrap"" TextAlignment=""Center""/>
    </Grid>
  </Border>
</Grid>
";
            var ctx = new ParserContext();
            ctx.XmlnsDictionary.Add("", "http://schemas.microsoft.com/winfx/2006/xaml/presentation");
            ctx.XmlnsDictionary.Add("x", "http://schemas.microsoft.com/winfx/2006/xaml");

            _root = (Grid)XamlReader.Load(XmlReader.Create(new StringReader(xaml)));
            Content = _root;

            _keyBox    = (TextBox)   _root.FindName("keyBox");
            _statusText= (TextBlock) _root.FindName("statusText");
            _btnBorder = (Border)    _root.FindName("btnBorder");
            _btnText   = (TextBlock) _root.FindName("btnText");
            _spinner   = (StackPanel) _root.FindName("spinner");

            var placeholder = (TextBlock)_root.FindName("placeholder");

            // Placeholder hide/show
            _keyBox.TextChanged += (s, e) =>
            {
                placeholder.Visibility = string.IsNullOrEmpty(_keyBox.Text)
                    ? Visibility.Visible : Visibility.Collapsed;
                _statusText.Text = "";
                SetStatus("", false);
            };

            // Enter key triggers activate
            _keyBox.KeyDown += (s, e) =>
            {
                if (e.Key == Key.Enter) BeginActivation();
            };

            // Button click
            _btnBorder.MouseLeftButtonDown += (s, e) => BeginActivation();

            // Button hover effects
            _btnBorder.MouseEnter += (s, e) =>
            {
                var anim = new DoubleAnimation(0.4, 0.7, TimeSpan.FromMilliseconds(150));
                var effect = (System.Windows.Media.Effects.DropShadowEffect)_btnBorder.Effect;
                effect.BeginAnimation(System.Windows.Media.Effects.DropShadowEffect.OpacityProperty, anim);
            };
            _btnBorder.MouseLeave += (s, e) =>
            {
                var anim = new DoubleAnimation(0.7, 0.4, TimeSpan.FromMilliseconds(150));
                var effect = (System.Windows.Media.Effects.DropShadowEffect)_btnBorder.Effect;
                effect.BeginAnimation(System.Windows.Media.Effects.DropShadowEffect.OpacityProperty, anim);
            };

            // Close button — ESC
            PreviewKeyDown += (s, e) =>
            {
                if (e.Key == Key.Escape) Application.Current.Shutdown();
            };
        }

        // ── Activation flow ───────────────────────────────────────────
        private bool _busy = false;

        private void BeginActivation()
        {
            if (_busy) return;
            string key = _keyBox.Text.Trim();
            if (string.IsNullOrEmpty(key))
            {
                SetStatus("Please enter your license key.", true);
                ShakeKeyBox();
                return;
            }
            SetBusy(true);
            SetStatus("Validating with server...", false);

            Thread t = new Thread(() =>
            {
                string errMsg = null;
                bool success = false;
                try
                {
                    LicenseResponse res = PavoTweak.Auth.LicenseClient.Activate(key);
                    if (res != null && res.Valid)
                    {
                        PavoTweak.Auth.LicenseClient.SaveToken(key);
                        success = true;
                    }
                    else
                    {
                        string code = res != null ? res.Code : "ERROR";
                        string msg = res != null ? res.Message : "Authentication failed.";
                        errMsg = PavoTweak.App.TranslateDenyReason(code, msg);
                    }
                }
                catch (Exception ex)
                {
                    errMsg = "Connection error: " + ex.Message;
                }

                Dispatcher.Invoke(() =>
                {
                    SetBusy(false);
                    if (success)
                    {
                        SetStatus("✓  License activated successfully!", false, "#4ADE80");
                        Authenticated = true;
                        // Short delay then close
                        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(800) };
                        timer.Tick += (s2, e2) => { timer.Stop(); FadeOutAndClose(); };
                        timer.Start();
                    }
                    else
                    {
                        SetStatus("✗  " + (errMsg ?? "Authentication failed."), true);
                        ShakeKeyBox();
                    }
                });
            });
            t.IsBackground = true;
            t.Start();
        }

        public static bool TrySilentAuth()
        {
            string saved = PavoTweak.Auth.LicenseClient.LoadSavedToken();
            if (string.IsNullOrEmpty(saved)) return false;
            try
            {
                LicenseResponse res = PavoTweak.Auth.LicenseClient.Validate(saved);
                if (res != null && res.Valid)
                {
                    return true;
                }
                else
                {
                    // Key was banned, expired or revoked — wipe the saved token
                    PavoTweak.Auth.LicenseClient.ClearSavedToken();
                    return false;
                }
            }
            catch
            {
                PavoTweak.Auth.LicenseClient.ClearSavedToken();
            }
            return false;
        }

        // ── UI helpers ────────────────────────────────────────────────
        private void SetBusy(bool busy)
        {
            _busy = busy;
            _keyBox.IsEnabled = !busy;
            _btnText.Visibility  = busy ? Visibility.Collapsed  : Visibility.Visible;
            _spinner.Visibility  = busy ? Visibility.Visible    : Visibility.Collapsed;

            if (busy)
            {
                _dotTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(300) };
                _dotCount = 0;
                _dotTimer.Tick += SpinnerTick;
                _dotTimer.Start();
            }
            else
            {
                if (_dotTimer != null) { _dotTimer.Stop(); _dotTimer = null; }
                // Reset spinner dots
                SetDotOpacity(0, 0.3); SetDotOpacity(1, 0.3); SetDotOpacity(2, 0.3);
            }
        }

        private void SpinnerTick(object sender, EventArgs e)
        {
            SetDotOpacity(0, 0.3); SetDotOpacity(1, 0.3); SetDotOpacity(2, 0.3);
            SetDotOpacity(_dotCount % 3, 1.0);
            _dotCount++;
        }

        private void SetDotOpacity(int idx, double opacity)
        {
            if (_spinner == null || idx >= _spinner.Children.Count) return;
            var el = _spinner.Children[idx] as UIElement;
            if (el != null) el.Opacity = opacity;
        }

        private void SetStatus(string msg, bool isError, string color = null)
        {
            _statusText.Text = msg;
            if (color != null)
                _statusText.Foreground = new SolidColorBrush(
                    (Color)ColorConverter.ConvertFromString(color));
            else
                _statusText.Foreground = new SolidColorBrush(
                    isError ? Color.FromRgb(0xF8, 0x71, 0x71)
                            : Color.FromRgb(0x88, 0x92, 0xB8));
        }

        private void ShakeKeyBox()
        {
            var keyBoxBorder = (Border)_root.FindName("keyBoxBorder");
            if (keyBoxBorder == null) return;
            var anim = new DoubleAnimationUsingKeyFrames();
            anim.KeyFrames.Add(new LinearDoubleKeyFrame(0,   KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(0))));
            anim.KeyFrames.Add(new LinearDoubleKeyFrame(-8,  KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(60))));
            anim.KeyFrames.Add(new LinearDoubleKeyFrame(8,   KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(120))));
            anim.KeyFrames.Add(new LinearDoubleKeyFrame(-6,  KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(180))));
            anim.KeyFrames.Add(new LinearDoubleKeyFrame(6,   KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(240))));
            anim.KeyFrames.Add(new LinearDoubleKeyFrame(0,   KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(300))));
            var transform = new TranslateTransform();
            keyBoxBorder.RenderTransform = transform;
            transform.BeginAnimation(TranslateTransform.XProperty, anim);
        }

        private void FadeOutAndClose()
        {
            var anim = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(350));
            anim.Completed += (s, e) => Close();
            _root.BeginAnimation(UIElement.OpacityProperty, anim);
        }
    }
}
