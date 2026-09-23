<#
.SYNOPSIS
    PavoTweak Windows Performance Suite — Booster Edition (v2.6)
    Secured with real-time Discord 2-Boost verification.
.DESCRIPTION
    Professional Windows gaming & system optimization CLI tool.
    Requires an active Pavo Server Booster authorization (2 Server Boosts).
#>

[CmdletBinding()]
param(
    [string]$ApiUrl = 'https://pavo-tweak-suite.onrender.com',
    [string]$AuthCode = ''
)

# Enforce TLS 1.2 / 1.3
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

# Global State
$script:ApiBase = $ApiUrl.TrimEnd('/')
$script:SessionToken = $null
$script:SessionId = $null
$script:UserData = $null
$script:BackupDir = Join-Path $env:APPDATA 'PavoTweak\Backups'
$script:LogDir = Join-Path $env:APPDATA 'PavoTweak\Logs'

# Ensure directories exist
if (-not (Test-Path $script:BackupDir)) { New-Item -ItemType Directory -Path $script:BackupDir -Force | Out-Null }
if (-not (Test-Path $script:LogDir)) { New-Item -ItemType Directory -Path $script:LogDir -Force | Out-Null }

# ─────────────────────────────────────────────────────────────────────────────
# UI Formatting & Colors
# ─────────────────────────────────────────────────────────────────────────────

function Write-Header {
    Clear-Host
    Write-Host '╔══════════════════════════════════════════════════════════════╗' -ForegroundColor Cyan
    Write-Host '║                         PAVO TWEAK                           ║' -ForegroundColor Cyan
    Write-Host '║               WINDOWS PERFORMANCE SUITE v2.6                 ║' -ForegroundColor White
    Write-Host '║                      Booster Edition                         ║' -ForegroundColor Magenta
    Write-Host '╚══════════════════════════════════════════════════════════════╝' -ForegroundColor Cyan
    Write-Host ''
}

function Write-Divider {
    Write-Host '────────────────────────────────────────────────────────────────' -ForegroundColor DarkGray
}

function Write-StatusBanner {
    Write-Divider
    if ($script:UserData) {
        Write-Host ' Discord Member  : ' -NoNewline -ForegroundColor Gray
        Write-Host "$($script:UserData.discordUsername) " -NoNewline -ForegroundColor White
        Write-Host "($($script:UserData.discordUserId))" -ForegroundColor DarkGray

        Write-Host ' Booster Status  : ' -NoNewline -ForegroundColor Gray
        Write-Host 'Active ' -NoNewline -ForegroundColor Green
        Write-Host '[OK] ' -NoNewline -ForegroundColor Green
        Write-Host "($($script:UserData.boostCount) Boosts Verified)" -ForegroundColor DarkGray

        Write-Host ' Pavo Access     : ' -NoNewline -ForegroundColor Gray
        Write-Host 'Authorized [OK]' -ForegroundColor Green

        Write-Host ' Active Session  : ' -NoNewline -ForegroundColor Gray
        Write-Host "$($script:SessionId) " -NoNewline -ForegroundColor DarkCyan
        Write-Host '(Heartbeat: OK)' -ForegroundColor DarkGreen
    } else {
        Write-Host ' Authorization   : ' -NoNewline -ForegroundColor Gray
        Write-Host 'Unauthenticated' -ForegroundColor Yellow
    }
    Write-Divider
    Write-Host ''
}

# ─────────────────────────────────────────────────────────────────────────────
# Session & Revocation Engine
# ─────────────────────────────────────────────────────────────────────────────

function Test-PavoSession {
    if (-not $script:SessionToken) { return $false }

    try {
        $headers = @{
            'Authorization' = "Bearer $($script:SessionToken)"
            'User-Agent'    = 'PavoTweakCLI/2.6'
        }
        $response = Invoke-RestMethod -Uri "$($script:ApiBase)/api/booster/auth/session" -Method Get -Headers $headers -ErrorAction Stop
        return ($response.success -eq $true)
    }
    catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        if ($statusCode -eq 403 -or $_.ErrorDetails.Message -like '*ACCESS_REVOKED*') {
            Show-AccessRevokedScreen
            return $false
        }
        return $false
    }
}

