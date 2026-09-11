#!/usr/bin/env sh
# MatPlay — one-command installer (Linux/macOS).
#
# Flow:
#   1. Detect OS, distro, and every dependency (node, ffmpeg, ffplay,
#      mpg123, cava, git, sudo, fnm).
#   2. Auto-install missing items with the right method per platform.
#   3. Clone or update the repo.
#   4. npm ci → npm run build → npm link (user-prefix fallback).
#   5. Create config skeleton if absent.
#   6. Print config file locations and next steps.
#
# Usage:
#   ./install.sh                  # full install (auto-installs missing deps)
#   ./install.sh --with-spotdl    # also install optional Spotify downloader
#   ./install.sh --no-system-deps # skip system packages (you installed them)
#   ./install.sh --dry-run        # show detection, install nothing
#
# Verified dependency truth table (checked against repology, Sep 2026):
#   ffmpeg+mpg123+git exist on apt/dnf/pacman/apk/zypper/brew (names as used).
#   ffmpeg needs RPM Fusion on Fedora, Packman on openSUSE (handled below).
#   cava on dnf/pacman/zypper/brew, and on apk edge-testing only.
#   On Debian/Ubuntu `cava` is a DIFFERENT package (a Java library!) —
#   never apt-install it; build github.com/karlstav/cava from source or
#   use MatPlay's built-in fallback visualizer.
#   Node.js >= 26.4 is never in distro repos — installed via fnm (user-space).
set -eu

REPO_URL="https://github.com/SaptodeepSarkar/MatPlay"
DEST="${MATPLAY_DEST:-$HOME/Projects/MatPlay}"
INSTALL_SYSTEM_DEPS=1
DRY_RUN=0
WITH_SPOTDL=0

for arg in "$@"; do
  case "$arg" in
    --no-system-deps) INSTALL_SYSTEM_DEPS=0 ;;
    --with-spotdl) WITH_SPOTDL=1 ;;
    --dry-run) DRY_RUN=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

need() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------------------
# OS / distro detection
# ---------------------------------------------------------------------------
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

echo "==> MatPlay installer (Linux/macOS)"
detect_os
detect_arch
echo "    platform: $OS ($ARCH)"

# ---------------------------------------------------------------------------
# Dependency detection table
# ---------------------------------------------------------------------------
DEPS='node:node
ffmpeg:ffmpeg
ffplay:ffplay
mpg123:mpg123
git:git
cava:cava'

# Node.js >= 26.4 check (OpenTUI FFI requirement)
node_ok=0
if need node; then
  if node -e "const p=process.versions.node.split('.').map(Number); process.exit(p[0]>26||(p[0]===26&&p[1]>=4)?0:1)" 2>/dev/null; then
    node_ok=1
  fi
fi

echo ""
echo "--- Detected dependencies ---"
for entry in $DEPS; do
  name="${entry%%:*}"
  cmd="${entry##*:}"
  if [ "$name" = "node" ]; then
    if [ "$node_ok" -eq 1 ]; then
      printf "  PASS  %-10s %s\n" "$name" "$(node --version)"
    else
      if need node; then
        printf "  FAIL  %-10s %s (need >= 26.4)\n" "$name" "$(node --version)"
      else
        printf "  FAIL  %-10s not found\n" "$name"
      fi
    fi
  elif need "$cmd" 2>/dev/null; then
    printf "  PASS  %-10s found\n" "$name"
  else
    printf "  FAIL  %-10s not found\n" "$name"
  fi
done

# Sudo availability
have_sudo=0
if [ "$(id -u)" -ne 0 ]; then
  if need sudo && sudo -n true 2>/dev/null; then
    have_sudo=1
    echo "  PASS  sudo      passwordless (will use)"
  else
    echo "  WARN  sudo      not passwordless (will prompt or skip)"
  fi
else
  have_sudo=1
  echo "  PASS  sudo      running as root (will use directly)"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo ""
  echo "==> dry run — nothing installed"
  exit 0
fi

