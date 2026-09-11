# MatPlay

Local-first terminal music player with a cover-art-adaptive TUI. The UI
re-skins itself from the current track's cover art (with a smooth fade),
cover art renders as real pixels via terminal graphics protocols, and a
CAVA-driven visualizer fills the screen behind everything.

## What MatPlay Does

MatPlay is a complete music player that runs inside your terminal. It scans
your local music library (`Playlist / Artist / Song / song.mp3`), indexes it,
and gives you a full playback experience — play, pause, seek, shuffle, queue,
loop — without ever opening a browser or external app. It renders the now
playing screen with cover art, a live CAVA spectrum visualizer, a lyrics
panel, and playback controls, all in a terminal-native interface that adapts
its colors to the current track's album art.

Key features:

- **Cover-art-adaptive theming** — the visualizer and UI palette shift with
  the current track's cover art (ffmpeg sampling, smooth fade).
- **Live spectrum** — CAVA decoding a private FIFO feed; desktop audio is
  never captured. Procedural fallback when CAVA is absent.
- **Gapless playback** — `mpg123` backend via remote protocol; `ffplay` as
  fallback.
- **MPRIS presence** — media keys work from KDE/GNOME applets.
- **Search, playlists, queue** — full library management in the terminal.
- **Lyrics** — LRC timestamp parsing with 3-line traveling window; plain
  `.txt` fallback.
- **Cross-platform** — Linux, macOS, Windows (ffplay + procedural visualizer).

## Stack

