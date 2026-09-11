import { useEffect, useMemo, useRef, useState } from 'react';
import { useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/react';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { KALYANI_COVER_THEME, type StitchTheme } from '../ui/stitchTheme.js';
import { lerpTheme, sampleCoverTheme } from '../ui/palette.js';
import { AlbumArtwork } from '../ui/components/AlbumArtwork.js';
import { TrackMetadata } from '../ui/components/TrackMetadata.js';
import { SeekBar } from '../ui/components/SeekBar.js';
import { PlaybackControls } from '../ui/components/PlaybackControls.js';
import { VolumeMeter } from '../ui/components/VolumeMeter.js';
import { SettingsMenu } from '../ui/components/SettingsMenu.js';
import { ShortcutsPanel } from '../ui/components/ShortcutsPanel.js';
import { SearchOverlay } from '../ui/components/SearchOverlay.js';
import { PlaylistOverlay } from '../ui/components/PlaylistOverlay.js';
import { QueueOverlay } from '../ui/components/QueueOverlay.js';
import { Visualizer } from '../ui/components/Visualizer.js';
import { stepViz, applySpectrum, type VizState } from '../ui/visualizerEngine.js';
import { CavaSpectrum } from '../playback/spectrum.js';
import { scanLibrarySync } from '../library/scanLibrary.js';
import { searchTracks } from '../library/search.js';
import { FfplayBackend } from '../playback/FfplayBackend.js';
import { loadTrackMeta, metaFromFolder, type TrackMeta } from '../playback/trackMeta.js';
import type { Track } from '../library/types.js';

const MUSIC_ROOT =
  process.env.MATPLAY_MUSIC_ROOT ?? path.join(os.homedir(), 'Music', 'Spotify');
const SEEK_WIDTH = 44;
const CONTENT_WIDTH = 28 + 3 + SEEK_WIDTH;
const RESTART_THRESHOLD_MS = 3000;
const VIZ_GAIN = 1.6;
const FADE_STEPS = 18;
const FADE_INTERVAL_MS = 55;

const FALLBACK_COVER = fileURLToPath(
  new URL('../../stitch/kalyani-cover.jpg', import.meta.url),
);

export function App(): React.ReactNode {
  const renderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const vizColumns = Math.max(16, Math.floor(width / 2));
  const vizRows = Math.max(8, height);

  const library = useMemo(() => scanLibrarySync(MUSIC_ROOT), []);
  const allTracks = useMemo(
    () => library.playlists.flatMap((playlist) => playlist.tracks),
    [library],
  );
  const [playlistFilter, setPlaylistFilter] = useState<string | undefined>(undefined);
  const queue = useMemo(() => {
    if (!playlistFilter) return allTracks;
    return library.playlists.find((playlist) => playlist.name === playlistFilter)?.tracks ?? [];
  }, [library, allTracks, playlistFilter]);

  const [queueIndex, setQueueIndex] = useState(() => {
    const kalyani = allTracks.findIndex((track) => /kalyani/i.test(track.title));
    return kalyani >= 0 ? kalyani : 0;
  });
  const track: Track | undefined = queue[queueIndex];

  const [theme, setTheme] = useState<StitchTheme>(KALYANI_COVER_THEME);
  const [isPlaying, setIsPlaying] = useState(true);
  const [positionMs, setPositionMs] = useState(0);
  const [volume, setVolume] = useState(0.62);
  const [shuffle, setShuffle] = useState(false);
  const [loopList, setLoopList] = useState(true);
  const [loopSingle, setLoopSingle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseIndex, setBrowseIndex] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueSel, setQueueSel] = useState(0);
  const [meta, setMeta] = useState<TrackMeta>(() =>
    track ? metaFromFolder(track, FALLBACK_COVER) : {
      title: 'No tracks found',
      artist: '—',
      formatLabel: '—',
      streamLabel: 'DIRECT STREAM',
      durationMs: undefined,
      coverSrc: FALLBACK_COVER,
    },
  );
  const [viz, setViz] = useState<VizState>(() => ({
    levels: Array.from({ length: vizColumns }, () => 0.05),
    peaks: Array.from({ length: vizColumns }, () => 0.05),
  }));

  const results = useMemo(() => searchTracks(allTracks, query), [allTracks, query]);

  const themeRef = useRef(theme);
  themeRef.current = theme;
  const fadeTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const paletteCache = useRef(new Map<string, StitchTheme>());

  const fadeTo = (target: StitchTheme): void => {
    const from = themeRef.current;
    if (fadeTimer.current) clearInterval(fadeTimer.current);
    let step = 0;
    fadeTimer.current = setInterval(() => {
      step += 1;
      setTheme(lerpTheme(from, target, step / FADE_STEPS));
      if (step >= FADE_STEPS && fadeTimer.current) {
        clearInterval(fadeTimer.current);
        fadeTimer.current = undefined;
      }
    }, FADE_INTERVAL_MS);
  };

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

  // Load tags/cover/audio/palette whenever the queue position changes.
  useEffect(() => {
    if (!track) return undefined;
    let cancelled = false;
    setMeta(metaFromFolder(track, FALLBACK_COVER));
    void (async () => {
      const enriched = await loadTrackMeta(track, FALLBACK_COVER);
      if (cancelled) return;
      setMeta(enriched);
      const cached = paletteCache.current.get(enriched.coverSrc);
      if (cached) {
        fadeTo(cached);
      } else {
        const sampled = await sampleCoverTheme(enriched.coverSrc, themeRef.current);
        if (cancelled) return;
        paletteCache.current.set(enriched.coverSrc, sampled);
        fadeTo(sampled);
      }
      const player = backend();
      await player.load(track);
      if (isPlayingRef.current) {
        await player.play();
      }
    })();
    return () => {
      cancelled = true;
      if (fadeTimer.current) {
        clearInterval(fadeTimer.current);
        fadeTimer.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueIndex, queue]);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    if (!track) return;
    if (isPlaying) {
      void backend().play();
    } else {
      void backend().pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  useEffect(() => {
    void backend().setVolume(volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  useEffect(() => {
    const player = backend();
    return () => {
      void player.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [isPlaying, track, queueIndex, queue]);

  const metaRef = useRef(meta);
  metaRef.current = meta;

  // Live spectrum (falls back to procedural when cava is quiet/absent).
  useEffect(() => {
    const spectrum = new CavaSpectrum({ bars: 48, framerate: 30 });
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

  const latestSpectrum = useRef<number[] | undefined>(undefined);
  const lastLiveAt = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const raw = latestSpectrum.current;
      if (raw && Date.now() - lastLiveAt.current < 600) {
        const boosted = raw.map((value) => Math.min(1, value * VIZ_GAIN));
        setViz((previous) => applySpectrum(previous, boosted, vizColumns));
      } else {
        setViz((previous) => stepViz(previous, vizColumns, Date.now() / 1000, isPlaying));
      }
    }, 66);
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

  const playSearchResult = (selected: Track): void => {
    const index = allTracks.findIndex((item) => item.id === selected.id);
    setPlaylistFilter(undefined);
    if (index >= 0) {
      setQueueIndex(index);
      setPositionMs(0);
    }
    setSearchOpen(false);
    setQuery('');
    setSearchIndex(0);
  };

  const choosePlaylist = (name: string | undefined): void => {
    setPlaylistFilter(name);
    setQueueIndex(0);
    setPositionMs(0);
    setBrowseOpen(false);
    setBrowseIndex(0);
  };

  const openQueue = (): void => {
    setQueueSel(queueIndex);
    setQueueOpen(true);
  };

  useKeyboard((key) => {
    const pressed = new Set([key.name, key.sequence]);
    const has = (...options: string[]): boolean =>
      options.some((option) => pressed.has(option));

    // Text input owns every key except navigation while searching.
    if (searchOpen) {
      if (has('escape')) {
        setSearchOpen(false);
        setQuery('');
        setSearchIndex(0);
      } else if (has('return')) {
        const selected = results[searchIndex];
        if (selected) playSearchResult(selected);
      } else if (has('up')) {
        setSearchIndex((index) => Math.max(0, index - 1));
      } else if (has('down')) {
        setSearchIndex((index) => Math.min(results.length - 1, index + 1));
      }
      return;
    }

    const browseRows = library.playlists.length + 1;
    if (browseOpen) {
      if (has('escape')) {
        setBrowseOpen(false);
      } else if (has('return')) {
        const row = browseIndex - 1;
        choosePlaylist(row < 0 ? undefined : library.playlists[row]?.name);
      } else if (has('up')) {
        setBrowseIndex((index) => Math.max(0, index - 1));
        return;
      } else if (has('down')) {
        setBrowseIndex((index) => Math.min(browseRows - 1, index + 1));
        return;
      }
    }

    if (queueOpen) {
      if (has('escape')) {
        setQueueOpen(false);
      } else if (has('return')) {
        goTo(queueSel);
        setQueueOpen(false);
      } else if (has('up')) {
        setQueueSel((index) => Math.max(0, index - 1));
        return;
      } else if (has('down')) {
        setQueueSel((index) => Math.min(queue.length - 1, index + 1));
        return;
      }
    }

    if (has('q') && !key.shift) {
      renderer.destroy();
    } else if (key.name === 'Q' || (key.name === 'q' && key.shift)) {
      if (queueOpen) {
        setQueueOpen(false);
      } else {
        openQueue();
      }
    } else if (has('escape')) {
      if (menuOpen || helpOpen || browseOpen || queueOpen) {
        setMenuOpen(false);
        setHelpOpen(false);
        setBrowseOpen(false);
        setQueueOpen(false);
      } else {
        renderer.destroy();
      }
    } else if (has('space', ' ')) {
      setIsPlaying((previous) => !previous);
    } else if (has('?')) {
      setHelpOpen((previous) => !previous);
    } else if (has('s')) {
      setMenuOpen((previous) => !previous);
    } else if (has('/')) {
      setSearchIndex(0);
      setSearchOpen(true);
    } else if (has('b')) {
      setBrowseIndex(0);
      setBrowseOpen((previous) => !previous);
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
      <box position="absolute" top={0} left={0} width={width} height={height}>
        <Visualizer levels={viz.levels} peaks={viz.peaks} rows={vizRows} theme={theme} />
      </box>

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
        <text fg={theme.muted}>{meta.streamLabel}</text>
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
          top={Math.max(0, Math.floor((height - 19) / 2))}
          left={Math.max(0, Math.floor((width - 40) / 2))}
        >
          <ShortcutsPanel theme={theme} />
        </box>
      ) : null}
      {searchOpen ? (
        <box
          position="absolute"
          top={Math.max(0, Math.floor((height - 18) / 2))}
          left={Math.max(0, Math.floor((width - 52) / 2))}
        >
          <SearchOverlay
            query={query}
            results={results}
            selectedIndex={searchIndex}
            theme={theme}
            onQuery={(value) => {
              setQuery(value);
              setSearchIndex(0);
            }}
          />
        </box>
      ) : null}
      {browseOpen ? (
        <box
          position="absolute"
          top={Math.max(0, Math.floor((height - 14) / 2))}
          left={Math.max(0, Math.floor((width - 44) / 2))}
        >
          <PlaylistOverlay
            playlists={library.playlists}
            totalTracks={allTracks.length}
            activePlaylist={playlistFilter}
            selectedIndex={browseIndex}
            theme={theme}
          />
        </box>
      ) : null}
      {queueOpen ? (
        <box
          position="absolute"
          top={Math.max(0, Math.floor((height - 18) / 2))}
          left={Math.max(0, Math.floor((width - 52) / 2))}
        >
          <QueueOverlay
            queue={queue}
            queueIndex={queueIndex}
            selectedIndex={queueSel}
            playlistName={playlistFilter ?? 'all'}
            theme={theme}
          />
        </box>
      ) : null}
    </box>
  );
}
