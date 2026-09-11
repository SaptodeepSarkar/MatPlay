import { useEffect, useState } from 'react';
import { useKeyboard, useRenderer } from '@opentui/react';
import { fileURLToPath } from 'node:url';
import { KALYANI_COVER_THEME } from '../ui/stitchTheme.js';
import { AlbumArtwork } from '../ui/components/AlbumArtwork.js';
import { TrackMetadata } from '../ui/components/TrackMetadata.js';
import { SeekBar } from '../ui/components/SeekBar.js';
import { PlaybackControls } from '../ui/components/PlaybackControls.js';
import { VolumeMeter } from '../ui/components/VolumeMeter.js';

// Mock screen: the Stitch "Terminal Music Player" now-playing unit,
// driven by the real KALYANI track metadata. No header, no footer.
const TRACK = {
  no: 1,
  title: 'Kalyani (with Shreya Ghoshal) [Remix]',
  artist: 'ARJN',
  playlist: 'Work',
  formatLabel: 'MP3 · 128KBPS · 48KHZ',
  lyricCurrent: 'കരിമിഴിയുള്ള കളവാണി (हाँ)',
  lyricNext: 'കാർ-കൂന്തല് കണ്ടപ്പൊ',
  durationMs: 260_016,
} as const;

const COVER_SRC = fileURLToPath(
  new URL('../../stitch/kalyani-cover.jpg', import.meta.url),
);

export function App(): React.ReactNode {
  const theme = KALYANI_COVER_THEME;
  const renderer = useRenderer();
  const [isPlaying, setIsPlaying] = useState(true);
  const [positionMs, setPositionMs] = useState(100_100);
  const [volume, setVolume] = useState(0.62);
  const [shuffle, setShuffle] = useState(false);
  const [loopList, setLoopList] = useState(true);
  const [loopSingle, setLoopSingle] = useState(false);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = setInterval(() => {
      setPositionMs((previous) => Math.min(TRACK.durationMs, previous + 500));
    }, 500);
    return () => {
      clearInterval(timer);
    };
  }, [isPlaying]);

  useKeyboard((key) => {
    if (key.name === 'q' || key.name === 'escape') {
      renderer.destroy();
    } else if (key.name === 'space') {
      setIsPlaying((previous) => !previous);
    } else if (key.name === 'right') {
      setPositionMs((previous) => Math.min(TRACK.durationMs, previous + 5000));
    } else if (key.name === 'left') {
      setPositionMs((previous) => Math.max(0, previous - 5000));
    } else if (key.sequence === '+') {
      setVolume((previous) => Math.min(1, previous + 0.05));
    } else if (key.sequence === '-') {
      setVolume((previous) => Math.max(0, previous - 0.05));
    } else if (key.name === 'm') {
      setVolume((previous) => (previous > 0 ? 0 : 0.62));
    } else if (key.sequence === '1') {
      setShuffle((previous) => !previous);
    } else if (key.sequence === '2') {
      setLoopList((previous) => !previous);
    } else if (key.sequence === '3') {
      setLoopSingle((previous) => !previous);
    }
  });

  return (
    <box
      width="100%"
      height="100%"
      backgroundColor={theme.appBg}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <box
        borderStyle="rounded"
        borderColor={theme.muted}
        backgroundColor={theme.card}
        padding={2}
        flexDirection="column"
        gap={1}
      >
        <box flexDirection="row" gap={3}>
          <AlbumArtwork src={COVER_SRC} theme={theme} />
          <box flexDirection="column" gap={1} justifyContent="center">
            <TrackMetadata
              trackNo={TRACK.no}
              title={TRACK.title}
              artist={TRACK.artist}
              formatLabel={TRACK.formatLabel}
              playlist={TRACK.playlist}
              lyricCurrent={TRACK.lyricCurrent}
              lyricNext={TRACK.lyricNext}
              theme={theme}
            />
            <SeekBar
              positionMs={positionMs}
              durationMs={TRACK.durationMs}
              widthChars={44}
              theme={theme}
            />
          </box>
        </box>
        <PlaybackControls
          isPlaying={isPlaying}
          shuffle={shuffle}
          loopList={loopList}
          loopSingle={loopSingle}
          theme={theme}
        />
        <VolumeMeter volume={volume} theme={theme} />
      </box>
    </box>
  );
}
