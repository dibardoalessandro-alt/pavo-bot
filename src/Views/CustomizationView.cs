using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Xml;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Windows.Markup;
using System.Windows.Media;
using Microsoft.Win32;
using System.Collections.Generic;

namespace PavoTweak
{
    public class CustomizationView : Grid
    {
        private ComboBox cmbTaskbarAlign;
        private ComboBox cmbSearchMode;
        private ComboBox cmbTaskbarTrans;
        private ComboBox cmbTaskbarAutoHide;
        private ComboBox cmbFileExtensions;
        private ComboBox cmbContextMenu;
        private ComboBox cmbSystemTheme;
        private ComboBox cmbTransparency;
        private ComboBox cmbCursorSize;
        private ComboBox cmbCursorColor;
        private Button btnRestartExplorer;
        private Button btnApplyCursor;

        [DllImport("user32.dll", EntryPoint = "SystemParametersInfo")]
        public static extern bool SystemParametersInfo(int uAction, int uParam, IntPtr lpvParam, int fuWinIni);

        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);

        private const int SPI_SETCURSORS = 0x0057;
        private const int SPIF_SENDCHANGE = 0x0002;
        private const int SPIF_UPDATEINIFILE = 0x0001;

        private const int SHCNE_ASSOCCHANGED = 0x08000000;
        private const int SHCNF_FLUSH = 0x1000;

        private bool isLoading = true;

        public CustomizationView()
        {
            InitializeComponent();
            LoadCurrentStates();
            BindEvents();
        }

