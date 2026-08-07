# Register Gen 2 realm in D1 (g2_realm + g2_realm_credentials).
# Reads gen2-27/plugins/RootMC/cloud.yml; generates server-id/secret if empty.
$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
. (Join-Path $workspaceRoot "scripts\load-rootmc-env.ps1")

$cloudCandidates = @(
    (Join-Path $workspaceRoot "gen2-27\plugins\RootMC\cloud.yml"),
    (Join-Path $workspaceRoot "gen2-27\Plugin Building\Minecraft\server\plugins\RootMC\cloud.yml")
)
$cloudYml = $cloudCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $cloudYml) {
    throw "Gen 2 cloud.yml not found under gen2-27/plugins/RootMC/"
}

$lines = Get-Content $cloudYml
$serverId = $null
$serverSecret = $null
foreach ($line in $lines) {
    if ($line -match '^\s*server-id:\s*"?([^"#]+)"?') { $serverId = $Matches[1].Trim() }
    if ($line -match '^\s*server-secret:\s*"?([^"#]+)"?') { $serverSecret = $Matches[1].Trim() }
}

$generated = $false
if (-not $serverId) {
    $serverId = "g2-" + [guid]::NewGuid().ToString("N").Substring(0, 12)
    $generated = $true
}
if (-not $serverSecret) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $serverSecret = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "").Replace("/", "")
    $generated = $true
}

if ($generated) {
    Write-Host "Generated new Gen 2 realm credentials; updating $cloudYml"
    $out = New-Object System.Collections.Generic.List[string]
    $wroteId = $false
    $wroteSecret = $false
    foreach ($line in $lines) {
        if ($line -match '^\s*server-id:') {
            $out.Add('  server-id: "' + $serverId + '"')
            $wroteId = $true
            continue
        }
        if ($line -match '^\s*server-secret:') {
            $out.Add('  server-secret: "' + $serverSecret + '"')
            $wroteSecret = $true
            continue
        }
        $out.Add($line)
    }
    if (-not $wroteId) { $out.Add('  server-id: "' + $serverId + '"') }
    if (-not $wroteSecret) { $out.Add('  server-secret: "' + $serverSecret + '"') }
    Set-Content -LiteralPath $cloudYml -Value $out -Encoding UTF8
    Write-Host "Copy server-id and server-secret to the live Gen 2 host cloud.yml."
}

$hash = [BitConverter]::ToString(
    [System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($serverSecret))
).Replace("-", "").ToLower()

$nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$sql = @'
INSERT INTO g2_realm (
  realm_id, realm_name, server_address, map_url, game_version,
  created_at_ms, updated_at_ms, last_heartbeat_ms, last_economy_snapshot_ms, featured
) VALUES (
  '__SERVER_ID__',
  'RootMC Gen 2',
  'g2.rootmc.net',
  '',
  '26.2',
  __NOW_MS__,
  __NOW_MS__,
  NULL,
  NULL,
  1
) ON CONFLICT(realm_id) DO UPDATE SET
  realm_name = excluded.realm_name,
  server_address = excluded.server_address,
  game_version = excluded.game_version,
  updated_at_ms = excluded.updated_at_ms,
  featured = 1;

INSERT INTO g2_realm_credentials (realm_id, secret_hash, created_at_ms)
VALUES ('__SERVER_ID__', '__HASH__', __NOW_MS__)
ON CONFLICT(realm_id) DO UPDATE SET secret_hash = excluded.secret_hash;
'@
$sql = $sql.Replace('__SERVER_ID__', $serverId).Replace('__HASH__', $hash).Replace('__NOW_MS__', [string]$nowMs)

$tmp = Join-Path $env:TEMP "rootmc-g2-seed-realm.sql"
Set-Content -LiteralPath $tmp -Value $sql -Encoding UTF8

Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host "Seeding g2_realm realm_id=$serverId ..."
npx wrangler d1 execute rootmc-g2 --remote --file="$tmp"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Gen 2 realm registered in D1."
