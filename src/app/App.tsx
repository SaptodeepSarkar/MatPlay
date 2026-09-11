import { useEffect, useMemo, useRef, useState } from 'react';
import { useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/react';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { KALYANI_COVER_THEME } from '../ui/stitchTheme.js';
import { AlbumArtwork } from '../ui/components/AlbumArtwork.js';
import { TrackMetadata } from '../ui/components/TrackMetadata.js';
import { SeekBar } from '../ui/components/SeekBar.js';
import { PlaybackControls } from '../ui/components/PlaybackControls.js';
import { VolumeMeter } from '../ui/components/VolumeMeter.js';
import { SettingsMenu } from '../ui/components/SettingsMenu.js';
import { ShortcutsPanel } from '../ui/components/ShortcutsPanel.js';
import { Visualizer } from '../ui/components/Visualizer.js';
import { stepViz, applySpectrum, type VizState } from '../ui/visualizerEngine.js';
import { CavaSpectrum } from '../playback/spectrum.js';
import { scanLibrarySync } from '../library/scanLibrary.js';
import { FfplayBackend } from '../playback/FfplayBackend.js';
import { loadTrackMeta, metaFromFolder, type TrackMeta } from '../playback/trackMeta.js';

const MUSIC_ROOT =
  process.env.MATPLAY_MUSIC_ROOT ?? path.join(os.homedir(), 'Music', 'Spotify');
const SEEK_WIDTH = 44;
const CONTENT_WIDTH = 28 + 3 + SEEK_WIDTH;
const VIZ_ROWS = 8;
const RESTART_THRESHOLD_MS = 3000;

const FALLBACK_COVER = fileURLToPath(
  new URL('../../stitch/kalyani-cover.jpg', import.meta.url),
);

export function App(): React.ReactNode {
  const theme = KALYANI_COVER_THEME;
  const renderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const vizColumns = Math.max(16, Math.floor((width - 4) / 2));

  const library = useMemo(() => scanLibrarySync(MUSIC_ROOT), []);
  const queue = useMemo(
    () => library.playlists.flatMap((playlist) => playlist.tracks),
    [library],
  );

  const [queueIndex, setQueueIndex] = useState(() => {
    const kalyani = queue.findIndex((track) => /kalyani/i.test(track.title));
    return kalyani >= 0 ? kalyani : 0;
  });
  const track = queue[queueIndex];

  const [isPlaying, setIsPlaying] = useState(true);
  const [positionMs, setPositionMs] = useState(0);
  const [volume, setVolume] = useState(0.62);
  const [shuffle, setShuffle] = useState(false);
  const [loopList, setLoopList] = useState(true);
  const [loopSingle, setLoopSingle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [meta, setMeta] = useState<TrackMeta>(() =>
    track ? metaFromFolder(track, FALLBACK_COVER) : {
      title: 'No tracks found',
      artist: '—',
      formatLabel: '—',
      durationMs: undefined,
      coverSrc: FALLBACK_COVER,
    },
  );
  const [viz, setViz] = useState<VizState>(() => ({
    levels: Array.from({ length: vizColumns }, () => 0.05),
    peaks: Array.from({ length: vizColumns }, () => 0.05),
  }));
  const latestSpectrum = useRef<number[] | undefined>(undefined);
  const lastLiveAt = useRef(0);

  const backendRef = useRef<FfplayBackend | undefined>(undefined);
  const backend = (): FfplayBackend => {
    if (!backendRef.current) {
      const instance = new FfplayBackend();
      instance.onEnded = () => {
        trackEndRef.current();
      };
      backendRef.current = instance;
    }
    return backendRef.current;
  };

  const goTo = (index: number): void => {
    if (queue.length === 0) return;
    setQueueIndex(((index % queue.length) + queue.length) % queue.length);
    setPositionMs(0);
  };
  const goToRef = useRef(goTo);
  goToRef.current = goTo;

  const handleTrackEnd = (): void => {
    if (!track) return;
    if (loopSingle) {
      setPositionMs(0);
      void backend().seek(0);
      return;
    }
    if (queueIndex < queue.length - 1) {
      goToRef.current(queueIndex + 1);
    } else if (loopList && queue.length > 0) {
      goToRef.current(0);
    } else {
      setIsPlaying(false);
    }
  };
  const trackEndRef = useRef(handleTrackEnd);
  trackEndRef.current = handleTrackEnd;

  // Load tags/cover/audio whenever the queue position changes.
  useEffect(() => {
    if (!track) return undefined;
    let cancelled = false;
    setMeta(metaFromFolder(track, FALLBACK_COVER));
    void (async () => {
      const enriched = await loadTrackMeta(track, FALLBACK_COVER);
      if (cancelled) return;
      setMeta(enriched);
      const player = backend();
      await player.load(track);
      if (isPlayingRef.current) {
        await player.play();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueIndex]);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Play/pause transport.
  useEffect(() => {
    if (!track) return;
    if (isPlaying) {
      void backend().play();
    } else {
      void backend().pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Keep ffplay volume in step with the UI meter.
  useEffect(() => {
    void backend().setVolume(volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  // Stop audio when the app unmounts.
  useEffect(() => {
    const player = backend();
    return () => {
      void player.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Position clock + natural track end.
  useEffect(() => {
    if (!isPlaying || !track) return undefined;
    const timer = setInterval(() => {
      setPositionMs((previous) => {
        const duration = metaRef.current.durationMs;
        const next = previous + 500;
        if (duration !== undefined && next >= duration) {
          trackEndRef.current();
          return 0;
        }
        return next;
      });
    }, 500);
    return () => {
      clearInterval(timer);
    };
  }, [isPlaying, track, queueIndex]);

  const metaRef = useRef(meta);
  metaRef.current = meta;

  // Live spectrum from cava (the actual audible output). Falls back to the
  // procedural engine when cava is unavailable or has not emitted yet.
  useEffect(() => {
    const spectrum = new CavaSpectrum({ bars: 48, framerate: 20 });
    const unsubscribe = spectrum.onLevels((levels) => {
      latestSpectrum.current = levels;
      lastLiveAt.current = Date.now();
    });
    spectrum.start();
    return () => {
      unsubscribe();
      spectrum.stop();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const raw = latestSpectrum.current;
      if (raw && Date.now() - lastLiveAt.current < 600) {
        setViz((previous) => applySpectrum(previous, raw, vizColumns));
      } else {
        setViz((previous) => stepViz(previous, vizColumns, Date.now() / 1000, isPlaying));
      }
    }, 120);
    return () => {
      clearInterval(timer);
    };
  }, [isPlaying, vizColumns]);

  const seekTo = (ms: number): void => {
    const clamped = Math.max(0, ms);
    setPositionMs(clamped);
    void backend().seek(clamped);
  };

  const next = (): void => {
    if (queueIndex < queue.length - 1) {
      goTo(queueIndex + 1);
    } else if (loopList) {
      goTo(0);
    } else {
      setPositionMs(meta.durationMs ?? 0);
      setIsPlaying(false);
    }
  };

  const previous = (): void => {
    if (positionMs > RESTART_THRESHOLD_MS) {
      seekTo(0);
    } else if (queueIndex > 0) {
      goTo(queueIndex - 1);
    } else if (loopList) {
      goTo(queue.length - 1);
    } else {
      seekTo(0);
    }
  };

  useKeyboard((key) => {
    // Match on both canonical name and raw sequence: terminals and
    // keyboard protocols report printable keys differently.
    const pressed = new Set([key.name, key.sequence]);
    const has = (...options: string[]): boolean =>
      options.some((option) => pressed.has(option));

    if (has('q')) {
      renderer.destroy();
    } else if (has('escape')) {
      if (menuOpen || helpOpen) {
        setMenuOpen(false);
        setHelpOpen(false);
      } else {
        renderer.destroy();
      }
    } else if (has('space', ' ')) {
      setIsPlaying((previous) => !previous);
    } else if (has('?')) {
      setHelpOpen((previous) => !previous);
    } else if (has('s')) {
      setMenuOpen((previous) => !previous);
    } else if (has('n')) {
      next();
    } else if (has('p')) {
      previous();
    } else if (has('left')) {
      seekTo(positionMsRef.current - 5000);
    } else if (has('right')) {
      seekTo(positionMsRef.current + 5000);
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

  const positionMsRef = useRef(positionMs);
  positionMsRef.current = positionMs;

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
            <AlbumArtwork src={meta.coverSrc} theme={theme} />
            <box flexDirection="column" gap={1} justifyContent="flex-start" paddingTop={1}>
              <TrackMetadata
                trackNo={queueIndex + 1}
                title={meta.title}
                artist={meta.artist}
                formatLabel={meta.formatLabel}
                theme={theme}
              />
              <SeekBar
                positionMs={positionMs}
                durationMs={meta.durationMs ?? 0}
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
            trackCount={queue.length}
            shuffle={shuffle}
            loopList={loopList}
            loopSingle={loopSingle}
            theme={theme}
          />
        </box>
      ) : null}
      {helpOpen ? (
        <box
          position="absolute"
          top={Math.max(0, Math.floor((height - 17) / 2))}
          left={Math.max(0, Math.floor((width - 40) / 2))}
        >
          <ShortcutsPanel theme={theme} />
        </box>
      ) : null}
    </box>
  );
}