# ---------------------------------------------------------------------------
# Node.js >= 26.4 (via fnm — user-space install, no sudo)
# ---------------------------------------------------------------------------
install_node() {
  echo ""
  echo "==> installing Node.js >= 26.4 via fnm (user-space, no sudo)"
  export FNMDIR="${XDG_DATA_HOME:-$HOME/.local/share}/fnm"
  if ! need fnm; then
    curl -fsSL https://fnm.vercel.app/install | bash
    export PATH="$FNMDIR/node-versions/default/installation/bin:$PATH"
    fnm_env=$(fnm env 2>/dev/null || true)
    eval "$fnm_env" 2>/dev/null || true
  fi
  if need fnm; then
    fnm install 26.4.0
    fnm use 26.4.0 --install >/dev/null
    eval "$(fnm env --shell sh)"
    echo "    node $(node --version) installed via fnm"
    echo "    fnm path added to shell profile (~/.bashrc or ~/.zshrc)"
  else
    echo "    fnm install failed — install Node.js >= 26.4 manually from nodejs.org" >&2
    return 1
  fi
}

if [ "$node_ok" -eq 0 ]; then
  install_node
  # Verify
  if ! node -e "const p=process.versions.node.split('.').map(Number); process.exit(p[0]>26||(p[0]===26&&p[1]>=4)?0:1)" 2>/dev/null; then
    echo "    Node.js >= 26.4 still unavailable after fnm — check your shell profile" >&2
    exit 1
  fi
fi
echo "    node $(node --version) ok"
need npm || { echo "    npm not found (ships with Node.js)" >&2; exit 1; }

# ---------------------------------------------------------------------------
# System packages: ffmpeg + ffplay + mpg123 + git required; cava recommended
# ---------------------------------------------------------------------------
install_system_deps() {
  echo ""
  echo "==> installing system packages (needs sudo)"
  if [ "$have_sudo" -eq 0 ]; then
    echo "    sudo unavailable — cannot install system packages" >&2
    echo "    install manually: ffmpeg mpg123 git (+ cava if you want live spectrum)" >&2
    return 1
  fi

  case "$OS" in
    ubuntu|debian)
      sudo apt-get update -y
      sudo apt-get install -y ffmpeg mpg123 git
      echo "    NOTE: 'cava' on Debian/Ubuntu is a Java library, NOT the audio"
      echo "    visualizer — do NOT apt-install it. Live spectrum needs a manual"
      echo "    build (github.com/karlstav/cava) or MatPlay uses its fallback."
      ;;
    fedora)
      if ! rpm -q rpmfusion-free-release >/dev/null 2>&1; then
        echo "==> enabling RPM Fusion (for ffmpeg)"
        sudo dnf install -y "https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm"
      fi
      sudo dnf install -y ffmpeg mpg123 cava git
      ;;
    arch|manjaro)
      sudo pacman -Syu --noconfirm --needed ffmpeg mpg123 cava git
      ;;
    alpine)
      sudo apk add ffmpeg mpg123 git
      sudo apk add cava 2>/dev/null && echo "    cava installed" || echo "    cava lives in edge-testing only — skipping (fallback visualizer)"
      ;;
    opensuse-tumbleweed|opensuse-leap|opensuse)
      if ! sudo zypper lr 2>/dev/null | grep -qi packman; then
        sudo zypper ar -cfp 90 "https://ftp.gwdg.de/pub/linux/misc/packman/suse/$(grep '^ID=' /etc/os-release | cut -d= -f2 | sed 's/Tumbleweed/Tumbleweed/' | sed 's/Leap/Leap/')" packman 2>/dev/null || {
          . /etc/os-release
          case "${ID:-}" in
            *tumbleweed*) PACKMAN_URL="https://ftp.gwdg.de/pub/linux/misc/packman/suse/openSUSE_Tumbleweed/" ;;
            *) PACKMAN_URL="https://ftp.gwdg.de/pub/linux/misc/packman/suse/openSUSE_Leap_${VERSION_ID}/" ;;
          esac
          sudo zypper ar -cfp 90 "$PACKMAN_URL" packman
        }
      fi
      sudo zypper install -y --from packman ffmpeg
      sudo zypper install -y mpg123 cava git
      ;;
    macos)
      brew install ffmpeg mpg123 cava git
      ;;
    *)
      echo "    unrecognized distro '$OS' — install manually: ffmpeg mpg123 git (+ cava)" >&2
      return 1
      ;;
  esac
}

missing=""
need ffmpeg || missing="$missing ffmpeg"
need ffplay || missing="$missing ffplay"
need mpg123 || missing="$missing mpg123"
need git || missing="$missing git"
need cava || missing="$missing cava(optional)"