        private void InitializeComponent()
        {
            string xaml = @"
<Grid xmlns=""http://schemas.microsoft.com/winfx/2006/xaml/presentation""
      xmlns:x=""http://schemas.microsoft.com/winfx/2006/xaml"">

    <Grid.Resources>
        <Style x:Key=""ActionBtn"" TargetType=""Button"">
            <Setter Property=""Background"" Value=""#2A2C3F""/>
            <Setter Property=""Foreground"" Value=""#E3E5E8""/>
            <Setter Property=""BorderThickness"" Value=""0""/>
            <Setter Property=""Padding"" Value=""10,6""/>
            <Setter Property=""FontSize"" Value=""11""/>
            <Setter Property=""FontFamily"" Value=""Segoe UI Variable Display""/>
            <Setter Property=""FontWeight"" Value=""Bold""/>
            <Setter Property=""Cursor"" Value=""Hand""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""Button"">
                        <Border Name=""Border"" CornerRadius=""14"" Background=""{TemplateBinding Background}"">
                            <TextBlock Text=""{TemplateBinding Content}""
                                       Foreground=""White""
                                       FontSize=""11""
                                       FontWeight=""Bold""
                                       FontFamily=""Segoe UI Variable Display""
                                       HorizontalAlignment=""Center""
                                       VerticalAlignment=""Center""
                                       Margin=""{TemplateBinding Padding}""/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property=""IsMouseOver"" Value=""True"">
                                <Setter TargetName=""Border"" Property=""Background"" Value=""#3D4060""/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
        <Style x:Key=""DarkComboBoxItem"" TargetType=""ComboBoxItem"">
            <Setter Property=""Background"" Value=""#222435""/>
            <Setter Property=""Foreground"" Value=""#E3E5E8""/>
            <Setter Property=""Padding"" Value=""8,5""/>
            <Setter Property=""FontSize"" Value=""10""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""ComboBoxItem"">
                        <Border Name=""ItemBorder"" Background=""#222435"" Padding=""8,5"">
                            <Label Content=""{TemplateBinding Content}""
                                   Foreground=""#E3E5E8""
                                   FontSize=""10""
                                   Padding=""0""
                                   VerticalAlignment=""Center""/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property=""IsMouseOver"" Value=""True"">
                                <Setter TargetName=""ItemBorder"" Property=""Background"" Value=""#2F3250""/>
                            </Trigger>
                            <Trigger Property=""IsSelected"" Value=""True"">
                                <Setter TargetName=""ItemBorder"" Property=""Background"" Value=""#3A3D5C""/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
        <Style x:Key=""DarkComboBox"" TargetType=""ComboBox"">
            <Setter Property=""Background"" Value=""#222435""/>
            <Setter Property=""Foreground"" Value=""#E3E5E8""/>
            <Setter Property=""BorderBrush"" Value=""#3A3D5C""/>
            <Setter Property=""BorderThickness"" Value=""1""/>
            <Setter Property=""FontSize"" Value=""10""/>
            <Setter Property=""ItemContainerStyle"" Value=""{StaticResource DarkComboBoxItem}""/>
            <Setter Property=""Template"">
                <Setter.Value>
                    <ControlTemplate TargetType=""ComboBox"">
                        <Grid>
                            <ToggleButton Name=""PART_ToggleButton""
                                           Focusable=""false""
                                           IsChecked=""{Binding Path=IsDropDownOpen, Mode=TwoWay, RelativeSource={RelativeSource TemplatedParent}}""
                                           Background=""{TemplateBinding Background}""
                                           BorderBrush=""{TemplateBinding BorderBrush}""
                                           BorderThickness=""{TemplateBinding BorderThickness}""
                                           Cursor=""Hand"">
                                <ToggleButton.Template>
                                    <ControlTemplate TargetType=""ToggleButton"">
                                        <Border Name=""TgBorder""
                                                Background=""{TemplateBinding Background}""
                                                BorderBrush=""{TemplateBinding BorderBrush}""
                                                BorderThickness=""{TemplateBinding BorderThickness}""
                                                CornerRadius=""4"">
                                            <TextBlock Text=""▾"" Foreground=""#E3E5E8""
                                                       VerticalAlignment=""Center"" HorizontalAlignment=""Right""
                                                       Margin=""0,0,6,0"" FontSize=""9""/>
                                        </Border>
                                        <ControlTemplate.Triggers>
                                            <Trigger Property=""IsMouseOver"" Value=""True"">
                                                <Setter TargetName=""TgBorder"" Property=""Background"" Value=""#2A2D47""/>
                                            </Trigger>
                                        </ControlTemplate.Triggers>
                                    </ControlTemplate>
                                </ToggleButton.Template>
                            </ToggleButton>
                            <TextBlock Name=""ContentSite""
                                       IsHitTestVisible=""False""
                                       Text=""{Binding SelectionBoxItem, RelativeSource={RelativeSource TemplatedParent}}""
                                       Foreground=""#E3E5E8""
                                       FontSize=""10""
                                       Margin=""8,0,24,0""
                                       VerticalAlignment=""Center""
                                       HorizontalAlignment=""Left""/>
                            <Popup Name=""PART_Popup""
                                   IsOpen=""{TemplateBinding IsDropDownOpen}""
                                   AllowsTransparency=""True""
                                   Focusable=""False""
                                   Placement=""Bottom""
                                   PopupAnimation=""Slide"">
                                <Border Background=""#1B1D27""
                                        BorderBrush=""#3A3D5C""
                                        BorderThickness=""1""
                                        CornerRadius=""4""
                                        MinWidth=""{Binding ActualWidth, RelativeSource={RelativeSource TemplatedParent}}"">
                                    <ScrollViewer VerticalScrollBarVisibility=""Auto"">
                                        <ItemsPresenter/>
                                    </ScrollViewer>
                                </Border>
                            </Popup>
                        </Grid>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </Grid.Resources>

    <Grid.ColumnDefinitions>
        <ColumnDefinition Width=""*""/>
        <ColumnDefinition Width=""*""/>
    </Grid.ColumnDefinitions>

    <!-- LEFT COLUMN: TASKBAR & EXPLORER -->
    <Grid Grid.Column=""0"" Margin=""0,0,8,0"">
        <Grid.RowDefinitions>
            <RowDefinition Height=""*""/>
            <RowDefinition Height=""*""/>
        </Grid.RowDefinitions>

        <!-- Taskbar Customization Card -->
        <Border Grid.Row=""0"" Style=""{DynamicResource PremiumCard}"" Margin=""0,0,0,10"">
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""*""/>
                </Grid.RowDefinitions>
                <StackPanel Grid.Row=""0"" Margin=""0,0,0,12"">
                    <TextBlock Text=""[[custom.taskbar.title]]"" FontSize=""12"" FontWeight=""Bold"" Foreground=""White""/>
                    <TextBlock Text=""[[custom.taskbar.desc]]"" FontSize=""9"" Foreground=""#4A5680"" Margin=""0,2,0,0""/>
                </StackPanel>

                <ScrollViewer Grid.Row=""1"" VerticalScrollBarVisibility=""Auto"">
                    <StackPanel>
                        <!-- Align Taskbar -->
                        <Grid Margin=""0,4,0,10"">
                            <StackPanel Margin=""0,0,100,0"">
                                <TextBlock Text=""[[custom.taskbar.align]]"" FontSize=""10"" FontWeight=""Bold"" Foreground=""White""/>
                                <TextBlock Text=""[[custom.taskbar.align.desc]]"" FontSize=""8.5"" Foreground=""#4A5680"" TextWrapping=""Wrap""/>
                            </StackPanel>
                            <ComboBox x:Name=""cmbTaskbarAlign"" HorizontalAlignment=""Right"" VerticalAlignment=""Center"" Width=""90"" Height=""22"" Style=""{StaticResource DarkComboBox}"">
                                <ComboBoxItem Content=""[[custom.val.left]]""/>
                                <ComboBoxItem Content=""[[custom.val.center]]""/>
                            </ComboBox>
                        </Grid>

                        <!-- Search Bar Mode -->
                        <Grid Margin=""0,4,0,10"">
                            <StackPanel Margin=""0,0,100,0"">
                                <TextBlock Text=""[[custom.taskbar.search]]"" FontSize=""10"" FontWeight=""Bold"" Foreground=""White""/>
                                <TextBlock Text=""[[custom.taskbar.search.desc]]"" FontSize=""8.5"" Foreground=""#4A5680"" TextWrapping=""Wrap""/>
                            </StackPanel>
                            <ComboBox x:Name=""cmbSearchMode"" HorizontalAlignment=""Right"" VerticalAlignment=""Center"" Width=""90"" Height=""22"" Style=""{StaticResource DarkComboBox}"">
                                <ComboBoxItem Content=""[[custom.val.hidden]]""/>
                                <ComboBoxItem Content=""[[custom.val.icon]]""/>
                                <ComboBoxItem Content=""[[custom.val.box]]""/>
                            </ComboBox>
                        </Grid>

                        <!-- Taskbar Transparent -->
                        <Grid Margin=""0,4,0,10"">
                            <StackPanel Margin=""0,0,100,0"">
                                <TextBlock Text=""[[custom.taskbar.trans]]"" FontSize=""10"" FontWeight=""Bold"" Foreground=""White""/>
                                <TextBlock Text=""[[custom.taskbar.trans.desc]]"" FontSize=""8.5"" Foreground=""#4A5680"" TextWrapping=""Wrap""/>
                            </StackPanel>
                            <ComboBox x:Name=""cmbTaskbarTrans"" HorizontalAlignment=""Right"" VerticalAlignment=""Center"" Width=""90"" Height=""22"" Style=""{StaticResource DarkComboBox}"">
                                <ComboBoxItem Content=""[[custom.val.standard]]""/>
                                <ComboBoxItem Content=""[[custom.val.transparent]]""/>
                            </ComboBox>
                        </Grid>

                        <!-- Auto-hide taskbar -->
                        <Grid Margin=""0,4,0,6"">
                            <StackPanel Margin=""0,0,100,0"">
                                <TextBlock Text=""[[custom.taskbar.autohide]]"" FontSize=""10"" FontWeight=""Bold"" Foreground=""White""/>
                                <TextBlock Text=""[[custom.taskbar.autohide.desc]]"" FontSize=""8.5"" Foreground=""#4A5680"" TextWrapping=""Wrap""/>
                            </StackPanel>
                            <ComboBox x:Name=""cmbTaskbarAutoHide"" HorizontalAlignment=""Right"" VerticalAlignment=""Center"" Width=""90"" Height=""22"" Style=""{StaticResource DarkComboBox}"">
                                <ComboBoxItem Content=""[[custom.val.disabled]]""/>
                                <ComboBoxItem Content=""[[custom.val.enabled]]""/>
                            </ComboBox>
                        </Grid>
                    </StackPanel>
                </ScrollViewer>
            </Grid>
        </Border>

        <!-- Explorer & Shell Card -->
        <Border Grid.Row=""1"" Style=""{DynamicResource PremiumCard}"" Margin=""0"">
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""*""/>
                </Grid.RowDefinitions>
                <StackPanel Grid.Row=""0"" Margin=""0,0,0,12"">
                    <TextBlock Text=""[[custom.explorer.title]]"" FontSize=""12"" FontWeight=""Bold"" Foreground=""White""/>
                    <TextBlock Text=""[[custom.explorer.desc]]"" FontSize=""9"" Foreground=""#4A5680"" Margin=""0,2,0,0""/>
                </StackPanel>

                <ScrollViewer Grid.Row=""1"" VerticalScrollBarVisibility=""Auto"">
                    <StackPanel>
                        <!-- File Extensions -->
                        <Grid Margin=""0,4,0,10"">
                            <StackPanel Margin=""0,0,100,0"">
                                <TextBlock Text=""[[custom.explorer.ext]]"" FontSize=""10"" FontWeight=""Bold"" Foreground=""White""/>
                                <TextBlock Text=""[[custom.explorer.ext.desc]]"" FontSize=""8.5"" Foreground=""#4A5680"" TextWrapping=""Wrap""/>
                            </StackPanel>
                            <ComboBox x:Name=""cmbFileExtensions"" HorizontalAlignment=""Right"" VerticalAlignment=""Center"" Width=""90"" Height=""22"" Style=""{StaticResource DarkComboBox}"">
                                <ComboBoxItem Content=""[[custom.val.hidden]]""/>
                                <ComboBoxItem Content=""[[custom.val.show]]""/>
                            </ComboBox>
                        </Grid>

                        <!-- Classic Context Menu -->
                        <Grid Margin=""0,4,0,14"">
                            <StackPanel Margin=""0,0,100,0"">
                                <TextBlock Text=""[[custom.explorer.menu]]"" FontSize=""10"" FontWeight=""Bold"" Foreground=""White""/>
                                <TextBlock Text=""[[custom.explorer.menu.desc]]"" FontSize=""8.5"" Foreground=""#4A5680"" TextWrapping=""Wrap""/>
                            </StackPanel>
                            <ComboBox x:Name=""cmbContextMenu"" HorizontalAlignment=""Right"" VerticalAlignment=""Center"" Width=""90"" Height=""22"" Style=""{StaticResource DarkComboBox}"">
                                <ComboBoxItem Content=""[[custom.val.default11]]""/>
                                <ComboBoxItem Content=""[[custom.val.classico10]]""/>
                            </ComboBox>
                        </Grid>

                        <!-- Restart Explorer Button -->
                        <Button x:Name=""btnRestartExplorer"" Content=""[[custom.btn.explorer]]"" Style=""{DynamicResource PremiumButton}"" HorizontalAlignment=""Stretch"" Height=""26"" Margin=""0,6,0,0""/>
                    </StackPanel>
                </ScrollViewer>
            </Grid>
        </Border>
    </Grid>

    <!-- RIGHT COLUMN: THEME & CURSOR -->
    <Grid Grid.Column=""1"" Margin=""8,0,0,0"">
        <Grid.RowDefinitions>
            <RowDefinition Height=""*""/>
            <RowDefinition Height=""*""/>
        </Grid.RowDefinitions>

        <!-- Theme & Style Card -->
        <Border Grid.Row=""0"" Style=""{DynamicResource PremiumCard}"" Margin=""0,0,0,10"">
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""*""/>
                </Grid.RowDefinitions>
                <StackPanel Grid.Row=""0"" Margin=""0,0,0,12"">
                    <TextBlock Text=""[[custom.theme.title]]"" FontSize=""12"" FontWeight=""Bold"" Foreground=""White""/>
                    <TextBlock Text=""[[custom.theme.desc]]"" FontSize=""9"" Foreground=""#4A5680"" Margin=""0,2,0,0""/>
                </StackPanel>

                <ScrollViewer Grid.Row=""1"" VerticalScrollBarVisibility=""Auto"">
                    <StackPanel>
                        <!-- Dark/Light Theme -->
                        <Grid Margin=""0,4,0,10"">
                            <StackPanel Margin=""0,0,100,0"">
                                <TextBlock Text=""[[custom.theme.system]]"" FontSize=""10"" FontWeight=""Bold"" Foreground=""White""/>
                                <TextBlock Text=""[[custom.theme.system.desc]]"" FontSize=""8.5"" Foreground=""#4A5680"" TextWrapping=""Wrap""/>
                            </StackPanel>
                            <ComboBox x:Name=""cmbSystemTheme"" HorizontalAlignment=""Right"" VerticalAlignment=""Center"" Width=""90"" Height=""22"" Style=""{StaticResource DarkComboBox}"">
                                <ComboBoxItem Content=""[[custom.val.dark]]""/>
                                <ComboBoxItem Content=""[[custom.val.light]]""/>
                            </ComboBox>
                        </Grid>

                        <!-- Transparency Effects -->
                        <Grid Margin=""0,4,0,6"">
                            <StackPanel Margin=""0,0,100,0"">
                                <TextBlock Text=""[[custom.theme.trans]]"" FontSize=""10"" FontWeight=""Bold"" Foreground=""White""/>
                                <TextBlock Text=""[[custom.theme.trans.desc]]"" FontSize=""8.5"" Foreground=""#4A5680"" TextWrapping=""Wrap""/>
                            </StackPanel>
                            <ComboBox x:Name=""cmbTransparency"" HorizontalAlignment=""Right"" VerticalAlignment=""Center"" Width=""90"" Height=""22"" Style=""{StaticResource DarkComboBox}"">
                                <ComboBoxItem Content=""[[custom.val.disabled]]""/>
                                <ComboBoxItem Content=""[[custom.val.enabled]]""/>
                            </ComboBox>
                        </Grid>
                    </StackPanel>
                </ScrollViewer>
            </Grid>
        </Border>

        <!-- Cursor Card -->
        <Border Grid.Row=""1"" Style=""{DynamicResource PremiumCard}"" Margin=""0"">
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height=""Auto""/>
                    <RowDefinition Height=""*""/>
                </Grid.RowDefinitions>
                <StackPanel Grid.Row=""0"" Margin=""0,0,0,12"">
                    <TextBlock Text=""[[custom.cursor.title]]"" FontSize=""12"" FontWeight=""Bold"" Foreground=""White""/>
                    <TextBlock Text=""[[custom.cursor.desc]]"" FontSize=""9"" Foreground=""#4A5680"" Margin=""0,2,0,0""/>
                </StackPanel>

                <ScrollViewer Grid.Row=""1"" VerticalScrollBarVisibility=""Auto"">
                    <StackPanel>
                        <!-- Cursor Size -->
                        <Grid Margin=""0,4,0,10"">
                            <StackPanel Margin=""0,0,100,0"">
                                <TextBlock Text=""[[custom.cursor.size]]"" FontSize=""10"" FontWeight=""Bold"" Foreground=""White""/>
                                <TextBlock Text=""[[custom.cursor.size.desc]]"" FontSize=""8.5"" Foreground=""#4A5680"" TextWrapping=""Wrap""/>
                            </StackPanel>
                            <ComboBox x:Name=""cmbCursorSize"" HorizontalAlignment=""Right"" VerticalAlignment=""Center"" Width=""90"" Height=""22"" Style=""{StaticResource DarkComboBox}"">
                                <ComboBoxItem Content=""[[custom.val.standard]]""/>
                                <ComboBoxItem Content=""[[custom.val.grande]]""/>
                                <ComboBoxItem Content=""[[custom.val.moltogrange]]""/>
                                <ComboBoxItem Content=""[[custom.val.gigante]]""/>
                            </ComboBox>
                        </Grid>

                        <!-- Cursor Color -->
                        <Grid Margin=""0,4,0,14"">
                            <StackPanel Margin=""0,0,100,0"">
                                <TextBlock Text=""[[custom.cursor.color]]"" FontSize=""10"" FontWeight=""Bold"" Foreground=""White""/>
                                <TextBlock Text=""[[custom.cursor.color.desc]]"" FontSize=""8.5"" Foreground=""#4A5680"" TextWrapping=""Wrap""/>
                            </StackPanel>
                            <ComboBox x:Name=""cmbCursorColor"" HorizontalAlignment=""Right"" VerticalAlignment=""Center"" Width=""90"" Height=""22"" Style=""{StaticResource DarkComboBox}"">
                                <ComboBoxItem Content=""[[custom.val.defaultaero]]""/>
                                <ComboBoxItem Content=""[[custom.val.neroclassico]]""/>
                                <ComboBoxItem Content=""[[custom.val.neoninvertito]]""/>
                            </ComboBox>
                        </Grid>

                        <!-- Apply Cursors Button -->
                        <Button x:Name=""btnApplyCursor"" Content=""[[custom.btn.cursor]]"" Style=""{DynamicResource PremiumButton}"" HorizontalAlignment=""Stretch"" Height=""26"" Margin=""0,6,0,0""/>
                    </StackPanel>
                </ScrollViewer>
            </Grid>
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

            // Bind elements
            cmbTaskbarAlign = (ComboBox)root.FindName("cmbTaskbarAlign");
            cmbSearchMode = (ComboBox)root.FindName("cmbSearchMode");
            cmbTaskbarTrans = (ComboBox)root.FindName("cmbTaskbarTrans");
            cmbTaskbarAutoHide = (ComboBox)root.FindName("cmbTaskbarAutoHide");
            cmbFileExtensions = (ComboBox)root.FindName("cmbFileExtensions");
            cmbContextMenu = (ComboBox)root.FindName("cmbContextMenu");
            cmbSystemTheme = (ComboBox)root.FindName("cmbSystemTheme");
            cmbTransparency = (ComboBox)root.FindName("cmbTransparency");
            cmbCursorSize = (ComboBox)root.FindName("cmbCursorSize");
            cmbCursorColor = (ComboBox)root.FindName("cmbCursorColor");
            btnRestartExplorer = (Button)root.FindName("btnRestartExplorer");
            btnApplyCursor = (Button)root.FindName("btnApplyCursor");
        }

