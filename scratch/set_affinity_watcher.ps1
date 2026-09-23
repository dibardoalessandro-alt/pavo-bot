Write-Output "Starting AC Odyssey Affinity Watcher..."
$applied = @{}

while ($true) {
    $procs = Get-Process -Name ACOdyssey, ACOdyssey_plus -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        if (-not $applied.ContainsKey($p.Id)) {
            try {
                $p.ProcessorAffinity = [IntPtr]4095
                $p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High
                Write-Output "Applied P-cores affinity to $($p.ProcessName) (PID: $($p.Id))"
                $applied[$p.Id] = $true
            } catch {}
        }
    }
    Start-Sleep -Milliseconds 100
}
