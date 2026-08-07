# Set business.rootrecord.info → Pages with DNS-only (grey cloud) and ensure Pages custom domain.
# Requires CLOUDFLARE_API_TOKEN with Zone:DNS:Edit + Account:Cloudflare Pages:Edit (or broader token).
# Loads credentials.env by walking up from this script (same pattern as deploy-product-web-to-pages.ps1).
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
if ($files.Count -eq 0) { throw "No credentials.env found (walked ancestors of script + cwd, including Web/)." }
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
  throw "Need CLOUDFLARE_API_TOKEN (Bearer), or CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY in credentials."
}

$accountId = [string]$env:CLOUDFLARE_ACCOUNT_ID
if (-not $accountId -or $accountId.Length -lt 10) { throw "CLOUDFLARE_ACCOUNT_ID required in credentials for Pages domain API." }
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
  try {
    $r = Invoke-RestMethod -Uri $Uri -Headers $headers -Method Delete
  } catch {
    $errBody = $null
    try {
      $resp = $_.Exception.Response
      if ($resp -and $resp.GetResponseStream()) {
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $errBody = $sr.ReadToEnd()
        $sr.Close()
      }
    } catch { /* no-op */ }
    if ($errBody) { Write-Host "API error body: $errBody" }
    throw
  }
  if ($null -ne $r -and $r.PSObject.Properties["success"] -and -not $r.success) {
    $msg = ($r.errors | ForEach-Object { $_.message }) -join "; "
    throw "Cloudflare API DELETE failed: $msg"
  }
  return $r.result
}

function Cf-Post([string]$Uri, [hashtable]$Body) {
  $json = $Body | ConvertTo-Json -Compress
  try {
    $r = Invoke-RestMethod -Uri $Uri -Headers $headers -Method Post -Body $json
  } catch {
    $errBody = $null
    try {
      $resp = $_.Exception.Response
      if ($resp -and $resp.GetResponseStream()) {
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $errBody = $sr.ReadToEnd()
        $sr.Close()
      }
    } catch { /* no-op */ }
    if ($errBody) { Write-Host "API error body: $errBody" }
    throw
  }
  if (-not $r.success) {
    $msg = ($r.errors | ForEach-Object { $_.message }) -join "; "
    throw "Cloudflare API POST failed: $msg"
  }
  return $r.result
}

# --- Zone ---
$zones = Cf-Get "$base/zones?name=rootrecord.info"
$zone = @($zones)[0]
if (-not $zone.id) { throw "Zone rootrecord.info not found or not accessible with this token." }
$zoneId = $zone.id
Write-Host "Zone rootrecord.info id: $zoneId"

# --- DNS: business hostname ---
$fqdn = "business.rootrecord.info"
# List every record on this name (CNAME + stray A/AAAA can cause wrong routing).
$allForName = @((Cf-Get "$base/zones/$zoneId/dns_records?name=$fqdn"))
foreach ($r in $allForName) {
  Write-Host "DNS on name: type=$($r.type) id=$($r.id) proxied=$($r.proxied) content=$($r.content)"
  if ($r.proxied -eq $true) {
    Write-Host "Patching $($r.id) to DNS only..."
    Cf-Patch "$base/zones/$zoneId/dns_records/$($r.id)" @{ proxied = $false } | Out-Null
  }
}
$list = Cf-Get "$base/zones/$zoneId/dns_records?type=CNAME&name=$fqdn"
if (-not $list -or $list.Count -eq 0) {
  Write-Host "No CNAME for $fqdn - creating DNS-only CNAME to rootrecord-business-web.pages.dev"
  Cf-Post "$base/zones/$zoneId/dns_records" @{
    type    = "CNAME"
    name    = $fqdn
    content = "rootrecord-business-web.pages.dev"
    proxied = $false
    ttl     = 1
  } | Out-Null
  Write-Host "Created CNAME (DNS only)."
} else {
  $rec = $list[0]
  Write-Host "Found DNS record $($rec.id) type=$($rec.type) name=$($rec.name) proxied=$($rec.proxied) content=$($rec.content)"
  if ($rec.proxied -eq $true) {
    Cf-Patch "$base/zones/$zoneId/dns_records/$($rec.id)" @{ proxied = $false } | Out-Null
    Write-Host "Updated record to DNS only (grey cloud)."
  } else {
    Write-Host "Record already DNS only - no DNS change."
  }
  $expected = "rootrecord-business-web.pages.dev"
  if ($rec.content -ne $expected) {
    Write-Warning "CNAME target is '$($rec.content)' not '$expected'. Fix in dashboard if wrong."
  }
}

# --- Pages custom domain ---
$project = "rootrecord-business-web"
$domainsUri = "$base/accounts/$accountId/pages/projects/$project/domains"
$domList = Cf-Get $domainsUri
$domArr = @($domList)
$have = @($domArr | Where-Object {
    $n = $_.name
    if (-not $n) { $n = $_.domain }
    $n -eq "business.rootrecord.info"
  })
if ($have.Count -gt 0) {
  Write-Host "Pages project $project already has custom domain business.rootrecord.info"
} else {
  Write-Host "Adding custom domain business.rootrecord.info to Pages project $project"
  Cf-Post $domainsUri @{ name = "business.rootrecord.info" } | Out-Null
  Write-Host "Custom domain add requested (SSL may take a minute)."
}

$businessDom = $null
foreach ($d in $domArr) {
  $n = $d.name
  if (-not $n) { $n = $d.domain }
  if ($n -eq "business.rootrecord.info") {
    Write-Host "Pages domain row: status=$($d.status) id=$($d.id)"
    $businessDom = $d
  }
}
if ($businessDom -and [string]$businessDom.status -eq "deactivated") {
  Write-Host "Removing deactivated Pages hostname (DELETE uses hostname in path, not UUID)..."
  Cf-Delete "$base/accounts/$accountId/pages/projects/$project/domains/business.rootrecord.info" | Out-Null
  Write-Host "Re-adding custom domain business.rootrecord.info..."
  Cf-Post $domainsUri @{ name = "business.rootrecord.info" } | Out-Null
  Write-Host "Re-add submitted; TLS activation may take a few minutes."
}

# --- Worker routes (orange-cloud + Worker on this hostname can cause 522 to wrong origin) ---
try {
  $routes = Cf-Get "$base/zones/$zoneId/workers/routes"
  $biz = @($routes | Where-Object { $_.pattern -match "business" })
  if ($biz.Count -gt 0) {
    Write-Warning "Zone has Worker route(s) mentioning business - review in dashboard (Workers routes):"
    $biz | ForEach-Object { Write-Host "  pattern=$($_.pattern) script=$($_.script)" }
  } else {
    Write-Host "No Worker routes matching 'business' on this zone."
  }
} catch {
  Write-Host "Could not list Worker routes (token may lack permission): $($_.Exception.Message)"
}

Write-Host "Done."
