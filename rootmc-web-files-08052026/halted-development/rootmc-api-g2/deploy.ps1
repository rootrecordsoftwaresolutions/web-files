# Deploy rootmc-api-g2 to api2.rootmc.net (clean D1, /v2 snapshot routes).
$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
. (Join-Path $workspaceRoot "scripts\load-rootmc-env.ps1")

if (-not $env:CLOUDFLARE_API_TOKEN -or $env:CLOUDFLARE_API_TOKEN.Length -lt 20) {
    throw "Set CLOUDFLARE_API_TOKEN in RootMC Workspace\.env"
}
if (-not $env:CLOUDFLARE_ACCOUNT_ID) {
    throw "Set CLOUDFLARE_ACCOUNT_ID in RootMC Workspace\.env"
}

Set-Location $PSScriptRoot
$tomlPath = Join-Path $PSScriptRoot "wrangler.toml"
$toml = Get-Content -LiteralPath $tomlPath -Raw

if ($toml -match 'database_id = "REPLACE_AFTER_D1_CREATE"') {
    Write-Host "Creating D1 database rootmc-g2 ..."
    $createOut = npx wrangler d1 create rootmc-g2 2>&1 | Out-String
    if ($createOut -match 'database_id\s*=\s*"([a-f0-9-]+)"') {
        $newId = $Matches[1]
        $toml = $toml -replace 'database_id = "REPLACE_AFTER_D1_CREATE"', "database_id = `"$newId`""
        Set-Content -LiteralPath $tomlPath -Value $toml -NoNewline
        Write-Host "Updated wrangler.toml database_id=$newId"
    } elseif ($createOut -match "already exists") {
        $listJson = npx wrangler d1 list --json 2>&1 | Out-String
        if ($listJson -match '"name":"rootmc-g2"[^}]*"uuid":"([a-f0-9-]+)"') {
            $newId = $Matches[1]
            $toml = $toml -replace 'database_id = "REPLACE_AFTER_D1_CREATE"', "database_id = `"$newId`""
            Set-Content -LiteralPath $tomlPath -Value $toml -NoNewline
            Write-Host "Using existing D1 rootmc-g2 id=$newId"
        } else {
            throw "D1 rootmc-g2 exists but could not parse id. Set database_id in wrangler.toml manually.`n$createOut"
        }
    } else {
        throw "D1 create failed:`n$createOut"
    }
}

if (-not (Test-Path "node_modules")) { npm install --legacy-peer-deps }

Write-Host "Applying Gen 2 D1 migrations (remote) ..."
& "$PSScriptRoot\d1-apply-g2.ps1"
$d1Exit = $LASTEXITCODE
if ($null -ne $d1Exit -and $d1Exit -ne 0) { exit $d1Exit }

& "$PSScriptRoot\scripts\seed-g2-realm.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$jwt = [string]$env:ROOTMC_JWT_SECRET
if (-not $jwt -or $jwt.Length -lt 16) { $jwt = [string]$env:ROOTRECORD_PRIMARY_JWT_SECRET }
if ($jwt -and $jwt.Length -ge 16) {
    $jwt | npx wrangler secret put JWT_SECRET
    Write-Host "Uploaded JWT_SECRET."
}

$rootmcBot = [string]$env:DISCORD_ROOTMC_BOT_TOKEN
if (-not $rootmcBot) { $rootmcBot = [string]$env:DISCORD_BOT_TOKEN }
$rootmcBot = $rootmcBot.Trim()
if ($rootmcBot -match '^(?i)bot\s+') { $rootmcBot = ($rootmcBot -replace '^(?i)bot\s+', '').Trim() }
if ($rootmcBot.Length -ge 45 -and $rootmcBot.Contains(".")) {
    $rootmcBot | npx wrangler secret put DISCORD_ROOTMC_BOT_TOKEN
    Write-Host "Uploaded DISCORD_ROOTMC_BOT_TOKEN."
}

$crossChat = [string]$env:CROSS_SERVER_CHAT_SECRET
if (-not $crossChat -or $crossChat.Length -lt 16) {
    throw "Set CROSS_SERVER_CHAT_SECRET in RootMC Workspace\.env"
}
$crossChat | npx wrangler secret put CROSS_SERVER_CHAT_SECRET
Write-Host "Uploaded CROSS_SERVER_CHAT_SECRET."

npx wrangler deploy
Write-Host ""
Write-Host "RootMC API Gen 2: https://api2.rootmc.net/"
Write-Host "Health: https://api2.rootmc.net/api/v2/health"
Write-Host ""
Write-Host "Discord OAuth redirect (add in Discord Developer Portal if not set):"
Write-Host "  https://api2.rootmc.net/v1/discord/rootmc/callback"
Write-Host "Discord interactions: https://api2.rootmc.net/v1/discord/rootmc/interactions"
