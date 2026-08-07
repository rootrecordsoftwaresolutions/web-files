# Attach rootmc.net: Cloudflare Dashboard > Pages > rootmc-web > Custom domains
# Preview: https://rootmc-web.pages.dev
# Deploy: powershell -File deploy.ps1
$ErrorActionPreference = "Stop"
# npx may write npm notices to stderr; do not treat them as terminating errors.
$PrevNativeErr = $ErrorActionPreference

$workspaceRoot = "C:\Users\store\Desktop\Projects\RootMC Workspace"
. (Join-Path $workspaceRoot "scripts\load-rootmc-env.ps1")

if (-not $env:CLOUDFLARE_API_TOKEN -or $env:CLOUDFLARE_API_TOKEN.Length -lt 20) {
    throw "Set CLOUDFLARE_API_TOKEN in RootMC Workspace\.env"
}
if (-not $env:CLOUDFLARE_ACCOUNT_ID) {
    throw "Set CLOUDFLARE_ACCOUNT_ID in RootMC Workspace\.env"
}

Set-Location $PSScriptRoot
node scripts/build.mjs

$project = "rootmc-web"
Write-Host "Deploying Pages project $project to RootMC account ..."

$ErrorActionPreference = "Continue"
$projList = (npx wrangler pages project list 2>&1) | Out-String
$ErrorActionPreference = $PrevNativeErr
if ($projList -notmatch $project) {
    Write-Host "Creating Pages project $project ..."
    npx wrangler pages project create $project --production-branch main 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$ErrorActionPreference = "Continue"
npx wrangler pages deploy build `
    --project-name $project `
    --branch main `
    --commit-dirty=true 2>&1 | Out-Host
$ErrorActionPreference = $PrevNativeErr
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. Attach custom domain rootmc.net in Cloudflare Dashboard: Pages > rootmc-web > Custom domains."
