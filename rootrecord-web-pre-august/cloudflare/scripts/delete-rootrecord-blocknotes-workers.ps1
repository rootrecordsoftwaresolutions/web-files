# Delete legacy BlockNotes / RootMC API Workers from the RootRecord Cloudflare account.
# Production API: rootmc-api on api.rootmc.net (RootMC account — see Web/cloudflare/rootmc-api/).
#
# Usage (from repo root):
#   powershell -NoProfile -ExecutionPolicy Bypass -File Web\cloudflare\scripts\delete-rootrecord-blocknotes-workers.ps1
#   powershell ... -File ... -Force   # skip DELETE prompt (CI / agent)

param([switch]$Force)

$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Import-DotEnvFile([string]$LiteralPath) {
    if (-not (Test-Path -LiteralPath $LiteralPath)) { return }
    Get-Content -LiteralPath $LiteralPath | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $p = $line.IndexOf("=")
        if ($p -gt 0) {
            $k = $line.Substring(0, $p).Trim()
            $v = $line.Substring($p + 1).Trim()
            if ($k -and $v) { Set-Item -Path "Env:$k" -Value $v }
        }
    }
}

$repoRoot = $PSScriptRoot
for ($i = 0; $i -le 12; $i++) {
    if (Test-Path (Join-Path $repoRoot "credentials.env")) { break }
    $parent = Split-Path $repoRoot -Parent
    if (-not $parent -or $parent -eq $repoRoot) { throw "credentials.env not found" }
    $repoRoot = $parent
}
Import-DotEnvFile (Join-Path $repoRoot "credentials.env")
$mainDevEnv = Join-Path $repoRoot "Web\main\.env"
if (Test-Path $mainDevEnv) { Import-DotEnvFile $mainDevEnv }
if ($env:CLOUDFLARE_GLOBAL_API_KEY -and -not $env:CLOUDFLARE_API_KEY) {
    Set-Item -Path "Env:CLOUDFLARE_API_KEY" -Value $env:CLOUDFLARE_GLOBAL_API_KEY
}

$hasToken = $env:CLOUDFLARE_API_TOKEN -and $env:CLOUDFLARE_API_TOKEN.Length -ge 10
$hasGlobal = $env:CLOUDFLARE_API_KEY -and $env:CLOUDFLARE_API_KEY.Length -ge 10 -and $env:CLOUDFLARE_EMAIL -and $env:CLOUDFLARE_EMAIL.Length -gt 3
if (-not $hasToken -and -not $hasGlobal) {
    throw "Set CLOUDFLARE_API_TOKEN or CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY in credentials.env"
}

$workers = @(
    "rootrecord-api-blocknotes",
    "rootrecord-api-rootmc",
    "rootmc-realm-api"
)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "DESTRUCTIVE: delete RootRecord-account BlockNotes / RootMC API Workers"
Write-Host "============================================================"
Write-Host "Account: RootRecord (credentials.env CLOUDFLARE_ACCOUNT_ID)"
Write-Host "Workers:"
foreach ($w in $workers) { Write-Host "  - $w" }
Write-Host ""
Write-Host "Production stays on: https://api.rootmc.net/ (rootmc-api, RootMC account)"
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Type DELETE to proceed"
    if ($confirm -ne "DELETE") {
        Write-Host "Aborted."
        exit 1
    }
}

Push-Location "C:\Users\store\Desktop\Projects\RootMC Workspace\Web Files\rootmc-realm-api"
try {
    if (-not (Test-Path "node_modules")) { npm ci 2>&1 | Out-Null }
    foreach ($name in $workers) {
        Write-Host "Deleting $name ..." -ForegroundColor Cyan
        & npx wrangler delete $name --force 2>&1 | ForEach-Object { Write-Host $_ }
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Delete $name returned exit $LASTEXITCODE (already absent is OK)."
        } else {
            Write-Host "  OK"
        }
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Done. All listed Workers should be absent on the RootRecord account." -ForegroundColor Green
exit 0
