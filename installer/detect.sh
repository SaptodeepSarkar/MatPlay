#!/usr/bin/env sh
# MatPlay — standalone dependency detector.
# Run this to check what MatPlay needs without installing anything.
#
# Usage:
#   ./installer/detect.sh
#
# Prints PASS/FAIL for every dependency, plus config file paths
# MatPlay will use on this machine.
set -eu

for arg in "$@"; do
  case "$arg" in
    --json)
      echo "use npm run check for machine-readable output"
      exit 0
      ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

need() { command -v "$1" >/dev/null 2>&1; }

detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS="$ID"
  elif [ "$(uname -s)" = "Darwin" ]; then
    OS="macos"
  else
    OS="unknown"
  fi
}

detect_arch() {
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
  esac
}

detect_node() {
  if need node; then
    NODE_VER=$(node --version)
    if node -e "const p=process.versions.node.split('.').map(Number); process.exit(p[0]>26||(p[0]===26&&p[1]>=4)?0:1)" 2>/dev/null; then
      NODE_STATUS="PASS"
    else
      NODE_STATUS="FAIL (too old — need >= 26.4)"
    fi
  else
    NODE_VER="not found"
    NODE_STATUS="FAIL"
  fi
}

detect_config_paths() {
  CONFIG_PATH="${XDG_CONFIG_HOME:-$HOME/.config}/matplay/config.json"
}

echo ""
echo "=== MatPlay Dependency Detection ==="
echo ""
detect_os
detect_arch
detect_node
detect_config_paths

echo "Platform: $OS ($ARCH)"
echo ""

echo "--- Dependencies ---"
if [ "$NODE_STATUS" = "PASS" ]; then
  echo "  PASS  node      $NODE_VER"
else
  echo "  FAIL  node      $NODE_VER — $NODE_STATUS"
fi
need ffmpeg && echo "  PASS  ffmpeg    found" || echo "  FAIL  ffmpeg    not found"
need ffplay && echo "  PASS  ffplay    found" || echo "  FAIL  ffplay    not found"
need mpg123 && echo "  PASS  mpg123    found" || echo "  FAIL  mpg123    not found (ffplay backend will be used)"
need git && echo "  PASS  git       found" || echo "  FAIL  git       not found"
need cava && echo "  PASS  cava      found (live spectrum)" || echo "  WARN  cava      not found (procedural visualizer fallback)"
need spotdl && echo "  PASS  spotdl    found (optional downloads)" || echo "  WARN  spotdl    not found (install with --with-spotdl)"

echo ""
echo "--- Config file locations ---"
echo "  Config:    $CONFIG_PATH"
if [ -f "$CONFIG_PATH" ]; then
  echo "  Status:    exists"
else
  echo "  Status:    will be created on install"
fi
echo ""

failed=0
[ "$NODE_STATUS" != "PASS" ] && failed=1
need ffmpeg || failed=1
need ffplay || failed=1
need git || failed=1

if [ "$failed" -eq 0 ]; then
  echo "All critical dependencies present. Run: matplay"
else
  echo "Critical dependencies missing. Run: ./install.sh"
fi
echo ""
