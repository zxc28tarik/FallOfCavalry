$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Dist = Join-Path $Root 'dist'

if (Test-Path $Dist) {
  Remove-Item -Recurse -Force $Dist
}
New-Item -ItemType Directory -Path $Dist | Out-Null

$items = @('index.html', 'css', 'js', 'assets', 'favicon.ico', 'favicon.png', 'favicon.svg')
foreach ($item in $items) {
  $src = Join-Path $Root $item
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $Dist -Recurse -Force
  }
}

$builtAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$version = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmm')

@(
  'FallOfCavalry Release Export (manual stamp)',
  "version=$version",
  "builtAt=$builtAt",
  '',
  'Run options:',
  '1) VS Code Live Server: Open dist/index.html with Live Server.',
  '2) Python: cd dist ; python -m http.server 8080'
) | Set-Content -Path (Join-Path $Dist 'RELEASE.txt') -Encoding UTF8

Write-Host "[export-build.ps1] OK version=$version builtAt=$builtAt"
