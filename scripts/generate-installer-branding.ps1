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
  throw 'SEB-éval-PRO : ImageMagick (magick) est requis pour générer le visuel NSIS.'
}

New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$html = Get-Content -Raw -Encoding UTF8 $qcmPath
$match = [regex]::Match($html, '<svg\b[^>]*id="Calque_1"[\s\S]*?</svg>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
if (-not $match.Success) {
  throw 'SEB-éval-PRO : logo Sauvegarde 56 (Calque_1) introuvable.'
}

$package = Get-Content -Raw -Encoding UTF8 $packagePath | ConvertFrom-Json
$version = [string]$package.version

$logoSvg = Join-Path $buildDir '_sauvegarde56.svg'
$logoPng = Join-Path $buildDir '_sauvegarde56.png'
$aPng = Join-Path $buildDir '_institutional-a.png'
$logoSmall = Join-Path $buildDir '_logo-small.png'
$title1 = Join-Path $buildDir '_title1.png'
$title3 = Join-Path $buildDir '_title3.png'
$title = Join-Path $buildDir '_title.png'
$versionPng = Join-Path $buildDir '_version.png'
$canvas = Join-Path $buildDir '_sidebar-canvas.png'
$sidebarPng = Join-Path $buildDir '_sidebar.png'
$headerBmp = Join-Path $buildDir 'installerHeader.bmp'
$sidebarBmp = Join-Path $buildDir 'installerSidebar.bmp'
$appIconPng = Join-Path $buildDir '_app-icon-256.png'
$appIconIco = Join-Path $buildDir 'app-icon.ico'

Set-Content -Path $logoSvg -Value $match.Value -Encoding UTF8

# L'icône du dépôt est conservée à l'identique et agrandie proprement pour satisfaire Windows (minimum 256 px).
$largestIconFrame = "${sourceIcon}[4]"
& magick $largestIconFrame -resize '240x240>' -gravity center -background none -extent '256x256' $appIconPng
& magick $appIconPng -define 'icon:auto-resize=256,128,64,48,32,16' $appIconIco

# Le logo et le A proviennent directement du SVG institutionnel présent dans le QCM.
& magick $logoSvg -background white -alpha remove -alpha off -resize '1028x' $logoPng
& magick $logoPng -crop '90x92+72+0' +repage -fuzz '4%' -transparent white $aPng
& magick $logoPng -resize '150x80>' $logoSmall

$fontList = (& magick -list font | Out-String)
$boldFont = if ($fontList -match '(?m)^\s*Font:\s+Calibri-Bold\s*$') { 'Calibri-Bold' } elseif ($fontList -match '(?m)^\s*Font:\s+Calibri\s*$') { 'Calibri' } else { 'Arial' }
$lightFont = if ($fontList -match '(?m)^\s*Font:\s+Calibri-Light\s*$') { 'Calibri-Light' } elseif ($fontList -match '(?m)^\s*Font:\s+Calibri\s*$') { 'Calibri' } else { 'Arial' }

& magick -background none -fill '#004D71' -font $boldFont -pointsize 20 'label:SEB-év' $title1
& magick -background none -fill '#004D71' -font $boldFont -pointsize 20 'label:l-PRO' $title3
& magick $aPng -resize '18x20>' (Join-Path $buildDir '_a-small.png')
& magick $title1 (Join-Path $buildDir '_a-small.png') $title3 +append -trim +repage -resize '152x>' $title
& magick -background none -fill '#004D71' -font $lightFont -pointsize 14 "label:Version $version" -trim +repage $versionPng

# Bandeau de l'installateur : logo Sauvegarde 56 exact.
& magick $logoPng -resize '142x52>' -gravity center -background white -extent '150x57' -alpha off -type TrueColor "BMP3:$headerBmp"

# Volet de bienvenue/fin : logo + SEB-éval-PRO + version, rien d'autre.
& magick -size '164x314' xc:white $canvas
& magick $canvas $logoSmall -gravity North -geometry '+0+14' -composite $title -gravity North -geometry '+0+126' -composite $versionPng -gravity North -geometry '+0+166' -composite -alpha off $sidebarPng
& magick $sidebarPng -alpha off -type TrueColor "BMP3:$sidebarBmp"

$cleanup = @($logoSvg, $logoPng, $aPng, $logoSmall, $title1, $title3, $title, $versionPng, $canvas, $sidebarPng, $appIconPng, (Join-Path $buildDir '_a-small.png'))
foreach ($file in $cleanup) {
  Remove-Item -Force -ErrorAction SilentlyContinue $file
}

Write-Host "SEB-éval-PRO : visuels NSIS générés avec le logo institutionnel et la version $version."
