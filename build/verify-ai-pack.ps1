param(
  [Parameter(Mandatory=$true)]
  [string]$FilePath
)

$ErrorActionPreference = 'Stop'
$ExpectedSha256 = '33e7a72cf5e6e2cfc2f2847075acc013d68bba023e35310cef86b5cf8fdca761'

if (-not (Test-Path -LiteralPath $FilePath)) {
  Write-Error "Fichier IA introuvable : $FilePath"
  exit 2
}

$actual = (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $ExpectedSha256) {
  Write-Error "SHA256 du modèle IA invalide : $actual"
  exit 42
}

Write-Host "Pack IA vérifié : $actual"
exit 0
