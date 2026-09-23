using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using System.Windows.Threading;

namespace PavoTweak
{
    /// <summary>
    /// Full-window premium animated background layer.
    /// Inherits Grid so it auto-fills its host ContentControl.
    /// IsHitTestVisible = False — never intercepts mouse clicks.
    /// Loaded once at startup as a singleton and reused across all pages.
    /// </summary>
    public class PremiumBackground : Grid
    {
        // ── Singleton ───────────────────────────────────────────────────────────
        private static PremiumBackground _instance;
        public static PremiumBackground GetInstance()
        {
            if (_instance == null) _instance = new PremiumBackground();
            return _instance;
        }

        // ── Background image filename ────────────────────────────────────────────
        private const string BG_FILE = "moving-hexagons-illuminated-in-blue-light-infinitely-looped-animation-video.jpg";

        // ── Internal layer references ────────────────────────────────────────────
        private Image           _bgImage;           // the hexagon photo
        private Border          _blueOverlay;       // subtle blue gradient tint
        private Border          _glowPulse;         // breathing radial glow
        private Canvas          _starLayer;         // tiny twinkling stars
        private Canvas          _particleLayer;     // floating particles
        private TranslateTransform _parallaxXform;  // mouse-parallax offset

        // ── Animation data ───────────────────────────────────────────────────────
        private readonly List<StarInfo>     _stars     = new List<StarInfo>();
        private readonly List<ParticleInfo> _particles = new List<ParticleInfo>();
        private DispatcherTimer             _ticker;
        private readonly Random             _rng       = new Random();
        private double _t = 0;                      // global time accumulator

        // ── Parallax target (smoothly lerped) ───────────────────────────────────
        private double _tgtX, _tgtY;
        private double _curX, _curY;

        // ── Counts ───────────────────────────────────────────────────────────────
        private const int STAR_COUNT     = 60;
        private const int PARTICLE_COUNT = 20;

        // ────────────────────────────────────────────────────────────────────────
        private PremiumBackground()
        {
            IsHitTestVisible = false;
            ClipToBounds     = true;
            Background       = Brushes.Transparent;

            // Build layers from bottom (index 0) to top
            _AddImageLayer();
            _AddBlueOverlay();
            _AddGlowPulse();

            _starLayer = _MakeCanvas();
            Children.Add(_starLayer);

            _particleLayer = _MakeCanvas();
            Children.Add(_particleLayer);

            // Wire up resize + start animations once the control is in the tree
            SizeChanged += (s, e) => _OnSized(ActualWidth, ActualHeight);

            Loaded += (s, e) =>
            {
                // Attach mouse-move parallax to the parent Window
                var win = Window.GetWindow(this);
                if (win != null) win.MouseMove += _OnMouseMove;

                _StartBreathingGlow();
                _StartTicker();
            };

            Unloaded += (s, e) =>
            {
                var win = Window.GetWindow(this);
                if (win != null) win.MouseMove -= _OnMouseMove;
            };
        }

        // ── Layer builders ───────────────────────────────────────────────────────

        private void _AddImageLayer()
        {
            _parallaxXform = new TranslateTransform(0, 0);

            // Load ONCE from embedded resource (works for all users without external files)
            BitmapImage bmp = _LoadEmbeddedBitmap(BG_FILE);

            _bgImage = new Image
            {
                Source                = bmp,
                Stretch               = Stretch.UniformToFill,
                HorizontalAlignment   = HorizontalAlignment.Stretch,
                VerticalAlignment     = VerticalAlignment.Stretch,
                Opacity               = 0.18,             // 18% — visible but text stays readable
                IsHitTestVisible      = false,
                RenderTransformOrigin = new Point(0.5, 0.5),
                RenderTransform       = _parallaxXform,
            };
            // Very mild blur for dreamy softness
            _bgImage.Effect = new BlurEffect
            {
                Radius        = 1.2,
                RenderingBias = RenderingBias.Performance,
            };
            Children.Add(_bgImage);
        }

