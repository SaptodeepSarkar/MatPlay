# MatPlay

## Goal

Build a complete local-first TypeScript terminal music player.

MatPlay should run inside the terminal, but visually feel closer to a polished GUI app than an old command-line tool. The target aesthetic is a clean Material UI-inspired TUI: panels, selected states, soft borders, accent colors, search, settings, lyrics, progress bars, and keyboard-first navigation.

## Research Verdict

Use **OpenTUI** + React 19 (`@opentui/core`, `@opentui/react`) for the TUI.
OpenTUI renders natively in Kitty/Sixel/Unicode block terminals with React
component model, which is the best fit for a Material UI-inspired terminal app.

Do **not** use MPD, Mopidy, or any external music server. The app owns its
own scanning, queue, playback state, config, and UI.

Important technical truth: "no MPD server" is realistic. "No dependencies at
all" is not realistic for MP3 playback in TypeScript. Node.js can read files,
but it does not natively decode MP3 or send decoded audio to ALSA/Pulse/
PipeWire/CoreAudio/WASAPI. Playback is hidden behind an `AudioBackend`
interface using system decoders (`mpg123` for gapless, `ffplay` as fallback).

## Hard Requirements

- Language: TypeScript.
- Runtime: Node.js.
- UI: terminal-based TUI, not browser GUI.
- Preferred UI framework: OpenTUI + React.
- No MPD.
- No Mopidy.
- No background music daemon.
- No Spotify, YouTube, or network API dependency.
- Local music only.
- First-run setup must ask the user to select or enter their main music folder.
- The app must scan the required folder structure automatically.
- The app must support playlist folders.
- The app must support lyrics files inside song folders.

## Acceptable Dependencies

Use dependencies only where they solve real technical problems.

Actual packages used:

- `@opentui/core` — terminal renderer
- `@opentui/react` — React integration for OpenTUI
- `react` — UI components
- `zod` — config validation
- `music-metadata` — audio metadata extraction
- `chokidar` — file change watching
- `mpris-service` — desktop media keys
- `tsx` — TypeScript runner
- `typescript` — compiler
- `vitest` — test runner

Avoid random dependencies for tiny utilities. Use Node standard library for filesystem, path handling, and simple data transforms.

## Music Folder Structure

MatPlay must expect this structure:

```txt
Main Music Folder/
  Playlist Folder/
    Artist Folder/
      Song Folder/
        song.mp3
        lyrics.lrc or lyrics.txt
```

Example:

```txt
Music/
  Work/
    Shreya Ghoshal/
      Kalyani/
        Kalyani.mp3
        Kalyani.lrc
    Sai Abhyankkar/
      Aasa Kooda/
        Aasa Kooda.mp3
        lyrics.txt
  Chill/
    Artist Name/
      Song Name/
        Song Name.mp3
        Song Name.lrc
```

Rules:

- The main music folder contains playlist folders.
- Each playlist folder contains artist folders.
- Each artist folder contains song folders.
- Each song folder contains one music file and optionally one lyrics file.
- A first-level folder is treated as a playlist.
- The same artist can appear in multiple playlists.
- The same song can appear in multiple playlists if the folder appears in multiple playlist folders.
- Supported audio for MVP: `.mp3`.
- Supported lyrics for MVP: `.lrc` and `.txt`.
- Prefer `.lrc` over `.txt` when both exist.
- Ignore hidden files and hidden folders.

## First-Run Setup

When MatPlay starts for the first time:

1. Check for a config file.
2. If no config exists, show a setup screen inside the TUI.
3. Ask the user to enter/select the main music folder.
4. Validate that the folder exists.
5. Scan the folder.
6. Show warnings if the structure is invalid.
7. Save the config.
8. Open the main player screen.

Suggested config locations:

```txt
Linux/macOS: ~/.config/matplay/config.json
Windows: use the proper user config directory
```

Config shape:

```ts
type AppConfig = {
  musicRoot: string;
  theme: "dark" | "light";
  accentColor: string;
  volume: number;
  lastPlaylist?: string;
  lastTrackId?: string;
};
```

## Library Model

Create a scanner module that reads the folder structure and builds this model:

```ts
type Track = {
  id: string;
  title: string;
  artist: string;
  playlist: string;
  songFolder: string;
  audioPath: string;
  lyricsPath?: string;
  durationMs?: number;
};

type Playlist = {
  id: string;
  name: string;
  artists: Artist[];
  tracks: Track[];
};

type Artist = {
  id: string;
  name: string;
  tracks: Track[];
};
```

Scanner behavior:

