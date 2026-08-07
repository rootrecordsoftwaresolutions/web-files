# Build Ava Ivy laptop kit -> E:\.1 Work Stations\RootMC\Ava Laptop\
# Unpacked Electron app + Start/Stop scripts that also boot rootmc-ava (:8787).
$ErrorActionPreference = "Stop"

$DesktopRoot = Split-Path $PSScriptRoot -Parent
$RootMcE = "E:\.1 Work Stations\RootMC"
$Kit = Join-Path $RootMcE "Ava Laptop"
$StartSrc = Join-Path $PSScriptRoot "start-ava-laptop.ps1"

$Node = $null
foreach ($c in @(
  "C:\Program Files\nodejs\node.exe",
  (Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
)) {
  if ($c -and (Test-Path -LiteralPath $c)) { $Node = $c; break }
}
if (-not $Node) { throw "node.exe not found - install Node 20+ first" }
if (-not (Test-Path -LiteralPath $StartSrc)) { throw "Missing $StartSrc" }

Write-Host "Desktop: $DesktopRoot"
Write-Host "Kit:     $Kit"
Write-Host "Node:    $Node"

Push-Location $DesktopRoot
try {
  $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
  npx --yes electron-builder --win dir --x64
  if ($LASTEXITCODE -ne 0) { throw "electron-builder failed ($LASTEXITCODE)" }
} finally {
  Pop-Location
}

$built = Get-ChildItem (Join-Path $DesktopRoot "dist") -Directory |
  Where-Object { $_.Name -match 'win' -and (Test-Path (Join-Path $_.FullName "Ava Ivy.exe")) } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $built) { throw "No Ava Ivy.exe under dist/*-win" }

New-Item -ItemType Directory -Force -Path $Kit | Out-Null
$appDir = Join-Path $Kit "AvaIvy"
if (Test-Path -LiteralPath $appDir) { Remove-Item -LiteralPath $appDir -Recurse -Force }
Copy-Item -LiteralPath $built.FullName -Destination $appDir -Recurse -Force

$startCmd = @"
@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Ava-Laptop.ps1"
endlocal
"@

$stopPs1 = @'
# Stop Ava brain + laptop UI processes
$ErrorActionPreference = "SilentlyContinue"
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'rootmc-ava\\src\\(index|server|poller)\.mjs' } |
  ForEach-Object {
    Write-Host "Stopping Ava pid $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force
  }
Get-CimInstance Win32_Process -Filter "Name='Ava Ivy.exe'" |
  ForEach-Object {
    Write-Host "Stopping UI pid $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force
  }
Write-Host "Done."
'@

$stopCmd = @"
@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Stop-Ava.ps1"
pause
endlocal
"@

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$readme = @"
Ava Laptop kit
==============

Built: $stamp
UI:    $($built.Name) -> AvaIvy\Ava Ivy.exe
Brain: auto-discovered RootMC\Web Files\rootmc-ava (any drive)

Start
-----
Double-click Start-Ava-Laptop.cmd
  1) Scans drives for RootMC + Ava (prefers this kit's drive / walk-up)
  2) Starts Ava poller/server on http://127.0.0.1:8787/
  3) Opens AvaIvy\Ava Ivy.exe

Stop
----
Stop-Ava.cmd

Needs on this laptop
--------------------
- Node.js 20+ on PATH
- RootMC\.env on the same tree Ava is found in
- Web Files\rootmc-ava\ (+ node_modules)
- Web Files\rootmc-realm-api\scripts\lib\rootmc-env.mjs
- Server Handoffs\Ava Ivy\

Override: set ROOTMC_ROOT to a RootMC folder before starting.

Rebuild
-------
powershell -File "...\rootmc-ava-desktop\scripts\build-laptop-kit.ps1"
"@

Copy-Item -LiteralPath $StartSrc -Destination (Join-Path $Kit "Start-Ava-Laptop.ps1") -Force
Set-Content -LiteralPath (Join-Path $Kit "Start-Ava-Laptop.cmd") -Value $startCmd -Encoding ASCII
Set-Content -LiteralPath (Join-Path $Kit "Stop-Ava.ps1") -Value $stopPs1 -Encoding UTF8
Set-Content -LiteralPath (Join-Path $Kit "Stop-Ava.cmd") -Value $stopCmd -Encoding ASCII
Set-Content -LiteralPath (Join-Path $Kit "README.txt") -Value $readme -Encoding UTF8

Write-Host ""
Write-Host "Laptop kit ready:" -ForegroundColor Green
Write-Host "  $Kit"
Get-ChildItem -LiteralPath $Kit | Select-Object Name, Length | Format-Table -AutoSize
$exe = Join-Path $appDir "Ava Ivy.exe"
Write-Host "UI exe: $exe"
Get-Item -LiteralPath $exe | Select-Object Length, LastWriteTime | Format-List
