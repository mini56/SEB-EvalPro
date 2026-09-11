$ErrorActionPreference = 'SilentlyContinue'

# Nettoyage complet de SEB EvalPro / SEB-éval-PRO.
# Les documents utilisateur (notamment Documents\SEB EvalPro\Bilans) sont conservés.

$names = @('SEB-éval-PRO', 'SEB EvalPro', 'seb-evalpro')

# Fermer les processus de l'application s'ils tournent encore.
Get-Process | Where-Object {
    $_.ProcessName -in @('SEB-éval-PRO', 'SEB EvalPro', 'seb-evalpro')
} | Stop-Process -Force

# Rechercher toutes les anciennes installations enregistrées par Windows.
$registryPatterns = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

$registeredApps = @()
foreach ($pattern in $registryPatterns) {
    $registeredApps += Get-ItemProperty $pattern | Where-Object {
        $_.DisplayName -and ($names -contains $_.DisplayName)
    }
}

$installLocations = New-Object System.Collections.Generic.List[string]
foreach ($entry in $registeredApps) {
    if ($entry.InstallLocation) {
        $installLocations.Add([Environment]::ExpandEnvironmentVariables($entry.InstallLocation.Trim('"')))
    }

    $command = $entry.QuietUninstallString
    if (-not $command) { $command = $entry.UninstallString }
    if (-not $command) { continue }

    $exe = $null
    $args = ''
    if ($command -match '^\s*"([^"]+)"\s*(.*)$') {
        $exe = $matches[1]
        $args = $matches[2]
    } elseif ($command -match '^\s*([^\s]+\.exe)\s*(.*)$') {
        $exe = $matches[1]
        $args = $matches[2]
    }

    if ($exe -and (Test-Path -LiteralPath $exe)) {
        if ($args -notmatch '(^|\s)/S($|\s)') { $args = ($args + ' /S').Trim() }
        Start-Process -FilePath $exe -ArgumentList $args -Wait -WindowStyle Hidden
    }
}

Start-Sleep -Milliseconds 700

# Supprimer les dossiers d'installation trouvés dans le registre.
foreach ($location in ($installLocations | Select-Object -Unique)) {
    if ($location -and (Test-Path -LiteralPath $location)) {
        Remove-Item -LiteralPath $location -Recurse -Force
    }
}

# Supprimer également les emplacements par défaut utilisés au fil des builds.
$defaultInstallRoots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\SEB-éval-PRO'),
    (Join-Path $env:LOCALAPPDATA 'Programs\SEB EvalPro'),
    (Join-Path $env:LOCALAPPDATA 'Programs\seb-evalpro'),
    (Join-Path $env:ProgramFiles 'SEB-éval-PRO'),
    (Join-Path $env:ProgramFiles 'SEB EvalPro')
)
if (${env:ProgramFiles(x86)}) {
    $defaultInstallRoots += (Join-Path ${env:ProgramFiles(x86)} 'SEB-éval-PRO')
    $defaultInstallRoots += (Join-Path ${env:ProgramFiles(x86)} 'SEB EvalPro')
}
foreach ($path in $defaultInstallRoots) {
    if ($path -and (Test-Path -LiteralPath $path)) {
        Remove-Item -LiteralPath $path -Recurse -Force
    }
}

# Nettoyer les données/cache Electron des anciennes et nouvelles appellations.
$dataRoots = @()
foreach ($name in $names) {
    $dataRoots += (Join-Path $env:APPDATA $name)
    $dataRoots += (Join-Path $env:LOCALAPPDATA $name)
}
foreach ($path in ($dataRoots | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $path) {
        Remove-Item -LiteralPath $path -Recurse -Force
    }
}

# Retirer tous les raccourcis connus, y compris ceux laissés par d'anciens builds.
$shortcutRoots = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    [Environment]::GetFolderPath('StartMenu'),
    [Environment]::GetFolderPath('CommonStartMenu')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

foreach ($root in $shortcutRoots) {
    Get-ChildItem -LiteralPath $root -Filter '*.lnk' -Recurse -Force | Where-Object {
        $_.BaseName -in @('SEB-éval-PRO', 'SEB EvalPro', 'seb-evalpro')
    } | Remove-Item -Force
}

# Supprimer les entrées Désinstaller encore présentes après le nettoyage.
foreach ($pattern in $registryPatterns) {
    Get-ItemProperty $pattern | Where-Object {
        $_.DisplayName -and ($names -contains $_.DisplayName)
    } | ForEach-Object {
        Remove-Item -LiteralPath $_.PSPath -Recurse -Force
    }
}

# Demander à Windows de rafraîchir ses icônes/raccourcis sans supprimer le cache global.
$ie4uinit = Join-Path $env:SystemRoot 'System32\ie4uinit.exe'
if (Test-Path -LiteralPath $ie4uinit) {
    Start-Process -FilePath $ie4uinit -ArgumentList '-show' -Wait -WindowStyle Hidden
}

Write-Output 'SEB-éval-PRO a été désinstallé et les anciennes données techniques ont été nettoyées.'
exit 0
