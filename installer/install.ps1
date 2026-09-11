# MatPlay installer — Windows (PowerShell 5.1+).
# Run: powershell -ExecutionPolicy Bypass -File installer\install.ps1
$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/SaptodeepSarkar/MatPlay"
$Dest = if ($env:MATPLAY_DEST) { $env:MATPLAY_DEST } else { "$HOME\Projects\MatPlay" }

Write-Host "==> MatPlay installer (Windows)"

# --- Node.js >= 26.4 ---
try {
  $nodeVer = (node --version) -replace '^v', ''
  $required = [version]"26.4.0"
  if ([version]$nodeVer -lt $required) {
    Write-Error "node $nodeVer too old — need >= 26.4 (winget install OpenJS.NodeJS)"
    exit 1
  }
  Write-Host "    node $nodeVer ok"
} catch {
  Write-Host "    installing Node.js via winget..."
  winget install --silent OpenJS.NodeJS
}

# --- ffmpeg (ships ffplay). No cava on Windows: visualizer falls back
# --- to the built-in procedural engine automatically.
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "==> installing ffmpeg via winget..."
  winget install --silent Gyan.FFmpeg
  Write-Host "    restart your terminal so PATH picks up ffmpeg, then re-run."
} else {
  Write-Host "    ffmpeg ok"
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
