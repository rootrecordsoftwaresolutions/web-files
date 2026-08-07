# Root Goals Pages: ensure project exists, DNS (grey-cloud CNAME), and custom domain goals.rootrecord.info.
# Loads credentials.env from repo ancestors (same pattern as setup-root-farms-pages-dns.ps1).
#
# Optional credentials.env keys:
#   GOALS_PAGES_PROJECT   (default: rootrecord-goals-web)
#   GOALS_PAGES_SUBDOMAIN (default: goals)  -> goals.rootrecord.info
#   GOALS_PAGES_HOST      (override FQDN)
#   ROOTRECORD_ZONE_NAME  (default: rootrecord.info)
#
# Requires: CLOUDFLARE_API_TOKEN (or EMAIL+GLOBAL_API_KEY), CLOUDFLARE_ACCOUNT_ID
$ErrorActionPreference = "Stop"
$env:WRANGLER_CI = "1"

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
if ($files.Count -eq 0) { throw "No credentials.env found (walked ancestors of script + cwd, including Web/)." }
foreach ($f in $files) { Import-DotEnvFile $f }
Write-Host "Loaded credentials from: $($files -join ', ')"

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
  throw "Need CLOUDFLARE_API_TOKEN (Bearer), or CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY in credentials."
}

$accountId = [string]$env:CLOUDFLARE_ACCOUNT_ID
if (-not $accountId -or $accountId.Length -lt 10) { throw "CLOUDFLARE_ACCOUNT_ID required in credentials for Pages domain API." }

$project = [string]$env:GOALS_PAGES_PROJECT
if (-not $project) { $project = "rootrecord-goals-web" }
$subLabel = [string]$env:GOALS_PAGES_SUBDOMAIN
if (-not $subLabel) { $subLabel = "goals" }
$zoneName = [string]$env:ROOTRECORD_ZONE_NAME
if (-not $zoneName) { $zoneName = "rootrecord.info" }
$fqdn = [string]$env:GOALS_PAGES_HOST
if (-not $fqdn) { $fqdn = "$subLabel.$zoneName" }
$pagesTarget = "$project.pages.dev"

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

function Cf-Delete([string]$Uri) {
  $r = Invoke-RestMethod -Uri $Uri -Headers $headers -Method Delete
  if ($null -ne $r -and $r.PSObject.Properties["success"] -and -not $r.success) {
    $msg = ($r.errors | ForEach-Object { $_.message }) -join "; "
    throw "Cloudflare API DELETE failed: $msg"
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

Write-Host "Root Goals Pages project: $project"
Write-Host "Custom host: $fqdn -> $pagesTarget"

$projects = @((Cf-Get "$base/accounts/$accountId/pages/projects"))
$exists = @($projects | Where-Object { $_.name -eq $project }).Count -gt 0
if (-not $exists) {
  Write-Host "Creating Pages project $project (production branch: main)..."
  & npx wrangler pages project create $project --production-branch=main
  if ($LASTEXITCODE -ne 0) { throw "wrangler pages project create failed (exit $LASTEXITCODE)" }
} else {
  Write-Host "Pages project $project already exists."
}

$zones = Cf-Get "$base/zones?name=$zoneName"
$zone = @($zones)[0]
if (-not $zone.id) { throw "Zone $zoneName not found or not accessible with this token." }
$zoneId = $zone.id
Write-Host "Zone $zoneName id: $zoneId"

$allForName = @((Cf-Get "$base/zones/$zoneId/dns_records?name=$fqdn"))
foreach ($r in $allForName) {
  Write-Host "DNS on name: type=$($r.type) id=$($r.id) proxied=$($r.proxied) content=$($r.content)"
  if ($r.proxied -eq $true) {
    Write-Host "Patching $($r.id) to DNS only..."
    Cf-Patch "$base/zones/$zoneId/dns_records/$($r.id)" @{ proxied = $false } | Out-Null
  }
}
$list = Cf-Get "$base/zones/$zoneId/dns_records?type=CNAME&name=$fqdn"
if (-not $list -or @($list).Count -eq 0) {
  Write-Host "No CNAME for $fqdn - creating DNS-only CNAME to $pagesTarget"
  Cf-Post "$base/zones/$zoneId/dns_records" @{
    type    = "CNAME"
    name    = $fqdn
    content = $pagesTarget
    proxied = $false
    ttl     = 1
  } | Out-Null
  Write-Host "Created CNAME (DNS only)."
} else {
  $rec = @($list)[0]
  Write-Host "Found DNS record $($rec.id) proxied=$($rec.proxied) content=$($rec.content)"
  if ($rec.proxied -eq $true) {
    Cf-Patch "$base/zones/$zoneId/dns_records/$($rec.id)" @{ proxied = $false } | Out-Null
    Write-Host "Updated record to DNS only."
  }
  if ($rec.content -ne $pagesTarget) {
    Write-Warning "CNAME target is '$($rec.content)' not '$pagesTarget'. Update in dashboard if wrong."
  }
}

$domainsUri = "$base/accounts/$accountId/pages/projects/$project/domains"
$domList = Cf-Get $domainsUri
$domArr = @($domList)
$have = @($domArr | Where-Object {
    $n = $_.name
    if (-not $n) { $n = $_.domain }
    $n -eq $fqdn
  })
if ($have.Count -gt 0) {
  Write-Host "Pages project $project already has custom domain $fqdn"
} else {
  Write-Host "Adding custom domain $fqdn to Pages project $project"
  Cf-Post $domainsUri @{ name = $fqdn } | Out-Null
  Write-Host "Custom domain add requested (SSL may take a minute)."
}

$hostDom = $null
foreach ($d in $domArr) {
  $n = $d.name
  if (-not $n) { $n = $d.domain }
  if ($n -eq $fqdn) {
    Write-Host "Pages domain row: status=$($d.status) id=$($d.id)"
    $hostDom = $d
  }
}
if ($hostDom -and [string]$hostDom.status -eq "deactivated") {
  Write-Host "Removing deactivated Pages hostname..."
  Cf-Delete "$base/accounts/$accountId/pages/projects/$project/domains/$fqdn" | Out-Null
  Write-Host "Re-adding custom domain $fqdn..."
  Cf-Post $domainsUri @{ name = $fqdn } | Out-Null
}

Write-Host ""
Write-Host "Done. Root Goals should be at: https://$fqdn/"

# --- API Worker hostname (api-goals.rootrecord.info) ---
$apiLabel = "api-goals"
$apiFqdn = "$apiLabel.$zoneName"
Write-Host ""
Write-Host "API host: $apiFqdn (Worker route rootrecord-api-goals)"

$apiList = Cf-Get "$base/zones/$zoneId/dns_records?name=$apiFqdn"
if (-not $apiList -or @($apiList).Count -eq 0) {
  Write-Host "Creating proxied AAAA for Worker route: $apiFqdn"
  Cf-Post "$base/zones/$zoneId/dns_records" @{
    type    = "AAAA"
    name    = $apiLabel
    content = "100::"
    proxied = $true
    ttl     = 1
  } | Out-Null
  Write-Host "Created api-goals DNS (proxied)."
} else {
  $apiRec = @($apiList)[0]
  Write-Host "Found api-goals DNS: type=$($apiRec.type) proxied=$($apiRec.proxied) content=$($apiRec.content)"
  if ($apiRec.proxied -ne $true) {
    Cf-Patch "$base/zones/$zoneId/dns_records/$($apiRec.id)" @{ proxied = $true } | Out-Null
    Write-Host "Set api-goals to proxied (orange cloud)."
  }
}

Write-Host "API should be at: https://$apiFqdn/api/"
