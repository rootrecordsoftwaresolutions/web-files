# rootmc.net apex -> Cloudflare Pages (rootmc-web). Fixes Error 525 when apex A-record points at Shockbyte with proxy on.
# Loads RootMC Workspace\.env (RootMC Cloudflare account). Run from repo: powershell -File Web\scripts\setup-rootmc-apex-pages-dns.ps1
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
      if ($k -and $v) { Set-Item -Path "Env:$k" -Value $v }
    }
  }
}

$rootMcEnv = "C:\Users\store\Desktop\Projects\RootMC Workspace\.env"
Import-DotEnvFile $rootMcEnv
Remove-Item Env:CLOUDFLARE_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:CLOUDFLARE_EMAIL -ErrorAction SilentlyContinue

$token = [string]$env:CLOUDFLARE_API_TOKEN
if ($token.Length -lt 20) { throw "Set CLOUDFLARE_API_TOKEN in RootMC Workspace\.env" }
$accountId = [string]$env:CLOUDFLARE_ACCOUNT_ID
if (-not $accountId) { throw "Set CLOUDFLARE_ACCOUNT_ID in RootMC Workspace\.env" }

$zoneName = [string]$env:ROOTMC_ZONE_NAME
if (-not $zoneName) { $zoneName = "rootmc.net" }
$project = [string]$env:ROOTMC_PAGES_PROJECT
if (-not $project) { $project = "rootmc-web" }
$fqdn = [string]$env:ROOTMC_APEX_HOST
if (-not $fqdn) { $fqdn = $zoneName }
$pagesTarget = "$project.pages.dev"

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type"  = "application/json"
}
$base = "https://api.cloudflare.com/client/v4"

function Cf-Get([string]$Uri) {
  $r = Invoke-RestMethod -Uri $Uri -Headers $headers -Method Get
  if (-not $r.success) { throw (($r.errors | ForEach-Object { $_.message }) -join "; ") }
  return $r.result
}

function Cf-Post([string]$Uri, [hashtable]$Body) {
  $json = $Body | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri $Uri -Headers $headers -Method Post -Body $json
  if (-not $r.success) { throw (($r.errors | ForEach-Object { $_.message }) -join "; ") }
  return $r.result
}

function Cf-Delete([string]$Uri) {
  $r = Invoke-RestMethod -Uri $Uri -Headers $headers -Method Delete
  if ($null -ne $r -and $r.PSObject.Properties["success"] -and -not $r.success) {
    throw (($r.errors | ForEach-Object { $_.message }) -join "; ")
  }
}

function Ensure-Cname([string]$RecordName) {
  $list = @((Cf-Get "$base/zones/$zoneId/dns_records?type=CNAME&name=$RecordName"))
  if ($list.Count -gt 0) {
    $rec = $list[0]
    if ($rec.content -ne $pagesTarget -or $rec.proxied -ne $true) {
      Write-Host "Updating CNAME $RecordName -> $pagesTarget (proxied)"
      $json = @{ type = "CNAME"; name = $RecordName; content = $pagesTarget; proxied = $true; ttl = 1 } | ConvertTo-Json
      Invoke-RestMethod -Uri "$base/zones/$zoneId/dns_records/$($rec.id)" -Headers $headers -Method Put -Body $json | Out-Null
    } else {
      Write-Host "CNAME $RecordName already correct."
    }
    return
  }
  Write-Host "Creating CNAME $RecordName -> $pagesTarget (proxied)"
  Cf-Post "$base/zones/$zoneId/dns_records" @{
    type    = "CNAME"
    name    = $RecordName
    content = $pagesTarget
    proxied = $true
    ttl     = 1
  } | Out-Null
}

Write-Host "Pages: $project | apex: $fqdn | zone: $zoneName"

$zones = Cf-Get "$base/zones?name=$zoneName"
$zoneId = @($zones)[0].id
if (-not $zoneId) { throw "Zone $zoneName not found on this account." }

# Remove apex A/AAAA that point at game host (common 525 cause).
$apexRecords = @((Cf-Get "$base/zones/$zoneId/dns_records?name=$fqdn"))
foreach ($rec in $apexRecords) {
  if ($rec.type -in @("A", "AAAA")) {
    Write-Host "Deleting $($rec.type) $fqdn -> $($rec.content) (not valid HTTPS origin for website)"
    Cf-Delete "$base/zones/$zoneId/dns_records/$($rec.id)" | Out-Null
  }
}

$domainsUri = "$base/accounts/$accountId/pages/projects/$project/domains"
$domList = @((Cf-Get $domainsUri))
function Get-DomainName($obj) {
  if ($obj.name) { return $obj.name }
  return $obj.domain
}

$have = @($domList | Where-Object { (Get-DomainName $_) -eq $fqdn })
if ($have.Count -eq 0) {
  Write-Host "Adding $fqdn to Pages project $project ..."
  Cf-Post $domainsUri @{ name = $fqdn } | Out-Null
} else {
  Write-Host "Custom domain $fqdn already on Pages."
}

# Optional www
$www = "www.$zoneName"
$wwwHave = @($domList | Where-Object { (Get-DomainName $_) -eq $www })
if ($wwwHave.Count -eq 0) {
  try {
    Cf-Post $domainsUri @{ name = $www } | Out-Null
    Write-Host "Added $www to Pages."
  } catch {
    Write-Warning "Could not add $www : $_"
  }
}

Ensure-Cname $fqdn
Ensure-Cname $www

Write-Host ""
Write-Host "Done. Wait 1-2 min for SSL, then open https://$fqdn/"
Write-Host "play.$zoneName should stay DNS-only A to Shockbyte (grey cloud) - not the apex."