- Generate stable IDs from relative paths.
- Ignore hidden files and folders.
- Detect invalid folders and report them in diagnostics.
- If a song folder contains no audio file, show a warning.
- If a song folder contains multiple audio files, show a warning and use the first sorted audio file.
- If no lyrics file exists, show `No lyrics found`.
- Prefer `.lrc` over `.txt`.
- Keep the scanner pure and testable.
- The scanner must not import UI or playback code.

## UI Design

Build a responsive TUI layout.

Wide terminal layout:

- Left sidebar: playlists.
- Middle panel: artists and tracks.
- Right panel: lyrics and now playing.
- Bottom bar: playback controls, progress, volume, and status.

Small terminal layout:

- Use tabs/views:
  - Playlists
  - Tracks
  - Now Playing
  - Lyrics
  - Settings

Visual style:

- Material-inspired dark theme by default.
- Clean panels with subtle borders.
- Soft card-like grouping, but no noisy boxes everywhere.
- Accent color for active playlist, active track, and focused panel.
- Selected states must be obvious.
- Use progress bars for track progress and volume.
- Use compact status chips such as `PLAYING`, `PAUSED`, `MISSING LYRICS`, `SCANNING`.
- Avoid large ASCII art.
- Avoid cluttered rainbow terminal styling.

Suggested color direction:

```ts
const theme = {
  background: "#101014",
  surface: "#181820",
  surfaceAlt: "#20202A",
  text: "#F5F5F7",
  muted: "#9CA3AF",
  border: "#343444",
  accent: "#BB86FC",
  accent2: "#03DAC6",
  warning: "#F59E0B",
  danger: "#EF4444",
};
```

## Keybindings

Global:

| Key | Action |
| --- | --- |
| `q` | Quit |
| `?` | Help |
| `/` | Search |
| `Tab` | Switch focus area |
| `Shift+Tab` | Previous focus area |
| `Enter` | Select/play |
| `Space` | Play/pause |
| `n` | Next track |
| `p` | Previous track |
| `r` | Rescan library |
| `s` | Settings |
| `l` | Lyrics view |
| `+` | Volume up |
| `-` | Volume down |
| `m` | Mute |
| Arrow keys | Move selection |
| `j/k` | Move selection |

## Playback

Playback requirements:

- Play selected track.
- Pause/resume.
- Stop on quit.
- Next/previous within the current playlist.
- Maintain queue based on playlist track order.
- Keep playback state separate from UI state.
- Playback engine must not import UI components.

Architecture requirement:

```ts
interface AudioBackend {
  load(track: Track): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getPosition(): Promise<number>;
  getDuration(): Promise<number | undefined>;
}
```

The first implementation can be `NodeAudioBackend`, but the rest of the app should only depend on `AudioBackend`.

## Lyrics

Lyrics requirements:

- Support plain `.txt`.
- Support `.lrc` timestamps.
- If `.lrc`, parse timestamps and highlight the current lyric based on playback time.
- If playback position is unavailable in the first version, show static lyrics and leave timed sync as a TODO.

Suggested lyrics model:

```ts
type LyricLine = {
  timeMs?: number;
  text: string;
};
```

## Search

Search requirements:

- Search by track title.
- Search by artist.
- Search by playlist.
- Search results should be playable.
- Show result type and path context.
- Keep search local and fast.

## Settings

Settings screen must allow:

- Change music root.
- Rescan library.
- Change theme.
- Change accent color.
- Reset config.
- Show app version.
- Show library diagnostics.

## Project Structure

Use this structure (actual implementation):

```txt
src/
  main.tsx            # renderer entry + shutdown hooks on signals
  app/
    App.tsx           # now-playing screen + overlays + transport
    config.ts         # zod config (load/save/defaults)
    shutdown.ts       # process cleanup registry
  ui/
    palette.ts        # ffmpeg sampling + theme fade
    stitchTheme.ts    # StitchTheme tokens
    visualizerEngine.ts
    components/       # AlbumArtwork, TrackMetadata, SeekBar,
                      # PlaybackControls, VolumeMeter, LyricsPanel,
                      # Visualizer, SettingsMenu, ShortcutsPanel,
                      # SearchOverlay, PlaylistOverlay, QueueOverlay
  library/            # scanner, search, types, diagnostics
  playback/           # AudioBackend, Mpg123Backend, FfplayBackend,
                      # SpectrumFeed (private fifo), cava client
  lyrics/             # lrc/txt parser
  platform/           # MPRIS presence, system integration
  utils/              # stable ids, path helpers
test/                 # vitest suite (30 tests)
stitch/               # Stitch design reference + sample art
installer/            # install.sh (linux/macOS), install.ps1 (windows)
```

## State Design

