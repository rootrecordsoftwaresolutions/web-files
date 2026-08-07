# Insert Cloudflare Web Analytics beacon into HTML files before Pages upload.
# Token: Web Analytics → Add site → copy token only. Pass -Token or set env CF_WEB_ANALYTICS_TOKEN.
param(
  [Parameter(Mandatory = $true)][string]$BuildRoot,
  [string]$Token = ""
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $BuildRoot)) {
  throw "BuildRoot not found: $BuildRoot"
}
$t = if ($Token) { $Token.Trim() } else { [string]$env:CF_WEB_ANALYTICS_TOKEN }
if (-not $t -or $t.Length -lt 8) {
  Write-Host "inject-cf-web-analytics: no token; skipping."
  exit 0
}
if ($t -match '["''<>]') {
  throw "Token contains invalid characters for JSON."
}
# Match dashboard snippet (token JSON spacing + end comment).
$snippet = @"
<!-- Cloudflare Web Analytics --><script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "$t"}'></script><!-- End Cloudflare Web Analytics -->
"@
$files = Get-ChildItem -LiteralPath $BuildRoot -Filter "*.html" -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' }
if (-not $files -or $files.Count -eq 0) {
  Write-Host "inject-cf-web-analytics: no HTML files under $BuildRoot"
  exit 0
}
$changed = 0
foreach ($f in $files) {
  $raw = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
  if ($raw -match 'static\.cloudflareinsights\.com/beacon\.min\.js') { continue }
  $new = $raw
  if ($raw -match '(?i)</head>') {
    $new = [regex]::Replace($raw, '(?i)</head>', ($snippet.TrimEnd() + "`n</head>"), 1)
  } elseif ($raw -match '(?i)</body>') {
    $new = [regex]::Replace($raw, '(?i)</body>', ($snippet.TrimEnd() + "`n</body>"), 1)
  } else {
    Write-Host "inject-cf-web-analytics: skip (no head/body): $($f.FullName)"
    continue
  }
  if ($new -ne $raw) {
    Set-Content -LiteralPath $f.FullName -Value $new -Encoding UTF8 -NoNewline
    $changed++
  }
}
Write-Host "inject-cf-web-analytics: updated $changed file(s) under $BuildRoot"
