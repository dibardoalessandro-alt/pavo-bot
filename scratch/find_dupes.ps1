$lines = Get-Content src\Lang.cs
$keys = @()
$inMap = $false
foreach ($line in $lines) {
    if ($line -like "*_translationMap*") {
        $inMap = $true
        continue
    }
    if ($line -like "*_it =*") {
        $inMap = $false
        break
    }
    if ($inMap) {
        if ($line -match '\{\s*"([^"]+)"\s*,') {
            $keys += $Matches[1].Trim().ToLower()
        }
    }
}

$duplicates = $keys | Group-Object | Where-Object { $_.Count -gt 1 }
Write-Host "Duplicates:"
foreach ($d in $duplicates) {
    Write-Host "  - $($d.Name) ($($d.Count))"
}