- TypeScript + Node.js 26.4+ (`--experimental-ffi` required by OpenTUI)
- [OpenTUI](https://opentui.com/) + React 19 (`@opentui/react`)
- Cover art: `<image protocol="auto">` — Kitty → Sixel → Unicode blocks.
- Audio output: `mpg123` (gapless via remote protocol) behind an
  `AudioBackend`; `ffplay` (from ffmpeg) as fallback.
- Live spectrum: `cava` decoding a **private FIFO feed** — desktop audio
  (browser, notifications) never reaches the visualizer. Without cava, a
  procedural engine takes over automatically.
- No external music server (MPD/Mopidy). Everything self-contained.

## Install

**Quick start (recommended):**

```sh
git clone https://github.com/SaptodeepSarkar/MatPlay.git
cd MatPlay
./installer/install.sh        # Linux/macOS — auto-detects and installs deps
```

```powershell
git clone https://github.com/SaptodeepSarkar/MatPlay.git
cd MatPlay
powershell -ExecutionPolicy Bypass -File installer\install.ps1   # Windows
```

Both installers auto-detect what's missing, install it, build the app,
link it globally, create the config skeleton, and print config paths.

Options:

```sh
./installer/install.sh --dry-run     # show detection, install nothing
./installer/install.sh --no-system-deps  # skip system packages
./installer/detect.sh                # check deps without installing
```

Manual install: `npm install`, `npm run build`, `npm link`. Requires
Node.js ≥ 26.4, ffmpeg + ffplay; cava recommended for the live spectrum.

```sh
npm run check   # verify node/ffmpeg/ffplay/cava/fifo on any machine
npm run dev     # run from source
```

### Per-platform dependency notes (verified Sep 2026)

| System | ffmpeg | mpg123 | cava | Notes |
| --- | --- | --- | --- | --- |
| Arch (pacman) | extra ✓ | extra ✓ | extra ✓ | Full experience |
| Fedora (dnf) | RPM Fusion ❗ | official ✓ | official ✓ | Installer enables RPM Fusion |
| Ubuntu/Debian (apt) | main ✓ | universe ✓ | **never `apt install cava`** — that name is a Java library! Build karlstav/cava from source or use the fallback | |
| openSUSE (zypper) | Packman ❗ | OSS ✓ | OSS ✓ | Installer adds Packman |
| Alpine (apk) | main ✓ | main ✓ | edge-testing only | Falls back if missing |
| macOS (brew) | ✓ | ✓ | ✓ | Full experience |
| Windows (winget) | Gyan.FFmpeg ✓ | — | — | ffplay backend + procedural visualizer |

Node.js ≥ 26.4 never comes from distro repos — use fnm/nvm/nodejs.org
on Linux, `winget install OpenJS.NodeJS` on Windows (the script
re-verifies the version and fails loudly if winget tracks an older one).

## Screenshots

Real screenshots of MatPlay running in a terminal — no mockups:

| State | Screenshot |
| --- | --- |
| Paused | `Shots/paused.png` |
| Playing (with CAVA visualizer) | `Shots/playing-visualizer.png` |
| Playing (with lyrics) | `Shots/playing-lyrics.png` |
| Playing (full visualizer) | `Shots/playing-full.png` |
| Playing (adaptive green palette) | `Shots/playing-green.png` |

All screenshots are 1920×1080 captured from the foot terminal.

## Config

`~/.config/matplay/config.json` (Linux/macOS) or
`%APPDATA%\matplay\config.json` (Windows). Everything is tunable:

```json
{
  "musicRoot": "/home/you/Music/Spotify",
  "volume": 0.62,
  "vizGain": 1.6,
  "vizMaxHeight": 0.92,
  "lastPlaylist": "Work",
  "lastTrackId": "…"
}
```

| Key | Meaning |
| --- | ------- |
| `musicRoot` | Main folder: playlist / artist / song / song.mp3 |
| `volume` | 0..1, restored on startup |
| `vizGain` | Spectrum amplification before bar mapping |
| `vizMaxHeight` | Fraction of screen height bars may never exceed |
| `lastPlaylist` / `lastTrackId` | Resume state (no autoplay on startup) |

## Keys

`space` play/pause · `n`/`p` next/previous · `←/→` seek · `/` search ·
`b` playlists · `Q` queue · `l` lyrics toggle · `s` settings ·
`?` shortcuts · `1/2/3` shuffle/loop-list/loop-one · `+/-` volume ·
`m` mute · `q` quit · `ESC` back.

## Layout

```txt
src/
  main.tsx            # renderer entry
  app/
    App.tsx           # now-playing screen
    config.ts         # zod config (load/save/defaults)
  ui/
    stitchTheme.ts    # StitchTheme tokens
    palette.ts        # ffmpeg sampling + theme fade
    visualizerEngine.ts
    components/       # AlbumArtwork, TrackMetadata, SeekBar,
                      # PlaybackControls, VolumeMeter, LyricsPanel,
                      # Visualizer, SettingsMenu, ShortcutsPanel,
                      # SearchOverlay, PlaylistOverlay, QueueOverlay
  library/            # scanner, search, types, diagnostics
  playback/           # AudioBackend, FfplayBackend, CavaSpectrum,
                      # SpectrumFeed (private fifo), trackMeta
  lyrics/             # lrc/txt parser
  utils/              # stable ids, path helpers
test/                 # vitest suite (30 tests)
stitch/               # Stitch design reference + sample art (mock screenshots removed — use Shots/ for real screenshots)
Shots/                # real screenshots from running the app
installer/            # install.sh (linux/macOS), install.ps1 (windows)
```

## Platform notes

- Linux/macOS: full experience (mpg123/ffplay + cava + fifo feed).
- Linux desktop applets (KDE/GNOME media controls): MatPlay registers
  `org.mpris.MediaPlayer2.matplay` with title, artist, album, duration,
  and cover art, and honors applet transport keys.
- Windows: works; no cava/fifo, so the visualizer uses the procedural
  fallback. Install ffmpeg via `winget install Gyan.FFmpeg`.
- Any terminal: Kitty graphics → Sixel → Unicode blocks, auto-negotiated.
- First run: run `./installer/install.sh` (or `.\install.ps1` on
  Windows). It detects your OS, installs missing deps, builds, links,
  and creates `~/.config/matplay/config.json` (or `%APPDATA%\matplay\`)
  with the default music root pre-filled.
