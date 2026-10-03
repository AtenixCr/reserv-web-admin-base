param([ValidateSet('start','test','build')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -Raw -LiteralPath (Join-Path $sourceRoot 'package.json') | ConvertFrom-Json
if ($package.name -notin @('customer-web','admin-web')) { throw 'Unexpected project name' }
$runtimeRoot = Join-Path ([IO.Path]::GetTempPath()) ('tourism-' + $package.name + '-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runtimeRoot | Out-Null
foreach ($file in @('package.json','package-lock.json','angular.json','tsconfig.json','tsconfig.app.json','tsconfig.spec.json','proxy.conf.json','vitest.config.ts','.npmrc')) {
    $sourceFile = Join-Path $sourceRoot $file
    if (Test-Path -LiteralPath $sourceFile) { Copy-Item -LiteralPath $sourceFile -Destination $runtimeRoot }
}
foreach ($directory in @('src','public')) {
    Copy-Item -LiteralPath (Join-Path $sourceRoot $directory) -Destination $runtimeRoot -Recurse
}
Write-Output "Runtime: $runtimeRoot"
Push-Location $runtimeRoot
try {
    if (Test-Path -LiteralPath 'package-lock.json') { & npm.cmd ci --no-audit --no-fund }
    else { & npm.cmd install --no-audit --no-fund }
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
    Copy-Item -LiteralPath 'package-lock.json' -Destination $sourceRoot -Force
    & npm.cmd run $Action
    if ($LASTEXITCODE -ne 0) { throw 'Angular command failed' }
    if ($Action -eq 'build') { Copy-Item -LiteralPath 'dist' -Destination $sourceRoot -Recurse -Force }
} finally { Pop-Location }
