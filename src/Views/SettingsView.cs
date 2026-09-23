using System;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Markup;
using System.Xml;

namespace PavoTweak
{
    public class SettingsView : Grid
    {
        // ─── Category panel references ───────────────────────────────
        private StackPanel panelGeneral;
        private StackPanel panelAppearance;
        private StackPanel panelPerformance;
        private StackPanel panelAudio;
        private StackPanel panelAdvanced;

        // ─── Active category ────────────────────────────────────────
        private string _activeCategory = "general";
        private Border _activeCatIndicator;

        // ─── Language refs ───────────────────────────────────────────
        private TextBlock lblPageTitle;
        private Button btnCatGeneral, btnCatAppearance, btnCatPerformance, btnCatAudio, btnCatAdvanced;

        // ─── Setting controls ────────────────────────────────────────
        private CheckBox cbStartWithWindows;
        private CheckBox cbMinimizeToTray;
        private CheckBox cbCheckUpdates;
        private CheckBox cbNotifications;
        private CheckBox cbSoundsEnabled;
        private CheckBox cbClickSound;
        private CheckBox cbHoverSound;
        private CheckBox cbHwAccel;
        private CheckBox cbGpuRender;
        private CheckBox cbMemOpt;
        private CheckBox cbDevMode;
        private CheckBox cbExperimental;
        private Slider slVolume;
        private Slider slUIScale;
        private Slider slFpsLimit;

        // Accent color swatch borders
        private Border swBlue, swPurple, swCyan, swGreen, swOrange, swRed, swPink;
        private Border _selectedSwatch;

        // Language buttons
        private Button btnLangIT, btnLangEN;

        // Theme buttons
        private Button btnThemeDark, btnThemeSoft, btnThemeSystem;

        public SettingsView()
        {
            BuildUI();
            LoadCurrentValues();
            Lang.LanguageChanged += RefreshLanguage;
            AppSettings.SettingsChanged += LoadCurrentValues;
        }

        // ════════════════════════════════════════════════════════════════
        //  BUILD UI
        // ════════════════════════════════════════════════════════════════
        private void BuildUI()
        {
            this.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(180) });
            this.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            // ── LEFT NAV ────────────────────────────────────────────────
            var nav = BuildCategoryNav();
            Grid.SetColumn(nav, 0);
            this.Children.Add(nav);

