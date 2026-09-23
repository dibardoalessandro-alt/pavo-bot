@echo off
echo ==============================================
echo BUILDING PAVO TWEAK SUITE
echo ==============================================

echo 1. Compiling Uninstaller...
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /out:Uninstall.exe /win32icon:pavo_icon.ico /r:System.Xaml.dll /r:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\WindowsBase.dll /r:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\PresentationCore.dll /r:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\PresentationFramework.dll src\Setup\PavoUninstall.cs src\AssemblyInfo.cs
if %errorlevel% neq 0 (
    echo Uninstaller compilation FAILED.
    exit /b %errorlevel%
)

echo 2. Compiling Main Application (PavoTweak)...
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /out:PavoTweak.exe /win32icon:pavo_icon.ico /r:System.Xaml.dll /r:System.Management.dll /r:System.ServiceProcess.dll /r:System.Net.dll /r:System.Runtime.Serialization.dll /r:System.Numerics.dll /r:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\WindowsBase.dll /r:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\PresentationCore.dll /r:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\PresentationFramework.dll /resource:"moving-hexagons-illuminated-in-blue-light-infinitely-looped-animation-video.jpg" /resource:pavo_logo.png src\*.cs src\Views\*.cs PavoTweak.cs
if %errorlevel% neq 0 (
    echo Main Application compilation FAILED.
    exit /b %errorlevel%
)

echo 3. Compiling Installer Setup (PavoSetup)...
echo    [+] Compressing binaries to GZip streams to prevent AV false positives...
powershell -Command "$i = [System.IO.File]::ReadAllBytes('PavoTweak.exe'); $o = [System.IO.File]::Create('PavoTweak.gz'); $z = New-Object System.IO.Compression.GZipStream($o, [System.IO.Compression.CompressionMode]::Compress); $z.Write($i, 0, $i.Length); $z.Close(); $o.Close();"
powershell -Command "$i = [System.IO.File]::ReadAllBytes('Uninstall.exe'); $o = [System.IO.File]::Create('Uninstall.gz'); $z = New-Object System.IO.Compression.GZipStream($o, [System.IO.Compression.CompressionMode]::Compress); $z.Write($i, 0, $i.Length); $z.Close(); $o.Close();"

C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /out:PavoSetup.exe /win32icon:pavo_icon.ico /resource:PavoTweak.gz /resource:Uninstall.gz /resource:pavo_logo.png /r:System.Xaml.dll /r:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\WindowsBase.dll /r:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\PresentationCore.dll /r:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\PresentationFramework.dll src\Setup\PavoSetup.cs src\AssemblyInfo.cs
if %errorlevel% neq 0 (
    echo Installer Setup compilation FAILED.
    del PavoTweak.gz Uninstall.gz 2>nul
    exit /b %errorlevel%
)
del PavoTweak.gz Uninstall.gz 2>nul

echo ==============================================
echo BUILD SUCCESSFUL!
echo Output files: PavoTweak.exe, Uninstall.exe, PavoSetup.exe
echo ==============================================
