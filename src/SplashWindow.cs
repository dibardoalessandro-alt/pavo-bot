using System;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using System.Windows.Threading;

namespace PavoTweak
{
    public class SplashWindow : Window
    {
        // ── XAML references ──────────────────────────────────────────────────
        private Grid        _root;
        private TextBlock   _lblStatus;
        private TextBlock   _lblPercent;
        private Border      _progressFill;
        private TextBlock   _lblVersion;

        // ── Animation ────────────────────────────────────────────────────────
        private DispatcherTimer _progressTimer;
        private double          _progress = 0;
        private readonly Random _rng = new Random();

        // ── Loading stages ────────────────────────────────────────────────────
        private static readonly string[] Stages =
        {
            "Initializing core engine...",
            "Loading performance modules...",
            "Calibrating system sensors...",
            "Optimizing UI components...",
            "Verifying license integrity...",
            "Loading driver database...",
            "Preparing tweak profiles...",
            "Starting telemetry engine...",
            "Finalizing startup...",
        };

        // ─────────────────────────────────────────────────────────────────────
        public SplashWindow()
        {
            WindowStyle             = WindowStyle.None;
            AllowsTransparency      = true;
            Background              = null;
            Width                   = 660;
            Height                  = 440;
            WindowStartupLocation   = WindowStartupLocation.CenterScreen;
            Topmost                 = true;
            ShowInTaskbar           = false;
            ResizeMode              = ResizeMode.NoResize;

            BuildUI();
            SourceInitialized += (s, e) => WindowHelper.DisableWindowShadow(this);
            Loaded            += (s, e) => BeginStartup();
        }

        // ──────────────────────────────────────────────────────────────────────
        // UI Construction
        // ──────────────────────────────────────────────────────────────────────

