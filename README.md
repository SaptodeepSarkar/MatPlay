# MatPlay

Local-first terminal music player with a cover-art-adaptive TUI. The UI
re-skins itself from the current track's cover art, and cover art renders
as real pixels via terminal graphics protocols.

## Stack

- TypeScript + Node.js 26.4+ (`--experimental-ffi` required by OpenTUI)
- [OpenTUI](https://opentui.com/) + React 19 (`@opentui/react`)
- Cover art: `<image protocol="auto">` — Kitty → Sixel → Unicode blocks.
  Works on foot (Sixel), kitty/ghostty/wezterm (Kitty), and anywhere else
  via the blocks fallback. No terminal restriction.
- Audio: `music-metadata` for durations/tags; playback behind an
  `AudioBackend` interface (mpv/ffplay adapter planned).

## Run

```sh
npm install
npm run dev
```

Keys: `space` play/pause · `←/→` seek · `1/2/3` shuffle/loop-list/loop-one ·
`+/-` volume · `m` mute · `q` quit.

## Layout

```txt
src/
  main.tsx            # renderer entry (createCliRenderer + createRoot)
  app/App.tsx         # now-playing screen (mock data for now)
  ui/
    stitchTheme.ts    # StitchTheme + themeFromCoverArt()
    components/       # AlbumArtwork, TrackMetadata, SeekBar,
                      # PlaybackControls, VolumeMeter
  library/            # types, diagnostics (scanner lands here)
  utils/              # stable ids, path helpers
test/                 # vitest snapshot tests (captureCharFrame)
stitch/               # Stitch design reference + sample cover art
```

## Status

UI mock milestone: Kalyani now-playing card on OpenTUI with real embedded
cover art. Library scanner, queue/shuffle/repeat engine, search, and real
audio playback are next, reusing the backend plan in `MatPlay.md`.
