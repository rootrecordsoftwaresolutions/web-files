# Ava Laptop - discover RootMC/Ava on any drive + self-install all dependencies
$ErrorActionPreference = "Continue"
$Kit = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-AvaRoot([string]$Root) {
  if ([string]::IsNullOrWhiteSpace($Root)) { return $false }
  $pkg = Join-Path $Root "Web Files\rootmc-ava\package.json"
  $idx = Join-Path $Root "Web Files\rootmc-ava\src\index.mjs"
  return (Test-Path -LiteralPath $pkg) -and (Test-Path -LiteralPath $idx)
}

function Find-RootMcRoot([string]$KitDir) {
  if ($env:ROOTMC_ROOT -and (Test-AvaRoot $env:ROOTMC_ROOT)) {
    return (Resolve-Path -LiteralPath $env:ROOTMC_ROOT).Path
  }

  $cur = $KitDir
  for ($i = 0; $i -lt 8 -and $cur; $i++) {
    if (Test-AvaRoot $cur) { return (Resolve-Path -LiteralPath $cur).Path }
    $parent = Split-Path -Parent $cur
    if (-not $parent -or $parent -eq $cur) { break }
    $cur = $parent
  }

  $relPaths = @(
    ".1 Work Stations\RootMC",
    "RootMC",
    ".1 Work Stations\RootMC Workspace",
    "RootMC Workspace"
  )

  $kitDrive = $null
  try { $kitDrive = ([IO.DriveInfo][IO.Path]::GetPathRoot($KitDir)).Name.TrimEnd('\') } catch {}

  $drives = @()
  if ($kitDrive) { $drives += $kitDrive }
  Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue |
    Where-Object { $_.Used -ne $null -or $_.Free -ne $null } |
    ForEach-Object {
      $letter = ($_.Root -replace '\\$', '')
      if ($letter -and $letter -notin $drives) { $drives += $letter }
    }

  foreach ($drive in $drives) {
    foreach ($rel in $relPaths) {
      $candidate = Join-Path "$drive\" $rel
      if (Test-AvaRoot $candidate) {
        return (Resolve-Path -LiteralPath $candidate).Path
      }
    }
    foreach ($depth1 in @(Get-ChildItem -LiteralPath "$drive\" -Directory -ErrorAction SilentlyContinue | Select-Object -First 40)) {
      $c1 = Join-Path $depth1.FullName "RootMC"
      if (Test-AvaRoot $c1) { return (Resolve-Path -LiteralPath $c1).Path }
      if ($depth1.Name -eq "RootMC" -and (Test-AvaRoot $depth1.FullName)) {
        return (Resolve-Path -LiteralPath $depth1.FullName).Path
      }
      foreach ($depth2 in @(Get-ChildItem -LiteralPath $depth1.FullName -Directory -ErrorAction SilentlyContinue | Select-Object -First 30)) {
        if ($depth2.Name -eq "RootMC" -and (Test-AvaRoot $depth2.FullName)) {
          return (Resolve-Path -LiteralPath $depth2.FullName).Path
        }
      }
    }
  }
  return $null
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = @($machine, $user, $env:Path) -join ";"
}

function Find-NodeExe {
  foreach ($c in @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe",
    (Join-Path $env:LOCALAPPDATA "Programs\node\node.exe"),
    (Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
  )) {
    if ($c -and (Test-Path -LiteralPath $c)) { return $c }
  }
  return $null
}

function Get-NodeMajor([string]$NodeExe) {
  try {
    $v = & $NodeExe -p "process.versions.node" 2>$null
    if ($v -match '^(\d+)') { return [int]$Matches[1] }
  } catch {}
  return 0
}

function Install-NodeLts {
  Write-Host "Installing Node.js LTS (winget)..."
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    & winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --disable-interactivity
    Refresh-Path
    return
  }
  Write-Host "winget not found — downloading Node 20 MSI..."
  $msi = Join-Path $env:TEMP "node-lts-x64.msi"
  # Fixed recent LTS channel redirect via nodejs.org
  $uri = "https://nodejs.org/dist/latest-v20.x/node-v20.19.4-x64.msi"
  try {
    Invoke-WebRequest -Uri $uri -OutFile $msi -UseBasicParsing
  } catch {
    # Fallback: let winget-less hosts fail clearly
    throw "Could not download Node MSI. Install Node 20+ from https://nodejs.org then re-run."
  }
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait -NoNewWindow
  Refresh-Path
}

function Ensure-Cloudflared {
  $candidates = @(
    $env:CLOUDFLARED_PATH,
    "C:\Program Files\cloudflared\cloudflared.exe",
    "C:\Program Files (x86)\cloudflared\cloudflared.exe",
    (Join-Path $env:LOCALAPPDATA "cloudflared\cloudflared.exe"),
    (Get-Command cloudflared -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
  ) | Where-Object { $_ }
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { return $c }
  }
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Host "cloudflared optional — not found (public tunnel skipped until installed)"
    return $null
  }
  Write-Host "Installing cloudflared (optional public tunnel)..."
  & winget install -e --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements --disable-interactivity
  Refresh-Path
  $again = Get-Command cloudflared -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
  if ($again) { return $again }
  foreach ($c in @(
    "C:\Program Files\cloudflared\cloudflared.exe",
    "C:\Program Files (x86)\cloudflared\cloudflared.exe"
  )) {
    if (Test-Path -LiteralPath $c) { return $c }
  }
  Write-Host "cloudflared install skipped/failed — Ava still runs locally on :8787"
  return $null
}

function Ensure-AvaNpmDeps([string]$AvaRoot, [string]$NodeExe) {
  $ensure = Join-Path $AvaRoot "scripts\ensure-deps.mjs"
  if (-not (Test-Path -LiteralPath $ensure)) {
    Write-Host "ensure-deps.mjs missing — running npm install directly"
    Push-Location $AvaRoot
    try {
      & npm.cmd install --omit=dev
      if ($LASTEXITCODE -ne 0) { throw "npm install failed ($LASTEXITCODE)" }
    } finally { Pop-Location }
    return
  }
  Write-Host "Ensuring Ava npm dependencies..."
  & $NodeExe $ensure
  if ($LASTEXITCODE -ne 0) { throw "ensure-deps failed ($LASTEXITCODE)" }
}

function Ensure-HandoffDirs([string]$Handoff) {
  foreach ($sub in @("", "data", "notes", "runtime", "uploads")) {
    $p = if ($sub) { Join-Path $Handoff $sub } else { $Handoff }
    if (-not (Test-Path -LiteralPath $p)) {
      New-Item -ItemType Directory -Force -Path $p | Out-Null
      Write-Host "Created $p"
    }
  }
}

# ---- main ----
Write-Host "Scanning for Ava / RootMC..."
$Root = Find-RootMcRoot $Kit
if (-not $Root) {
  Write-Host "Could not find RootMC with Web Files\rootmc-ava on any drive."
  Write-Host "Put this kit next to RootMC (or set ROOTMC_ROOT), then retry."
  Read-Host "Press Enter"
  exit 1
}

$AvaRoot = Join-Path $Root "Web Files\rootmc-ava"
$EnvFile = Join-Path $Root ".env"
$Exe = Join-Path $Kit "AvaIvy\Ava Ivy.exe"
$Handoff = Join-Path $Root "Server Handoffs\Ava Ivy"
$RealmEnv = Join-Path $Root "Web Files\rootmc-realm-api\scripts\lib\rootmc-env.mjs"

$env:ROOTMC_ROOT = $Root
$env:ROOTMC_ENV_FILE = $EnvFile
$env:AVA_HANDOFF = $Handoff
$env:AVA_NO_STATUS_WINDOW = "1"

Write-Host "Found Ava at: $Root"

if (-not (Test-Path -LiteralPath $Exe)) {
  Write-Host "Missing UI: $Exe"
  Read-Host "Press Enter"
  exit 1
}
if (-not (Test-Path -LiteralPath (Join-Path $AvaRoot "src\index.mjs"))) {
  Write-Host "Missing Ava source: $AvaRoot"
  Read-Host "Press Enter"
  exit 1
}

# Self-install Node if needed
$node = Find-NodeExe
$major = if ($node) { Get-NodeMajor $node } else { 0 }
if (-not $node -or $major -lt 20) {
  try {
    Install-NodeLts
  } catch {
    Write-Host $_.Exception.Message
    Read-Host "Press Enter"
    exit 1
  }
  Refresh-Path
  $node = Find-NodeExe
  $major = if ($node) { Get-NodeMajor $node } else { 0 }
}
if (-not $node -or $major -lt 20) {
  Write-Host "Node.js 20+ still not available after install. Reboot or install from https://nodejs.org then re-run."
  Read-Host "Press Enter"
  exit 1
}
Write-Host "Node: $node (v$(& $node -p 'process.versions.node'))"

# Optional tunnel binary
$cf = Ensure-Cloudflared
if ($cf) {
  $env:CLOUDFLARED_PATH = $cf
  Write-Host "cloudflared: $cf"
}

# Handoff folders
Ensure-HandoffDirs $Handoff

# Env secrets (cannot auto-create)
if (-not (Test-Path -LiteralPath $EnvFile)) {
  Write-Host "Missing secrets: $EnvFile"
  Write-Host "Copy RootMC\.env onto this tree (tokens), then re-run. Everything else self-installs."
  Read-Host "Press Enter"
  exit 1
}

# realm-api env loader (required by Ava config)
if (-not (Test-Path -LiteralPath $RealmEnv)) {
  Write-Host "Missing env loader: $RealmEnv"
  Write-Host "Finish copying Web Files\rootmc-realm-api onto this drive."
  Read-Host "Press Enter"
  exit 1
}

try {
  Ensure-AvaNpmDeps -AvaRoot $AvaRoot -NodeExe $node
} catch {
  Write-Host "Dependency install failed: $($_.Exception.Message)"
  Read-Host "Press Enter"
  exit 1
}

$alive = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'rootmc-ava\\src\\(index|server|poller)\.mjs' }
if (-not $alive) {
  Write-Host "Starting Ava brain from $AvaRoot"
  Start-Process -FilePath $node -ArgumentList "src\index.mjs" -WorkingDirectory $AvaRoot -WindowStyle Minimized
  Start-Sleep -Seconds 2
} else {
  Write-Host "Ava brain already running (pid $($alive.ProcessId -join ', '))"
}

Write-Host "Starting Ava Ivy UI"
Start-Process -FilePath $Exe -WorkingDirectory (Split-Path $Exe)
Write-Host "Status UI: http://127.0.0.1:8787/"
