# Bundle + single-file Windows executable (Node 18 runtime embedded via pkg).
# Prerequisite: Node 18+ on PATH (bundled .exe uses Node 18 runtime from pkg). Run from this directory:
#   powershell -NoProfile -ExecutionPolicy Bypass -File ./build-exe.ps1
# Output: dist/Root Manager.exe
# Usage: place credentials.env at repo root (or set CREDENTIALS_ENV). Run: node index.mjs --help
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "node not on PATH"
}
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "package-lock.json")) {
    npm ci
} else {
    npm install
}
npm run exe
if ($LASTEXITCODE -ne 0) { throw "npm run exe failed (exit $LASTEXITCODE)." }
Write-Host "Built: $(Join-Path $PSScriptRoot 'dist/Root Manager.exe')"
