# Installs workspace deps with verbose pnpm logging; fails fast if react-scripts did not link (hoisted at workspace root).
$ErrorActionPreference = "Stop"
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
Set-Location $workspaceRoot
$log = Join-Path $workspaceRoot "pnpm-install.log"
Remove-Item $log -ErrorAction SilentlyContinue
Write-Host "Workspace root: $workspaceRoot"
Write-Host "Logging to: $log"
Write-Host "pnpm install (loglevel=debug)…"
try {
  pnpm install --loglevel debug 2>&1 | Tee-Object -FilePath $log
} finally { }

$bin = Join-Path $workspaceRoot "node_modules\.bin\react-scripts.cmd"
if (-not (Test-Path $bin)) {
  Write-Host "ERROR: react-scripts not linked at $bin — see $log; try a shorter repo path (e.g. C:\dev\rrw\)." -ForegroundColor Red
  exit 1
}
Write-Host "OK: react-scripts linked." -ForegroundColor Green