            // ── RIGHT CONTENT ───────────────────────────────────────────
            var content = BuildContent();
            Grid.SetColumn(content, 1);
            this.Children.Add(content);
        }

        private Grid BuildCategoryNav()
        {
            var nav = new Grid();
            nav.Background = new SolidColorBrush(Color.FromArgb(255, 6, 8, 15));

            var border = new Border
            {
                BorderBrush     = new SolidColorBrush(Color.FromArgb(255, 13, 20, 40)),
                BorderThickness = new Thickness(0, 0, 1, 0)
            };
            nav.Children.Add(border);

            var sp = new StackPanel { Margin = new Thickness(0, 12, 0, 0) };

            var header = new TextBlock
            {
                Text       = "⚙",
                FontSize   = 22,
                Foreground = Brushes.White,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin     = new Thickness(0, 0, 0, 16)
            };
            sp.Children.Add(header);

            lblPageTitle = new TextBlock
            {
                Text       = Lang.Get("settings.title"),
                FontSize   = 10,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(124, 92, 252)),
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin     = new Thickness(0, 0, 0, 20)
            };
            sp.Children.Add(lblPageTitle);

            btnCatGeneral     = MakeCatButton(Lang.Get("settings.general"),    "general");
            btnCatAppearance  = MakeCatButton(Lang.Get("settings.appearance"), "appearance");
            btnCatPerformance = MakeCatButton(Lang.Get("settings.performance"),"performance");
            btnCatAudio       = MakeCatButton(Lang.Get("settings.audio"),      "audio");
            btnCatAdvanced    = MakeCatButton(Lang.Get("settings.advanced"),   "advanced");

            sp.Children.Add(btnCatGeneral);
            sp.Children.Add(btnCatAppearance);
            sp.Children.Add(btnCatPerformance);
            sp.Children.Add(btnCatAudio);
            sp.Children.Add(btnCatAdvanced);

            nav.Children.Add(sp);
            SetActiveCategory("general");
            return nav;
        }

        private Button MakeCatButton(string text, string category)
        {
            var btn = new Button
            {
                Content             = text,
                HorizontalContentAlignment = HorizontalAlignment.Left,
                Padding             = new Thickness(20, 10, 10, 10),
                Background          = Brushes.Transparent,
                BorderThickness     = new Thickness(3, 0, 0, 0),
                BorderBrush         = Brushes.Transparent,
                Foreground          = new SolidColorBrush(Color.FromRgb(107, 115, 153)),
                FontSize            = 12,
                FontWeight          = FontWeights.SemiBold,
                Cursor              = System.Windows.Input.Cursors.Hand,
                Tag                 = category,
                Template            = CreateSidebarButtonTemplate()
            };
            btn.Click += (s, e) => SetActiveCategory(category);
            return btn;
        }

        private ControlTemplate CreateSidebarButtonTemplate()
        {
            var template = new ControlTemplate(typeof(Button));
            var factory = new FrameworkElementFactory(typeof(Border));
            factory.SetValue(Border.NameProperty, "Bd");
            factory.SetBinding(Border.BackgroundProperty,
                new System.Windows.Data.Binding("Background") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
            factory.SetBinding(Border.BorderBrushProperty,
                new System.Windows.Data.Binding("BorderBrush") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
            factory.SetBinding(Border.BorderThicknessProperty,
                new System.Windows.Data.Binding("BorderThickness") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
            factory.SetValue(Border.CornerRadiusProperty, new CornerRadius(0, 8, 8, 0));
            factory.SetValue(Border.MarginProperty, new Thickness(0, 1, 8, 1));

            var presenter = new FrameworkElementFactory(typeof(TextBlock));
            presenter.SetBinding(TextBlock.TextProperty,
                new System.Windows.Data.Binding("Content") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
            presenter.SetBinding(TextBlock.ForegroundProperty,
                new System.Windows.Data.Binding("Foreground") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
            presenter.SetValue(TextBlock.VerticalAlignmentProperty, VerticalAlignment.Center);
            presenter.SetValue(TextBlock.FontFamilyProperty, new FontFamily("Segoe UI Variable Text"));
            presenter.SetValue(TextBlock.FontWeightProperty, FontWeights.Bold);
            presenter.SetValue(TextBlock.MarginProperty, new Thickness(4, 0, 4, 0));
            factory.AppendChild(presenter);

            template.VisualTree = factory;
            return template;
        }

        private void SetActiveCategory(string category)
        {
            _activeCategory = category;

            var btnMap = new[]
            {
                new { Btn = btnCatGeneral,     Cat = "general" },
                new { Btn = btnCatAppearance,  Cat = "appearance" },
                new { Btn = btnCatPerformance, Cat = "performance" },
                new { Btn = btnCatAudio,       Cat = "audio" },
                new { Btn = btnCatAdvanced,    Cat = "advanced" },
            };

            var accentBrush = new SolidColorBrush(Color.FromRgb(124, 92, 252));
            var transparentBrush = Brushes.Transparent;
            var activeFg  = Brushes.White;
            var inactiveFg = new SolidColorBrush(Color.FromRgb(107, 115, 153));

            foreach (var item in btnMap)
            {
                bool isActive = item.Cat == category;
                item.Btn.BorderBrush  = isActive ? accentBrush : transparentBrush;
                item.Btn.Foreground   = isActive ? activeFg   : inactiveFg;
                item.Btn.Background   = isActive ? new SolidColorBrush(Color.FromArgb(20, 255, 255, 255)) : Brushes.Transparent;
            }

            UIElement targetPanel = null;
            if (category == "general") targetPanel = panelGeneral;
            else if (category == "appearance") targetPanel = panelAppearance;
            else if (category == "performance") targetPanel = panelPerformance;
            else if (category == "audio") targetPanel = panelAudio;
            else if (category == "advanced") targetPanel = panelAdvanced;

            var panels = new[] { panelGeneral, panelAppearance, panelPerformance, panelAudio, panelAdvanced };
            foreach (var p in panels)
            {
                if (p != null)
                {
                    if (p == targetPanel)
                    {
                        p.Visibility = Visibility.Visible;

                        var translate = new TranslateTransform(0, 12);
                        p.RenderTransform = translate;
                        p.RenderTransformOrigin = new Point(0.5, 0.5);

                        var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(220));
                        var slideUp = new DoubleAnimation(12, 0, TimeSpan.FromMilliseconds(220));

                        var ease = new QuarticEase { EasingMode = EasingMode.EaseOut };
                        fadeIn.EasingFunction = ease;
                        slideUp.EasingFunction = ease;

                        Timeline.SetDesiredFrameRate(fadeIn, 120);
                        Timeline.SetDesiredFrameRate(slideUp, 120);

                        p.BeginAnimation(UIElement.OpacityProperty, fadeIn);
                        translate.BeginAnimation(TranslateTransform.YProperty, slideUp);
                    }
                    else
                    {
                        p.Visibility = Visibility.Collapsed;
                        p.Opacity = 0;
                        p.RenderTransform = null;
                    }
                }
            }
        }

        // ── CONTENT AREA ─────────────────────────────────────────────
        private Grid BuildContent()
        {
            var g = new Grid();

            var sv = new ScrollViewer
            {
                VerticalScrollBarVisibility   = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                Margin  = new Thickness(20, 16, 10, 16)
            };

            var container = new StackPanel();

            panelGeneral     = BuildGeneralPanel();
            panelAppearance  = BuildAppearancePanel();
            panelPerformance = BuildPerformancePanel();
            panelAudio       = BuildAudioPanel();
            panelAdvanced    = BuildAdvancedPanel();

            panelGeneral.Visibility     = Visibility.Visible;
            panelAppearance.Visibility  = Visibility.Collapsed;
            panelPerformance.Visibility = Visibility.Collapsed;
            panelAudio.Visibility       = Visibility.Collapsed;
            panelAdvanced.Visibility    = Visibility.Collapsed;

            container.Children.Add(panelGeneral);
            container.Children.Add(panelAppearance);
            container.Children.Add(panelPerformance);
            container.Children.Add(panelAudio);
            container.Children.Add(panelAdvanced);

            sv.Content = container;
            g.Children.Add(sv);
            return g;
        }

        // ════════════════════════════════════════════════════════════════
        //  PANELS
        // ════════════════════════════════════════════════════════════════

        // ── GENERAL ─────────────────────────────────────────────────────
        private StackPanel BuildGeneralPanel()
        {
            var sp = new StackPanel();

            sp.Children.Add(SectionHeader(Lang.Get("settings.language")));

            // Language buttons row
            var langRow = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 20) };
            btnLangIT = MakeToggleButton(Lang.Get("settings.lang.it"), AppSettings.Language == AppLanguage.Italian);
            btnLangEN = MakeToggleButton(Lang.Get("settings.lang.en"), AppSettings.Language == AppLanguage.English);
            btnLangIT.Click += (s, e) => {
                SoundManager.PlayClick();
                AppSettings.Language = AppLanguage.Italian;
                Lang.Current = AppLanguage.Italian;
                SetLangActive(AppLanguage.Italian);
                AppSettings.Save();
                MainWindow.Instance.ShowToast(Lang.Get("toast.lang.changed"));
            };
            btnLangEN.Click += (s, e) => {
                SoundManager.PlayClick();
                AppSettings.Language = AppLanguage.English;
                Lang.Current = AppLanguage.English;
                SetLangActive(AppLanguage.English);
                AppSettings.Save();
                MainWindow.Instance.ShowToast(Lang.Get("toast.lang.changed"));
            };
            langRow.Children.Add(btnLangIT);
            btnLangEN.Margin = new Thickness(8, 0, 0, 0);
            langRow.Children.Add(btnLangEN);
            sp.Children.Add(langRow);

            sp.Children.Add(SectionHeader(Lang.Get("settings.general")));
            cbStartWithWindows = MakeCheckbox(Lang.Get("settings.startup"),       AppSettings.StartWithWindows);
            cbMinimizeToTray   = MakeCheckbox(Lang.Get("settings.tray"),          AppSettings.MinimizeToTray);
            cbCheckUpdates     = MakeCheckbox(Lang.Get("settings.updates"),       AppSettings.CheckUpdates);
            cbNotifications    = MakeCheckbox(Lang.Get("settings.notifications"), AppSettings.NotificationsEnabled);
            sp.Children.Add(cbStartWithWindows);
            sp.Children.Add(cbMinimizeToTray);
            sp.Children.Add(cbCheckUpdates);
            sp.Children.Add(cbNotifications);

            sp.Children.Add(MakeSaveButton());
            return sp;
        }

        // ── APPEARANCE ───────────────────────────────────────────────────
        private StackPanel BuildAppearancePanel()
        {
            var sp = new StackPanel();

            sp.Children.Add(SectionHeader(Lang.Get("settings.theme")));

            var themeRow = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 20) };
            btnThemeDark   = MakeToggleButton(Lang.Get("settings.theme.dark"),   AppSettings.Theme == AppTheme.Dark);
            btnThemeSoft   = MakeToggleButton(Lang.Get("settings.theme.soft"),   AppSettings.Theme == AppTheme.SoftDark);
            btnThemeSystem = MakeToggleButton(Lang.Get("settings.theme.system"), AppSettings.Theme == AppTheme.System);
            btnThemeSoft.Margin   = new Thickness(8, 0, 0, 0);
            btnThemeSystem.Margin = new Thickness(8, 0, 0, 0);
            btnThemeDark.Click   += (s, e) => { SoundManager.PlayClick(); AppSettings.Theme = AppTheme.Dark;     SetThemeActive(AppTheme.Dark);     };
            btnThemeSoft.Click   += (s, e) => { SoundManager.PlayClick(); AppSettings.Theme = AppTheme.SoftDark; SetThemeActive(AppTheme.SoftDark); };
            btnThemeSystem.Click += (s, e) => { SoundManager.PlayClick(); AppSettings.Theme = AppTheme.System;   SetThemeActive(AppTheme.System);   };
            themeRow.Children.Add(btnThemeDark);
            themeRow.Children.Add(btnThemeSoft);
            themeRow.Children.Add(btnThemeSystem);
            sp.Children.Add(themeRow);

            sp.Children.Add(SectionHeader(Lang.Get("settings.accent")));
            sp.Children.Add(BuildAccentPicker());

            sp.Children.Add(SectionHeader(Lang.Get("settings.uiscale")));
            slUIScale = MakeFluidSlider(0.8, 1.5, AppSettings.UIScale, 0.1, true);
            sp.Children.Add(slUIScale);
            sp.Children.Add(SliderValueLabel(slUIScale, "x"));

            sp.Children.Add(MakeSaveButton());
            return sp;
        }

        private StackPanel BuildAccentPicker()
        {
            var row = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 4, 0, 20) };
            var swatches = new[]
            {
                new { Name = "Blue",   Hex = "#5865F2" },
                new { Name = "Purple", Hex = "#9C27B0" },
                new { Name = "Cyan",   Hex = "#00F2FE" },
                new { Name = "Green",  Hex = "#23A55A" },
                new { Name = "Orange", Hex = "#E18F2E" },
                new { Name = "Red",    Hex = "#F23F43" },
                new { Name = "Pink",   Hex = "#FF6B9D" },
            };
            foreach (var sw in swatches)
            {
                var hex = sw.Hex;
                var b = new Border
                {
                    Width           = 28,
                    Height          = 28,
                    CornerRadius    = new CornerRadius(14),
                    Background      = new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex)),
                    Margin          = new Thickness(0, 0, 8, 0),
                    Cursor          = System.Windows.Input.Cursors.Hand,
                    BorderThickness = new Thickness(AppSettings.AccentHex == hex ? 2.5 : 0),
                    BorderBrush     = Brushes.White,
                    Tag             = hex
                };
                b.MouseLeftButtonUp += (s, e) => {
                    SoundManager.PlayClick();
                    AppSettings.AccentHex = hex;
                    RefreshAccentSwatches(row, hex);
                    ThemeManager.ApplyAccent(hex);
                };
                row.Children.Add(b);
            }
            return new StackPanel { Children = { row } };
        }

        private void RefreshAccentSwatches(StackPanel row, string selectedHex)
        {
            foreach (Border b in row.Children)
            {
                string hex = b.Tag as string;
                b.BorderThickness = new Thickness(hex == selectedHex ? 2.5 : 0);
            }
        }

        // ── PERFORMANCE ──────────────────────────────────────────────────
        private StackPanel BuildPerformancePanel()
        {
            var sp = new StackPanel();

            sp.Children.Add(SectionHeader(Lang.Get("settings.animations")));
            var animRow = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 20) };
            var btnAnimLow    = MakeToggleButton(Lang.Get("settings.anim.low"),    AppSettings.AnimationQuality == AnimQuality.Low);
            var btnAnimNormal = MakeToggleButton(Lang.Get("settings.anim.normal"), AppSettings.AnimationQuality == AnimQuality.Normal);
            var btnAnimHigh   = MakeToggleButton(Lang.Get("settings.anim.high"),   AppSettings.AnimationQuality == AnimQuality.High);
            btnAnimNormal.Margin = new Thickness(8, 0, 0, 0);
            btnAnimHigh.Margin   = new Thickness(8, 0, 0, 0);
            btnAnimLow.Click    += (s, e) => { SoundManager.PlayClick(); AppSettings.AnimationQuality = AnimQuality.Low;    SetAnimActive(btnAnimLow, btnAnimNormal, btnAnimHigh, btnAnimLow); };
            btnAnimNormal.Click += (s, e) => { SoundManager.PlayClick(); AppSettings.AnimationQuality = AnimQuality.Normal; SetAnimActive(btnAnimLow, btnAnimNormal, btnAnimHigh, btnAnimNormal); };
            btnAnimHigh.Click   += (s, e) => { SoundManager.PlayClick(); AppSettings.AnimationQuality = AnimQuality.High;   SetAnimActive(btnAnimLow, btnAnimNormal, btnAnimHigh, btnAnimHigh); };
            animRow.Children.Add(btnAnimLow);
            animRow.Children.Add(btnAnimNormal);
            animRow.Children.Add(btnAnimHigh);
            sp.Children.Add(animRow);

            sp.Children.Add(SectionHeader(Lang.Get("settings.fpslimit")));
            slFpsLimit = MakeFluidSlider(30, 240, AppSettings.FpsLimit, 30, true);
            sp.Children.Add(slFpsLimit);
            sp.Children.Add(SliderValueLabel(slFpsLimit, " FPS"));

            cbHwAccel  = MakeCheckbox(Lang.Get("settings.hwaccel"),  AppSettings.HardwareAcceleration);
            cbGpuRender = MakeCheckbox(Lang.Get("settings.gpurender"), AppSettings.GpuRendering);
            cbMemOpt    = MakeCheckbox(Lang.Get("settings.memopt"),   AppSettings.MemoryOptimization);
            sp.Children.Add(cbHwAccel);
            sp.Children.Add(cbGpuRender);
            sp.Children.Add(cbMemOpt);

            sp.Children.Add(MakeSaveButton());
            return sp;
        }

        // ── AUDIO ────────────────────────────────────────────────────────
        private StackPanel BuildAudioPanel()
        {
            var sp = new StackPanel();

            sp.Children.Add(SectionHeader(Lang.Get("settings.sounds")));
            cbSoundsEnabled = MakeCheckbox(Lang.Get("settings.sounds"),      AppSettings.SoundsEnabled);
            cbClickSound    = MakeCheckbox(Lang.Get("settings.clicksound"),  AppSettings.ClickSoundEnabled);
            cbHoverSound    = MakeCheckbox(Lang.Get("settings.hoversound"),  AppSettings.HoverSoundEnabled);
            sp.Children.Add(cbSoundsEnabled);
            sp.Children.Add(cbClickSound);
            sp.Children.Add(cbHoverSound);

            cbSoundsEnabled.Checked   += (s, e) => SoundManager.Enabled = true;
            cbSoundsEnabled.Unchecked += (s, e) => SoundManager.Enabled = false;

            sp.Children.Add(SectionHeader(Lang.Get("settings.volume")));
            slVolume = MakeFluidSlider(0, 1, AppSettings.Volume, 0.05, false);
            sp.Children.Add(slVolume);
            sp.Children.Add(SliderValueLabel(slVolume, "%", 100));

            sp.Children.Add(MakeSaveButton());
            return sp;
        }

        // ── ADVANCED ─────────────────────────────────────────────────────
        private StackPanel BuildAdvancedPanel()
        {
            var sp = new StackPanel();

            cbDevMode      = MakeCheckbox(Lang.Get("settings.devmode"),      AppSettings.DeveloperMode);
            cbExperimental = MakeCheckbox(Lang.Get("settings.experimental"), AppSettings.ExperimentalFeatures);
            sp.Children.Add(cbDevMode);
            sp.Children.Add(cbExperimental);

            sp.Children.Add(new Border { Height = 16 });

            sp.Children.Add(MakeActionButton(Lang.Get("settings.clearcache"),   "#23A55A", () => {
                SoundManager.PlayClick();
                ClearCache();
                MainWindow.Instance.ShowToast(Lang.Get("toast.cache.cleared"));
            }));

            sp.Children.Add(MakeActionButton(Lang.Get("settings.restorepoint"), "#5865F2", () => {
                SoundManager.PlayClick();
                CreateRestorePoint();
            }));

            sp.Children.Add(MakeActionButton(Lang.Get("settings.export"), "#E18F2E", () => {
                SoundManager.PlayClick();
                ExportSettings();
            }));

            sp.Children.Add(MakeActionButton(Lang.Get("settings.import"), "#9C27B0", () => {
                SoundManager.PlayClick();
                ImportSettings();
            }));

            sp.Children.Add(new Border { Height = 8 });

            sp.Children.Add(MakeActionButton(Lang.Get("settings.reset"), "#F23F43", () => {
                SoundManager.PlayClick();
                AppSettings.ResetToDefaults();
                Lang.Current = AppSettings.Language;
                LoadCurrentValues();
                MainWindow.Instance.ShowToast(Lang.Get("settings.reset.confirm"));
            }));

            sp.Children.Add(MakeSaveButton());
            return sp;
        }

        // ════════════════════════════════════════════════════════════════
        //  HELPERS — UI building
        // ════════════════════════════════════════════════════════════════

        private TextBlock SectionHeader(string text)
        {
            return new TextBlock
            {
                Text       = text,
                FontSize   = 11,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                Margin     = new Thickness(0, 18, 0, 8),
                Opacity    = 0.9
            };
        }

        private CheckBox MakeCheckbox(string text, bool isChecked)
        {
            return new CheckBox
            {
                Content     = new TextBlock { Text = text, Foreground = new SolidColorBrush(Color.FromRgb(209, 213, 219)), FontSize = 12, VerticalAlignment = VerticalAlignment.Center },
                IsChecked   = isChecked,
                Margin      = new Thickness(0, 8, 0, 8),
                Style       = (Style)Application.Current.FindResource("iOSCheckBox"),
                VerticalAlignment = VerticalAlignment.Center
            };
        }

        private Button MakeToggleButton(string text, bool active)
        {
            var accent = Color.FromRgb(88, 101, 242);
            var btn = new Button
            {
                Content         = text,
                Padding         = new Thickness(16, 7, 16, 7),
                BorderThickness = new Thickness(1),
                FontSize        = 11,
                Cursor          = System.Windows.Input.Cursors.Hand,
                Background      = active ? new SolidColorBrush(accent) : new SolidColorBrush(Color.FromArgb(40, 88, 101, 242)),
                BorderBrush     = new SolidColorBrush(active ? accent : Color.FromArgb(80, 88, 101, 242)),
                Foreground      = Brushes.White,
                Template        = CreateRoundedButtonTemplate(6)
            };
            return btn;
        }

        private Button MakeActionButton(string text, string hexColor, Action onClick)
        {
            Color c = (Color)ColorConverter.ConvertFromString(hexColor);
            var btn = new Button
            {
                Content         = text,
                Padding         = new Thickness(16, 9, 16, 9),
                BorderThickness = new Thickness(0),
                FontSize        = 11,
                FontWeight      = FontWeights.SemiBold,
                Cursor          = System.Windows.Input.Cursors.Hand,
                Background      = new SolidColorBrush(Color.FromArgb(40, c.R, c.G, c.B)),
                BorderBrush     = new SolidColorBrush(Color.FromArgb(100, c.R, c.G, c.B)),
                Foreground      = new SolidColorBrush(c),
                Margin          = new Thickness(0, 0, 0, 8),
                Template        = CreateRoundedButtonTemplate(6),
                HorizontalAlignment = HorizontalAlignment.Stretch,
                HorizontalContentAlignment = HorizontalAlignment.Left
            };
            btn.Click += (s, e) => onClick();
            return btn;
        }

        private Button MakeSaveButton()
        {
            var btn = new Button
            {
                Content     = Lang.Get("btn.save"),
                Padding     = new Thickness(24, 9, 24, 9),
                Margin      = new Thickness(0, 20, 0, 4),
                HorizontalAlignment = HorizontalAlignment.Right,
                BorderThickness = new Thickness(0),
                FontSize    = 12,
                FontWeight  = FontWeights.Bold,
                Background  = new SolidColorBrush(Color.FromRgb(88, 101, 242)),
                Foreground  = Brushes.White,
                Cursor      = System.Windows.Input.Cursors.Hand,
                Template    = CreateRoundedButtonTemplate(7)
            };
            btn.Click += (s, e) => SaveSettings();
            return btn;
        }

        private ControlTemplate CreateRoundedButtonTemplate(double radius)
        {
            var template = new ControlTemplate(typeof(Button));
            var factory = new FrameworkElementFactory(typeof(Border));
            factory.SetValue(Border.CornerRadiusProperty, new CornerRadius(radius));
            factory.SetBinding(Border.BackgroundProperty,
                new System.Windows.Data.Binding("Background") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
            factory.SetBinding(Border.BorderBrushProperty,
                new System.Windows.Data.Binding("BorderBrush") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
            factory.SetBinding(Border.BorderThicknessProperty,
                new System.Windows.Data.Binding("BorderThickness") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
            factory.SetBinding(Border.PaddingProperty,
                new System.Windows.Data.Binding("Padding") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
            var presenter = new FrameworkElementFactory(typeof(TextBlock));
            presenter.SetBinding(TextBlock.TextProperty,
                new System.Windows.Data.Binding("Content") { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
            presenter.SetValue(TextBlock.ForegroundProperty, new SolidColorBrush(Colors.White));
            presenter.SetValue(TextBlock.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            presenter.SetValue(TextBlock.VerticalAlignmentProperty, VerticalAlignment.Center);
            presenter.SetValue(TextBlock.FontWeightProperty, FontWeights.Bold);
            factory.AppendChild(presenter);
            template.VisualTree = factory;
            return template;
        }

        private TextBlock SliderValueLabel(Slider slider, string suffix, double multiplier = 1)
        {
            var lbl = new TextBlock
            {
                FontSize   = 10,
                Foreground = new SolidColorBrush(Color.FromRgb(148, 155, 164)),
                Margin     = new Thickness(0, 0, 0, 16)
            };
            lbl.Text = (slider.Value * multiplier).ToString("F0") + suffix;
            slider.ValueChanged += (s, e) =>
                lbl.Text = (slider.Value * multiplier).ToString("F0") + suffix;
            return lbl;
        }

        private Slider MakeFluidSlider(double min, double max, double value, double tick, bool snapToTick)
        {
            string accent = string.IsNullOrEmpty(AppSettings.AccentHex) ? "#5865F2" : AppSettings.AccentHex;

            string xaml = string.Format(
                System.Globalization.CultureInfo.InvariantCulture,
                @"<Slider xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation'
                         xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml'
                         Minimum='{0}' Maximum='{1}' Value='{2}'
                         TickFrequency='{3}' IsSnapToTickEnabled='{4}'
                         Margin='0,0,0,18' Height='20' Cursor='Hand'>
  <Slider.Template>
    <ControlTemplate TargetType='Slider'>
      <Grid>
        <Border Height='6' CornerRadius='3' Background='#1E2340' Margin='0,7,0,7'/>
        <Track x:Name='PART_Track'>
          <Track.DecreaseRepeatButton>
            <RepeatButton Focusable='False'>
              <RepeatButton.Template>
                <ControlTemplate TargetType='RepeatButton'>
                  <Border Height='6' CornerRadius='3,0,0,3' Background='{5}' Margin='0,7,0,7'>
                    <Border.Effect>
                      <DropShadowEffect Color='{5}' BlurRadius='8' Opacity='0.5' ShadowDepth='0'/>
                    </Border.Effect>
                  </Border>
                </ControlTemplate>
              </RepeatButton.Template>
            </RepeatButton>
          </Track.DecreaseRepeatButton>
          <Track.IncreaseRepeatButton>
            <RepeatButton Focusable='False'>
              <RepeatButton.Template>
                <ControlTemplate TargetType='RepeatButton'>
                  <Border Background='Transparent'/>
                </ControlTemplate>
              </RepeatButton.Template>
            </RepeatButton>
          </Track.IncreaseRepeatButton>
          <Track.Thumb>
            <Thumb>
              <Thumb.Template>
                <ControlTemplate TargetType='Thumb'>
                  <Grid>
                    <Ellipse Width='20' Height='20' Fill='{5}'>
                      <Ellipse.Effect>
                        <DropShadowEffect Color='{5}' BlurRadius='12' Opacity='0.6' ShadowDepth='0'/>
                      </Ellipse.Effect>
                    </Ellipse>
                    <Ellipse Width='8' Height='8' Fill='White' HorizontalAlignment='Center' VerticalAlignment='Center'/>
                  </Grid>
                </ControlTemplate>
              </Thumb.Template>
            </Thumb>
          </Track.Thumb>
        </Track>
      </Grid>
    </ControlTemplate>
  </Slider.Template>
</Slider>",
                min, max, value, tick,
                snapToTick ? "True" : "False",
                accent);

            var xmlReader = XmlReader.Create(new StringReader(xaml));
            return (Slider)XamlReader.Load(xmlReader);
        }

        // ════════════════════════════════════════════════════════════════
        //  ACTIONS
        // ════════════════════════════════════════════════════════════════

        private void SaveSettings()
        {
            SoundManager.PlayClick();
            AppSettings.StartWithWindows     = cbStartWithWindows != null && cbStartWithWindows.IsChecked == true;
            AppSettings.MinimizeToTray       = cbMinimizeToTray != null && cbMinimizeToTray.IsChecked == true;
            AppSettings.CheckUpdates         = cbCheckUpdates != null && cbCheckUpdates.IsChecked == true;
            AppSettings.NotificationsEnabled = cbNotifications != null && cbNotifications.IsChecked == true;
            AppSettings.SoundsEnabled        = cbSoundsEnabled != null && cbSoundsEnabled.IsChecked == true;
            AppSettings.ClickSoundEnabled    = cbClickSound != null && cbClickSound.IsChecked == true;
            AppSettings.HoverSoundEnabled    = cbHoverSound != null && cbHoverSound.IsChecked == true;
            AppSettings.HardwareAcceleration = cbHwAccel != null && cbHwAccel.IsChecked == true;
            AppSettings.GpuRendering         = cbGpuRender != null && cbGpuRender.IsChecked == true;
            AppSettings.MemoryOptimization   = cbMemOpt != null && cbMemOpt.IsChecked == true;
            AppSettings.DeveloperMode        = cbDevMode != null && cbDevMode.IsChecked == true;
            AppSettings.ExperimentalFeatures = cbExperimental != null && cbExperimental.IsChecked == true;
            if (slVolume   != null) AppSettings.Volume   = slVolume.Value;
            if (slUIScale  != null) AppSettings.UIScale  = slUIScale.Value;
            if (slFpsLimit != null) AppSettings.FpsLimit = (int)slFpsLimit.Value;
            SoundManager.Enabled = AppSettings.SoundsEnabled;
            AppSettings.Save();
            AppSettings.FireChanged();
            MainWindow.Instance.ShowToast(Lang.Get("settings.saved"));
        }

        private void LoadCurrentValues()
        {
            if (cbStartWithWindows != null) cbStartWithWindows.IsChecked = AppSettings.StartWithWindows;
            if (cbMinimizeToTray   != null) cbMinimizeToTray.IsChecked   = AppSettings.MinimizeToTray;
            if (cbCheckUpdates     != null) cbCheckUpdates.IsChecked     = AppSettings.CheckUpdates;
            if (cbNotifications    != null) cbNotifications.IsChecked    = AppSettings.NotificationsEnabled;
            if (cbSoundsEnabled    != null) cbSoundsEnabled.IsChecked    = AppSettings.SoundsEnabled;
            if (cbClickSound       != null) cbClickSound.IsChecked       = AppSettings.ClickSoundEnabled;
            if (cbHoverSound       != null) cbHoverSound.IsChecked       = AppSettings.HoverSoundEnabled;
            if (cbHwAccel          != null) cbHwAccel.IsChecked          = AppSettings.HardwareAcceleration;
            if (cbGpuRender        != null) cbGpuRender.IsChecked        = AppSettings.GpuRendering;
            if (cbMemOpt           != null) cbMemOpt.IsChecked           = AppSettings.MemoryOptimization;
            if (cbDevMode          != null) cbDevMode.IsChecked          = AppSettings.DeveloperMode;
            if (cbExperimental     != null) cbExperimental.IsChecked     = AppSettings.ExperimentalFeatures;
            if (slVolume           != null) slVolume.Value               = AppSettings.Volume;
            if (slUIScale          != null) slUIScale.Value              = AppSettings.UIScale;
            if (slFpsLimit         != null) slFpsLimit.Value             = AppSettings.FpsLimit;
        }

        private void ClearCache()
        {
            MainWindow.Instance.Log(Lang.Get("log.cache.start"));
            try
            {
                string folder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "PavoTweak", "cache");
                if (Directory.Exists(folder))
                    Directory.Delete(folder, true);
            }
            catch { }
            MainWindow.Instance.Log(Lang.Get("log.cache.done"), "SUCCESSO");
        }

        private void CreateRestorePoint()
        {
            MainWindow.Instance.Log(Lang.Get("log.restore.start"));
            // Use WMI SystemRestore directly — no powershell.exe process spawning
            string errMsg;
            if (SystemRestoreHelper.CreateRestorePoint("PavoTweak Restore Point", out errMsg))
            {
                MainWindow.Instance.Log(Lang.Get("log.restore.ok"), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.Get("toast.restore.done"));
            }
            else
            {
                string msg = string.Format(Lang.Get("log.restore.error"), errMsg);
                MainWindow.Instance.Log(msg, "ERRORE");
            }
        }

        private void ExportSettings()
        {
            try
            {
                string src = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "PavoTweak", "settings.json");
                string dest = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                    "pavo_settings_export.json");
                if (File.Exists(src)) File.Copy(src, dest, true);
                MainWindow.Instance.Log(string.Format(Lang.Get("log.export.ok"), dest), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.Get("log.export.ok").Split(':')[0] + "!");
            }
            catch (Exception ex)
            {
                MainWindow.Instance.Log(string.Format(Lang.Get("log.export.error"), ex.Message), "ERRORE");
            }
        }

        private void ImportSettings()
        {
            try
            {
                string src = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                    "pavo_settings_export.json");
                if (!File.Exists(src))
                {
                    MainWindow.Instance.Log(Lang.Get("log.import.notfound"), "ERRORE");
                    return;
                }
                string dest = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "PavoTweak", "settings.json");
                File.Copy(src, dest, true);
                AppSettings.Load();
                LoadCurrentValues();
                MainWindow.Instance.Log(Lang.Get("log.import.ok"), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.Get("toast.settings.saved"));
            }
            catch (Exception ex)
            {
                MainWindow.Instance.Log(string.Format(Lang.Get("log.import.error"), ex.Message), "ERRORE");
            }
        }

        // ── Theme/lang button state helpers ──────────────────────────
        private void SetLangActive(AppLanguage lang)
        {
            var accent = Color.FromRgb(88, 101, 242);
            btnLangIT.Background = lang == AppLanguage.Italian
                ? new SolidColorBrush(accent)
                : new SolidColorBrush(Color.FromArgb(40, 88, 101, 242));
            btnLangEN.Background = lang == AppLanguage.English
                ? new SolidColorBrush(accent)
                : new SolidColorBrush(Color.FromArgb(40, 88, 101, 242));
        }

        private void SetThemeActive(AppTheme theme)
        {
            var accent = Color.FromRgb(88, 101, 242);
            btnThemeDark.Background   = theme == AppTheme.Dark     ? new SolidColorBrush(accent) : new SolidColorBrush(Color.FromArgb(40, 88, 101, 242));
            btnThemeSoft.Background   = theme == AppTheme.SoftDark ? new SolidColorBrush(accent) : new SolidColorBrush(Color.FromArgb(40, 88, 101, 242));
            btnThemeSystem.Background = theme == AppTheme.System   ? new SolidColorBrush(accent) : new SolidColorBrush(Color.FromArgb(40, 88, 101, 242));
        }

        private void SetAnimActive(Button low, Button normal, Button high, Button active)
        {
            var accent = Color.FromRgb(88, 101, 242);
            foreach (var b in new[] { low, normal, high })
                b.Background = b == active
                    ? new SolidColorBrush(accent)
                    : new SolidColorBrush(Color.FromArgb(40, 88, 101, 242));
        }

        // ─── Language refresh ────────────────────────────────────────
        public void RefreshLanguage()
        {
            if (lblPageTitle      != null) lblPageTitle.Text      = Lang.Get("settings.title");
            if (btnCatGeneral     != null) btnCatGeneral.Content  = Lang.Get("settings.general");
            if (btnCatAppearance  != null) btnCatAppearance.Content= Lang.Get("settings.appearance");
            if (btnCatPerformance != null) btnCatPerformance.Content=Lang.Get("settings.performance");
            if (btnCatAudio       != null) btnCatAudio.Content    = Lang.Get("settings.audio");
            if (btnCatAdvanced    != null) btnCatAdvanced.Content  = Lang.Get("settings.advanced");
        }
    }
}