        private void _AddBlueOverlay()
        {
            _blueOverlay = new Border
            {
                IsHitTestVisible    = false,
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment   = VerticalAlignment.Stretch,
                Opacity             = 0.28,
                Background          = new LinearGradientBrush(
                    new GradientStopCollection
                    {
                        new GradientStop(Color.FromArgb(70,  5,  20,  80), 0.0),
                        new GradientStop(Color.FromArgb(20,  0,   5,  30), 0.5),
                        new GradientStop(Color.FromArgb(55, 10,  25,  90), 1.0),
                    },
                    new Point(0, 0), new Point(1, 1))
            };
            Children.Add(_blueOverlay);
        }

        private void _AddGlowPulse()
        {
            _glowPulse = new Border
            {
                IsHitTestVisible    = false,
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment   = VerticalAlignment.Stretch,
                Opacity             = 0,
                Background          = new RadialGradientBrush(
                    new GradientStopCollection
                    {
                        new GradientStop(Color.FromArgb(70, 59, 130, 246), 0.0),
                        new GradientStop(Color.FromArgb(0,   0,   0,   0), 1.0),
                    })
                {
                    Center         = new Point(0.5, 0.5),
                    RadiusX        = 0.5,
                    RadiusY        = 0.5,
                    GradientOrigin = new Point(0.5, 0.5),
                    MappingMode    = BrushMappingMode.RelativeToBoundingBox,
                }
            };
            Children.Add(_glowPulse);
        }

        private static Canvas _MakeCanvas()
        {
            return new Canvas
            {
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment   = VerticalAlignment.Stretch,
                IsHitTestVisible    = false,
            };
        }

        // ── Resize ───────────────────────────────────────────────────────────────

        private void _OnSized(double w, double h)
        {
            if (w < 1 || h < 1) return;

            // Oversize the image by 6% for parallax headroom
            double iw = w * 1.06, ih = h * 1.06;
            _bgImage.Width  = iw;
            _bgImage.Height = ih;
            // Centre the oversized image
            _bgImage.Margin = new Thickness(-(iw - w) / 2, -(ih - h) / 2,
                                             -(iw - w) / 2, -(ih - h) / 2);

            _starLayer.Width     = w; _starLayer.Height     = h;
            _particleLayer.Width = w; _particleLayer.Height = h;

            _RebuildStars(w, h);
            _RebuildParticles(w, h);
        }

        // ── Stars ────────────────────────────────────────────────────────────────

        private void _RebuildStars(double w, double h)
        {
            _starLayer.Children.Clear();
            _stars.Clear();

            for (int i = 0; i < STAR_COUNT; i++)
            {
                double sz = _rng.NextDouble() * 2.2 + 0.5;
                double op = _rng.NextDouble() * 0.32 + 0.06;
                byte   bl = (byte)(_rng.Next(180, 255));

                var dot = new Ellipse
                {
                    Width            = sz,
                    Height           = sz,
                    Fill             = new SolidColorBrush(Color.FromRgb(bl, bl, 255)),
                    Opacity          = op,
                    IsHitTestVisible = false,
                };
                double x = _rng.NextDouble() * w;
                double y = _rng.NextDouble() * h;
                Canvas.SetLeft(dot, x);
                Canvas.SetTop (dot, y);
                _starLayer.Children.Add(dot);

                _stars.Add(new StarInfo
                {
                    Shape   = dot,
                    BaseOp  = op,
                    Phase   = _rng.NextDouble() * Math.PI * 2,
                    Speed   = _rng.NextDouble() * 0.55 + 0.15,
                });
            }
        }

        // ── Particles ────────────────────────────────────────────────────────────

        private void _RebuildParticles(double w, double h)
        {
            _particleLayer.Children.Clear();
            _particles.Clear();

            for (int i = 0; i < PARTICLE_COUNT; i++)
            {
                double sz = _rng.NextDouble() * 5.5 + 1.5;
                double op = _rng.NextDouble() * 0.16 + 0.03;
                double angle = _rng.NextDouble() * Math.PI * 2;
                double spd   = _rng.NextDouble() * 0.22 + 0.04;

                Color c = (_rng.Next(2) == 0)
                    ? Color.FromRgb(59, 130, 246)
                    : Color.FromRgb(190, 215, 255);

                var dot = new Ellipse
                {
                    Width            = sz,
                    Height           = sz,
                    Fill             = new SolidColorBrush(c),
                    Opacity          = op,
                    IsHitTestVisible = false,
                };
                double x = _rng.NextDouble() * w;
                double y = _rng.NextDouble() * h;
                Canvas.SetLeft(dot, x);
                Canvas.SetTop (dot, y);
                _particleLayer.Children.Add(dot);

                _particles.Add(new ParticleInfo
                {
                    Shape  = dot,
                    X      = x, Y = y,
                    VX     = Math.Cos(angle) * spd,
                    VY     = Math.Sin(angle) * spd,
                    BaseOp = op,
                    Phase  = _rng.NextDouble() * Math.PI * 2,
                    OpSpd  = _rng.NextDouble() * 0.40 + 0.12,
                });
            }
        }

