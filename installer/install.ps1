# MatPlay — one-command installer (Windows PowerShell 5.1+).
#
# Flow:
#   1. Detect Windows version and every dependency (node, ffmpeg,
#      ffplay, git). mpg123 and cava are unavailable on Windows —
#      ffplay backend and procedural visualizer are used instead.
#   2. Auto-install missing items via winget.
#   3. Clone or update the repo.
#   4. npm ci → npm run build → npm link (admin fallback).
#   5. Create config skeleton if absent.
#   6. Print config file locations and next steps.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File installer\install.ps1
#   powershell -ExecutionPolicy Bypass -File installer\install.ps1 -WithSpotdl
#
# Verified dependency truth table (checked Sep 2026):
#   ffmpeg (Gyan.FFmpeg) and git (Git.Git) available via winget.
#   Node.js (OpenJS.NodeJS) available via winget but may track an
#   older release — script re-verifies version >= 26.4 and fails
#   loudly if winget gives an old one (install from nodejs.org instead).
#   No cava or mpg123 on Windows — use built-in fallbacks.
[CmdletBinding()]
param(
  [string]$Dest = if ($env:MATPLAY_DEST) { $env:MATPLAY_DEST } else { "$HOME\Projects\MatPlay" },
  [switch]$NoSystemDeps,
  [switch]$WithSpotdl,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/SaptodeepSarkar/MatPlay"

function Write-Step { param([string]$Msg) Write-Host "==> $Msg" -ForegroundColor Cyan }
function Write-Check { param([string]$Name, [bool]$Ok, [string]$Detail = "")
  $color = if ($Ok) { "Green" } else { "Red" }
  Write-Host "  $Name — " -NoNewline -ForegroundColor Gray
  Write-Host "$(if ($Ok) {'PASS'} else {'FAIL'})" -NoNewline -ForegroundColor $color
  if ($Detail) { Write-Host "  $Detail" -ForegroundColor DarkGray }
}

# ---------------------------------------------------------------------------
# Helper: run a command and return true/false
# ---------------------------------------------------------------------------
function Test-Command { param([string]$Name)
  [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-NodeOk {
  try {
    $parts = (node --version) -replace '^v', '' -split '\.'
    return ([int]$parts[0] -gt 26) -or (([int]$parts[0] -eq 26) -and ([int]$parts[1] -ge 4))
  } catch {
    return $false
  }
}

# ---------------------------------------------------------------------------
# OS detection
# ---------------------------------------------------------------------------
Write-Step "MatPlay installer (Windows)"
$osVer = Get-CimInstance Win32OperatingSystem
Write-Host "  platform: Windows $($osVer.Caption) ($((Get-CimInstance Win32ComputerSystem).TotalPhysicalMemory / 1GB -as [int])GB RAM)" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# Dependency detection table
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- Detected dependencies ---" -ForegroundColor Yellow

$nodeOk = Test-NodeOk
Write-Check "node" $nodeOk $(if (Test-Command node) { node --version } else { "not found (need >= 26.4)" })
Write-Check "ffmpeg" (Test-Command ffmpeg) $(if (Test-Command ffmpeg) { "found" } else { "required for audio" })
Write-Check "ffplay" (Test-Command ffplay) $(if (Test-Command ffplay) { "found" } else { "required for audio" })
Write-Check "git" (Test-Command git) $(if (Test-Command git) { "found" } else { "required for clone" })
Write-Check "mpg123" $false "unavailable on Windows — using ffplay backend"
Write-Check "cava" $false "unavailable on Windows — using procedural visualizer"
Write-Check "spotdl" (Test-Command spotdl) $(if (Test-Command spotdl) { "optional downloads ready" } else { "optional; use -WithSpotdl" })

# Winget availability
$wingetOk = Test-Command winget
Write-Check "winget" $wingetOk $(if ($wingetOk) {"found"} else {"required for auto-install"})

if ($DryRun) {
  Write-Host ""
  Write-Host "==> dry run — nothing installed"
  exit 0
}

# ---------------------------------------------------------------------------
# Install missing dependencies via winget
# ---------------------------------------------------------------------------
if (-not $NoSystemDeps) {
  if (-not $wingetOk) {
    Write-Host ""
    Write-Host "winget not found — installing winget (App Installer)..." -ForegroundColor Yellow
    try {
      winget install Microsoft.DesktopAppInstaller --silent --accept-package-agreements --accept-source-agreements 2>$null
      if (Test-Command winget) { $wingetOk = $true }
    } catch {
      Write-Warning "Could not install winget. Install dependencies manually."
    }
  }

  # --- Node.js >= 26.4 ---
  if (-not $nodeOk) {
    Write-Host ""
    Write-Step "Installing Node.js >= 26.4 via winget..."
    winget install --silent OpenJS.NodeJS --accept-package-agreements --accept-source-agreements 2>$null
    # Re-verify — winget may track an older release
    if (-not (Test-NodeOk)) {
      Write-Error "Node.js >= 26.4 still missing after winget (it may track an older release)."
      Write-Host "  Install manually from https://nodejs.org (v20+ LTS recommended), then re-run this script."
      exit 1
    }
    Write-Host "    node $(node --version) ok"
  } else {
    Write-Host "    node $(node --version) ok"
  }

  # --- ffmpeg (ships ffplay) ---
  if (-not (Test-Command ffmpeg)) {
    Write-Host ""
    Write-Step "Installing ffmpeg via winget..."
    winget install --silent Gyan.FFmpeg --accept-package-agreements --accept-source-agreements 2>$null
    Write-Host "    Restart your terminal so PATH picks up ffmpeg, then re-run this script."
    Write-Host "    (Or manually add C:\Program Files\ffmpeg\bin to your PATH.)"
    exit 0
  }
  Write-Host "    ffmpeg ok"

  # --- git ---
  if (-not (Test-Command git)) {
    Write-Host ""
    Write-Step "Installing git via winget..."
    winget install --silent Git.Git --accept-package-agreements --accept-source-agreements 2>$null
  }
  Write-Host "    git ok"

  # --- mpg123 (not on Windows) ---
  Write-Host "    mpg123: unavailable on Windows — ffplay backend used (volume steps restart audio)" -ForegroundColor DarkGray

  # --- cava (not on Windows) ---
  Write-Host "    cava: unavailable on Windows — procedural visualizer fallback" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
# Optional spotDL integration (official Python package)
# ---------------------------------------------------------------------------
if ($WithSpotdl -and -not (Test-Command spotdl)) {
  $python = if (Test-Command py) { "py" } elseif (Test-Command python) { "python" } else { $null }
  if ($python) {
    Write-Step "Installing optional spotDL downloader..."
    & $python -m pip install --user spotdl
    if (-not (Test-Command spotdl)) {
      Write-Warning "spotDL installed outside PATH. Add your Python Scripts directory to PATH."
    }
  } else {
    Write-Warning "Python with pip is required for spotDL. MatPlay will install without downloads."
  }
}

# ---------------------------------------------------------------------------
# Verify npm
# ---------------------------------------------------------------------------
if (-not (Test-Command npm)) {
  Write-Error "npm not found (ships with Node.js)"
  exit 1
}
Write-Host "    npm $(npm --version) ok"

# ---------------------------------------------------------------------------
# App: clone/update, build, link
# ---------------------------------------------------------------------------
Write-Host ""
if (-not (Test-Path "$Dest\.git")) {
  Write-Step "Cloning $RepoUrl to $Dest"
  git clone $RepoUrl $Dest
} else {
  Write-Host "==> updating existing repo at $Dest"
  Set-Location $Dest
  git pull --ff-only
}

Set-Location $Dest

Write-Host "==> npm ci" -ForegroundColor Yellow
npm ci --no-audit --no-fund

Write-Host "==> build" -ForegroundColor Yellow
npm run build

Write-Host "==> link" -ForegroundColor Yellow
try {
  npm link 2>$null
  Write-Host "    linked globally (system prefix)" -ForegroundColor Green
} catch {
  Write-Host "    system link failed — trying user prefix..." -ForegroundColor Yellow
  try {
    npm config set prefix "$HOME\AppData\Local\npm" 2>$null
    npm link 2>$null
    Write-Host "    linked into $HOME\AppData\Local\npm" -ForegroundColor Green
  } catch {
    Write-Host "    global link failed — use npx matplay or npm run dev" -ForegroundColor Yellow
  }
}

# ---------------------------------------------------------------------------
# Config skeleton
# ---------------------------------------------------------------------------
$configDir = Join-Path $env:APPDATA "matplay"
$configFile = Join-Path $configDir "config.json"
if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Force -Path $configDir | Out-Null }
if (-not (Test-Path $configFile)) {
  $musicRoot = Join-Path $HOME "Music\Spotify"
  @"
{
  "musicRoot": "$musicRoot",
  "volume": 0.62,
  "vizGain": 1.6,
  "vizMaxHeight": 0.92,
  "theme": "dark",
  "accentColor": "#BB86FC"
}
"@ | Out-File -Encoding utf8 $configFile
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  MatPlay installation complete" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Config file locations:" -ForegroundColor Yellow
Write-Host "  Config:    $configFile" -ForegroundColor White
Write-Host "  Default:   $HOME\Music\Spotify (edit config if yours is elsewhere)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Key commands:" -ForegroundColor Yellow
Write-Host "  matplay          start the player" -ForegroundColor White
Write-Host "  npm run dev      run from source" -ForegroundColor White
Write-Host "  npm run check    verify all dependencies" -ForegroundColor White
Write-Host "  Downloads:       Settings > SPOTDL DOWNLOADS (optional)" -ForegroundColor White
Write-Host ""
Write-Host "Media keys (play/pause/next/prev) work automatically when a" -ForegroundColor DarkGray
Write-Host "desktop environment (e.g. Windows Media Transport) is available." -ForegroundColor DarkGray
Write-Host ""