if [ -n "$missing" ]; then
  if [ "$INSTALL_SYSTEM_DEPS" -eq 1 ]; then
    install_system_deps || true
  else
    echo "    skipping system deps (--no-system-deps). Still missing:$missing"
  fi
fi

echo ""
echo "--- Post-install check ---"
need ffmpeg && echo "  PASS  ffmpeg" || echo "  FAIL  ffmpeg (audio will not work)"
need ffplay && echo "  PASS  ffplay" || echo "  FAIL  ffplay"
need mpg123 && echo "  PASS  mpg123" || echo "  FAIL  mpg123 (ffplay backend will be used)"
need git && echo "  PASS  git" || echo "  FAIL  git"
need cava && echo "  PASS  cava (live spectrum)" || echo "  WARN  cava (procedural visualizer fallback)"
need spotdl && echo "  PASS  spotdl (downloads)" || echo "  WARN  spotdl (optional; use --with-spotdl)"

# ---------------------------------------------------------------------------
# Optional spotDL integration (official Python package)
# ---------------------------------------------------------------------------
install_spotdl() {
  echo ""
  echo "==> installing optional spotDL downloader"
  if need pipx; then
    pipx install spotdl
  elif need python3 && python3 -m pip --version >/dev/null 2>&1; then
    python3 -m pip install --user spotdl
  elif need python && python -m pip --version >/dev/null 2>&1; then
    python -m pip install --user spotdl
  else
    echo "    Python with pip (or pipx) is required for spotDL." >&2
    echo "    MatPlay will still install; downloads remain unavailable." >&2
    return 1
  fi
}

if [ "$WITH_SPOTDL" -eq 1 ] && ! need spotdl; then
  install_spotdl || true
fi
if [ "$WITH_SPOTDL" -eq 1 ]; then
  need spotdl \
    && echo "  PASS  spotdl ready" \
    || echo "  WARN  spotdl installed outside PATH; add your Python user bin directory"
fi

# ---------------------------------------------------------------------------
# App: clone/update, build, link
# ---------------------------------------------------------------------------
echo ""
if [ ! -d "$DEST/.git" ]; then
  echo "==> cloning $REPO_URL to $DEST"
  git clone "$REPO_URL" "$DEST"
else
  echo "==> updating existing repo at $DEST"
  cd "$DEST" && git pull --ff-only
fi

cd "$DEST"
echo "==> npm ci"
npm ci --no-audit --no-fund
echo "==> build"
npm run build

echo "==> link"
if npm link 2>/dev/null; then
  echo "    linked globally (system prefix)"
else
  echo "    system link needs privileges — linking into ~/.local instead"
  npm config set prefix "$HOME/.local" 2>/dev/null
  npm link 2>/dev/null || npm install -g . 2>/dev/null || true
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) echo "    ~/.local/bin already in PATH" ;;
    *) echo "    add to PATH: export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
  esac
fi

# ---------------------------------------------------------------------------
# Config skeleton
# ---------------------------------------------------------------------------
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/matplay"
CONFIG_FILE="$CONFIG_DIR/config.json"
mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_FILE" ]; then
  printf '{\n  "musicRoot": "%s/Music/Spotify",\n  "volume": 0.62,\n  "vizGain": 1.6,\n  "vizMaxHeight": 0.92,\n  "theme": "dark",\n  "accentColor": "#BB86FC"\n}\n' "$HOME" > "$CONFIG_FILE"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=============================="
echo "  MatPlay installation complete"
echo "=============================="
echo ""
echo "Config file locations:"
echo "  Config:    $CONFIG_FILE"
echo "  Default:   ~/Music/Spotify (edit config if yours is elsewhere)"
echo ""
echo "Key commands:"
echo "  matplay          start the player"
echo "  npm run dev      run from source"
echo "  npm run check    verify all dependencies"
echo "  Downloads:       Settings > SPOTDL DOWNLOADS (optional)"
echo ""
echo "If ~/.local/bin is not in your PATH, add this to ~/.bashrc or ~/.zshrc:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
echo ""
echo "MPRIS media keys (play/pause/next/prev) work automatically when a"
echo "desktop environment is running — no config needed."
echo ""