        // ── 60-FPS ticker ─────────────────────────────────────────────────────────

        private void _StartTicker()
        {
            _ticker = new DispatcherTimer(DispatcherPriority.Render)
            {
                Interval = TimeSpan.FromMilliseconds(16)  // ~60 fps
            };
            _ticker.Tick += _Tick;
            _ticker.Start();
        }

        private void _Tick(object sender, EventArgs e)
        {
            _t += 0.016;

            // ─ Smooth parallax lerp ─────────────────────────────
            _curX += (_tgtX - _curX) * 0.05;
            _curY += (_tgtY - _curY) * 0.05;
            _parallaxXform.X = _curX;
            _parallaxXform.Y = _curY;

            // ─ Stars: twinkle ────────────────────────────────────
            foreach (var s in _stars)
                s.Shape.Opacity = s.BaseOp * (0.45 + 0.55 * Math.Sin(_t * s.Speed + s.Phase));

            // ─ Particles: float + breathe ────────────────────────
            double W = _particleLayer.ActualWidth;
            double H = _particleLayer.ActualHeight;
            if (W < 1 || H < 1) return;

            foreach (var p in _particles)
            {
                p.X += p.VX;
                p.Y += p.VY;

                // wrap edges
                if (p.X < -8)    p.X = W + 4;
                if (p.X > W + 8) p.X = -4;
                if (p.Y < -8)    p.Y = H + 4;
                if (p.Y > H + 8) p.Y = -4;

                Canvas.SetLeft(p.Shape, p.X);
                Canvas.SetTop (p.Shape, p.Y);

                double f = _t * p.OpSpd + p.Phase;
                p.Shape.Opacity = p.BaseOp * (0.35 + 0.65 * Math.Abs(Math.Sin(f)));
            }
        }

        // ── Breathing glow (XAML storyboard on the radial overlay) ───────────────

        private void _StartBreathingGlow()
        {
            var anim = new DoubleAnimation
            {
                From           = 0.0,
                To             = 0.60,
                Duration       = TimeSpan.FromSeconds(4.0),
                AutoReverse    = true,
                RepeatBehavior = RepeatBehavior.Forever,
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
            };
            _glowPulse.BeginAnimation(OpacityProperty, anim);
        }

        // ── Mouse parallax ────────────────────────────────────────────────────────

        private void _OnMouseMove(object sender, MouseEventArgs e)
        {
            var win = sender as Window;
            if (win == null) return;
            Point p = e.GetPosition(win);
            // Map to -1..+1 relative to window center, scale to ±10px headroom
            _tgtX = (p.X / Math.Max(win.ActualWidth,  1) - 0.5) * 10.0;
            _tgtY = (p.Y / Math.Max(win.ActualHeight, 1) - 0.5) *  7.0;
        }

        // ── Helpers ──────────────────────────────────────────────────────────────

        /// <summary>
        /// Loads a BitmapImage first from the embedded assembly resource,
        /// then falls back to the filesystem next to the exe.
        /// </summary>
        private static BitmapImage _LoadEmbeddedBitmap(string resourceName)
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

            // 2. Fallback: load from file next to exe
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

        // ── Animation state ───────────────────────────────────────────────────────

        private class StarInfo
        {
            public Ellipse Shape;
            public double BaseOp, Phase, Speed;
        }

        private class ParticleInfo
        {
            public Ellipse Shape;
            public double X, Y, VX, VY;
            public double BaseOp, Phase, OpSpd;
        }
    }
}
