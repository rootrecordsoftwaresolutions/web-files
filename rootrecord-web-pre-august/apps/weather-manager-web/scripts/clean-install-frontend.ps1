# Clean reinstall for Weather Manager web app (standalone pnpm project at Web\apps\weather-manager-web).
# Optional: -PurgeLockfile  also deletes pnpm-lock.yaml (slower next install; only if lock is corrupted).
param([switch]$PurgeLockfile)
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot
Write-Host "Project root: $((Get-Location).Path)"

$nm = Join-Path $projectRoot "node_modules"
if (Test-Path $nm) {
  Write-Host "Removing node_modules (rimraf): $nm"
  npx --yes rimraf@6 $nm
}

if ($PurgeLockfile -and (Test-Path "pnpm-lock.yaml")) {
  Write-Host "Removing pnpm-lock.yaml (-PurgeLockfile)..."
  Remove-Item "pnpm-lock.yaml" -Force
}

if ((Test-Path "pnpm-lock.yaml") -and -not $PurgeLockfile) {
  Write-Host "pnpm install --frozen-lockfile..."
  pnpm install --frozen-lockfile
} else {
  Write-Host "pnpm install (no lockfile or -PurgeLockfile)..."
  pnpm install
}
