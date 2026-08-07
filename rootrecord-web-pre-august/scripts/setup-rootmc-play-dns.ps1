# RootMC Minecraft — DNS-only A record for play.rootrecord.info (grey cloud; do NOT proxy).
# Minecraft TCP does not work through the orange-cloud HTTP proxy.
#
# Optional credentials.env keys:
#   ROOTMC_PLAY_HOST          (default: play.rootrecord.info)
#   ROOTMC_SERVER_IP          (default: 15.204.13.9)
#   ROOTRECORD_ZONE_NAME      (default: rootrecord.info)
$ErrorActionPreference = "Stop"

function Import-DotEnvFile([string]$LiteralPath) {
  if (-not (Test-Path -LiteralPath $LiteralPath)) { return }
  Get-Content -LiteralPath $LiteralPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $p = $line.IndexOf("=")
    if ($p -gt 0) {
      $k = $line.Substring(0, $p).Trim()
      $v = $line.Substring($p + 1).Trim()
      if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
      if ($v.StartsWith("'") -and $v.EndsWith("'")) { $v = $v.Substring(1, $v.Length - 2) }
      Set-Item -Path "Env:$k" -Value $v
    }
  }
}

function Collect-AncestorDirs([string]$Start) {
  $dirs = @()
  $probe = $Start
  for ($i = 0; $i -le 20; $i++) {
    $dirs += $probe
    $parent = Split-Path $probe -Parent
    if (-not $parent -or $parent -eq $probe) { break }
    $probe = $parent
  }
  return $dirs
}

$dirSet = @{}
foreach ($root in @($PSScriptRoot, (Get-Location).Path)) {
  foreach ($d in Collect-AncestorDirs $root) {
    $dirSet[$d] = $true
  }
}
$files = @()
foreach ($d in $dirSet.Keys) {
  foreach ($name in @("credentials.env.txt", "credentials.env")) {
    $full = Join-Path $d $name
    if (Test-Path -LiteralPath $full) { $files += $full }
    $webNested = Join-Path (Join-Path $d "Web") $name
    if (Test-Path -LiteralPath $webNested) { $files += $webNested }
  }
}
$files = $files | Select-Object -Unique
if ($files.Count -eq 0) { throw "No credentials.env found." }
foreach ($f in $files) { Import-DotEnvFile $f }

if ($env:CLOUDFLARE_GLOBAL_API_KEY -and -not $env:CLOUDFLARE_API_KEY) {
  Set-Item -Path "Env:CLOUDFLARE_API_KEY" -Value $env:CLOUDFLARE_GLOBAL_API_KEY
}

$token = [string]$env:CLOUDFLARE_API_TOKEN
$email = [string]$env:CLOUDFLARE_EMAIL
$key = [string]$env:CLOUDFLARE_API_KEY
$headers = @{ "Content-Type" = "application/json" }
if ($token.Length -ge 20) {
  $headers["Authorization"] = "Bearer $token"
} elseif ($email.Length -gt 3 -and $key.Length -ge 10) {
  $headers["X-Auth-Email"] = $email
  $headers["X-Auth-Key"] = $key
} else {
  throw "Need CLOUDFLARE_API_TOKEN or CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY."
}

$zoneName = [string]$env:ROOTRECORD_ZONE_NAME
if (-not $zoneName) { $zoneName = "rootrecord.info" }
$fqdn = [string]$env:ROOTMC_PLAY_HOST
if (-not $fqdn) { $fqdn = "play.$zoneName" }
$serverIp = [string]$env:ROOTMC_SERVER_IP
if (-not $serverIp) { $serverIp = "15.204.13.9" }

$base = "https://api.cloudflare.com/client/v4"

function Cf-Get([string]$Uri) {
  $r = Invoke-RestMethod -Uri $Uri -Headers $headers -Method Get
  if (-not $r.success) {
    $msg = ($r.errors | ForEach-Object { $_.message }) -join "; "
    throw "Cloudflare API GET failed: $msg"
  }
  return $r.result
}

function Cf-Patch([string]$Uri, [hashtable]$Body) {
  $json = $Body | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri $Uri -Headers $headers -Method Patch -Body $json
  if (-not $r.success) {
    $msg = ($r.errors | ForEach-Object { $_.message }) -join "; "
    throw "Cloudflare API PATCH failed: $msg"
  }
  return $r.result
}

function Cf-Post([string]$Uri, [hashtable]$Body) {
  $json = $Body | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri $Uri -Headers $headers -Method Post -Body $json
  if (-not $r.success) {
    $msg = ($r.errors | ForEach-Object { $_.message }) -join "; "
    throw "Cloudflare API POST failed: $msg"
  }
  return $r.result
}

Write-Host "RootMC play host: $fqdn -> $serverIp (DNS only, grey cloud)"

$zones = Cf-Get "$base/zones?name=$zoneName"
$zone = @($zones)[0]
if (-not $zone.id) { throw "Zone $zoneName not found." }
$zoneId = $zone.id

$allForName = @((Cf-Get "$base/zones/$zoneId/dns_records?name=$fqdn"))
foreach ($r in $allForName) {
  Write-Host "Existing: type=$($r.type) id=$($r.id) proxied=$($r.proxied) content=$($r.content)"
  if ($r.proxied -eq $true) {
    Write-Host "Patching $($r.id) to DNS only (required for Minecraft TCP)..."
    Cf-Patch "$base/zones/$zoneId/dns_records/$($r.id)" @{ proxied = $false } | Out-Null
  }
}

$aList = Cf-Get "$base/zones/$zoneId/dns_records?type=A&name=$fqdn"
if (-not $aList -or @($aList).Count -eq 0) {
  Cf-Post "$base/zones/$zoneId/dns_records" @{
    type    = "A"
    name    = $fqdn
    content = $serverIp
    proxied = $false
    ttl     = 1
  } | Out-Null
  Write-Host "Created DNS-only A record $fqdn -> $serverIp"
} else {
  $rec = @($aList)[0]
  $patch = @{ proxied = $false }
  if ($rec.content -ne $serverIp) {
    $patch["content"] = $serverIp
    Write-Host "Updating A record content to $serverIp"
  }
  Cf-Patch "$base/zones/$zoneId/dns_records/$($rec.id)" $patch | Out-Null
  $target = if ($patch.ContainsKey("content")) { $patch["content"] } else { $rec.content }
  Write-Host "A record $fqdn is DNS-only -> $target"
}

Write-Host ""
Write-Host "Done. Players can add server: $fqdn (port 25565 if not default)"
Write-Host "Set plugins/RootRecord/rootmc.yml server.address to $fqdn and restart Paper."
