$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $root 'build'
$qcmPath = Join-Path $root 'source/qcmv1.0.html'
$sourceIcon = Join-Path $root 'source/imageqcm/avatar_icon.ico'
$privacyPartsDir = Join-Path $root 'source/branding/privacy-screen'

if (-not (Test-Path $qcmPath)) { throw 'SEB-éval-PRO : source/qcmv1.0.html introuvable pour le logo institutionnel.' }
if (-not (Test-Path $sourceIcon)) { throw 'SEB-éval-PRO : icône source imageqcm/avatar_icon.ico introuvable.' }
if (-not (Test-Path $privacyPartsDir)) { throw 'SEB-éval-PRO : fragments de l’écran d’accueil introuvables.' }
if (-not (Get-Command magick -ErrorAction SilentlyContinue)) { throw 'SEB-éval-PRO : ImageMagick (magick) est requis pour générer les visuels NSIS.' }

New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

# Le visuel d'installation reprend désormais exactement l'image validée de l'écran
# d'accueil/confidentialité. Aucun numéro de version n'est incrusté dans la source.
$privacyParts = @(
  'fix00a.txt',
  'fix00b.txt',
  'part01.txt',
  'part02.txt',
  'part03.txt',
  'fix04a.txt',
  'fix04b.txt'
)
foreach ($name in $privacyParts) {
  if (-not (Test-Path (Join-Path $privacyPartsDir $name))) {
    throw "SEB-éval-PRO : fragment écran d'accueil manquant : $name"
  }
}

$privacyBase64 = ($privacyParts | ForEach-Object {
  [IO.File]::ReadAllText((Join-Path $privacyPartsDir $_)).Replace("`r", '').Replace("`n", '')
}) -join ''

$brandingSource = Join-Path $buildDir '_installer-home-screen.jpg'
try {
  [IO.File]::WriteAllBytes($brandingSource, [Convert]::FromBase64String($privacyBase64))
} catch {
  throw "SEB-éval-PRO : reconstruction Base64 de l'écran d'accueil impossible : $($_.Exception.Message)"
}

$brandingHash = (Get-FileHash -Algorithm SHA256 $brandingSource).Hash.ToLowerInvariant()
$expectedBrandingHash = 'd27fc728e04b94b3678948b2ce81a1429628e6b9fcbd3c6eef49133752d1d802'
if ($brandingHash -ne $expectedBrandingHash) {
  throw "SEB-éval-PRO : SHA-256 de l'écran d'accueil incorrect ($brandingHash)."
}

$buildNumber = $env:GITHUB_RUN_NUMBER
if ([string]::IsNullOrWhiteSpace($buildNumber)) { $buildNumber = $env:SEB_BUILD_NUMBER }
if ([string]::IsNullOrWhiteSpace($buildNumber)) { $buildNumber = 'DEV' }
$buildLabel = "Build #$buildNumber"

# Logo Sauvegarde 56 utilisé uniquement dans le petit bandeau supérieur NSIS.
$html = Get-Content -Raw -Encoding UTF8 $qcmPath
$logoMatch = [regex]::Match($html, '<svg\b[^>]*id="Calque_1"[\s\S]*?</svg>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
if (-not $logoMatch.Success) { throw 'SEB-éval-PRO : logo Sauvegarde 56 (Calque_1) introuvable.' }
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
  if ($geometry -ne "${size}x${size}") { throw "SEB-éval-PRO : trame icône invalide pour ${size}px ($geometry)." }
  $iconFrames += $frame
}
& magick @iconFrames $appIconIco
$icoInfo = (& magick identify -format "%wx%h`n" $appIconIco) -join "`n"
foreach ($size in $iconSizes) {
  if ($icoInfo -notmatch "(?m)^${size}x${size}$") { throw "SEB-éval-PRO : la trame ${size}x${size} manque dans app-icon.ico." }
}

# Adapter sans déformer l'écran d'accueil au format NSIS 450x228 puis ajouter
# automatiquement le numéro du build courant en bas à droite.
$fontPath = Join-Path $env:WINDIR 'Fonts\arial.ttf'
if (-not (Test-Path $fontPath)) { throw 'SEB-éval-PRO : police Arial Windows introuvable pour le numéro de build.' }

& magick $brandingSource -resize '450x228^' -gravity center -extent '450x228' -gravity southeast -font $fontPath -pointsize 14 -fill white -stroke black -strokewidth 2 -annotate '+10+8' $buildLabel -stroke none -fill white -annotate '+10+8' $buildLabel -background white -alpha remove -alpha off -type TrueColor "BMP3:$brandingBmp"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $brandingBmp)) { throw 'SEB-éval-PRO : génération de installerBranding.bmp échouée.' }
$brandingGeometry = (& magick identify -format '%wx%h' $brandingBmp).Trim()
if ($brandingGeometry -ne '450x228') { throw "SEB-éval-PRO : visuel Setup invalide ($brandingGeometry au lieu de 450x228)." }

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

Remove-Item -Force -ErrorAction SilentlyContinue $headerSvg, $appIconSourcePng, $brandingSource
foreach ($frame in $iconFrames) { Remove-Item -Force -ErrorAction SilentlyContinue $frame }

Write-Host "SEB-éval-PRO : écran d'accueil validé utilisé pour le Setup; $buildLabel ajouté en bas à droite."
