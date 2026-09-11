$ErrorActionPreference = 'SilentlyContinue'

# Complete cleanup for SEB EvalPro / SEB-eval-PRO.
# User documents, especially Documents\SEB EvalPro\Bilans, are never removed.

$eAcute = [char]0x00E9
$accentedName = "SEB-$($eAcute)val-PRO"
$names = @($accentedName, 'SEB EvalPro', 'SEB-eval-PRO', 'seb-evalpro') | Select-Object -Unique
$diagnosticPath = Join-Path $env:TEMP 'seb-evalpro-uninstall-leftovers.txt'
Remove-Item -LiteralPath $diagnosticPath -Force -ErrorAction SilentlyContinue

function ConvertTo-SebAscii {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ''
    }

    $normalized = $Value.Trim().ToLowerInvariant()
    $normalized = $normalized.Replace([string]$eAcute, 'e')
    $normalized = $normalized -replace '[\s_]+', '-'
    return $normalized
}

function Test-SebEvalName {
    param([string]$Value)

    $normalized = ConvertTo-SebAscii $Value
    if (-not $normalized) {
        return $false
    }

    $normalized = $normalized -replace '-?\d+(?:\.\d+){1,3}(?:-.*)?$', ''
    return $normalized -in @('seb-eval-pro', 'seb-evalpro')
}

function Test-SebEvalRegistryEntry {
    param($Entry)

    if (Test-SebEvalName $Entry.DisplayName) {
        return $true
    }

    foreach ($candidate in @($Entry.InstallLocation, $Entry.UninstallString, $Entry.QuietUninstallString)) {
        $normalized = ConvertTo-SebAscii $candidate
        if ($normalized -match 'seb-eval-?pro') {
            return $true
        }
    }

    return $false
}

function Split-UninstallCommand {
    param([string]$Command)

    if ([string]::IsNullOrWhiteSpace($Command)) {
        return $null
    }

    $expanded = [Environment]::ExpandEnvironmentVariables($Command.Trim())
    if ($expanded -match '^\s*"([^"]+)"\s*(.*)$') {
        return [pscustomobject]@{
            Exe  = $matches[1]
            Args = $matches[2]
        }
    }

    if ($expanded -match '^\s*(.+?\.exe)\s*(.*)$') {
        return [pscustomobject]@{
            Exe  = $matches[1].Trim()
            Args = $matches[2]
        }
    }

    return $null
}

function Remove-PathWithRetry {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return
    }

    for ($attempt = 0; $attempt -lt 12; $attempt++) {
        if (-not (Test-Path -LiteralPath $Path)) {
            return
        }

        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 250
    }
}

$registryPatterns = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

function Get-SebEvalRegistryEntries {
    $entries = @()
    foreach ($pattern in $registryPatterns) {
        $entries += @(Get-ItemProperty $pattern -ErrorAction SilentlyContinue | Where-Object {
            Test-SebEvalRegistryEntry $_
        })
    }
    return @($entries)
}

