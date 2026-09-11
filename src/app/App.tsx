import { useEffect, useState } from 'react';
import { useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/react';
import { fileURLToPath } from 'node:url';
import { KALYANI_COVER_THEME } from '../ui/stitchTheme.js';
import { AlbumArtwork } from '../ui/components/AlbumArtwork.js';
import { TrackMetadata } from '../ui/components/TrackMetadata.js';
import { SeekBar } from '../ui/components/SeekBar.js';
import { PlaybackControls } from '../ui/components/PlaybackControls.js';
import { VolumeMeter } from '../ui/components/VolumeMeter.js';
import { SettingsMenu } from '../ui/components/SettingsMenu.js';
import { Visualizer } from '../ui/components/Visualizer.js';
import { stepViz, type VizState } from '../ui/visualizerEngine.js';

// Mock screen: the Stitch "Terminal Music Player" now-playing unit with a
// CAVA-style visualizer floor, driven by the real KALYANI track metadata.
const TRACK = {
  no: 1,
  title: 'Kalyani (with Shreya Ghoshal) [Remix]',
  artist: 'ARJN',
  formatLabel: 'MP3 · 128KBPS · 48KHZ',
  durationMs: 260_016,
} as const;

const SEEK_WIDTH = 44;
const CONTENT_WIDTH = 28 + 3 + SEEK_WIDTH;
const VIZ_ROWS = 8;

const COVER_SRC = fileURLToPath(
  new URL('../../stitch/kalyani-cover.jpg', import.meta.url),
);

export function App(): React.ReactNode {
  const theme = KALYANI_COVER_THEME;
  const renderer = useRenderer();
  const { width } = useTerminalDimensions();
  const vizColumns = Math.max(16, Math.floor((width - 4) / 2));

  const [isPlaying, setIsPlaying] = useState(true);
  const [positionMs, setPositionMs] = useState(100_100);
  const [volume, setVolume] = useState(0.62);
  const [shuffle, setShuffle] = useState(false);
  const [loopList, setLoopList] = useState(true);
  const [loopSingle, setLoopSingle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viz, setViz] = useState<VizState>(() => ({
    levels: Array.from({ length: vizColumns }, () => 0.05),
    peaks: Array.from({ length: vizColumns }, () => 0.05),
  }));

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = setInterval(() => {
      setPositionMs((previous) => Math.min(TRACK.durationMs, previous + 500));
    }, 500);
    return () => {
      clearInterval(timer);
    };
  }, [isPlaying]);

  useEffect(() => {
    const timer = setInterval(() => {
      setViz((previous) => stepViz(previous, vizColumns, Date.now() / 1000, isPlaying));
    }, 120);
    return () => {
      clearInterval(timer);
    };
  }, [isPlaying, vizColumns]);

  useKeyboard((key) => {
    // Match on both canonical name and raw sequence: terminals and
    // keyboard protocols report printable keys differently.
    const pressed = new Set([key.name, key.sequence]);
    const has = (...options: string[]): boolean =>
      options.some((option) => pressed.has(option));

    if (has('q', 'escape')) {
      renderer.destroy();
    } else if (has('space', ' ')) {
      setIsPlaying((previous) => !previous);
    } else if (has('s')) {
      setMenuOpen((previous) => !previous);
    } else if (has('left')) {
      setPositionMs((previous) => Math.max(0, previous - 5000));
    } else if (has('right')) {
      setPositionMs((previous) => Math.min(TRACK.durationMs, previous + 5000));
    } else if (has('+', '=', 'plus', 'equal')) {
      setVolume((previous) => Math.min(1, previous + 0.05));
    } else if (has('-', 'minus')) {
      setVolume((previous) => Math.max(0, previous - 0.05));
    } else if (has('m', 'mute')) {
      setVolume((previous) => (previous > 0 ? 0 : 0.62));
    } else if (has('1')) {
      setShuffle((previous) => !previous);
    } else if (has('2')) {
      setLoopList((previous) => !previous);
    } else if (has('3')) {
      setLoopSingle((previous) => !previous);
    }
  });

  return (
    <box width="100%" height="100%" backgroundColor={theme.appBg} flexDirection="column">
      <box flexDirection="row" alignItems="center" paddingX={2} paddingTop={1}>
        <box
          width={5}
          height={3}
          borderStyle="rounded"
          borderColor={theme.accent}
          justifyContent="center"
          alignItems="center"
        >
          <text fg={theme.accent}>
            <strong>⚙</strong>
          </text>
        </box>
        <box flexGrow={1} />
        <text fg={theme.muted}>PCM 48.0 KHZ • DIRECT STREAM</text>
      </box>

      <box flexGrow={1} justifyContent="center" alignItems="center">
        <box flexDirection="column" width={CONTENT_WIDTH} gap={1}>
          <box flexDirection="row" gap={3}>
            <AlbumArtwork src={COVER_SRC} theme={theme} />
            <box flexDirection="column" gap={1} justifyContent="flex-start" paddingTop={1}>
              <TrackMetadata
                trackNo={TRACK.no}
                title={TRACK.title}
                artist={TRACK.artist}
                formatLabel={TRACK.formatLabel}
                theme={theme}
              />
              <SeekBar
                positionMs={positionMs}
                durationMs={TRACK.durationMs}
                widthChars={SEEK_WIDTH}
                theme={theme}
              />
            </box>
          </box>
          <text fg={theme.muted}>{'─'.repeat(CONTENT_WIDTH)}</text>
          <box flexDirection="row" alignItems="center">
            <PlaybackControls
              isPlaying={isPlaying}
              shuffle={shuffle}
              loopList={loopList}
              loopSingle={loopSingle}
              theme={theme}
            />
            <box flexGrow={1} />
            <VolumeMeter volume={volume} theme={theme} />
          </box>
        </box>
      </box>

      <box height={VIZ_ROWS} justifyContent="center" alignItems="center">
        <Visualizer levels={viz.levels} peaks={viz.peaks} rows={VIZ_ROWS} theme={theme} />
      </box>

      {menuOpen ? (
        <box position="absolute" top={4} left={2}>
          <SettingsMenu
            musicDir="~/Music/Spotify/"
            trackCount={61}
            shuffle={shuffle}
            loopList={loopList}
            loopSingle={loopSingle}
            theme={theme}
          />
        </box>
      ) : null}
    </box>
  );
}