        private void SavePrivateSetting(string name, int value)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\PavoTweak\CustomSettings"))
                {
                    if (key != null) key.SetValue(name, value, RegistryValueKind.DWord);
                }
            }
            catch {}
        }

        private void SavePrivateSetting(string name, string value)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\PavoTweak\CustomSettings"))
                {
                    if (key != null) key.SetValue(name, value, RegistryValueKind.String);
                }
            }
            catch {}
        }

        private int GetPrivateSetting(string name, int defaultValue)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\PavoTweak\CustomSettings"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue(name);
                        if (val != null) return Convert.ToInt32(val);
                    }
                }
            }
            catch {}
            return defaultValue;
        }

        private string GetPrivateSetting(string name, string defaultValue)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\PavoTweak\CustomSettings"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue(name);
                        if (val != null) return val.ToString();
                    }
                }
            }
            catch {}
            return defaultValue;
        }

        private int GetRegDword(RegistryKey root, string subKey, string valueName, int defaultValue)
        {
            try
            {
                using (RegistryKey key = root.OpenSubKey(subKey))
                {
                    if (key != null)
                    {
                        object val = key.GetValue(valueName);
                        if (val != null) return Convert.ToInt32(val);
                    }
                }
            }
            catch {}
            return defaultValue;
        }

        private string GetRegString(RegistryKey root, string subKey, string valueName, string defaultValue)
        {
            try
            {
                using (RegistryKey key = root.OpenSubKey(subKey))
                {
                    if (key != null)
                    {
                        object val = key.GetValue(valueName);
                        if (val != null) return val.ToString();
                    }
                }
            }
            catch {}
            return defaultValue;
        }

        private void LoadCurrentStates()
        {
            isLoading = true;
            try
            {
                // 1. Taskbar Alignment (Left=0/Center=1)
                int align = GetPrivateSetting("TaskbarAl", -1);
                if (align == -1)
                {
                    align = GetRegDword(Registry.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "TaskbarAl", 1);
                }
                if (cmbTaskbarAlign != null) cmbTaskbarAlign.SelectedIndex = (align == 0) ? 0 : 1;

                // 2. Search Mode (Hide=0, Icon=1, Box=2)
                int search = GetPrivateSetting("SearchboxTaskbarMode", -1);
                if (search == -1)
                {
                    int regVal = GetRegDword(Registry.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\Search", "SearchboxTaskbarMode", 1);
                    if (regVal == 0) search = 0;
                    else if (regVal == 1) search = 1;
                    else search = 2; // Box
                }
                if (cmbSearchMode != null) cmbSearchMode.SelectedIndex = search;

                // 3. Taskbar Translucency (Standard=0, Transparent=1)
                int transVal = GetPrivateSetting("TaskbarTranslucency", -1);
                if (transVal == -1)
                {
                    transVal = GetRegDword(Registry.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "TaskbarTranslucency", 0);
                }
                if (cmbTaskbarTrans != null) cmbTaskbarTrans.SelectedIndex = (transVal == 1) ? 1 : 0;

                // 4. Auto-hide Taskbar (Disabled=0, Enabled=1)
                int autoHide = GetPrivateSetting("TaskbarAutoHide", -1);
                if (autoHide == -1)
                {
                    byte[] settings = null;
                    try
                    {
                        using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3"))
                        {
                            if (key != null) settings = (byte[])key.GetValue("Settings");
                        }
                    }
                    catch {}
                    if (settings != null && settings.Length > 8)
                    {
                        autoHide = (settings[8] == 0x03) ? 1 : 0;
                    }
                    else
                    {
                        autoHide = 0;
                    }
                }
                if (cmbTaskbarAutoHide != null) cmbTaskbarAutoHide.SelectedIndex = autoHide;

                // 5. File Extensions (HideFileExt: 1=Hide (index 0), 0=Show (index 1))
                int hideExt = GetPrivateSetting("HideFileExt", -1);
                if (hideExt == -1)
                {
                    hideExt = GetRegDword(Registry.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "HideFileExt", 1);
                }
                if (cmbFileExtensions != null) cmbFileExtensions.SelectedIndex = (hideExt == 1) ? 0 : 1;

                // 6. Context Menu CLSID Key (Default=0, Classic=1)
                int classicMenu = GetPrivateSetting("ContextMenuClassic", -1);
                if (classicMenu == -1)
                {
                    bool found = false;
                    try
                    {
                        using (RegistryKey menuKey = Registry.CurrentUser.OpenSubKey(@"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}"))
                        {
                            if (menuKey != null) found = true;
                        }
                    }
                    catch {}
                    classicMenu = found ? 1 : 0;
                }
                if (cmbContextMenu != null) cmbContextMenu.SelectedIndex = classicMenu;

                // 7. System Theme (0=Dark (index 0), 1=Light (index 1))
                int sysTheme = GetPrivateSetting("AppsUseLightTheme", -1);
                if (sysTheme == -1)
                {
                    sysTheme = GetRegDword(Registry.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme", 0);
                }
                if (cmbSystemTheme != null) cmbSystemTheme.SelectedIndex = (sysTheme == 0) ? 0 : 1;

                // 8. Transparency Effects (EnableTransparency: 0=Disabled (index 0), 1=Enabled (index 1))
                int transparency = GetPrivateSetting("EnableTransparency", -1);
                if (transparency == -1)
                {
                    transparency = GetRegDword(Registry.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "EnableTransparency", 1);
                }
                if (cmbTransparency != null) cmbTransparency.SelectedIndex = (transparency == 1) ? 1 : 0;

                // 9. Cursor Size (1=Std, 2=Big, 3=VeryBig, 4=Giga)
                int cursorSize = GetPrivateSetting("CursorSize", -1);
                if (cursorSize == -1)
                {
                    cursorSize = GetRegDword(Registry.CurrentUser, @"Control Panel\Accessibility", "CursorSize", 1);
                }
                if (cmbCursorSize != null)
                {
                    if (cursorSize <= 1) cmbCursorSize.SelectedIndex = 0;
                    else if (cursorSize == 2) cmbCursorSize.SelectedIndex = 1;
                    else if (cursorSize == 3) cmbCursorSize.SelectedIndex = 2;
                    else cmbCursorSize.SelectedIndex = 3;
                }

                // Cursor Color (Default=0, Black=1, Inverted=2)
                int cursorColor = GetPrivateSetting("CursorColor", -1);
                if (cursorColor == -1)
                {
                    string scheme = GetRegString(Registry.CurrentUser, @"Control Panel\Cursors", "SchemeName", "");
                    if (scheme.Contains("Black")) cursorColor = 1;
                    else if (scheme.Contains("Inverted")) cursorColor = 2;
                    else cursorColor = 0;
                }
                if (cmbCursorColor != null) cmbCursorColor.SelectedIndex = cursorColor;
            }
            catch {}
            isLoading = false;
        }

        private void BindEvents()
        {
            if (cmbTaskbarAlign != null) cmbTaskbarAlign.SelectionChanged += (s, e) => ApplyTaskbarAlign();
            if (cmbSearchMode != null) cmbSearchMode.SelectionChanged += (s, e) => ApplySearchMode();
            if (cmbTaskbarTrans != null) cmbTaskbarTrans.SelectionChanged += (s, e) => ApplyTaskbarTrans();
            if (cmbTaskbarAutoHide != null) cmbTaskbarAutoHide.SelectionChanged += (s, e) => ApplyTaskbarAutoHide();
            if (cmbFileExtensions != null) cmbFileExtensions.SelectionChanged += (s, e) => ApplyFileExtensions();
            if (cmbContextMenu != null) cmbContextMenu.SelectionChanged += (s, e) => ApplyContextMenu();
            if (cmbSystemTheme != null) cmbSystemTheme.SelectionChanged += (s, e) => ApplySystemTheme();
            if (cmbTransparency != null) cmbTransparency.SelectionChanged += (s, e) => ApplyTransparency();

            if (btnRestartExplorer != null) btnRestartExplorer.Click += (s, e) => RestartExplorer();
            if (btnApplyCursor != null) btnApplyCursor.Click += (s, e) => ApplyCursorTweak();
        }

        private void ApplyTaskbarAlign()
        {
            if (isLoading || cmbTaskbarAlign == null) return;
            int align = cmbTaskbarAlign.SelectedIndex; // 0 = Left, 1 = Center
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", true))
                {
                    if (key != null)
                    {
                        key.SetValue("TaskbarAl", align, RegistryValueKind.DWord);
                        SavePrivateSetting("TaskbarAl", align);
                        MainWindow.Instance.Log(Lang.TranslateString("Taskbar allineata a: ") + (align == 0 ? Lang.TranslateString("Sinistra") : Lang.TranslateString("Centro")), "SUCCESSO");
                    }
                }
            }
            catch {}
        }

        private void ApplySearchMode()
        {
            if (isLoading || cmbSearchMode == null) return;
            int mode = cmbSearchMode.SelectedIndex; // 0 = Hide, 1 = Icon, 2 = Box
            int regValue = 1;
            if (mode == 0) regValue = 0;
            else if (mode == 1) regValue = 1;
            else regValue = 3;

            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Search", true))
                {
                    if (key != null)
                    {
                        key.SetValue("SearchboxTaskbarMode", regValue, RegistryValueKind.DWord);
                        SavePrivateSetting("SearchboxTaskbarMode", mode);
                        MainWindow.Instance.Log(Lang.TranslateString("Modalità ricerca modificata in: ") + cmbSearchMode.Text, "SUCCESSO");
                    }
                }
            }
            catch {}
        }

        private void ApplyTaskbarTrans()
        {
            if (isLoading || cmbTaskbarTrans == null) return;
            int trans = cmbTaskbarTrans.SelectedIndex; // 0 = Standard, 1 = Transparent
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", true))
                {
                    if (key != null)
                    {
                        key.SetValue("TaskbarTranslucency", trans, RegistryValueKind.DWord);
                        SavePrivateSetting("TaskbarTranslucency", trans);
                    }
                }
                // HKLM OLED setting if admin
                try
                {
                    using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced", true))
                    {
                        if (key != null)
                        {
                            key.SetValue("UseOLEDTaskbarTransparency", trans, RegistryValueKind.DWord);
                        }
                    }
                }
                catch {}
                MainWindow.Instance.Log(Lang.TranslateString("Trasparenza Taskbar impostata su: ") + (trans == 1 ? Lang.TranslateString("Attiva") : Lang.TranslateString("Disattiva")), "SUCCESSO");
            }
            catch {}
        }

        private void ApplyTaskbarAutoHide()
        {
            if (isLoading || cmbTaskbarAutoHide == null) return;
            bool auto = (cmbTaskbarAutoHide.SelectedIndex == 1);
            try
            {
                byte[] settings = null;
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3"))
                {
                    if (key != null) settings = (byte[])key.GetValue("Settings");
                }
                if (settings != null && settings.Length > 8)
                {
                    settings[8] = auto ? (byte)0x03 : (byte)0x02;
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3", true))
                    {
                        if (key != null)
                        {
                            key.SetValue("Settings", settings, RegistryValueKind.Binary);
                            SavePrivateSetting("TaskbarAutoHide", auto ? 1 : 0);
                        }
                    }
                    MainWindow.Instance.Log(Lang.TranslateString("Auto-hide Barra Applicazioni impostata su: ") + (auto ? Lang.TranslateString("Attivo") : Lang.TranslateString("Disattivo")), "SUCCESSO");
                }
            }
            catch {}
        }

        private void ApplyFileExtensions()
        {
            if (isLoading || cmbFileExtensions == null) return;
            int val = (cmbFileExtensions.SelectedIndex == 0) ? 1 : 0; // 0=Hide (val 1), 1=Show (val 0)
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", true))
                {
                    if (key != null)
                    {
                        key.SetValue("HideFileExt", val, RegistryValueKind.DWord);
                        SavePrivateSetting("HideFileExt", val);
                        MainWindow.Instance.Log(Lang.TranslateString("Visibilità estensioni file impostata a: ") + (val == 0 ? Lang.TranslateString("Mostra") : Lang.TranslateString("Nascondi")), "SUCCESSO");
                    }
                }
            }
            catch {}
        }

        private void ApplyContextMenu()
        {
            if (isLoading || cmbContextMenu == null) return;
            int selection = cmbContextMenu.SelectedIndex; // 0 = Default, 1 = Classico
            try
            {
                if (selection == 1) // Enable classic
                {
                    using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32"))
                    {
                        if (key != null) key.SetValue("", "", RegistryValueKind.String);
                    }
                    SavePrivateSetting("ContextMenuClassic", selection);
                    MainWindow.Instance.Log(Lang.TranslateString("Menu contestuale classico Windows 10 abilitato. Riavvia Explorer per applicare."), "SUCCESSO");
                }
                else // Restore Win11
                {
                    try
                    {
                        Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}", false);
                    }
                    catch {}
                    SavePrivateSetting("ContextMenuClassic", selection);
                    MainWindow.Instance.Log(Lang.TranslateString("Menu contestuale moderno Windows 11 ripristinato. Riavvia Explorer per applicare."), "SUCCESSO");
                }
            }
            catch {}
        }

        private void ApplySystemTheme()
        {
            if (isLoading || cmbSystemTheme == null) return;
            int lightThemeVal = (cmbSystemTheme.SelectedIndex == 0) ? 0 : 1; // 0 = Dark, 1 = Light
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", true))
                {
                    if (key != null)
                    {
                        key.SetValue("AppsUseLightTheme", lightThemeVal, RegistryValueKind.DWord);
                        key.SetValue("SystemUsesLightTheme", lightThemeVal, RegistryValueKind.DWord);
                        SavePrivateSetting("AppsUseLightTheme", lightThemeVal);
                        MainWindow.Instance.Log(Lang.TranslateString("Tema di sistema modificato in: ") + (lightThemeVal == 0 ? Lang.TranslateString("Scuro") : Lang.TranslateString("Chiaro")), "SUCCESSO");
                    }
                }
            }
            catch {}
        }

        private void ApplyTransparency()
        {
            if (isLoading || cmbTransparency == null) return;
            int trans = cmbTransparency.SelectedIndex; // 0 = Disattivo, 1 = Attivo
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", true))
                {
                    if (key != null)
                    {
                        key.SetValue("EnableTransparency", trans, RegistryValueKind.DWord);
                        SavePrivateSetting("EnableTransparency", trans);
                        MainWindow.Instance.Log(Lang.TranslateString("Effetti di trasparenza impostati a: ") + (trans == 1 ? Lang.TranslateString("Attivo") : Lang.TranslateString("Disattivato")), "SUCCESSO");
                    }
                }
            }
            catch {}
        }

        private void ApplyCursorTweak()
        {
            SoundManager.PlayClick();
            if (cmbCursorSize == null || cmbCursorColor == null) return;

            int sizeIdx = cmbCursorSize.SelectedIndex; // 0=1, 1=2, 2=3, 3=4
            int sizeVal = sizeIdx + 1;

            int colorIdx = cmbCursorColor.SelectedIndex; // 0=Default Aero, 1=Black, 2=Inverted

            MainWindow.Instance.Log(Lang.TranslateString("Applicazione configurazione puntatore mouse..."));
            try
            {
                // Set Size
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Control Panel\Accessibility", true))
                {
                    if (key != null) key.SetValue("CursorSize", sizeVal, RegistryValueKind.DWord);
                }

                // Set Color scheme and load all pointers
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Control Panel\Cursors", true))
                {
                    if (key != null)
                    {
                        if (colorIdx == 0) // Default Aero
                        {
                            key.SetValue("SchemeName", "Windows Aero", RegistryValueKind.String);
                            key.SetValue("Arrow", @"C:\Windows\Cursors\aero_arrow.cur", RegistryValueKind.String);
                            key.SetValue("Help", @"C:\Windows\Cursors\aero_helpsel.cur", RegistryValueKind.String);
                            key.SetValue("AppStarting", @"C:\Windows\Cursors\aero_working.ani", RegistryValueKind.String);
                            key.SetValue("Wait", @"C:\Windows\Cursors\aero_busy.ani", RegistryValueKind.String);
                            key.SetValue("NWPen", @"C:\Windows\Cursors\aero_pen.cur", RegistryValueKind.String);
                            key.SetValue("No", @"C:\Windows\Cursors\aero_unavail.cur", RegistryValueKind.String);
                            key.SetValue("SizeNS", @"C:\Windows\Cursors\aero_ns.cur", RegistryValueKind.String);
                            key.SetValue("SizeWE", @"C:\Windows\Cursors\aero_ew.cur", RegistryValueKind.String);
                            key.SetValue("SizeNWSE", @"C:\Windows\Cursors\aero_nwse.cur", RegistryValueKind.String);
                            key.SetValue("SizeNESW", @"C:\Windows\Cursors\aero_nesw.cur", RegistryValueKind.String);
                            key.SetValue("SizeAll", @"C:\Windows\Cursors\aero_move.cur", RegistryValueKind.String);
                            key.SetValue("UpArrow", @"C:\Windows\Cursors\aero_up.cur", RegistryValueKind.String);
                            key.SetValue("Hand", @"C:\Windows\Cursors\aero_link.cur", RegistryValueKind.String);
                        }
                        else if (colorIdx == 1) // Black
                        {
                            string sfx = (sizeVal == 2) ? "l" : (sizeVal >= 3) ? "m" : "";
                            string arrowFile = string.Format(@"C:\Windows\Cursors\arrow_r{0}.cur", sfx);
                            string helpFile = string.Format(@"C:\Windows\Cursors\help_r{0}.cur", sfx);
                            string busyFile = string.Format(@"C:\Windows\Cursors\busy_r{0}.cur", sfx);
                            string waitFile = string.Format(@"C:\Windows\Cursors\wait_r{0}.cur", sfx);
                            string crossFile = string.Format(@"C:\Windows\Cursors\cross_r{0}.cur", sfx);
                            string beamFile = string.Format(@"C:\Windows\Cursors\beam_r{0}.cur", sfx);
                            string penFile = string.Format(@"C:\Windows\Cursors\pen_r{0}.cur", sfx);
                            string noFile = string.Format(@"C:\Windows\Cursors\no_r{0}.cur", sfx);
                            string nsFile = string.Format(@"C:\Windows\Cursors\size4_r{0}.cur", sfx);
                            string weFile = string.Format(@"C:\Windows\Cursors\size3_r{0}.cur", sfx);
                            string nwseFile = string.Format(@"C:\Windows\Cursors\size1_r{0}.cur", sfx);
                            string neswFile = string.Format(@"C:\Windows\Cursors\size2_r{0}.cur", sfx);
                            string moveFile = string.Format(@"C:\Windows\Cursors\move_r{0}.cur", sfx);
                            string upFile = string.Format(@"C:\Windows\Cursors\up_r{0}.cur", sfx);

                            key.SetValue("SchemeName", "Windows Black", RegistryValueKind.String);
                            key.SetValue("Arrow", arrowFile, RegistryValueKind.String);
                            key.SetValue("Help", helpFile, RegistryValueKind.String);
                            key.SetValue("AppStarting", waitFile, RegistryValueKind.String);
                            key.SetValue("Wait", busyFile, RegistryValueKind.String);
                            key.SetValue("Crosshair", crossFile, RegistryValueKind.String);
                            key.SetValue("IBeam", beamFile, RegistryValueKind.String);
                            key.SetValue("NWPen", penFile, RegistryValueKind.String);
                            key.SetValue("No", noFile, RegistryValueKind.String);
                            key.SetValue("SizeNS", nsFile, RegistryValueKind.String);
                            key.SetValue("SizeWE", weFile, RegistryValueKind.String);
                            key.SetValue("SizeNWSE", nwseFile, RegistryValueKind.String);
                            key.SetValue("SizeNESW", neswFile, RegistryValueKind.String);
                            key.SetValue("SizeAll", moveFile, RegistryValueKind.String);
                            key.SetValue("UpArrow", upFile, RegistryValueKind.String);
                            key.SetValue("Hand", @"C:\Windows\Cursors\aero_link.cur", RegistryValueKind.String);
                        }
                        else // Inverted
                        {
                            string sfx = (sizeVal == 2) ? "l" : (sizeVal >= 3) ? "m" : "";
                            string arrowFile = string.Format(@"C:\Windows\Cursors\arrow_i{0}.cur", sfx);
                            string helpFile = string.Format(@"C:\Windows\Cursors\help_i{0}.cur", sfx);
                            string busyFile = string.Format(@"C:\Windows\Cursors\busy_i{0}.cur", sfx);
                            string waitFile = string.Format(@"C:\Windows\Cursors\wait_i{0}.cur", sfx);
                            string crossFile = string.Format(@"C:\Windows\Cursors\cross_i{0}.cur", sfx);
                            string beamFile = string.Format(@"C:\Windows\Cursors\beam_i{0}.cur", sfx);
                            string penFile = string.Format(@"C:\Windows\Cursors\pen_i{0}.cur", sfx);
                            string noFile = string.Format(@"C:\Windows\Cursors\no_i{0}.cur", sfx);
                            string nsFile = string.Format(@"C:\Windows\Cursors\size4_i{0}.cur", sfx);
                            string weFile = string.Format(@"C:\Windows\Cursors\size3_i{0}.cur", sfx);
                            string nwseFile = string.Format(@"C:\Windows\Cursors\size1_i{0}.cur", sfx);
                            string neswFile = string.Format(@"C:\Windows\Cursors\size2_i{0}.cur", sfx);
                            string moveFile = string.Format(@"C:\Windows\Cursors\move_i{0}.cur", sfx);
                            string upFile = string.Format(@"C:\Windows\Cursors\up_i{0}.cur", sfx);

                            key.SetValue("SchemeName", "Windows Inverted", RegistryValueKind.String);
                            key.SetValue("Arrow", arrowFile, RegistryValueKind.String);
                            key.SetValue("Help", helpFile, RegistryValueKind.String);
                            key.SetValue("AppStarting", waitFile, RegistryValueKind.String);
                            key.SetValue("Wait", busyFile, RegistryValueKind.String);
                            key.SetValue("Crosshair", crossFile, RegistryValueKind.String);
                            key.SetValue("IBeam", beamFile, RegistryValueKind.String);
                            key.SetValue("NWPen", penFile, RegistryValueKind.String);
                            key.SetValue("No", noFile, RegistryValueKind.String);
                            key.SetValue("SizeNS", nsFile, RegistryValueKind.String);
                            key.SetValue("SizeWE", weFile, RegistryValueKind.String);
                            key.SetValue("SizeNWSE", nwseFile, RegistryValueKind.String);
                            key.SetValue("SizeNESW", neswFile, RegistryValueKind.String);
                            key.SetValue("SizeAll", moveFile, RegistryValueKind.String);
                            key.SetValue("UpArrow", upFile, RegistryValueKind.String);
                            key.SetValue("Hand", @"C:\Windows\Cursors\aero_link_i.cur", RegistryValueKind.String);
                        }
                    }
                }

                // Force windows system parameters to reload cursors immediately
                SystemParametersInfo(SPI_SETCURSORS, 0, IntPtr.Zero, SPIF_SENDCHANGE | SPIF_UPDATEINIFILE);

                // Save private settings for UI state consistency
                SavePrivateSetting("CursorSize", sizeVal);
                SavePrivateSetting("CursorColor", colorIdx);

                MainWindow.Instance.Log(Lang.TranslateString("Configurazione cursore aggiornata ed inviata alle API di Windows."), "SUCCESSO");
                MainWindow.Instance.ShowToast(Lang.TranslateString("Puntatore mouse aggiornato!"));
            }
            catch (Exception ex)
            {
                MainWindow.Instance.Log(Lang.TranslateString("Impossibile salvare configurazione cursore: ") + ex.Message, "ERRORE");
            }
        }

        private void RestartExplorer()
        {
            SoundManager.PlayClick();

            // Always ask the user explicitly before touching any system process
            var result = MessageBox.Show(
                Lang.TranslateString("Questa operazione riavvierà la shell di Windows (Esplora Risorse).\n\n") +
                Lang.TranslateString("Il desktop sparirà per un secondo e poi verrà ripristinato automaticamente.\n\n") +
                Lang.TranslateString("Continuare?"),
                Lang.TranslateString("Riavvia Esplora Risorse"),
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (result != MessageBoxResult.Yes) return;

            MainWindow.Instance.Log(Lang.TranslateString("Riavvio in corso della shell Esplora Risorse..."));
            System.Threading.Tasks.Task.Run(() =>
            {
                try
                {
                    foreach (var process in System.Diagnostics.Process.GetProcessesByName("explorer"))
                    {
                        process.Kill();
                        process.WaitForExit();
                    }
                }
                catch {}

                System.Threading.Thread.Sleep(800);

                try
                {
                    System.Diagnostics.Process.Start("explorer.exe");
                }
                catch {}

                this.Dispatcher.BeginInvoke(new Action(() =>
                {
                    MainWindow.Instance.Log(Lang.TranslateString("Esplora Risorse riavviato correttamente."), "SUCCESSO");
                    MainWindow.Instance.ShowToast(Lang.TranslateString("Esplora Risorse riavviato!"));
                }));
            });
        }
    }
}
