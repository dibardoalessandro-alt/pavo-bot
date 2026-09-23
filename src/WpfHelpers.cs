using System;
using System.IO;
using System.Media;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Windows.Threading;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace PavoTweak
{
    public static class SoundManager
    {
        private static bool enabled = true;
        private static SoundPlayer clickPlayer;

        static SoundManager()
        {
            try
            {
                string path = @"C:\Windows\Media\Windows Navigation Start.wav";
                if (File.Exists(path))
                {
                    clickPlayer = new SoundPlayer(path);
                    clickPlayer.Load(); // Preload to RAM
                }
            }
            catch {}
        }

        public static bool Enabled 
        { 
            get { return enabled; } 
            set { enabled = value; } 
        }

        public static void PlayHover()
        {
            // Hover sounds disabled for premium clean UI feel
        }

        public static void PlayClick()
        {
            if (!enabled) return;
            System.Threading.Tasks.Task.Run(() =>
            {
                try
                {
                    if (clickPlayer != null)
                    {
                        clickPlayer.Play();
                    }
                    else
                    {
                        SystemSounds.Asterisk.Play();
                    }
                }
                catch {}
            });
        }

        public static void PlaySuccess()
        {
            // Success sounds disabled to prevent duplicate system sounds
        }
    }

    public class Particle
    {
        public double BaseX { get; set; }
        public double BaseY { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public double Vx { get; set; }
        public double Vy { get; set; }
        public double Size { get; set; }
        public double Opacity { get; set; }
        public double SpeedFactor { get; set; }
        public Brush Brush { get; set; }
    }

    public class ParticleCanvas : Canvas
    {
        private List<Particle> particles = new List<Particle>();
        private Random rnd = new Random();
        private DispatcherTimer timer;
        private int maxParticles = 65;

        private Brush bgBrush = new SolidColorBrush(Color.FromRgb(6, 7, 12));
        private Brush nebula1Brush = new RadialGradientBrush(Color.FromArgb(24, 156, 39, 176), Color.FromArgb(0, 0, 0, 0));
        private Brush nebula2Brush = new RadialGradientBrush(Color.FromArgb(20, 88, 101, 242), Color.FromArgb(0, 0, 0, 0));
        private Brush nebula3Brush = new RadialGradientBrush(Color.FromArgb(16, 0, 242, 254), Color.FromArgb(0, 0, 0, 0));

        public ParticleCanvas()
        {
            bgBrush.Freeze();
            nebula1Brush.Freeze();
            nebula2Brush.Freeze();
            nebula3Brush.Freeze();

            this.Loaded += ParticleCanvas_Loaded;
            this.Unloaded += ParticleCanvas_Unloaded;
        }

        private void ParticleCanvas_Loaded(object sender, RoutedEventArgs e)
        {
            InitializeParticles();

            timer = new DispatcherTimer(DispatcherPriority.Render);
            timer.Interval = TimeSpan.FromMilliseconds(20);
            timer.Tick += Timer_Tick;
            timer.Start();
        }

        private void InitializeParticles()
        {
            particles.Clear();
            double w = this.ActualWidth > 0 ? this.ActualWidth : 1100;
            double h = this.ActualHeight > 0 ? this.ActualHeight : 780;

            for (int i = 0; i < maxParticles; i++)
            {
                var p = CreateNewParticle(w, h, true);
                particles.Add(p);
            }
        }

        private Particle CreateNewParticle(double width, double height, bool randomPos = false)
        {
            double px = rnd.NextDouble() * width;
            double py = randomPos ? rnd.NextDouble() * height : height + 10;
            double size = rnd.NextDouble() * 3.5 + 1.2;
            double opacity = rnd.NextDouble() * 0.6 + 0.2;

            Color starColor = Color.FromRgb(255, 255, 255);
            double colorRoll = rnd.NextDouble();
            if (colorRoll < 0.15) starColor = Color.FromRgb(165, 220, 255); 
            else if (colorRoll < 0.25) starColor = Color.FromRgb(255, 220, 180); 

            var brush = new SolidColorBrush(Color.FromArgb((byte)(opacity * 255), starColor.R, starColor.G, starColor.B));
            brush.Freeze();

            return new Particle
            {
                BaseX = px,
                BaseY = py,
                X = px,
                Y = py,
                Vx = (rnd.NextDouble() - 0.5) * 0.2, 
                Vy = -rnd.NextDouble() * 0.3 - 0.1, 
                Size = size,
                Opacity = opacity,
                SpeedFactor = rnd.NextDouble() * 0.05 + 0.03, 
                Brush = brush
            };
        }

        private void ParticleCanvas_Unloaded(object sender, RoutedEventArgs e)
        {
            if (timer != null)
            {
                timer.Stop();
                timer = null;
            }
        }

        private void Timer_Tick(object sender, EventArgs e)
        {
            double w = this.ActualWidth;
            double h = this.ActualHeight;
            if (w == 0 || h == 0) return;

            Point mousePos = new Point(-9999, -9999);
            try
            {
                Window parentWindow = Window.GetWindow(this);
                if (parentWindow != null)
                {
                    if (parentWindow.WindowState == WindowState.Minimized || !parentWindow.IsVisible)
                    {
                        return; // Skip animation calculations and invalidation when minimized/hidden
                    }

                    if (parentWindow.IsActive)
                    {
                        Point rawMouse = System.Windows.Input.Mouse.GetPosition(this);
                        if (rawMouse.X >= 0 && rawMouse.X <= w && rawMouse.Y >= 0 && rawMouse.Y <= h)
                        {
                            mousePos = rawMouse;
                        }
                    }
                }
            }
            catch {}

            for (int i = 0; i < particles.Count; i++)
            {
                var p = particles[i];

                p.BaseX += p.Vx;
                p.BaseY += p.Vy;

                if (p.BaseY < -10) { p.BaseY = h + 10; p.BaseX = rnd.NextDouble() * w; }
                if (p.BaseX < -10) p.BaseX = w + 10;
                if (p.BaseX > w + 10) p.BaseX = -10;

                double targetX = p.BaseX;
                double targetY = p.BaseY;

                if (mousePos.X > -5000)
                {
                    double dx = mousePos.X - p.BaseX;
                    double dy = mousePos.Y - p.BaseY;
                    double dist = Math.Sqrt(dx * dx + dy * dy);

                    if (dist < 180)
                    {
                        double force = (180 - dist) / 180; 
                        double pullDist = force * 35;       
                        targetX = p.BaseX + (dx / dist) * pullDist;
                        targetY = p.BaseY + (dy / dist) * pullDist;
                    }
                }

                p.X += (targetX - p.X) * p.SpeedFactor;
                p.Y += (targetY - p.Y) * p.SpeedFactor;
            }

            this.InvalidateVisual();
        }

        protected override void OnRender(DrawingContext dc)
        {
            double w = this.ActualWidth;
            double h = this.ActualHeight;
            if (w == 0 || h == 0) return;

            // bgBrush background removed to allow transparent window rounded corners
            // dc.DrawRectangle(bgBrush, null, new Rect(0, 0, w, h));

            double t = DateTime.Now.TimeOfDay.TotalSeconds;

            // Nebula 1 (Purple)
            double x1 = -150 + 300 + Math.Sin(t * 0.05) * 30;
            double y1 = -150 + 300 + Math.Cos(t * 0.04) * 30;
            dc.DrawEllipse(nebula1Brush, null, new Point(x1, y1), 300, 300);

            // Nebula 2 (Blue)
            double x2 = w - 500 + 350 + Math.Cos(t * 0.03) * 40;
            double y2 = 100 + 350 + Math.Sin(t * 0.04) * 40;
            dc.DrawEllipse(nebula2Brush, null, new Point(x2, y2), 350, 350);

            // Nebula 3 (Cyan)
            double x3 = 100 + 250;
            double y3 = 300 + 250;
            dc.DrawEllipse(nebula3Brush, null, new Point(x3, y3), 250, 250);

            // Draw particles
            for (int i = 0; i < particles.Count; i++)
            {
                var p = particles[i];
                dc.DrawEllipse(p.Brush, null, new Point(p.X, p.Y), p.Size / 2, p.Size / 2);
            }
        }
    }

    public static class WindowHelper
    {
        [DllImport("user32.dll")]
        private static extern int SetWindowCompositionAttribute(IntPtr hwnd, ref WindowCompositionAttributeData data);

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

        public static void DisableWindowShadow(Window w)
        {
            try
            {
                var helper = new System.Windows.Interop.WindowInteropHelper(w);
                var handle = helper.Handle;
                if (handle == IntPtr.Zero)
                {
                    handle = helper.EnsureHandle();
                }
                int val = 1; // DWMNCRP_DISABLED
                DwmSetWindowAttribute(handle, 2, ref val, sizeof(int)); // DWMWA_NCRENDERING_POLICY = 2

                int disableTransitions = 1;
                DwmSetWindowAttribute(handle, 3, ref disableTransitions, sizeof(int)); // DWMWA_TRANSITIONS_FORCEDISABLED = 3
            }
            catch {}
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct WindowCompositionAttributeData
        {
            public WindowCompositionAttribute Attribute;
            public IntPtr Data;
            public int SizeOfData;
        }

        private enum WindowCompositionAttribute
        {
            WCA_ACCENT_POLICY = 19
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct AccentPolicy
        {
            public AccentState AccentState;
            public int AccentFlags;
            public int GradientColor;
            public int AnimationId;
        }

        private enum AccentState
        {
            ACCENT_DISABLED = 0,
            ACCENT_ENABLE_GRADIENT = 1,
            ACCENT_ENABLE_TRANSPARENTGRADIENT = 2,
            ACCENT_ENABLE_BLURBEHIND = 3,
            ACCENT_ENABLE_ACRYLICBLURBEHIND = 4,
            ACCENT_INVALID_STATE = 5
        }

        public static void EnableBlur(Window w, bool acrylic = false)
        {
            try
            {
                var helper = new System.Windows.Interop.WindowInteropHelper(w);
                var handle = helper.Handle;

                var accent = new AccentPolicy();
                accent.AccentState = acrylic ? AccentState.ACCENT_ENABLE_ACRYLICBLURBEHIND : AccentState.ACCENT_ENABLE_BLURBEHIND;
                accent.GradientColor = 0x01000000; // Transparent background style

                int size = Marshal.SizeOf(accent);
                IntPtr accentPtr = Marshal.AllocHGlobal(size);
                Marshal.StructureToPtr(accent, accentPtr, false);

                var data = new WindowCompositionAttributeData();
                data.Attribute = WindowCompositionAttribute.WCA_ACCENT_POLICY;
                data.SizeOfData = size;
                data.Data = accentPtr;

                SetWindowCompositionAttribute(handle, ref data);
                Marshal.FreeHGlobal(accentPtr);
            }
            catch {}
        }
    }

    public static class ThemeManager
    {
        public static event Action<Color> AccentChanged;

        private static Color _currentAccent = Color.FromRgb(88, 101, 242);
        public static Color CurrentAccent { get { return _currentAccent; } }

        public static void ApplyAccent(string hexColor)
        {
            try
            {
                Color c = (Color)System.Windows.Media.ColorConverter.ConvertFromString(hexColor);
                _currentAccent = c;
                AppSettings.AccentHex = hexColor;

                // Update the global AccentBrush resource if accessible
                if (Application.Current != null && Application.Current.Resources.Contains("AccentBrush"))
                {
                    Application.Current.Resources["AccentBrush"] = new SolidColorBrush(c);
                }

                if (AccentChanged != null) AccentChanged(c);
            }
            catch {}
        }

        /// <summary>
        /// Returns White or a dark color depending on the luminance of the given background.
        /// Ensures text is always readable regardless of background.
        /// </summary>
        public static SolidColorBrush ContrastText(Color background)
        {
            // Perceived luminance formula (ITU-R BT.709)
            double lum = 0.2126 * (background.R / 255.0)
                       + 0.7152 * (background.G / 255.0)
                       + 0.0722 * (background.B / 255.0);
            return lum > 0.4
                ? new SolidColorBrush(Color.FromRgb(15, 15, 20))   // dark text on light bg
                : Brushes.White;                                      // white text on dark bg
        }

        public static SolidColorBrush ContrastText(string hexColor)
        {
            try
            {
                Color c = (Color)System.Windows.Media.ColorConverter.ConvertFromString(hexColor);
                return ContrastText(c);
            }
            catch { return Brushes.White; }
        }
    }

    /// <summary>
    /// Interactive background grid with spotlight effect tracking mouse movements.
    /// </summary>
    public class DynamicSpotlightGrid : Grid
    {
        private Border spotlightGlow;
        private TranslateTransform spotlightTransform;

        public DynamicSpotlightGrid()
        {
            this.Background = new SolidColorBrush(Color.FromRgb(3, 4, 8));

            spotlightGlow = new Border();
            spotlightGlow.Width = 600;
            spotlightGlow.Height = 600;
            spotlightGlow.HorizontalAlignment = HorizontalAlignment.Left;
            spotlightGlow.VerticalAlignment = VerticalAlignment.Top;
            spotlightGlow.IsHitTestVisible = false;
            spotlightGlow.Opacity = 0.16;

            spotlightTransform = new TranslateTransform(-300, -300);
            spotlightGlow.RenderTransform = spotlightTransform;

            this.Children.Add(spotlightGlow);

            this.MouseMove += DynamicSpotlightGrid_MouseMove;
            this.Loaded += DynamicSpotlightGrid_Loaded;
            ThemeManager.AccentChanged += ThemeManager_AccentChanged;
        }

        private void DynamicSpotlightGrid_Loaded(object sender, RoutedEventArgs e)
        {
            UpdateSpotlightColor(ThemeManager.CurrentAccent);
        }

        private void ThemeManager_AccentChanged(Color accentColor)
        {
            UpdateSpotlightColor(accentColor);
        }

        public void UpdateSpotlightColor(Color accentColor)
        {
            try
            {
                var brush = new RadialGradientBrush();
                brush.GradientStops.Add(new GradientStop(accentColor, 0));
                brush.GradientStops.Add(new GradientStop(Color.FromArgb(0, 0, 0, 0), 1));
                spotlightGlow.Background = brush;
            }
            catch {}
        }

        private void DynamicSpotlightGrid_MouseMove(object sender, System.Windows.Input.MouseEventArgs e)
        {
            try
            {
                Point p = e.GetPosition(this);
                spotlightTransform.X = p.X - 300;
                spotlightTransform.Y = p.Y - 300;
            }
            catch {}
        }
    }

    /// <summary>
    /// Hardware-accelerated circular progress vector ring.
    /// </summary>
    public class CircularProgress : FrameworkElement
    {
        public static readonly DependencyProperty ValueProperty =
            DependencyProperty.Register("Value", typeof(double), typeof(CircularProgress),
                new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsRender));

        public double Value
        {
            get { return (double)GetValue(ValueProperty); }
            set { SetValue(ValueProperty, value); }
        }

        public static readonly DependencyProperty StrokeThicknessProperty =
            DependencyProperty.Register("StrokeThickness", typeof(double), typeof(CircularProgress),
                new FrameworkPropertyMetadata(6.0, FrameworkPropertyMetadataOptions.AffectsRender));

        public double StrokeThickness
        {
            get { return (double)GetValue(StrokeThicknessProperty); }
            set { SetValue(StrokeThicknessProperty, value); }
        }

        public static readonly DependencyProperty IndicatorBrushProperty =
            DependencyProperty.Register("IndicatorBrush", typeof(Brush), typeof(CircularProgress),
                new FrameworkPropertyMetadata(Brushes.DodgerBlue, FrameworkPropertyMetadataOptions.AffectsRender));

        public Brush IndicatorBrush
        {
            get { return (Brush)GetValue(IndicatorBrushProperty); }
            set { SetValue(IndicatorBrushProperty, value); }
        }

        protected override void OnRender(DrawingContext dc)
        {
            double size = Math.Min(RenderSize.Width, RenderSize.Height);
            if (size <= 0) return;

            double radius = (size - StrokeThickness) / 2;
            Point center = new Point(RenderSize.Width / 2, RenderSize.Height / 2);

            // Background circle track (dark translucent)
            var trackPen = new Pen(new SolidColorBrush(Color.FromArgb(20, 255, 255, 255)), StrokeThickness);
            dc.DrawEllipse(null, trackPen, center, radius, radius);

            // Foreground progress arc
            double angle = 360.0 * (Math.Max(0.0, Math.Min(100.0, Value)) / 100.0);
            if (angle > 0)
            {
                if (angle >= 360)
                {
                    var progressPen = new Pen(IndicatorBrush, StrokeThickness);
                    dc.DrawEllipse(null, progressPen, center, radius, radius);
                }
                else
                {
                    var progressPen = new Pen(IndicatorBrush, StrokeThickness);
                    var geometry = new StreamGeometry();
                    using (var context = geometry.Open())
                    {
                        double radAngle = (angle - 90.0) * Math.PI / 180.0;
                        Point startPoint = new Point(center.X, center.Y - radius);
                        Point endPoint = new Point(center.X + radius * Math.Cos(radAngle), center.Y + radius * Math.Sin(radAngle));

                        context.BeginFigure(startPoint, false, false);
                        context.ArcTo(endPoint, new Size(radius, radius), 0, angle > 180, SweepDirection.Clockwise, true, false);
                    }
                    geometry.Freeze();
                    dc.DrawGeometry(null, progressPen, geometry);
                }
            }
        }
    }
}