# Stop the application if it is still running.
Get-Process -ErrorAction SilentlyContinue | Where-Object {
    Test-SebEvalName $_.ProcessName
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Milliseconds 500

# Find every registered installation and run its own uninstaller silently first.
$registeredApps = @(Get-SebEvalRegistryEntries)
$installLocations = New-Object System.Collections.Generic.List[string]
$executedUninstallers = @{}

foreach ($entry in $registeredApps) {
    if ($entry.InstallLocation) {
        $installLocations.Add([Environment]::ExpandEnvironmentVariables($entry.InstallLocation.Trim('"')))
    }

    $command = $entry.QuietUninstallString
    if (-not $command) {
        $command = $entry.UninstallString
    }

    $parsed = Split-UninstallCommand $command
    if (-not $parsed) {
        continue
    }

    $exe = $parsed.Exe
    $args = $parsed.Args

    if ($exe) {
        $parent = Split-Path -Parent $exe
        if ($parent) {
            $installLocations.Add($parent)
        }
    }

    if (-not $exe -or -not (Test-Path -LiteralPath $exe)) {
        continue
    }

    $uninstallerKey = $exe.ToLowerInvariant()
    if ($executedUninstallers.ContainsKey($uninstallerKey)) {
        continue
    }
    $executedUninstallers[$uninstallerKey] = $true

    if ($args -notmatch '(^|\s)/S($|\s)') {
        $args = ($args + ' /S').Trim()
    }

    $process = Start-Process -FilePath $exe -ArgumentList $args -Wait -PassThru -WindowStyle Hidden
    if ($process -and $process.ExitCode -ne 0) {
        Write-Output "Registered uninstaller returned code $($process.ExitCode): $exe"
    }
}

Start-Sleep -Milliseconds 1000

# Known install locations used by current and older builds.
$defaultInstallRoots = @(
    (Join-Path $env:LOCALAPPDATA "Programs\$accentedName"),
    (Join-Path $env:LOCALAPPDATA 'Programs\SEB EvalPro'),
    (Join-Path $env:LOCALAPPDATA 'Programs\SEB-eval-PRO'),
    (Join-Path $env:LOCALAPPDATA 'Programs\seb-evalpro'),
    (Join-Path $env:ProgramFiles $accentedName),
    (Join-Path $env:ProgramFiles 'SEB EvalPro'),
    (Join-Path $env:ProgramFiles 'SEB-eval-PRO'),
    (Join-Path $env:ProgramFiles 'seb-evalpro')
)

if (${env:ProgramFiles(x86)}) {
    $defaultInstallRoots += (Join-Path ${env:ProgramFiles(x86)} $accentedName)
    $defaultInstallRoots += (Join-Path ${env:ProgramFiles(x86)} 'SEB EvalPro')
    $defaultInstallRoots += (Join-Path ${env:ProgramFiles(x86)} 'SEB-eval-PRO')
    $defaultInstallRoots += (Join-Path ${env:ProgramFiles(x86)} 'seb-evalpro')
}

$allInstallRoots = @($installLocations) + $defaultInstallRoots
foreach ($path in ($allInstallRoots | Where-Object { $_ } | Select-Object -Unique)) {
    Remove-PathWithRetry $path
}

# Remove Electron userData/cache for every known product name.
$dataRoots = @()
foreach ($name in $names) {
    $dataRoots += (Join-Path $env:APPDATA $name)
    $dataRoots += (Join-Path $env:LOCALAPPDATA $name)
}

foreach ($path in ($dataRoots | Select-Object -Unique)) {
    Remove-PathWithRetry $path
}

# Remove desktop and Start Menu shortcuts from current-user and all-user locations.
$shortcutRoots = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    [Environment]::GetFolderPath('StartMenu'),
    [Environment]::GetFolderPath('CommonStartMenu')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

foreach ($root in $shortcutRoots) {
    Get-ChildItem -LiteralPath $root -Filter '*.lnk' -Recurse -Force -ErrorAction SilentlyContinue | Where-Object {
        Test-SebEvalName $_.BaseName
    } | Remove-Item -Force -ErrorAction SilentlyContinue
}

# Remove stale Add/Remove Programs entries after the physical cleanup.
foreach ($entry in @(Get-SebEvalRegistryEntries)) {
    Remove-Item -LiteralPath $entry.PSPath -Recurse -Force -ErrorAction SilentlyContinue
}

# Ask Windows to refresh shortcut/icon display.
$ie4uinit = Join-Path $env:SystemRoot 'System32\ie4uinit.exe'
if (Test-Path -LiteralPath $ie4uinit) {
    Start-Process -FilePath $ie4uinit -ArgumentList '-show' -Wait -WindowStyle Hidden
}

# Final verification: return a failure code if technical traces still remain.
$leftovers = New-Object System.Collections.Generic.List[string]

foreach ($entry in @(Get-SebEvalRegistryEntries)) {
    $leftovers.Add("Registry: $($entry.PSPath)")
}

foreach ($path in ($allInstallRoots | Where-Object { $_ } | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $path) {
        $leftovers.Add("Install: $path")
    }
}

foreach ($path in ($dataRoots | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $path) {
        $leftovers.Add("Data: $path")
    }
}

foreach ($root in $shortcutRoots) {
    Get-ChildItem -LiteralPath $root -Filter '*.lnk' -Recurse -Force -ErrorAction SilentlyContinue | Where-Object {
        Test-SebEvalName $_.BaseName
    } | ForEach-Object {
        $leftovers.Add("Shortcut: $($_.FullName)")
    }
}

Get-Process -ErrorAction SilentlyContinue | Where-Object {
    Test-SebEvalName $_.ProcessName
} | ForEach-Object {
    $leftovers.Add("Process: $($_.ProcessName)")
}

if ($leftovers.Count -gt 0) {
    $diagnosticLines = @('SEB EvalPro cleanup incomplete:')
    $diagnosticLines += @($leftovers | Select-Object -Unique | ForEach-Object { " - $_" })
    $diagnosticLines | Set-Content -LiteralPath $diagnosticPath -Encoding UTF8
    $diagnosticLines | ForEach-Object { Write-Output $_ }
    exit 2
}

Remove-Item -LiteralPath $diagnosticPath -Force -ErrorAction SilentlyContinue
Write-Output "$accentedName was uninstalled and its technical data were cleaned."
exit 0