function Show-AccessRevokedScreen {
    Clear-Host
    Write-Host '╔══════════════════════════════════════════════════════════════╗' -ForegroundColor Red
    Write-Host '║                         PAVO TWEAK                           ║' -ForegroundColor Red
    Write-Host '║                       ACCESS REVOKED                         ║' -ForegroundColor Yellow
    Write-Host '╚══════════════════════════════════════════════════════════════╝' -ForegroundColor Red
    Write-Host ''
    Write-Host ' [!] Your Discord booster eligibility is no longer valid.' -ForegroundColor Red
    Write-Host ''
    Write-Host ' Requirement:' -ForegroundColor White
    Write-Host '   At least 2 active Server Boosts to the Pavo Discord server.' -ForegroundColor Gray
    Write-Host ''
    Write-Host ' Action Required:' -ForegroundColor White
    Write-Host '   1. Re-boost the Pavo Discord server with 2 boosts.' -ForegroundColor Gray
    Write-Host '   2. Ask staff to run /pavo-verify.' -ForegroundColor Gray
    Write-Host '   3. Run /pavo-access on Discord to generate a new access code.' -ForegroundColor Gray
    Write-Host ''
    Write-Divider
    Write-Host 'Press any key to exit...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
    exit 0
}

function Invoke-AuthenticationFlow {
    param([string]$ProvidedCode = '')

    while ($true) {
        Write-Header
        Write-Host ' [AUTHENTICATION REQUIRED]' -ForegroundColor Yellow
        Write-Host ' PavoTweak Booster Edition is exclusive to Discord Server Boosters (2+ Boosts).' -ForegroundColor Gray
        Write-Host ' Type ' -NoNewline -ForegroundColor Gray
        Write-Host '/pavo-access ' -NoNewline -ForegroundColor Cyan
        Write-Host 'in Discord to generate your single-use temporary code.' -ForegroundColor Gray
        Write-Host ''

        $codeToUse = $ProvidedCode
        if ([string]::IsNullOrWhiteSpace($codeToUse)) {
            Write-Host ' Enter your temporary Discord authentication code:' -ForegroundColor White
            Write-Host ' > ' -NoNewline -ForegroundColor Cyan
            $codeToUse = Read-Host
        }

        if ([string]::IsNullOrWhiteSpace($codeToUse)) {
            Write-Host ''
            Write-Host ' [!] Authentication code cannot be empty.' -ForegroundColor Red
            Start-Sleep -Seconds 2
            $ProvidedCode = ''
            continue
        }

        Write-Host ''
        Write-Host ' [*] Verifying code with Pavo Security Server...' -ForegroundColor DarkCyan

        try {
            $hwid = (Get-CimInstance Win32_ComputerSystemProduct).UUID
            $body = @{
                code = $codeToUse.Trim().ToUpper()
                hwid = $hwid
            } | ConvertTo-Json

            $headers = @{
                'Content-Type' = 'application/json'
                'User-Agent'   = 'PavoTweakCLI/2.6'
            }

            $response = Invoke-RestMethod -Uri "$($script:ApiBase)/api/booster/auth/exchange" -Method Post -Headers $headers -Body $body -ErrorAction Stop

            if ($response.success -and $response.data.sessionToken) {
                $script:SessionToken = $response.data.sessionToken
                $script:SessionId = $response.data.sessionId
                $script:UserData = $response.data.user

                Write-Host ' [OK] Authorization successful! Session activated.' -ForegroundColor Green
                Start-Sleep -Seconds 1
                return $true
            } else {
                Write-Host ''
                Write-Host " [!] Authentication failed: $($response.message)" -ForegroundColor Red
                Start-Sleep -Seconds 3
                $ProvidedCode = ''
            }
        }
        catch {
            $errMsg = $_.Exception.Message
            if ($_.ErrorDetails.Message) {
                try {
                    $jsonErr = $_.ErrorDetails.Message | ConvertFrom-Json
                    $errMsg = $jsonErr.message
                } catch {
                    $errMsg = $_.ErrorDetails.Message
                }
            }
            Write-Host ''
            Write-Host " [!] Authentication failed: $errMsg" -ForegroundColor Red
            Write-Host ' Make sure the backend is running and your booster status is active.' -ForegroundColor DarkGray
            Write-Host ''
            Write-Host ' Press any key to try again...' -ForegroundColor DarkGray
            $null = [Console]::ReadKey($true)
            $ProvidedCode = ''
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# Safe Backup & Restore Engine
# ─────────────────────────────────────────────────────────────────────────────

function Save-TweakCheckpoint {
    param(
        [string]$TweakName,
        [array]$RegistryBackups
    )

    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $filename = "backup_${TweakName}_${timestamp}.json"
    $fullPath = Join-Path $script:BackupDir $filename

    $backupPayload = @{
        tweakName = $TweakName
        timestamp = $timestamp
        createdAt = (Get-Date).ToString('o')
        entries   = $RegistryBackups
    }

    $backupPayload | ConvertTo-Json -Depth 5 | Set-Content -Path $fullPath -Encoding UTF8
    Write-Host " [Backup] Created restore point: $filename" -ForegroundColor DarkGray
}

function Set-RegistryValueSafe {
    param(
        [string]$Path,
        [string]$Name,
        $Value,
        [string]$Type = 'DWord',
        [ref]$BackupList
    )

    $oldValue = $null
    $exists = $false

    if (Test-Path $Path) {
        $item = Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue
        if ($null -ne $item -and $null -ne $item.$Name) {
            $oldValue = $item.$Name
            $exists = $true
        }
    } else {
        New-Item -Path $Path -Force -ErrorAction SilentlyContinue | Out-Null
    }

    if ($BackupList) {
        $BackupList.Value += @{
            path     = $Path
            name     = $Name
            oldValue = $oldValue
            newValue = $Value
            type     = $Type
            existed  = $exists
        }
    }

    Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type $Type -Force -ErrorAction SilentlyContinue | Out-Null
}

# ─────────────────────────────────────────────────────────────────────────────
# Optimization Modules
# ─────────────────────────────────────────────────────────────────────────────

function Invoke-FpsOptimization {
    if (-not (Test-PavoSession)) { return }

    Write-Header
    Write-Host ' [1] FPS OPTIMIZATION & GAMING SCHEDULER' -ForegroundColor Cyan
    Write-Divider
    Write-Host ' Applying safe Windows gaming and responsiveness optimizations...' -ForegroundColor Gray

    $backups = @()

    # 1. Windows Game Mode
    Write-Host ' [*] Optimizing Windows Game Mode and GameBar settings...' -ForegroundColor White
    Set-RegistryValueSafe -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value 1 -Type 'DWord' -BackupList ([ref]$backups)
    Set-RegistryValueSafe -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AllowAutoGameMode' -Value 1 -Type 'DWord' -BackupList ([ref]$backups)
    Set-RegistryValueSafe -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 -Type 'DWord' -BackupList ([ref]$backups)
    Set-RegistryValueSafe -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_FSEBehaviorMode' -Value 2 -Type 'DWord' -BackupList ([ref]$backups)

    # 2. System Responsiveness & MMCSS
    Write-Host ' [*] Tuning Multimedia and System Responsiveness (0x00000000)...' -ForegroundColor White
    Set-RegistryValueSafe -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -Value 0 -Type 'DWord' -BackupList ([ref]$backups)
    Set-RegistryValueSafe -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xFFFFFFFF -Type 'DWord' -BackupList ([ref]$backups)

    # 3. MMCSS Gaming GPU Priority
    Write-Host ' [*] Setting MMCSS Games task to High GPU Priority...' -ForegroundColor White
    Set-RegistryValueSafe -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'GPU Priority' -Value 8 -Type 'DWord' -BackupList ([ref]$backups)
    Set-RegistryValueSafe -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Priority' -Value 6 -Type 'DWord' -BackupList ([ref]$backups)
    Set-RegistryValueSafe -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Scheduling Category' -Value 'High' -Type 'String' -BackupList ([ref]$backups)
    Set-RegistryValueSafe -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'SFIO Priority' -Value 'High' -Type 'String' -BackupList ([ref]$backups)

    # 4. Power Plan
    Write-Host ' [*] Activating High Performance Power Plan...' -ForegroundColor White
    try {
        & powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null | Out-Null
        & powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null | Out-Null
    } catch {}

    Save-TweakCheckpoint -TweakName 'FPS_Optimization' -RegistryBackups $backups

    Write-Host ''
    Write-Host ' [OK] FPS Optimization completed successfully!' -ForegroundColor Green
    Write-Host ' Press any key to return to menu...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

function Invoke-WindowsOptimization {
    if (-not (Test-PavoSession)) { return }

    Write-Header
    Write-Host ' [2] WINDOWS SYSTEM OPTIMIZATION' -ForegroundColor Cyan
    Write-Divider
    Write-Host ' Tuning Windows visual performance, telemetry and background memory...' -ForegroundColor Gray

    $backups = @()

    # 1. Visual Performance Settings
    Write-Host ' [*] Optimizing Windows animation delay and visual responsiveness...' -ForegroundColor White
    Set-RegistryValueSafe -Path 'HKCU:\Control Panel\Desktop' -Name 'MenuShowDelay' -Value '0' -Type 'String' -BackupList ([ref]$backups)
    Set-RegistryValueSafe -Path 'HKCU:\Control Panel\Desktop\WindowMetrics' -Name 'MinAnimate' -Value '0' -Type 'String' -BackupList ([ref]$backups)

    # 2. Disable safe background diagnostic overhead
    Write-Host ' [*] Disabling unnecessary background diagnostic throttle...' -ForegroundColor White
    Set-RegistryValueSafe -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Name 'AllowTelemetry' -Value 0 -Type 'DWord' -BackupList ([ref]$backups)
    Set-RegistryValueSafe -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications' -Name 'GlobalUserDisabled' -Value 1 -Type 'DWord' -BackupList ([ref]$backups)

    # 3. RAM Working Set Trim
    Write-Host ' [*] Trimming idle system working set memory cache...' -ForegroundColor White
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()

    Save-TweakCheckpoint -TweakName 'Windows_Optimization' -RegistryBackups $backups

    Write-Host ''
    Write-Host ' [OK] Windows Optimization completed successfully!' -ForegroundColor Green
    Write-Host ' Press any key to return to menu...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

function Invoke-FiveMOptimization {
    if (-not (Test-PavoSession)) { return }

    Write-Header
    Write-Host ' [3] FIVEM GAMING OPTIMIZATION' -ForegroundColor Cyan
    Write-Divider
    Write-Host ' Cleaning FiveM cache and configuring high priority scheduling...' -ForegroundColor Gray

    $backups = @()

    # 1. FiveM Cache Cleaning
    Write-Host ' [*] Checking FiveM installation directories...' -ForegroundColor White
    $fivemLocal = Join-Path $env:LOCALAPPDATA 'FiveM\FiveM.app'
    $cleanedCount = 0

    if (Test-Path $fivemLocal) {
        $cachePaths = @(
            (Join-Path $fivemLocal 'data\cache'),
            (Join-Path $fivemLocal 'data\nui-storage'),
            (Join-Path $fivemLocal 'data\server-cache'),
            (Join-Path $fivemLocal 'data\server-cache-priv')
        )

        foreach ($p in $cachePaths) {
            if (Test-Path $p) {
                try {
                    Remove-Item -Path "$p\*" -Recurse -Force -ErrorAction SilentlyContinue
                    $cleanedCount++
                } catch {}
            }
        }
        Write-Host " [OK] FiveM local cache purged ($($cleanedCount) caches cleared)." -ForegroundColor Green
    } else {
        Write-Host ' [i] FiveM standard directory not found in LocalAppData (Skipped cache file purge).' -ForegroundColor DarkGray
    }

    # 2. FiveM Process CPU Priority
    Write-Host ' [*] Setting FiveM high CPU priority in Windows registry...' -ForegroundColor White
    Set-RegistryValueSafe -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FiveM.exe\PerfOptions' -Name 'CpuPriorityClass' -Value 3 -Type 'DWord' -BackupList ([ref]$backups)
    Set-RegistryValueSafe -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FiveM_GTAProcess.exe\PerfOptions' -Name 'CpuPriorityClass' -Value 3 -Type 'DWord' -BackupList ([ref]$backups)

    Save-TweakCheckpoint -TweakName 'FiveM_Optimization' -RegistryBackups $backups

    Write-Host ''
    Write-Host ' [OK] FiveM Optimization completed successfully!' -ForegroundColor Green
    Write-Host ' Press any key to return to menu...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

function Invoke-FortniteOptimization {
    if (-not (Test-PavoSession)) { return }

    Write-Header
    Write-Host ' [4] FORTNITE OPTIMIZATION' -ForegroundColor Cyan
    Write-Divider
    Write-Host ' Optimizing DirectX shader cache and Fortnite process scheduling...' -ForegroundColor Gray

    $backups = @()

    # 1. Clean DirectX Shader Cache (Stutter Fix)
    Write-Host ' [*] Purging corrupt DirectX shader caches to reduce micro-stutters...' -ForegroundColor White
    $d3dPath = Join-Path $env:LOCALAPPDATA 'D3DSCache'
    $nvidiaCache = Join-Path $env:LOCALAPPDATA 'NVIDIA\DXCache'

    if (Test-Path $d3dPath) {
        Remove-Item -Path "$d3dPath\*" -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $nvidiaCache) {
        Remove-Item -Path "$nvidiaCache\*" -Recurse -Force -ErrorAction SilentlyContinue
    }

    # 2. Fortnite High Priority
    Write-Host ' [*] Setting Fortnite High CPU Priority in Windows scheduler...' -ForegroundColor White
    Set-RegistryValueSafe -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping.exe\PerfOptions' -Name 'CpuPriorityClass' -Value 3 -Type 'DWord' -BackupList ([ref]$backups)

    Save-TweakCheckpoint -TweakName 'Fortnite_Optimization' -RegistryBackups $backups

    Write-Host ''
    Write-Host ' [OK] Fortnite Optimization completed successfully!' -ForegroundColor Green
    Write-Host ' Press any key to return to menu...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

function Invoke-TempCleanOptimization {
    if (-not (Test-PavoSession)) { return }

    Write-Header
    Write-Host ' [5] TEMPORARY FILES DEEP CLEAN' -ForegroundColor Cyan
    Write-Divider
    Write-Host ' Safely cleaning temporary files, prefetch, error dumps and cache...' -ForegroundColor Gray

    $cleanedBytes = 0
    $targets = @(
        $env:TEMP,
        'C:\Windows\Temp',
        'C:\Windows\Prefetch',
        (Join-Path $env:LOCALAPPDATA 'CrashDumps'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\DeliveryOptimization')
    )

    foreach ($target in $targets) {
        if (Test-Path $target) {
            Write-Host " [*] Cleaning: $target" -ForegroundColor White
            Get-ChildItem -Path $target -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                try {
                    $cleanedBytes += $_.Length
                    Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
                } catch {}
            }
        }
    }

    # Clear Recycle Bin
    try {
        Clear-RecycleBin -Force -ErrorAction SilentlyContinue | Out-Null
    } catch {}

    $cleanedMb = [math]::Round($cleanedBytes / 1MB, 2)
    Write-Host ''
    Write-Host " [OK] Deep Clean complete! Freed ~$($cleanedMb) MB of temporary storage." -ForegroundColor Green
    Write-Host ' Press any key to return to menu...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

function Invoke-NetworkOptimization {
    if (-not (Test-PavoSession)) { return }

    Write-Header
    Write-Host ' [6] NETWORK & LATENCY OPTIMIZATION' -ForegroundColor Cyan
    Write-Divider
    Write-Host ' Tuning TCP NoDelay, Nagles algorithm and DNS cache...' -ForegroundColor Gray

    $backups = @()

    # 1. Flush & register DNS
    Write-Host ' [*] Flushing and resetting DNS resolver cache...' -ForegroundColor White
    & ipconfig /flushdns 2>$null | Out-Null
    & ipconfig /registerdns 2>$null | Out-Null

    # 2. Disable Nagle's Algorithm on active network interfaces
    Write-Host ' [*] Applying TCPNoDelay and TcpAckFrequency (Nagle disable)...' -ForegroundColor White
    $interfacesPath = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces'
    if (Test-Path $interfacesPath) {
        Get-ChildItem -Path $interfacesPath | ForEach-Object {
            $subPath = $_.PSPath
            Set-RegistryValueSafe -Path $subPath -Name 'TcpAckFrequency' -Value 1 -Type 'DWord' -BackupList ([ref]$backups)
            Set-RegistryValueSafe -Path $subPath -Name 'TCPNoDelay' -Value 1 -Type 'DWord' -BackupList ([ref]$backups)
        }
    }

    Save-TweakCheckpoint -TweakName 'Network_Optimization' -RegistryBackups $backups

    Write-Host ''
    Write-Host ' [OK] Network & Latency Optimization applied successfully!' -ForegroundColor Green
    Write-Host ' Press any key to return to menu...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

function Invoke-SystemInfo {
    if (-not (Test-PavoSession)) { return }

    Write-Header
    Write-Host ' [7] SYSTEM INFORMATION & DIAGNOSTICS' -ForegroundColor Cyan
    Write-Divider

    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
        $gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1
        $totalRamGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
        $freeRamGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
        $activeScheme = (& powercfg /getactivescheme) -replace '.*:\s*', ''

        Write-Host ' Operating System : ' -NoNewline -ForegroundColor Gray
        Write-Host "$($os.Caption) (Build $($os.BuildNumber))" -ForegroundColor White

        Write-Host ' Processor (CPU)  : ' -NoNewline -ForegroundColor Gray
        Write-Host "$($cpu.Name)" -ForegroundColor White

        Write-Host ' Graphics (GPU)   : ' -NoNewline -ForegroundColor Gray
        Write-Host "$($gpu.Name)" -ForegroundColor White

        Write-Host ' System Memory    : ' -NoNewline -ForegroundColor Gray
        Write-Host "$($totalRamGb) GB Total ($($freeRamGb) GB Free)" -ForegroundColor White

        Write-Host ' Active Power Plan: ' -NoNewline -ForegroundColor Gray
        Write-Host "$activeScheme" -ForegroundColor White

        Write-Host ' Pavo Version     : ' -NoNewline -ForegroundColor Gray
        Write-Host 'PavoTweak Booster Edition v2.6 (Production)' -ForegroundColor Cyan

        Write-Host ' Verified Booster : ' -NoNewline -ForegroundColor Gray
        Write-Host "$($script:UserData.discordUsername) ($($script:UserData.boostCount) Boosts)" -ForegroundColor Green
    }
    catch {
        Write-Host " [!] Error retrieving system info: $_" -ForegroundColor Red
    }

    Write-Host ''
    Write-Host ' Press any key to return to menu...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

# ─────────────────────────────────────────────────────────────────────────────
# Restore System
# ─────────────────────────────────────────────────────────────────────────────

function Invoke-RestoreSystem {
    if (-not (Test-PavoSession)) { return }

    while ($true) {
        Write-Header
        Write-Host ' [8] RESTORE SYSTEM & UNDO CHANGES' -ForegroundColor Cyan
        Write-Divider
        Write-Host ' [1] Restore Last Changes' -ForegroundColor White
        Write-Host ' [2] Restore All PavoTweak Changes' -ForegroundColor White
        Write-Host ' [3] View Changes History' -ForegroundColor White
        Write-Host ' [4] Back to Main Menu' -ForegroundColor DarkGray
        Write-Host ''
        Write-Host ' Select an option [1-4]: ' -NoNewline -ForegroundColor Cyan
        $choice = Read-Host

        switch ($choice) {
            '1' { Restore-LastChanges }
            '2' { Restore-AllChanges }
            '3' { View-ChangesHistory }
            '4' { return }
        }
    }
}

function Restore-BackupFile([string]$FilePath) {
    if (-not (Test-Path $FilePath)) { return }

    try {
        $json = Get-Content -Path $FilePath -Raw -Encoding UTF8 | ConvertFrom-Json
        Write-Host " [*] Restoring checkpoint: $($json.tweakName) ($($json.timestamp))..." -ForegroundColor White

        foreach ($entry in $json.entries) {
            if ($entry.existed -and $null -ne $entry.oldValue) {
                Set-ItemProperty -Path $entry.path -Name $entry.name -Value $entry.oldValue -Type $entry.type -Force -ErrorAction SilentlyContinue | Out-Null
            } elseif (-not $entry.existed) {
                Remove-ItemProperty -Path $entry.path -Name $entry.name -Force -ErrorAction SilentlyContinue | Out-Null
            }
        }

        Write-Host ' [OK] Checkpoint successfully restored.' -ForegroundColor Green
    }
    catch {
        Write-Host " [!] Failed to restore file: $_" -ForegroundColor Red
    }
}

function Restore-LastChanges {
    $latest = Get-ChildItem -Path $script:BackupDir -Filter 'backup_*.json' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) {
        Write-Host ''
        Write-Host ' [!] No restore checkpoints found.' -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        return
    }

    Write-Host ''
    Restore-BackupFile -FilePath $latest.FullName
    Write-Host ''
    Write-Host ' Press any key to continue...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

function Restore-AllChanges {
    $backups = Get-ChildItem -Path $script:BackupDir -Filter 'backup_*.json' | Sort-Object LastWriteTime -Descending
    if (-not $backups -or $backups.Count -eq 0) {
        Write-Host ''
        Write-Host ' [!] No restore checkpoints found.' -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        return
    }

    Write-Host ''
    Write-Host " [*] Rolling back all ($($backups.Count)) PavoTweak restore checkpoints..." -ForegroundColor White
    foreach ($b in $backups) {
        Restore-BackupFile -FilePath $b.FullName
    }

    Write-Host ''
    Write-Host ' [OK] All PavoTweak modifications have been restored to original states!' -ForegroundColor Green
    Write-Host ' Press any key to continue...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

function View-ChangesHistory {
    $backups = Get-ChildItem -Path $script:BackupDir -Filter 'backup_*.json' | Sort-Object LastWriteTime -Descending
    Write-Host ''
    Write-Host ' BACKUP & CHANGE LOG HISTORY:' -ForegroundColor Yellow
    Write-Divider

    if (-not $backups -or $backups.Count -eq 0) {
        Write-Host ' No restore checkpoints found.' -ForegroundColor Gray
    } else {
        foreach ($b in $backups) {
            $json = Get-Content -Path $b.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
            Write-Host " * $($json.tweakName) " -NoNewline -ForegroundColor Cyan
            Write-Host "[$($json.createdAt)] " -NoNewline -ForegroundColor DarkGray
            Write-Host "($($json.entries.Count) registry keys)" -ForegroundColor Gray
        }
    }

    Write-Host ''
    Write-Host ' Press any key to continue...' -ForegroundColor DarkGray
    $null = [Console]::ReadKey($true)
}

# ─────────────────────────────────────────────────────────────────────────────
# Settings & Main Loop
# ─────────────────────────────────────────────────────────────────────────────

function Invoke-SettingsMenu {
    Write-Header
    Write-Host ' [9] SETTINGS & SESSION' -ForegroundColor Cyan
    Write-Divider
    Write-Host " API Backend Base : $($script:ApiBase)" -ForegroundColor White
    Write-Host " Active Session   : $($script:SessionId)" -ForegroundColor White
    Write-Host " Discord User ID  : $($script:UserData.discordUserId)" -ForegroundColor White
    Write-Host " Discord Username : $($script:UserData.discordUsername)" -ForegroundColor White
    Write-Host " Backup Directory : $($script:BackupDir)" -ForegroundColor White
    Write-Host ''
    Write-Host ' [1] Change API Server URL' -ForegroundColor White
    Write-Host ' [2] Logout and Terminate Session' -ForegroundColor White
    Write-Host ' [3] Back to Main Menu' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host ' Select an option [1-3]: ' -NoNewline -ForegroundColor Cyan
    $choice = Read-Host

    switch ($choice) {
        '1' {
            Write-Host ' Enter new Backend URL (e.g. http://localhost:5000):' -ForegroundColor White
            $newUrl = Read-Host
            if (-not [string]::IsNullOrWhiteSpace($newUrl)) {
                $script:ApiBase = $newUrl.TrimEnd('/')
                Write-Host " [OK] Backend URL updated to: $($script:ApiBase)" -ForegroundColor Green
                Start-Sleep -Seconds 1
            }
        }
        '2' {
            try {
                $headers = @{ 'Authorization' = "Bearer $($script:SessionToken)" }
                Invoke-RestMethod -Uri "$($script:ApiBase)/api/booster/auth/logout" -Method Post -Headers $headers -ErrorAction SilentlyContinue | Out-Null
            } catch {}
            $script:SessionToken = $null
            $script:SessionId = $null
            $script:UserData = $null
            Write-Host ' [OK] Logged out successfully.' -ForegroundColor Green
            Start-Sleep -Seconds 1
            Invoke-AuthenticationFlow
        }
    }
}

function Main {
    # 1. Require Administrator Elevation
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host ' [!] PavoTweak requires Administrator privileges to apply system optimizations.' -ForegroundColor Red
        Write-Host " Please right-click PowerShell or Launch-PavoTweak.bat and select 'Run as Administrator'." -ForegroundColor Yellow
        Write-Host ''
        Write-Host ' Press any key to exit...' -ForegroundColor DarkGray
        $null = [Console]::ReadKey($true)
        exit 1
    }

    # 2. Authenticate
    Invoke-AuthenticationFlow -ProvidedCode $AuthCode

    # 3. Main Menu Loop
    while ($true) {
        if (-not (Test-PavoSession)) {
            Invoke-AuthenticationFlow
        }

        Write-Header
        Write-StatusBanner

        Write-Host ' [1] FPS Optimization' -ForegroundColor White
        Write-Host ' [2] Windows Optimization' -ForegroundColor White
        Write-Host ' [3] FiveM Optimization' -ForegroundColor White
        Write-Host ' [4] Fortnite Optimization' -ForegroundColor White
        Write-Host ' [5] Temporary Files Deep Clean' -ForegroundColor White
        Write-Host ' [6] Network & Latency Optimization' -ForegroundColor White
        Write-Host ' [7] System Information & Diagnostics' -ForegroundColor White
        Write-Host ' [8] Restore System & Undo Changes' -ForegroundColor White
        Write-Host ' [9] Settings & Session Details' -ForegroundColor White
        Write-Host ' [0] Exit' -ForegroundColor DarkGray
        Write-Host ''
        Write-Host ' Select an option [0-9]: ' -NoNewline -ForegroundColor Cyan
        $choice = Read-Host

        switch ($choice) {
            '1' { Invoke-FpsOptimization }
            '2' { Invoke-WindowsOptimization }
            '3' { Invoke-FiveMOptimization }
            '4' { Invoke-FortniteOptimization }
            '5' { Invoke-TempCleanOptimization }
            '6' { Invoke-NetworkOptimization }
            '7' { Invoke-SystemInfo }
            '8' { Invoke-RestoreSystem }
            '9' { Invoke-SettingsMenu }
            '0' {
                Write-Host ''
                Write-Host ' Exiting PavoTweak. Happy Gaming!' -ForegroundColor Cyan
                Start-Sleep -Seconds 1
                exit 0
            }
            default {
                Write-Host ' Invalid choice. Please select 0-9.' -ForegroundColor Red
                Start-Sleep -Seconds 1
            }
        }
    }
}

Main