        private void BuildUI()
        {
            // ── Root Grid (invisible until fade-in) ──────────────────────────
            var root = new Grid { Opacity = 0, Margin = new Thickness(22) };

            // ── Shadow / Glow Border ─────────────────────────────────────────
            var outerBorder = new Border
            {
                CornerRadius    = new CornerRadius(24),
                BorderBrush     = new SolidColorBrush(Color.FromArgb(55, 59, 130, 246)),
                BorderThickness = new Thickness(1.5),
                ClipToBounds    = true,
            };
            outerBorder.Effect = new DropShadowEffect
            {
                Color       = Color.FromRgb(20, 50, 160),
                BlurRadius  = 42,
                Opacity     = 0.55,
                ShadowDepth = 0,
            };
            root.Children.Add(outerBorder);

            // ── Main inner Grid inside the border ────────────────────────────
            var inner = new Grid();
            outerBorder.Child = inner;

            // ── Base background ──────────────────────────────────────────────
            inner.Background = new LinearGradientBrush(
                new GradientStopCollection
                {
                    new GradientStop(Color.FromRgb(4,  5, 12), 0.0),
                    new GradientStop(Color.FromRgb(6,  8, 18), 0.5),
                    new GradientStop(Color.FromRgb(5,  7, 16), 1.0),
                },
                new Point(0, 0), new Point(1, 1));

            // ── Hexagon background image (loaded from embedded resource) ─────
            BitmapImage hexBmp = _LoadEmbedded(
                "moving-hexagons-illuminated-in-blue-light-infinitely-looped-animation-video.jpg");

            if (hexBmp != null)
            {
                var bgImg = new Image
                {
                    Source           = hexBmp,
                    Stretch          = Stretch.UniformToFill,
                    Opacity          = 0.18,
                    IsHitTestVisible = false,
                };
                bgImg.Effect = new BlurEffect { Radius = 1.5, RenderingBias = RenderingBias.Performance };
                inner.Children.Add(bgImg);
            }

            // ── Blue diagonal gradient overlay ───────────────────────────────
            var overlay = new Border
            {
                IsHitTestVisible = false,
                Background       = new LinearGradientBrush(
                    new GradientStopCollection
                    {
                        new GradientStop(Color.FromArgb(100, 5, 15, 55), 0.0),
                        new GradientStop(Color.FromArgb(30,  2,  8, 30), 0.5),
                        new GradientStop(Color.FromArgb(80,  8, 18, 70), 1.0),
                    },
                    new Point(0, 0), new Point(1, 1))
            };
            inner.Children.Add(overlay);

            // ── Ambient top-right radial glow ────────────────────────────────
            var glowTop = new Border
            {
                IsHitTestVisible    = false,
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment   = VerticalAlignment.Top,
                Width               = 320,
                Height              = 320,
                Margin              = new Thickness(0, -80, -80, 0),
                Background          = new RadialGradientBrush(
                    Color.FromArgb(40, 59, 130, 246),
                    Color.FromArgb(0, 0, 0, 0))
            };
            inner.Children.Add(glowTop);

            // ── Ambient bottom-left radial glow ──────────────────────────────
            var glowBot = new Border
            {
                IsHitTestVisible    = false,
                HorizontalAlignment = HorizontalAlignment.Left,
                VerticalAlignment   = VerticalAlignment.Bottom,
                Width               = 260,
                Height              = 260,
                Margin              = new Thickness(-60, 0, 0, -60),
                Background          = new RadialGradientBrush(
                    Color.FromArgb(30, 30, 80, 200),
                    Color.FromArgb(0, 0, 0, 0))
            };
            inner.Children.Add(glowBot);

            // ── Particle canvas (low opacity) ─────────────────────────────────
            var particleHost = new ContentControl
            {
                IsHitTestVisible = false,
                Opacity          = 0.18,
            };
            particleHost.Content = new ParticleCanvas();
            inner.Children.Add(particleHost);

            // ── Main content grid ─────────────────────────────────────────────
            var content = new Grid { Margin = new Thickness(40) };
            content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            content.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            inner.Children.Add(content);

            // ── TOP ROW: version badge ────────────────────────────────────────
            var topBar = new Grid();
            Grid.SetRow(topBar, 0);
            content.Children.Add(topBar);

            _lblVersion = new TextBlock
            {
                Text               = "v2.4.0  PREMIUM",
                Foreground         = new SolidColorBrush(Color.FromArgb(100, 80, 130, 255)),
                FontSize           = 9,
                FontWeight         = FontWeights.Bold,
                FontFamily         = new FontFamily("Segoe UI Variable Text"),
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment   = VerticalAlignment.Center,
                Margin              = new Thickness(0, 0, 0, 0),
            };
            topBar.Children.Add(_lblVersion);

            // ── CENTER ROW: logo + name ───────────────────────────────────────
            var centerPanel = new StackPanel
            {
                VerticalAlignment   = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
            };
            Grid.SetRow(centerPanel, 1);
            content.Children.Add(centerPanel);

            // Logo icon border — large
            var iconOuter = new Border
            {
                Width               = 80,
                Height              = 80,
                CornerRadius        = new CornerRadius(22),
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin              = new Thickness(0, 0, 0, 22),
            };
            iconOuter.Background = new LinearGradientBrush(
                new GradientStopCollection
                {
                    new GradientStop(Color.FromRgb(30, 80, 200), 0.0),
                    new GradientStop(Color.FromRgb(59, 130, 246), 0.5),
                    new GradientStop(Color.FromRgb(96, 165, 250), 1.0),
                },
                new Point(0, 0), new Point(1, 1));
            iconOuter.Effect = new DropShadowEffect
            {
                Color       = Color.FromRgb(59, 130, 246),
                BlurRadius  = 40,
                Opacity     = 0.7,
                ShadowDepth = 0,
            };

            // Logo image
            var logoImg = new Image
            {
                Source  = _LoadBitmap("pavo_logo.png"),
                Width   = 44,
                Height  = 44,
                Stretch = Stretch.Uniform,
            };
            RenderOptions.SetBitmapScalingMode(logoImg, BitmapScalingMode.HighQuality);
            iconOuter.Child = logoImg;
            centerPanel.Children.Add(iconOuter);

            // Animate logo glow breathing
            _AnimateBreathingGlow(iconOuter);

            // App name — large gradient text simulation using two stacked TextBlocks
            var appName = new TextBlock
            {
                Text                = "PAVO TWEAK",
                FontFamily          = new FontFamily("Segoe UI Variable Display"),
                FontSize            = 30,
                FontWeight          = FontWeights.Black,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin              = new Thickness(0, 0, 0, 4),
                Foreground          = new LinearGradientBrush(
                    new GradientStopCollection
                    {
                        new GradientStop(Colors.White, 0.0),
                        new GradientStop(Color.FromRgb(192, 210, 255), 0.5),
                        new GradientStop(Color.FromRgb(147, 180, 255), 1.0),
                    },
                    new Point(0, 0), new Point(1, 0))
            };
            centerPanel.Children.Add(appName);

            // Tagline
            var tagline = new TextBlock
            {
                Text                = "PREMIUM PERFORMANCE SUITE",
                FontFamily          = new FontFamily("Segoe UI Variable Display"),
                FontSize            = 10,
                FontWeight          = FontWeights.SemiBold,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin              = new Thickness(0, 0, 0, 0),
                Foreground          = new SolidColorBrush(Color.FromArgb(200, 59, 130, 246)),
            };
            centerPanel.Children.Add(tagline);

            // Decorative separator line
            var sep = new Border
            {
                Height              = 1,
                Width               = 120,
                Margin              = new Thickness(0, 14, 0, 0),
                HorizontalAlignment = HorizontalAlignment.Center,
                Background          = new LinearGradientBrush(
                    new GradientStopCollection
                    {
                        new GradientStop(Color.FromArgb(0, 59, 130, 246), 0.0),
                        new GradientStop(Color.FromArgb(160, 59, 130, 246), 0.5),
                        new GradientStop(Color.FromArgb(0, 59, 130, 246), 1.0),
                    },
                    new Point(0, 0.5), new Point(1, 0.5))
            };
            centerPanel.Children.Add(sep);

            // ── BOTTOM ROW: progress bar + status ────────────────────────────
            var bottomPanel = new StackPanel { Margin = new Thickness(0, 0, 0, 0) };
            Grid.SetRow(bottomPanel, 2);
            content.Children.Add(bottomPanel);

            // Status row
            var statusRow = new Grid { Margin = new Thickness(0, 0, 0, 8) };
            _lblStatus = new TextBlock
            {
                Text            = "Initializing core engine...",
                Foreground      = new SolidColorBrush(Color.FromArgb(180, 130, 155, 220)),
                FontSize        = 10,
                FontFamily      = new FontFamily("Segoe UI Variable Text"),
                FontWeight      = FontWeights.SemiBold,
                VerticalAlignment = VerticalAlignment.Center,
            };
            _lblPercent = new TextBlock
            {
                Text                = "0%",
                Foreground          = new SolidColorBrush(Color.FromRgb(59, 130, 246)),
                FontSize            = 11,
                FontFamily          = new FontFamily("Segoe UI Variable Text"),
                FontWeight          = FontWeights.Bold,
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment   = VerticalAlignment.Center,
            };
            statusRow.Children.Add(_lblStatus);
            statusRow.Children.Add(_lblPercent);
            bottomPanel.Children.Add(statusRow);

            // Progress bar track
            var track = new Grid { Height = 5, Margin = new Thickness(0, 0, 0, 0) };
            // Track background
            track.Children.Add(new Border
            {
                CornerRadius    = new CornerRadius(3),
                Background      = new SolidColorBrush(Color.FromArgb(80, 20, 35, 80)),
                BorderBrush     = new SolidColorBrush(Color.FromArgb(60, 30, 55, 120)),
                BorderThickness = new Thickness(1),
            });

            // Progress fill — scaled from left origin
            _progressFill = new Border
            {
                CornerRadius            = new CornerRadius(3),
                HorizontalAlignment     = HorizontalAlignment.Left,
                RenderTransformOrigin   = new Point(0, 0.5),
                Width                   = 580,          // full width of track (set large)
                RenderTransform         = new ScaleTransform(0, 1),
            };
            _progressFill.Background = new LinearGradientBrush(
                new GradientStopCollection
                {
                    new GradientStop(Color.FromRgb(30,  80, 200), 0.0),
                    new GradientStop(Color.FromRgb(59, 130, 246), 0.5),
                    new GradientStop(Color.FromRgb(96, 165, 250), 1.0),
                },
                new Point(0, 0), new Point(1, 0));
            _progressFill.Effect = new DropShadowEffect
            {
                Color       = Color.FromRgb(59, 130, 246),
                BlurRadius  = 12,
                Opacity     = 0.8,
                ShadowDepth = 0,
            };
            track.Children.Add(_progressFill);

            // Shimmer overlay on the progress fill
            var shimmer = new Border
            {
                CornerRadius        = new CornerRadius(3),
                HorizontalAlignment = HorizontalAlignment.Left,
                Width               = 580,
                IsHitTestVisible    = false,
                RenderTransform     = new ScaleTransform(0, 1),
                RenderTransformOrigin = new Point(0, 0.5),
                Background          = new LinearGradientBrush(
                    new GradientStopCollection
                    {
                        new GradientStop(Color.FromArgb(0,   255, 255, 255), 0.0),
                        new GradientStop(Color.FromArgb(60,  255, 255, 255), 0.5),
                        new GradientStop(Color.FromArgb(0,   255, 255, 255), 1.0),
                    },
                    new Point(0, 0), new Point(1, 0))
            };
            track.Children.Add(shimmer);

            bottomPanel.Children.Add(track);

            // Pulse dots (decorative) — three dots that animate
            var dotsPanel = new StackPanel
            {
                Orientation         = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin              = new Thickness(0, 12, 0, 0),
            };
            for (int i = 0; i < 3; i++)
            {
                var dot = new Ellipse
                {
                    Width  = 5,
                    Height = 5,
                    Fill   = new SolidColorBrush(Color.FromRgb(59, 130, 246)),
                    Margin = new Thickness(4, 0, 4, 0),
                };
                _AnimateDotPulse(dot, i * 200);
                dotsPanel.Children.Add(dot);
            }
            bottomPanel.Children.Add(dotsPanel);

            // Set content
            this.Content = root;
            _root = root;
        }

