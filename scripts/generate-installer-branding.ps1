$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $root 'build'
$qcmPath = Join-Path $root 'source/qcmv1.0.html'
$sourceIcon = Join-Path $root 'source/imageqcm/avatar_icon.ico'
$brandingSource = Join-Path $root 'source/branding/seb-eval-pro-installer.png'

if (-not (Test-Path $qcmPath)) {
  throw 'SEB-éval-PRO : source/qcmv1.0.html introuvable pour le logo institutionnel.'
}
if (-not (Test-Path $sourceIcon)) {
  throw 'SEB-éval-PRO : icône source imageqcm/avatar_icon.ico introuvable.'
}
if (-not (Test-Path $brandingSource)) {
  throw 'SEB-éval-PRO : image validée du Setup introuvable.'
}
if (-not (Get-Command magick -ErrorAction SilentlyContinue)) {
  throw 'SEB-éval-PRO : ImageMagick (magick) est requis pour générer les visuels NSIS.'
}

New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

# Logo Sauvegarde 56 utilisé uniquement pour le petit bandeau supérieur NSIS.
$html = Get-Content -Raw -Encoding UTF8 $qcmPath
$logoMatch = [regex]::Match($html, '<svg\b[^>]*id="Calque_1"[\s\S]*?</svg>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
if (-not $logoMatch.Success) {
  throw 'SEB-éval-PRO : logo Sauvegarde 56 (Calque_1) introuvable.'
}
$logoInner = [regex]::Replace($logoMatch.Value, '^<svg\b[^>]*>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$logoInner = [regex]::Replace($logoInner, '</svg>\s*$', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

$brandingBmp = Join-Path $buildDir 'installerBranding.bmp'
$headerSvg = Join-Path $buildDir '_installer-header.svg'
$headerBmp = Join-Path $buildDir 'installerHeader.bmp'
$appIconSourcePng = Join-Path $buildDir '_app-icon-source.png'
$appIconIco = Join-Path $buildDir 'app-icon.ico'

# Icône Windows multi-résolution conservée à l'identique.
& magick "${sourceIcon}[4]" -alpha on -trim +repage $appIconSourcePng

$iconSizes = @(16, 20, 24, 32, 40, 48, 64, 96, 128, 256)
$iconFrames = @()
foreach ($size in $iconSizes) {
  $frame = Join-Path $buildDir ("_app-icon-{0}.png" -f $size)
  & magick $appIconSourcePng -alpha on -resize "x$size" -gravity center -background none -extent "${size}x${size}" $frame

  $geometry = (& magick identify -format '%wx%h' $frame).Trim()
  if ($geometry -ne "${size}x${size}") {
    throw "SEB-éval-PRO : trame icône invalide pour ${size}px ($geometry)."
  }
  $iconFrames += $frame
}

& magick @iconFrames $appIconIco

$icoInfo = (& magick identify -format "%wx%h`n" $appIconIco) -join "`n"
foreach ($size in $iconSizes) {
  if ($icoInfo -notmatch "(?m)^${size}x${size}$") {
    throw "SEB-éval-PRO : la trame ${size}x${size} manque dans app-icon.ico."
  }
}

# IMPORTANT : le grand visuel du Setup n'est plus reconstruit élément par élément.
# On utilise directement l'image complète validée par l'utilisateur.
& magick $brandingSource -background white -alpha remove -alpha off -resize '450x228!' -type TrueColor "BMP3:$brandingBmp"
$brandingGeometry = (& magick identify -format '%wx%h' $brandingBmp).Trim()
if ($brandingGeometry -ne '450x228') {
  throw "SEB-éval-PRO : visuel Setup invalide ($brandingGeometry au lieu de 450x228)."
}

# Petit logo supérieur de l'assistant NSIS.
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

Remove-Item -Force -ErrorAction SilentlyContinue $headerSvg, $appIconSourcePng
foreach ($frame in $iconFrames) {
  Remove-Item -Force -ErrorAction SilentlyContinue $frame
}

Write-Host 'SEB-éval-PRO : image complète validée utilisée directement pour le visuel NSIS 450x228.'
