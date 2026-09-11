$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'source/branding/seb-eval-pro-installer.png'
$target = Join-Path $root 'build/installerBranding.bmp'

if (-not (Test-Path $source)) {
  throw 'SEB-éval-PRO : image validée du Setup introuvable.'
}
if (-not (Get-Command magick -ErrorAction SilentlyContinue)) {
  throw 'SEB-éval-PRO : ImageMagick (magick) est requis pour appliquer le visuel validé.'
}

& magick $source -background white -alpha remove -alpha off -resize '450x228!' -type TrueColor "BMP3:$target"

if (-not (Test-Path $target)) {
  throw 'SEB-éval-PRO : installerBranding.bmp non généré.'
}

$geometry = (& magick identify -format '%wx%h' $target).Trim()
if ($geometry -ne '450x228') {
  throw "SEB-éval-PRO : visuel Setup invalide ($geometry au lieu de 450x228)."
}

Write-Host 'SEB-éval-PRO : image validée appliquée telle quelle au Setup (450x228).'
