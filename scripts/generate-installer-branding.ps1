$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $root 'build'
$qcmPath = Join-Path $root 'source/qcmv1.0.html'
$packagePath = Join-Path $root 'package.json'
$sourceIcon = Join-Path $root 'source/imageqcm/avatar_icon.ico'

if (-not (Test-Path $qcmPath)) {
  throw 'SEB-éval-PRO : source/qcmv1.0.html introuvable pour le logo institutionnel.'
}
if (-not (Test-Path $sourceIcon)) {
  throw 'SEB-éval-PRO : icône source imageqcm/avatar_icon.ico introuvable.'
}
if (-not (Get-Command magick -ErrorAction SilentlyContinue)) {
  throw 'SEB-éval-PRO : ImageMagick (magick) est requis pour générer les visuels NSIS.'
}

New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$html = Get-Content -Raw -Encoding UTF8 $qcmPath
$logoMatch = [regex]::Match($html, '<svg\b[^>]*id="Calque_1"[\s\S]*?</svg>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
if (-not $logoMatch.Success) {
  throw 'SEB-éval-PRO : logo Sauvegarde 56 (Calque_1) introuvable.'
}

$aMatch = [regex]::Match($logoMatch.Value, '<path\s+class="st0"\s+d="(M20\.3,14\.3[\s\S]*?)"\s*/>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
if (-not $aMatch.Success) {
  throw 'SEB-éval-PRO : pictogramme A institutionnel introuvable dans le logo Sauvegarde 56.'
}

$package = Get-Content -Raw -Encoding UTF8 $packagePath | ConvertFrom-Json
$version = [string]$package.version

$logoInner = [regex]::Replace($logoMatch.Value, '^<svg\b[^>]*>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$logoInner = [regex]::Replace($logoInner, '</svg>\s*$', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$aPath = $aMatch.Groups[1].Value

$brandingSvg = Join-Path $buildDir '_installer-branding.svg'
$brandingBmp = Join-Path $buildDir 'installerBranding.bmp'
$headerSvg = Join-Path $buildDir '_installer-header.svg'
$headerBmp = Join-Path $buildDir 'installerHeader.bmp'
$appIconPng = Join-Path $buildDir '_app-icon-256.png'
$appIconIco = Join-Path $buildDir 'app-icon.ico'

# Icône Windows : conserver les petites trames d'origine et ajouter une trame 256x256
# afin que le bureau/la barre des tâches restent nets tout en satisfaisant electron-builder.
$framePattern = Join-Path $buildDir '_icon-frame-%02d.png'
& magick $sourceIcon $framePattern
$frames = Get-ChildItem -Path $buildDir -Filter '_icon-frame-*.png' | Sort-Object Name
$largestIconFrame = "${sourceIcon}[4]"
& magick $largestIconFrame -resize 'x244' -gravity center -background none -extent '256x256' $appIconPng
$iconArgs = @()
foreach ($frame in $frames) { $iconArgs += $frame.FullName }
$iconArgs += $appIconPng
$iconArgs += $appIconIco
& magick @iconArgs

# Le visuel plein écran de l'assistant reprend le modèle validé : logo Sauvegarde 56,
# SEB-éval-PRO avec le A institutionnel orange exact, version Calibri Light bleue,
# fond blanc et formes bleu clair.
$branding = @"
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="628" viewBox="0 0 1000 628">
  <rect x="0" y="0" width="1000" height="628" fill="#ffffff"/>
  <path d="M0 150 C150 180 230 330 330 470 C410 570 520 620 630 628 L0 628 Z" fill="#edf6ff"/>
  <path d="M0 455 C155 475 255 545 360 628 L0 628 Z" fill="#cfe8ff"/>
  <path d="M0 525 C135 540 205 582 278 628 L0 628 Z" fill="#9fd0f5"/>

  <g opacity="0.58" fill="#79baf0">
    <circle cx="84" cy="382" r="24"/>
    <circle cx="42" cy="408" r="17"/>
    <circle cx="126" cy="408" r="17"/>
    <path d="M49 455 C51 421 64 404 84 404 C104 404 117 421 119 455 Z"/>
    <path d="M12 452 C13 429 24 419 40 419 C55 419 63 433 64 457 Z"/>
    <path d="M105 457 C106 433 113 419 128 419 C144 419 154 429 156 452 Z"/>
  </g>

  <svg x="278" y="33" width="444" height="113" viewBox="0 0 257.1 65.5">
    $logoInner
  </svg>

  <text x="182" y="332" font-family="Calibri, Arial, sans-serif" font-size="82" font-weight="700" fill="#0873bd">SEB-év</text>
  <svg x="506" y="256" width="84" height="84" viewBox="19 0 20 20">
    <path fill="#F9B233" d="$aPath"/>
  </svg>
  <text x="586" y="332" font-family="Calibri, Arial, sans-serif" font-size="82" font-weight="700" fill="#0873bd">l-PRO</text>

  <text x="500" y="388" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="34" font-weight="300" fill="#0873bd">Version $version</text>

  <text x="500" y="470" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="27" font-weight="300" letter-spacing="4" fill="#79baf0">Évaluer aujourd’hui,</text>
  <text x="500" y="510" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="27" font-weight="300" letter-spacing="4" fill="#79baf0">construire demain</text>
  <rect x="456" y="535" width="88" height="3" rx="2" fill="#79baf0"/>

  <text x="927" y="520" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="17" font-style="italic" letter-spacing="1.2" fill="#79baf0">Des parcours</text>
  <text x="927" y="544" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="17" font-style="italic" letter-spacing="1.2" fill="#79baf0">pour des</text>
  <text x="927" y="568" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="17" font-style="italic" letter-spacing="1.2" fill="#79baf0">réussites durables</text>
  <rect x="884" y="584" width="86" height="2" fill="#79baf0"/>
</svg>
"@
Set-Content -Path $brandingSvg -Value $branding -Encoding UTF8
& magick $brandingSvg -background white -alpha remove -alpha off -resize '500x314!' -type TrueColor "BMP3:$brandingBmp"

$header = @"
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57" viewBox="0 0 150 57">
  <rect width="150" height="57" fill="#ffffff"/>
  <svg x="7" y="4" width="136" height="48" viewBox="0 0 257.1 65.5">
    $logoInner
  </svg>
</svg>
"@
Set-Content -Path $headerSvg -Value $header -Encoding UTF8
& magick $headerSvg -background white -alpha remove -alpha off -type TrueColor "BMP3:$headerBmp"

Remove-Item -Force -ErrorAction SilentlyContinue $brandingSvg, $headerSvg, $appIconPng
foreach ($frame in $frames) { Remove-Item -Force -ErrorAction SilentlyContinue $frame.FullName }

Write-Host "SEB-éval-PRO : visuel plein écran NSIS généré avec le A institutionnel exact et la version $version."
