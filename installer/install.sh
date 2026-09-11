#!/usr/bin/env sh
# MatPlay installer — Linux (apt/dnf/pacman/apk/zypper), macOS (brew).
# Usage: ./installer/install.sh [--no-system-deps]
set -eu

REPO_URL="https://github.com/SaptodeepSarkar/MatPlay"
DEST="${MATPLAY_DEST:-$HOME/Projects/MatPlay}"
INSTALL_SYSTEM_DEPS=1

for arg in "$@"; do
  case "$arg" in
    --no-system-deps) INSTALL_SYSTEM_DEPS=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

need() { command -v "$1" >/dev/null 2>&1; }
version_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$1" ]; }

echo "==> MatPlay installer"

# --- Node.js >= 26.4 (required by OpenTUI FFI) ---
if need node; then
  NODE_VER="$(node --version | sed 's/^v//')"
  if version_ge "26.4.0" "$NODE_VER"; then
    echo "    node $NODE_VER ok"
  else
    echo "    node $NODE_VER too old — need >= 26.4 (use fnm/nvm or nodejs.org)" >&2
    exit 1
  fi
else
  echo "    node not found — install Node.js >= 26.4 (fnm, nvm, or nodejs.org)" >&2
  exit 1
fi
need npm || { echo "    npm not found (ships with Node.js)" >&2; exit 1; }

# --- System deps: ffmpeg (ffplay) required, cava recommended ---
MISSING=""
need ffmpeg || MISSING="$MISSING ffmpeg"
need ffplay || MISSING="$MISSING ffplay"
need cava || MISSING="$MISSING cava(optional)"
if [ -n "$MISSING" ] && [ "$INSTALL_SYSTEM_DEPS" -eq 1 ]; then
  echo "==> installing system packages:$MISSING (needs sudo)"
  if need apt-get; then
    sudo apt-get update && sudo apt-get install -y ffmpeg cava
  elif need dnf; then
    sudo dnf install -y ffmpeg cava
  elif need pacman; then
    sudo pacman -Sy --noconfirm ffmpeg cava
  elif need apk; then
    sudo apk add ffmpeg cava
  elif need zypper; then
    sudo zypper install -y ffmpeg cava
  elif need brew; then
    brew install ffmpeg cava
  else
    echo "    no supported package manager — install manually:$MISSING" >&2
  fi
elif [ -n "$MISSING" ]; then
  echo "    skipping system deps (--no-system-deps). Missing:$MISSING"
fi

# --- App ---
if [ ! -d "$DEST/.git" ]; then
  echo "==> cloning $REPO_URL to $DEST"
  git clone "$REPO_URL" "$DEST"
fi
cd "$DEST"
echo "==> npm ci"
npm ci --no-audit --no-fund
echo "==> build"
npm run build
echo "==> link (npm link --global)"
npm link 2>/dev/null || sudo npm link

# --- Config skeleton ---
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/matplay"
if [ ! -f "$CONFIG_DIR/config.json" ]; then
  mkdir -p "$CONFIG_DIR"
  printf '{\n  "musicRoot": "%s/Music/Spotify",\n  "volume": 0.62,\n  "vizGain": 1.6,\n  "vizMaxHeight": 0.92\n}\n' "$HOME" > "$CONFIG_DIR/config.json"
  echo "==> wrote $CONFIG_DIR/config.json (edit musicRoot!)"
fi

echo "==> done. Run: matplay   (or: npm run dev)"
echo "    Verify with: npm run check"
