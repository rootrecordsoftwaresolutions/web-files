# Deploy all per-app API shards (does NOT deploy rootrecord-primary).
# Run from Web/cloudflare:  powershell -NoProfile -ExecutionPolicy Bypass -File ./deploy-api-shards.ps1
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$shards = @(
  "rootrecord-api-weather",
  "rootrecord-api-business",
  "rootrecord-api-account",
  "rootrecord-api-token",
  "rootrecord-api-kilauea",
  "rootrecord-api-goals"
)
foreach ($name in $shards) {
  $dir = Join-Path $here $name
  if (-not (Test-Path -LiteralPath $dir)) {
    throw "Missing directory: $dir"
  }
  Write-Host "`n========== $name ==========" -ForegroundColor Cyan
  Push-Location $dir
  try {
    # Always `npm ci` here: Wrangler v4 pulls `blake3-wasm` with a required `.wasm` file under
    # `node_modules/blake3-wasm/dist/wasm/nodejs/`. Skipping install when `node_modules` exists but
    # is incomplete (partial copy, AV quarantine, failed extract) yields ENOENT at deploy time.
    npm ci
    powershell -NoProfile -ExecutionPolicy Bypass -File ./deploy.ps1 @args
  }
  finally {
    Pop-Location
  }
}
Write-Host "`nAll API shards deployed." -ForegroundColor Green
