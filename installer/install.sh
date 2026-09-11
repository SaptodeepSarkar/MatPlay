#!/usr/bin/env sh
# MatPlay installer — Linux (apt/dnf/pacman/apk/zypper), macOS (brew).
# Usage: ./installer/install.sh [--no-system-deps]
#
# Verified dependency truth table (checked against repology, Sep 2026):
# - ffmpeg+mpg123+git exist on apt/dnf/pacman/apk/zypper/brew (names as used).
# - ffmpeg needs RPM Fusion on Fedora, Packman on openSUSE (handled below).
# - cava (audio visualizer) exists on dnf/pacman/zypper/brew, and on apk
#   edge-testing only. On Debian/Ubuntu `cava` is a DIFFERENT package
#   (a Java library!) — never apt-install it; build karlstav/cava from
#   source if you want the live spectrum there.
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

echo "==> MatPlay installer"

# --- Node.js >= 26.4 (required by OpenTUI FFI) ---
if need node; then
  if node -e "const p=process.versions.node.split('.').map(Number); process.exit(p[0]>26||(p[0]===26&&p[1]>=4)?0:1)" 2>/dev/null; then
    echo "    node $(node --version) ok"
  else
    echo "    $(node --version) too old — need Node.js >= 26.4 (use fnm/nvm or nodejs.org; distro repos are usually older)" >&2
    exit 1
  fi
else
  echo "    node not found — install Node.js >= 26.4 via fnm, nvm, or nodejs.org" >&2
  exit 1
fi
need npm || { echo "    npm not found (ships with Node.js)" >&2; exit 1; }

# --- System deps: ffmpeg+ffplay+mpg123+git required, cava recommended ---
install_system_deps() {
  echo "==> installing system packages (needs sudo)"
  if need apt-get; then
    sudo apt-get update
    sudo apt-get install -y ffmpeg mpg123 git
    echo "    NOTE: 'cava' on Debian/Ubuntu is a Java library, NOT the audio"
    echo "    visualizer — do NOT apt-install it. Live spectrum needs a manual"
    echo "    build (github.com/karlstav/cava) or MatPlay uses its fallback."
  elif need dnf; then
    if ! rpm -q rpmfusion-free-release >/dev/null 2>&1; then
      echo "==> enabling RPM Fusion (for ffmpeg)"
      sudo dnf install -y "https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm"
    fi
    sudo dnf install -y ffmpeg mpg123 cava git
  elif need pacman; then
    sudo pacman -Syu --noconfirm --needed ffmpeg mpg123 cava git
  elif need apk; then
    sudo apk add ffmpeg mpg123 git
    sudo apk add cava || echo "    cava lives in Alpine edge-testing only — skipping (fallback visualizer)."
  elif need zypper; then
    if ! sudo zypper lr 2>/dev/null | grep -qi packman; then
      # shellcheck disable=SC1091
      . /etc/os-release
      case "${ID:-}-${VERSION_ID:-}" in
        *tumbleweed*) PACKMAN_URL="https://ftp.gwdg.de/pub/linux/misc/packman/suse/openSUSE_Tumbleweed/" ;;
        *) PACKMAN_URL="https://ftp.gwdg.de/pub/linux/misc/packman/suse/openSUSE_Leap_${VERSION_ID}/" ;;
      esac
      echo "==> adding Packman (for ffmpeg): $PACKMAN_URL"
      sudo zypper ar -cfp 90 "$PACKMAN_URL" packman
    fi
    sudo zypper install -y --from packman ffmpeg
    sudo zypper install -y mpg123 cava git
  elif need brew; then
    brew install ffmpeg mpg123 cava git
  else
    echo "    no supported package manager — install manually: ffmpeg mpg123 git (+ cava)" >&2
    return 1
  fi
}

MISSING=""
need ffmpeg || MISSING="$MISSING ffmpeg"
need ffplay || MISSING="$MISSING ffplay"
need mpg123 || MISSING="$MISSING mpg123"
need git || MISSING="$MISSING git"
need cava || MISSING="$MISSING cava(optional)"
if [ -n "$MISSING" ] && [ "$INSTALL_SYSTEM_DEPS" -eq 1 ]; then
  install_system_deps || true
elif [ -n "$MISSING" ]; then
  echo "    skipping system deps (--no-system-deps). Still missing:$MISSING"
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
echo "==> link"
if npm link 2>/dev/null; then
  echo "    linked globally"
else
  echo "    system link needs privileges — linking into ~/.local instead"
  npm config set prefix "$HOME/.local"
  npm link
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) echo "    add to PATH: export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
  esac
fi

# --- Config skeleton ---
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/matplay"
if [ ! -f "$CONFIG_DIR/config.json" ]; then
  mkdir -p "$CONFIG_DIR"
  printf '{\n  "musicRoot": "%s/Music/Spotify",\n  "volume": 0.62,\n  "vizGain": 1.6,\n  "vizMaxHeight": 0.92\n}\n' "$HOME" > "$CONFIG_DIR/config.json"
  echo "==> wrote $CONFIG_DIR/config.json (edit musicRoot!)"
fi

echo "==> done. Run: matplay   (or: npm run dev)"
echo "    Verify with: npm run check"