- Keep UI state separate from playback state.
- Use a reducer/store pattern.
- Playback engine should not import UI components.
- Scanner should not import UI or playback.
- Config should be read once at startup and updated through explicit settings actions.
- Library scan results should be cached in memory.

## MVP Milestones

1. Create TypeScript project with OpenTUI + React 19.
2. Implement first-run setup and config saving.
3. Implement folder scanner with diagnostics.
4. Implement main UI layout with fake playback state.
5. Implement real playback adapter.
6. Add lyrics detection and display.
7. Add search.
8. Add tests for scanner and lyrics parser.
9. Polish keyboard navigation and help modal.

## Quality Requirements

- Strong TypeScript types.
- No `any` unless genuinely unavoidable.
- Clean error messages.
- Graceful handling of missing folders/files.
- Do not crash on malformed library structure.
- Keep audio backend replaceable.
- Add tests for folder scanning edge cases.
- Add tests for lyrics parsing.
- Document expected folder structure in README.

## README Requirements

The README must include:

- What MatPlay does.
- Installation.
- Run command.
- Required folder structure.
- Example music library tree.
- Keybindings.
- Known limitations.
- Troubleshooting audio playback.

## Agent Build Prompt

Use this exact prompt with your coding agent:

```md
You are building MatPlay, a complete local-first TypeScript terminal music player.

Project goal:
Build a terminal-based music player that feels like a modern GUI app. It should run in the terminal, but visually feel like a clean Material UI desktop app: panels, soft borders, accent colors, selected states, search fields, command palette, progress bar, lyrics panel, playlist sidebar, and responsive layout.

Hard requirements:
- Language: TypeScript.
- Runtime: Node.js.
- UI: TUI, not browser GUI.
- Preferred UI framework: OpenTUI + React.
- Do not use MPD, Mopidy, or any external music server.
- Do not require a background daemon.
- The app must be self-contained from the user's perspective.
- It may use npm packages for terminal UI, filesystem scanning, config, audio decoding/playback, and metadata.
- Do not rely on Spotify, YouTube, or network APIs.
- Music is local only.

Important technical honesty:
Node.js cannot natively play MP3 files. Implement playback through one of these acceptable routes:
1. Preferred: local npm-based playback pipeline using audio decoding + PCM speaker output.
2. Fallback: clearly isolated audio adapter that can later be replaced.
3. Do not use MPD or a server process.

Music folder structure:
The app must expect this structure:

Main Music Folder/
  Playlist Folder/
    Artist Folder/
      Song Folder/
        song.mp3
        lyrics.lrc or lyrics.txt

Rules:
- The first-level folders under the main music folder are playlists.
- Inside each playlist are artist folders.
- Inside each artist are song folders.
- Inside each song folder there must be one audio file.
- Lyrics are optional but should be detected if present.
- Supported audio initially: `.mp3`.
- Prefer `.lrc` over `.txt`.
- Generate stable IDs from relative paths.
- Ignore hidden files and folders.

First-run setup:
When the app starts for the first time:
1. Check for config file at `~/.config/matplay/config.json` on Linux/macOS.
2. If no config exists, show a setup screen inside the TUI.
3. Ask the user to enter/select the main music folder.
4. Validate that the folder exists.
5. Scan the folder.
6. Show warnings if structure is invalid.
7. Save config.
8. Open the main player screen.

UI:
- Wide layout: playlist sidebar, track list, lyrics/now-playing panel, bottom player bar.
- Small layout: tabs for Playlists, Tracks, Now Playing, Lyrics, Settings.
- Dark Material-inspired theme.
- Clear focus states.
- Search overlay.
- Help modal.
- Settings screen.

Keybindings:
- `q`: quit
- `?`: help
- `/`: search
- `Tab`: switch focus
- `Shift+Tab`: previous focus
- `Enter`: select/play
- `Space`: play/pause
- `n`: next track
- `p`: previous track
- `r`: rescan library
- `s`: settings
- `l`: lyrics view
- `+`: volume up
- `-`: volume down
- `m`: mute
- Arrow keys / `j/k`: move selection

Architecture:
Use separate modules for app state, UI, library scanning, playback, lyrics, config, and utilities.

Do not build a toy demo. Build the real skeleton with working scanning, config, UI, and playback abstraction. If real audio playback is too risky in the first pass, build the backend interface and a clearly marked adapter implementation, but do not pollute the UI with backend details.
```

## Blunt Product Note

The strict folder structure is good for your own synced music collection, especially if you are downloading playlist folders with lyrics. But for normal users, it is too rigid. Build this as the MVP, but keep the scanner modular so later you can add a loose import mode without rewriting the whole app.

