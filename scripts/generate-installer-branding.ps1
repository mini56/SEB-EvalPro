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
$appIconSourcePng = Join-Path $buildDir '_app-icon-source.png'
$appIconIco = Join-Path $buildDir 'app-icon.ico'

# Le fichier source historique contient cinq images NON carrées (14x16, 27x32,
# 41x48, 55x64 et 109x128). Windows attend au contraire des trames ICO carrées
# correspondant à ses tailles d'affichage. C'est la cause de l'icône visuellement
# trop petite selon le mode Petit/Moyen/Grand du Bureau.
#
# On repart donc du dessin le plus détaillé (109x128), on supprime seulement ses
# marges transparentes, puis on fabrique explicitement chaque trame carrée Windows.
# Aucun auto-resize ICO n'est utilisé : chaque canvas est contrôlé avant assemblage.
& magick "${sourceIcon}[4]" -alpha on -trim +repage $appIconSourcePng

$iconSizes = @(16, 20, 24, 32, 40, 48, 64, 96, 128, 256)
$iconFrames = @()
foreach ($size in $iconSizes) {
  $frame = Join-Path $buildDir ("_app-icon-{0}.png" -f $size)

  # Le personnage remplit toute la hauteur disponible, sans déformation ni rognage.
  # Son rapport largeur/hauteur naturel est conservé puis centré sur un canvas carré.
  & magick $appIconSourcePng -alpha on -resize "x$size" -gravity center -background none -extent "${size}x${size}" $frame

  $geometry = (& magick identify -format '%wx%h' $frame).Trim()
  if ($geometry -ne "${size}x${size}") {
    throw "SEB-éval-PRO : trame icône invalide pour ${size}px ($geometry)."
  }
  $iconFrames += $frame
}

# Assemblage ICO Windows multi-résolution à partir des trames carrées validées.
& magick @iconFrames $appIconIco

# Contrôle bloquant : toutes les tailles Windows prévues doivent être réellement
# présentes dans le .ico final. Cela évite de réintroduire une icône non standard.
$icoInfo = (& magick identify -format "%wx%h`n" $appIconIco) -join "`n"
foreach ($size in $iconSizes) {
  if ($icoInfo -notmatch "(?m)^${size}x${size}$") {
    throw "SEB-éval-PRO : la trame ${size}x${size} manque dans app-icon.ico."
  }
}

# Visuel dédié à la zone réelle de la page NSIS : 450x228 pixels.
# On garde la composition validée (logo, SEB-éval-PRO, version, slogans et vagues),
# mais tout est repositionné pour qu'aucun élément ne soit rogné dans l'assistant.
$branding = @"
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="456" viewBox="0 0 900 456">
  <rect x="0" y="0" width="900" height="456" fill="#ffffff"/>

  <path d="M0 150 C125 170 205 270 285 365 C335 420 405 450 485 456 L0 456 Z" fill="#edf6ff"/>
  <path d="M0 338 C120 350 205 392 300 456 L0 456 Z" fill="#cfe8ff"/>
  <path d="M0 400 C105 409 165 430 222 456 L0 456 Z" fill="#9fd0f5"/>

  <g opacity="0.58" fill="#79baf0">
    <circle cx="73" cy="329" r="20"/>
    <circle cx="39" cy="349" r="14"/>
    <circle cx="107" cy="349" r="14"/>
    <path d="M43 389 C45 360 56 346 73 346 C90 346 101 360 103 389 Z"/>
    <path d="M15 387 C16 368 25 359 38 359 C51 359 58 371 59 391 Z"/>
    <path d="M88 391 C89 371 95 359 108 359 C121 359 130 368 132 387 Z"/>
  </g>

  <svg x="262" y="18" width="376" height="96" viewBox="0 0 257.1 65.5">
    $logoInner
  </svg>

  <text x="205" y="268" font-family="Calibri, Arial, sans-serif" font-size="68" font-weight="700" fill="#0873bd">SEB-év</text>
  <svg x="438" y="209" width="66" height="66" viewBox="19 0 20 20">
    <path fill="#F9B233" d="$aPath"/>
  </svg>
  <text x="500" y="268" font-family="Calibri, Arial, sans-serif" font-size="68" font-weight="700" fill="#0873bd">l-PRO</text>

  <text x="450" y="318" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="27" font-weight="300" fill="#0873bd">Version $version</text>

  <text x="450" y="374" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="21" font-weight="300" letter-spacing="3" fill="#79baf0">Évaluer aujourd’hui,</text>
  <text x="450" y="405" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="21" font-weight="300" letter-spacing="3" fill="#79baf0">construire demain</text>
  <rect x="413" y="423" width="74" height="3" rx="2" fill="#79baf0"/>

  <text x="817" y="370" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="14" font-style="italic" letter-spacing="0.8" fill="#79baf0">Des parcours</text>
  <text x="817" y="390" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="14" font-style="italic" letter-spacing="0.8" fill="#79baf0">pour des</text>
  <text x="817" y="410" text-anchor="middle" font-family="Calibri Light, Calibri, Arial, sans-serif" font-size="14" font-style="italic" letter-spacing="0.8" fill="#79baf0">réussites durables</text>
  <rect x="782" y="425" width="70" height="2" fill="#79baf0"/>
</svg>
"@
Set-Content -Path $brandingSvg -Value $branding -Encoding UTF8
& magick $brandingSvg -background white -alpha remove -alpha off -resize '450x228!' -type TrueColor "BMP3:$brandingBmp"

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

Remove-Item -Force -ErrorAction SilentlyContinue $brandingSvg, $headerSvg, $appIconSourcePng
foreach ($frame in $iconFrames) {
  Remove-Item -Force -ErrorAction SilentlyContinue $frame
}

Write-Host "SEB-éval-PRO : icône Windows reconstruite en trames carrées 16/20/24/32/40/48/64/96/128/256 et visuel NSIS 450x228 généré pour la version $version."