        // ──────────────────────────────────────────────────────────────────────
        // Animations
        // ──────────────────────────────────────────────────────────────────────

        private void BeginStartup()
        {
            // Fade in
            var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(500))
            {
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
            };
            _root.BeginAnimation(Grid.OpacityProperty, fadeIn);

            // Scale-up entry animation
            var st = new ScaleTransform(0.92, 0.92);
            _root.RenderTransformOrigin = new Point(0.5, 0.5);
            _root.RenderTransform = st;
            var sx = new DoubleAnimation(0.92, 1.0, TimeSpan.FromMilliseconds(500))
            {
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
            };
            var sy = new DoubleAnimation(0.92, 1.0, TimeSpan.FromMilliseconds(500))
            {
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
            };
            st.BeginAnimation(ScaleTransform.ScaleXProperty, sx);
            st.BeginAnimation(ScaleTransform.ScaleYProperty, sy);

            // Start progress
            _progressTimer = new DispatcherTimer(DispatcherPriority.Render)
            {
                Interval = TimeSpan.FromMilliseconds(28),
            };
            _progressTimer.Tick += OnProgressTick;
            _progressTimer.Start();
        }

        private void OnProgressTick(object sender, EventArgs e)
        {
            double step = _rng.NextDouble() * 1.4 + 0.3;
            _progress += step;
            if (_progress >= 100)
            {
                _progress = 100;
                _progressTimer.Stop();
                FinishLoading();
            }

            // Smooth ScaleX animation to target
            double targetScale = _progress / 100.0;
            var st = (ScaleTransform)_progressFill.RenderTransform;
            var anim = new DoubleAnimation(targetScale, TimeSpan.FromMilliseconds(80))
            {
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseOut },
            };
            st.BeginAnimation(ScaleTransform.ScaleXProperty, anim);

