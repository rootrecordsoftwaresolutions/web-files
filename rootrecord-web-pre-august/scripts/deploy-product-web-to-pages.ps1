param(
  [Parameter(Mandatory = $true)][string]$ProjectName,
  [switch]$SkipBuild
)
# Deploy a mobile app CRA build/ folder to Cloudflare Pages (one project per product).
# Run from the app frontend directory (e.g. weather-manager-mobile/frontend).
# Loads credentials.env walking up from this script and from cwd, plus ancestor/Web/credentials.env.
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

if ($files.Count -eq 0) {
  throw "No credentials.env or credentials.env.txt found (walked ancestors of script + cwd, including Web/)."
}

foreach ($f in $files) {
  Import-DotEnvFile $f
}

if ($env:CLOUDFLARE_GLOBAL_API_KEY -and -not $env:CLOUDFLARE_API_KEY) {
  Set-Item -Path "Env:CLOUDFLARE_API_KEY" -Value $env:CLOUDFLARE_GLOBAL_API_KEY
}

$hasToken = $env:CLOUDFLARE_API_TOKEN -and $env:CLOUDFLARE_API_TOKEN.Length -ge 10
$hasGlobal = $env:CLOUDFLARE_API_KEY -and $env:CLOUDFLARE_API_KEY.Length -ge 10 -and $env:CLOUDFLARE_EMAIL -and $env:CLOUDFLARE_EMAIL.Length -gt 3
if (-not $hasToken -and -not $hasGlobal) {
  throw "Set CLOUDFLARE_API_TOKEN, or CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY in a credentials file (merged from: $($files -join ', '))."
}

$frontendRoot = (Get-Location).Path
$buildDir = Join-Path $frontendRoot "build"
# Always run a production build when not -SkipBuild — otherwise stale build/ can be uploaded after code edits.
if (-not $SkipBuild) {
  Write-Host "Building SPA (react-scripts)..."
  # react-scripts/webpack builds for the heavier bundles (Business Manager: recharts +
  # framer-motion + jspdf + full radix-ui set) OOM on Node 22 even with a generous heap. The
  # crash is "Committing semi space failed" — Windows refusing a virtual-memory commit during
  # scavenge, not V8's old-space cap. Two-pronged mitigation:
  #
  #   1. GENERATE_SOURCEMAP=false — source-map emission is what actually pushes peak commit
  #      over the cliff; production bundles don't need them and Cloudflare Pages doesn't either.
  #      This is the single most effective CRA OOM fix and a no-op on apps that already disable
  #      sourcemaps via .env.production.
  #   2. NODE_OPTIONS = bigger old-space + bigger semi-space. Semi-space (default 16MB) is what
  #      the "Committing semi space failed" abort references; raising it gives V8 more room to
  #      grow the young generation before forcing a commit storm. Old-space at 8GB so the build
  #      itself doesn't run out either.
  #
  # Both env vars are saved and restored so we don't pollute the caller's session.
  $existingNodeOptions = $env:NODE_OPTIONS
  $existingGenSourcemap = $env:GENERATE_SOURCEMAP
  $heapOption = "--max-old-space-size=8192 --max-semi-space-size=128"
  if ([string]::IsNullOrWhiteSpace($existingNodeOptions)) {
    $env:NODE_OPTIONS = $heapOption
  }
  elseif ($existingNodeOptions -notmatch "max-old-space-size") {
    $env:NODE_OPTIONS = "$existingNodeOptions $heapOption"
  }
  $env:GENERATE_SOURCEMAP = "false"
  try {
    pnpm run build
  }
  finally {
    $env:NODE_OPTIONS = $existingNodeOptions
    $env:GENERATE_SOURCEMAP = $existingGenSourcemap
  }
}

if (-not (Test-Path (Join-Path $buildDir "index.html"))) {
  throw "Build output missing: $buildDir\index.html"
}

$builtIndex = Get-Content -LiteralPath (Join-Path $buildDir "index.html") -Raw
if ($builtIndex -match '/src/main\.tsx') {
  throw "build/index.html still references Vite dev entry (/src/main.tsx). Fix the production build before deploy."
}

$deployDir = "."
$wranglerPath = Join-Path $frontendRoot "wrangler.toml"
if (Test-Path -LiteralPath $wranglerPath) {
  $tomlRaw = Get-Content -LiteralPath $wranglerPath -Raw
  if ($tomlRaw -match 'pages_build_output_dir\s*=\s*"([^"]+)"') {
    $outRel = $Matches[1].Trim()
    $outIndex = Join-Path (Join-Path $frontendRoot $outRel) "index.html"
    if ($outRel -and (Test-Path -LiteralPath $outIndex)) {
      $deployDir = $outRel
    }
  }
}

$analyticsEnvByProject = @{
  "rootrecord-weather-web"   = "CF_WEB_ANALYTICS_TOKEN_WEATHER"
  "rootrecord-business-web"  = "CF_WEB_ANALYTICS_TOKEN_BUSINESS"
  "rootrecord-account-web"   = "CF_WEB_ANALYTICS_TOKEN_ACCOUNT"
  "rootrecord-token-web"     = "CF_WEB_ANALYTICS_TOKEN_TOKEN"
  "rootrecord-kilauea-web"   = "CF_WEB_ANALYTICS_TOKEN_KILAUEA"
  "rootrecord-root-farms-web" = "CF_WEB_ANALYTICS_TOKEN_ROOT_FARMS"
  "rootrecord-goals-web"     = "CF_WEB_ANALYTICS_TOKEN_GOALS"
}
$analyticsVar = $analyticsEnvByProject[$ProjectName]
if ($analyticsVar) {
  $analyticsTok = [Environment]::GetEnvironmentVariable($analyticsVar, "Process")
  if ($analyticsTok -and $analyticsTok.Length -ge 8) {
    $injectScript = Join-Path $PSScriptRoot "inject-cf-web-analytics.ps1"
    if (Test-Path -LiteralPath $injectScript) {
      & $injectScript -BuildRoot $buildDir -Token $analyticsTok
    }
  }
}

$env:WRANGLER_CI = "1"
Write-Host "Ensuring Cloudflare Pages project exists: $ProjectName"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  $createLog = (npx wrangler pages project create $ProjectName --production-branch=main 2>&1 | Out-String)
} finally {
  $ErrorActionPreference = $prevEap
}
if ($createLog.Trim()) { Write-Host $createLog.Trim() }
if ($LASTEXITCODE -ne 0 -and $createLog -notmatch "(?i)already exists|8000012") {
  Write-Host "Note: pages project create exited $LASTEXITCODE (continuing to deploy)."
}
# Deploy pages_build_output_dir (e.g. build/) so a Vite root index.html is not served instead of the bundle.
# Pages Functions in functions/ are still picked up from the project cwd.
Write-Host "Deploying static assets from: $deployDir"
npx wrangler pages deploy $deployDir --project-name=$ProjectName --branch=main @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
