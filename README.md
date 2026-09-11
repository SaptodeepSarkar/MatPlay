# MatPlay

Local-first terminal music player with a cover-art-adaptive TUI. The UI
re-skins itself from the current track's cover art (with a smooth fade),
cover art renders as real pixels via terminal graphics protocols, and a
CAVA-driven visualizer fills the screen behind everything.

## Stack

- TypeScript + Node.js 26.4+ (`--experimental-ffi` required by OpenTUI)
- [OpenTUI](https://opentui.com/) + React 19 (`@opentui/react`)
- Cover art: `<image protocol="auto">` — Kitty → Sixel → Unicode blocks.
- Audio output: `ffplay` (ships with ffmpeg) behind an `AudioBackend`.
- Live spectrum: `cava` decoding a **private FIFO feed** — desktop audio
  (browser, notifications) never reaches the visualizer. Without cava, a
  procedural engine takes over automatically.

## Install

```sh
# Linux (apt/dnf/pacman/apk/zypper) or macOS (brew):
./installer/install.sh
# Windows (PowerShell):
powershell -ExecutionPolicy Bypass -File installer\install.ps1
```

Or manually: `npm install`, `npm run build`, `npm link`. Requires
Node.js ≥ 26.4, ffmpeg + ffplay; cava recommended for the live spectrum.

```sh
npm run check   # verify node/ffmpeg/ffplay/cava/fifo on any machine
npm run dev     # run from source
```

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
test/                 # vitest suite
stitch/               # Stitch design reference + sample art
installer/            # install.sh (linux/macOS), install.ps1 (windows)
```

## Platform notes

- Linux/macOS: full experience (ffplay + cava + fifo feed).
- Windows: works; no cava/fifo, so the visualizer uses the procedural
  fallback. Install ffmpeg via `winget install Gyan.FFmpeg`.
- Any terminal: Kitty graphics → Sixel → Unicode blocks, auto-negotiated.
