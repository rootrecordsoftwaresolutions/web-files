# Deploy rootrecord-app-build Worker.
# Same credentials.env-walking pattern as rootrecord-license/deploy.ps1 so this Worker uses
# CLOUDFLARE_API_TOKEN (or CLOUDFLARE_GLOBAL_API_KEY + CLOUDFLARE_EMAIL) instead of falling
# back to an OAuth browser flow when called from cloudflare-update-workers.bat.
$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$repoRoot = $null
$probe = $PSScriptRoot
for ($i = 0; $i -le 16; $i++) {
    $tryCred = Join-Path $probe "credentials.env"
    if (Test-Path -LiteralPath $tryCred) {
        $repoRoot = $probe
        break
    }
    $parent = Split-Path $probe -Parent
    if (-not $parent -or $parent -eq $probe) { break }
    $probe = $parent
}
if (-not $repoRoot) {
    throw "credentials.env not found (searched parents of $PSScriptRoot)."
}
$rootCred = Join-Path $repoRoot "credentials.env"
Get-Content $rootCred | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $p = $line.IndexOf("=")
    if ($p -gt 0) {
        $k = $line.Substring(0, $p).Trim()
        $v = $line.Substring($p + 1).Trim()
        Set-Item -Path "Env:$k" -Value $v
    }
}
if ($env:CLOUDFLARE_GLOBAL_API_KEY -and -not $env:CLOUDFLARE_API_KEY) {
    Set-Item -Path "Env:CLOUDFLARE_API_KEY" -Value $env:CLOUDFLARE_GLOBAL_API_KEY
}
$hasToken = $env:CLOUDFLARE_API_TOKEN -and $env:CLOUDFLARE_API_TOKEN.Length -ge 10
$hasGlobal = $env:CLOUDFLARE_API_KEY -and $env:CLOUDFLARE_API_KEY.Length -ge 10 -and $env:CLOUDFLARE_EMAIL -and $env:CLOUDFLARE_EMAIL.Length -gt 3
if (-not $hasToken -and -not $hasGlobal) {
    Write-Host "Set either CLOUDFLARE_API_TOKEN, or CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY in credentials.env."
    exit 1
}

Set-Location $PSScriptRoot
if (-not (Test-Path "node_modules")) { npm install }

# Optional Discord / DM secrets — uploaded only when present in credentials.env.
$appWebhook = [string]$env:APP_BUILD_REQUEST_WEBHOOK_URL
if ($appWebhook -match '^https?://' -and $appWebhook.Length -gt 20) {
    $appWebhook | npx wrangler secret put APP_BUILD_REQUEST_WEBHOOK_URL
    Write-Host "Uploaded APP_BUILD_REQUEST_WEBHOOK_URL to rootrecord-app-build."
}
$appBearer = [string]$env:APP_BUILD_REQUEST_WEBHOOK_BEARER
if ($appBearer -and $appBearer.Length -gt 8) {
    $appBearer | npx wrangler secret put APP_BUILD_REQUEST_WEBHOOK_BEARER
    Write-Host "Uploaded APP_BUILD_REQUEST_WEBHOOK_BEARER to rootrecord-app-build."
}
$botToken = [string]$env:APP_BUILD_DISCORD_BOT_TOKEN
if ($botToken -and $botToken.Length -gt 30) {
    $botToken | npx wrangler secret put APP_BUILD_DISCORD_BOT_TOKEN
    Write-Host "Uploaded APP_BUILD_DISCORD_BOT_TOKEN to rootrecord-app-build."
}
$dmUserId = [string]$env:APP_BUILD_DISCORD_DM_USER_ID
if ($dmUserId -match '^\d{6,}$') {
    $dmUserId | npx wrangler secret put APP_BUILD_DISCORD_DM_USER_ID
    Write-Host "Uploaded APP_BUILD_DISCORD_DM_USER_ID to rootrecord-app-build."
}

npx wrangler deploy
Write-Host "Done. rootrecord-app-build: https://rootrecord-app-build.rootrecord.workers.dev"
