# MatPlay installer — Windows (PowerShell 5.1+).
# Run: powershell -ExecutionPolicy Bypass -File installer\install.ps1
$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/SaptodeepSarkar/MatPlay"
$Dest = if ($env:MATPLAY_DEST) { $env:MATPLAY_DEST } else { "$HOME\Projects\MatPlay" }

function Test-NodeOk {
  try {
    $parts = (node --version) -replace '^v', '' -split '\.'
    return ([int]$parts[0] -gt 26) -or (([int]$parts[0] -eq 26) -and ([int]$parts[1] -ge 4))
  } catch {
    return $false
  }
}

Write-Host "==> MatPlay installer (Windows)"

# --- git (needed for clone) ---
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "==> installing git via winget..."
  winget install --silent Git.Git
}

# --- Node.js >= 26.4 ---
if (-not (Test-NodeOk)) {
  Write-Host "==> installing Node.js via winget..."
  winget install --silent OpenJS.NodeJS
  if (-not (Test-NodeOk)) {
    Write-Error "Node.js >= 26.4 still missing after winget (it may track an older release) — install manually from nodejs.org, then re-run."
    exit 1
  }
}
Write-Host "    node $(node --version) ok"

# --- ffmpeg (ships ffplay). No cava on Windows: visualizer falls back
# --- to the built-in procedural engine automatically.
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "==> installing ffmpeg via winget..."
  winget install --silent Gyan.FFmpeg
  Write-Host "    restart your terminal so PATH picks up ffmpeg, then re-run this script."
  exit 0
}
Write-Host "    ffmpeg ok"
if (Get-Command mpg123 -ErrorAction SilentlyContinue) {
  Write-Host "    mpg123 ok (gapless backend)"
} else {
  Write-Host "    note: mpg123 not found — ffplay backend will be used (volume steps restart audio)."
}
if (-not (Get-Command cava -ErrorAction SilentlyContinue)) {
  Write-Host "    note: cava is unavailable on Windows — live spectrum disabled (procedural fallback)."
}

# --- App ---
if (-not (Test-Path "$Dest\.git")) {
  Write-Host "==> cloning $RepoUrl to $Dest"
  git clone $RepoUrl $Dest
}
Set-Location $Dest
Write-Host "==> npm ci"
npm ci --no-audit --no-fund
Write-Host "==> build"
npm run build
Write-Host "==> link"
npm link

# --- Config skeleton ---
$configDir = Join-Path $env:APPDATA "matplay"
$configFile = Join-Path $configDir "config.json"
if (-not (Test-Path $configFile)) {
  New-Item -ItemType Directory -Force -Path $configDir | Out-Null
  $musicRoot = (Join-Path $HOME "Music\Spotify") -replace '\\', '\\'
  "{`n  `"musicRoot`": `"$musicRoot`",`n  `"volume`": 0.62,`n  `"vizGain`": 1.6,`n  `"vizMaxHeight`": 0.92`n}" | Out-File -Encoding utf8 $configFile
  Write-Host "==> wrote $configFile (edit musicRoot!)"
}

Write-Host "==> done. Run: matplay   (or: npm run dev)"
