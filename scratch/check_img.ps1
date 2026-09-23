Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("c:\Users\dilar\Desktop\tweak\pavo_logo.png")
Write-Host "Width: $($img.Width) Height: $($img.Height)"
$img.Dispose()