            _lblPercent.Text = ((int)_progress) + "%";

            // Status messages by phase
            int stage = (int)(_progress / (100.0 / Stages.Length));
            stage = Math.Min(stage, Stages.Length - 1);
            _lblStatus.Text = Stages[stage];
        }

        private void FinishLoading()
        {
            var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(450))
            {
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseIn },
            };
            fadeOut.Completed += (s, e) =>
            {
                var main = new MainWindow();
                Application.Current.MainWindow = main;
                main.Show();
                this.Close();
            };
            _root.BeginAnimation(Grid.OpacityProperty, fadeOut);
        }

        // ──────────────────────────────────────────────────────────────────────
        // Helper animators
        // ──────────────────────────────────────────────────────────────────────

        private void _AnimateBreathingGlow(Border b)
        {
            var anim = new DoubleAnimation
            {
                From           = 0.55,
                To             = 0.85,
                Duration       = TimeSpan.FromSeconds(2.2),
                AutoReverse    = true,
                RepeatBehavior = RepeatBehavior.Forever,
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
            };
            var glow = (DropShadowEffect)b.Effect;
            glow.BeginAnimation(DropShadowEffect.OpacityProperty, anim);
        }

        private void _AnimateDotPulse(Ellipse dot, int delayMs)
        {
            var anim = new DoubleAnimation
            {
                From           = 0.15,
                To             = 1.0,
                Duration       = TimeSpan.FromMilliseconds(600),
                AutoReverse    = true,
                RepeatBehavior = RepeatBehavior.Forever,
                BeginTime      = TimeSpan.FromMilliseconds(delayMs),
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
            };
            dot.BeginAnimation(Ellipse.OpacityProperty, anim);
        }

        private static BitmapImage _LoadBitmap(string fileName)
        {
            return _LoadEmbedded(fileName);
        }

        /// <summary>
        /// Loads a bitmap first from embedded assembly resources, then from the filesystem.
        /// </summary>
        private static BitmapImage _LoadEmbedded(string resourceName)
        {
            // 1. Try embedded resource
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                using (Stream s = asm.GetManifestResourceStream(resourceName))
                {
                    if (s != null)
                    {
                        var bmp = new BitmapImage();
                        bmp.BeginInit();
                        bmp.StreamSource = s;
                        bmp.CacheOption  = BitmapCacheOption.OnLoad;
                        bmp.EndInit();
                        bmp.Freeze();
                        return bmp;
                    }
                }
            }
            catch { }

            // 2. Fallback: file next to exe
            try
            {
                string path = System.IO.Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory, resourceName);
                if (File.Exists(path))
                {
                    var bmp = new BitmapImage();
                    bmp.BeginInit();
                    bmp.UriSource   = new Uri(path, UriKind.Absolute);
                    bmp.CacheOption = BitmapCacheOption.OnLoad;
                    bmp.EndInit();
                    bmp.Freeze();
                    return bmp;
                }
            }
            catch { }

            return null;
        }
    }
}
