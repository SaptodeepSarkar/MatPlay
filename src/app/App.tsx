import { useEffect, useMemo, useRef, useState } from 'react';
import { useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/react';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { KALYANI_COVER_THEME, stitchFallbackTheme, type StitchTheme } from '../ui/stitchTheme.js';
import { sampleCoverTheme } from '../ui/palette.js';
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
import { LyricsPanel } from '../ui/components/LyricsPanel.js';
import { Visualizer } from '../ui/components/Visualizer.js';
import { stepViz, applySpectrum, type VizState } from '../ui/visualizerEngine.js';
import { CavaSpectrum } from '../playback/spectrum.js';
import { SpectrumFeed, spectrumFifoPath } from '../playback/spectrumFeed.js';
import { scanLibrarySync } from '../library/scanLibrary.js';
import { searchTracks } from '../library/search.js';
import { buildPlayOrder, stepIndex } from '../playback/queue.js';
import { execFileSync } from 'node:child_process';
import { watch } from 'chokidar';
import type { AudioBackend } from '../playback/AudioBackend.js';
import { FfplayBackend } from '../playback/FfplayBackend.js';
import { Mpg123Backend } from '../playback/Mpg123Backend.js';
import { loadTrackMeta, metaFromFolder, type TrackMeta } from '../playback/trackMeta.js';
import { MediaPresence } from '../platform/presence.js';
import { onShutdown, runShutdown } from './shutdown.js';
import { configExists, defaultConfig, loadConfig, saveConfig, type AppConfig } from './config.js';
import { SetupScreen } from '../ui/components/SetupScreen.js';
import { DiagnosticsPanel } from '../ui/components/DiagnosticsPanel.js';
import { SettingsButton } from '../ui/components/SettingsButton.js';
import { resetTerminalBackground, syncTerminalBackground } from '../ui/terminalBackground.js';
import { parseLyrics } from '../lyrics/parseLyrics.js';
import type { LyricLine } from '../library/types.js';
import type { Track } from '../library/types.js';

const WIDE_CONTENT_WIDTH = 75;
const RESTART_THRESHOLD_MS = 3000;
function preferredTheme(target: StitchTheme, config: AppConfig): StitchTheme {
  const base = config.theme === 'light' ? stitchFallbackTheme : target;
  return config.accentColor === 'auto' ? base : { ...base, accent: config.accentColor };
}

const FALLBACK_COVER = fileURLToPath(
  new URL('../../stitch/kalyani-cover.jpg', import.meta.url),
);

type PlayerBackend = AudioBackend & {
  onEnded: (() => void) | undefined;
  onError: ((message: string) => void) | undefined;
};

let preferMpg123: boolean | undefined;
/** mpg123 remote control (gapless) when present, ffplay otherwise. */
function detectBackend(): 'mpg123' | 'ffplay' {
  if (preferMpg123 === undefined) {
    try {
      execFileSync('mpg123', ['--version'], { stdio: 'ignore' });
      preferMpg123 = true;
    } catch {
      preferMpg123 = false;
    }
  }
  return preferMpg123 ? 'mpg123' : 'ffplay';
}

export function App(): React.ReactNode {
  const renderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const vizColumns = Math.max(16, Math.floor(width / 2));
  const vizRows = Math.max(8, height);
  const compact = width < 82;
  const tiny = width < 52 || height < 22;
  const contentWidth = Math.max(28, Math.min(WIDE_CONTENT_WIDTH, width - 4));
  const seekWidth = compact ? Math.max(24, contentWidth - 2) : 44;

  const [config, setConfig] = useState<AppConfig>(() => loadConfig());
  const [setupOpen, setSetupOpen] = useState(() => {
    if (process.env.MATPLAY_MUSIC_ROOT) return false;
    return !configExists() || scanLibrarySync(config.musicRoot).diagnostics.some((item) => item.level === 'error');
  });
  const [setupPath, setSetupPath] = useState(config.musicRoot);
  const [setupDiagnostics, setSetupDiagnostics] = useState<ReturnType<typeof scanLibrarySync>['diagnostics']>([]);
  const configRef = useRef(config);
  const saveTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const saveSoon = (): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveConfig(configRef.current);
    }, 800);
  };
  const updateConfig = (patch: Partial<AppConfig>): void => {
    setConfig((previous) => {
      const next = { ...previous, ...patch };
      configRef.current = next;
      return next;
    });
    saveSoon();
  };

  const musicRoot = process.env.MATPLAY_MUSIC_ROOT ?? config.musicRoot;
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [libraryNotice, setLibraryNotice] = useState<string | undefined>();
  const library = useMemo(() => scanLibrarySync(musicRoot), [musicRoot, libraryRevision]);
  const allTracks = useMemo(
    () => library.playlists.flatMap((playlist) => playlist.tracks),
    [library],
  );
  useEffect(() => {
    if (!libraryNotice) return undefined;
    const timer = setTimeout(() => setLibraryNotice(undefined), 2000);
    return () => clearTimeout(timer);
  }, [libraryNotice]);
  useEffect(() => {
    if (process.env.MATPLAY_DISABLE_WATCHER === '1') return undefined;
    let timer: NodeJS.Timeout | undefined;
    const watcher = watch(musicRoot, { ignoreInitial: true, depth: 3 });
    const refresh = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setLibraryRevision((revision) => revision + 1);
        setLibraryNotice('LIBRARY UPDATED');
      }, 250);
    };
    watcher.on('add', refresh).on('unlink', refresh).on('addDir', refresh).on('unlinkDir', refresh);
    return () => {
      if (timer) clearTimeout(timer);
      void watcher.close();
    };
  }, [musicRoot]);
  const [playlistFilter, setPlaylistFilter] = useState<string | undefined>(() => {
    if (process.env.MATPLAY_MUSIC_ROOT) return undefined;
    const saved = loadConfig().lastPlaylist;
    if (saved && library.playlists.some((playlist) => playlist.name === saved)) {
      return saved;
    }
    return undefined;
  });
  const queue = useMemo(() => {
    if (!playlistFilter) return allTracks;
    return library.playlists.find((playlist) => playlist.name === playlistFilter)?.tracks ?? [];
  }, [library, allTracks, playlistFilter]);

  const [queueIndex, setQueueIndex] = useState(() => {
    if (process.env.MATPLAY_MUSIC_ROOT) {
      const kalyani = queue.findIndex((track) => /kalyani/i.test(track.title));
      return kalyani >= 0 ? kalyani : 0;
    }
    const savedId = loadConfig().lastTrackId;
    if (savedId) {
      const index = queue.findIndex((track) => track.id === savedId);
      if (index >= 0) return index;
    }
    const kalyani = queue.findIndex((track) => /kalyani/i.test(track.title));
    return kalyani >= 0 ? kalyani : 0;
  });
  const track: Track | undefined = queue[queueIndex];
  const trackRef = useRef(track);
  trackRef.current = track;
  const queueIndexRef = useRef(queueIndex);
  queueIndexRef.current = queueIndex;

  const [theme, setTheme] = useState<StitchTheme>(() => {
    return preferredTheme(KALYANI_COVER_THEME, config);
  });
  // Resume paused on the last played song; never autoplay on startup.
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | undefined>();
  const [positionMs, setPositionMs] = useState(0);
  const [volume, setVolume] = useState(config.volume);
  const lastAudibleVolume = useRef(config.volume > 0 ? config.volume : 0.62);
  const [shuffle, setShuffle] = useState(false);
  const [loopList, setLoopList] = useState(true);
  const [loopSingle, setLoopSingle] = useState(false);

  // Stable play order: sequential, or shuffled with the current track
  // pinned first. Regenerated only when the queue or shuffle mode changes,
  // never while advancing — so the upcoming track is always known ahead.
  const [orderKey, setOrderKey] = useState(0);
  useEffect(() => {
    setOrderKey((key) => key + 1);
  }, [queue, shuffle]);
  const order = useMemo(
    () => buildPlayOrder(queue.length, queueIndexRef.current, shuffle),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue.length, shuffle, orderKey],
  );
  const orderRef = useRef(order);
  orderRef.current = order;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseIndex, setBrowseIndex] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueSel, setQueueSel] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsVisible, setLyricsVisible] = useState(true);
  const [lyricsOffset, setLyricsOffset] = useState(0);
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
  useEffect(() => {
    syncTerminalBackground(theme.appBg);
  }, [theme.appBg]);
  useEffect(() => {
    const unregister = onShutdown(resetTerminalBackground);
    return () => {
      unregister();
      resetTerminalBackground();
    };
  }, []);
  const paletteCache = useRef(new Map<string, StitchTheme>());
  const metaCache = useRef(new Map<string, TrackMeta>());
  const lyricsCache = useRef(new Map<string, LyricLine[]>());

  const applyTheme = (target: StitchTheme): void => {
    const preferred = preferredTheme(target, configRef.current);
    const unchanged = Object.keys(preferred).every((key) =>
      preferred[key as keyof StitchTheme] === themeRef.current[key as keyof StitchTheme],
    );
    if (unchanged) return;
    // OSC 11 changes repaint the whole terminal. Apply the completed palette
    // atomically so cover switches cannot flash through intermediate colors.
    themeRef.current = preferred;
    setTheme(preferred);
  };

  const backendRef = useRef<PlayerBackend | undefined>(undefined);
  const audioLoadRef = useRef<Promise<void>>(Promise.resolve());
  const trackLoadGeneration = useRef(0);
  const backend = (): PlayerBackend => {
    if (!backendRef.current) {
      const instance: PlayerBackend =
        detectBackend() === 'mpg123' ? new Mpg123Backend() : new FfplayBackend();
      instance.onEnded = () => {
        trackEndRef.current();
      };
      instance.onError = (message) => {
        setAudioError(message);
        setIsPlaying(false);
      };
      backendRef.current = instance;
    }
    return backendRef.current;
  };

  const feedRef = useRef<SpectrumFeed | undefined>(undefined);
  const feed = (): SpectrumFeed => {
    if (!feedRef.current) feedRef.current = new SpectrumFeed();
    return feedRef.current;
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
      seekTo(0);
      return;
    }
    const target = stepIndex(orderRef.current, queueIndex, 1, loopList);
    if (target === undefined) {
      setIsPlaying(false);
    } else {
      goToRef.current(target);
    }
  };
  const trackEndRef = useRef(handleTrackEnd);
  trackEndRef.current = handleTrackEnd;

  // Load tags/cover/audio/palette/lyrics whenever the queue position
  // changes. The current track stays on screen until the next one is
  // ready — cached switches apply instantly with no fallback flash.
  useEffect(() => {
    if (!track) return undefined;
    setLyricsOffset(0);
    let cancelled = false;
    const generation = ++trackLoadGeneration.current;
    if (!process.env.MATPLAY_MUSIC_ROOT) {
      updateConfig({ lastTrackId: track.id, lastPlaylist: track.playlist });
    }
    const cachedMeta = metaCache.current.get(track.id);
    const cachedLyrics = lyricsCache.current.get(track.id);
    if (cachedMeta) {
      setMeta(cachedMeta);
      presenceRef.current?.updateTrack(track, cachedMeta);
      const cachedPalette = paletteCache.current.get(cachedMeta.coverSrc);
      if (cachedPalette) applyTheme(cachedPalette);
      if (cachedLyrics) setLyrics(cachedLyrics);
    }

    // Decoder loads are serialized because both backends own one process.
    // The generation check gives rapid next/previous input latest-wins
    // semantics and prevents a slow older load from resuming the wrong song.
    const queuedLoad = audioLoadRef.current.catch(() => undefined).then(async () => {
      if (cancelled || generation !== trackLoadGeneration.current) return;
      const player = backend();
      await player.load(track);
      if (cancelled || generation !== trackLoadGeneration.current) return;
      if (isPlayingRef.current) {
        await player.play();
        if (!cancelled && generation === trackLoadGeneration.current) {
          feed().start(track.audioPath, 0);
        }
      }
    });
    audioLoadRef.current = queuedLoad.catch((error: unknown) => {
      if (!cancelled && generation === trackLoadGeneration.current) {
        setAudioError(error instanceof Error ? error.message : String(error));
        setIsPlaying(false);
      }
    });

    void (async () => {
      const enriched = cachedMeta ?? await loadTrackMeta(track, FALLBACK_COVER);
      if (cancelled) return;
      metaCache.current.set(track.id, enriched);
      setMeta(enriched);
      presenceRef.current?.updateTrack(track, enriched);
      presenceRef.current?.updatePlaybackStatus(isPlayingRef.current, true);
      const cached = paletteCache.current.get(enriched.coverSrc);
      if (cached) {
        applyTheme(cached);
      } else {
        const sampled = await sampleCoverTheme(enriched.coverSrc, themeRef.current);
        if (cancelled) return;
        paletteCache.current.set(enriched.coverSrc, sampled);
        applyTheme(sampled);
      }
      let lines = lyricsCache.current.get(track.id);
      if (!lines && track.lyricsPath) {
        try {
          const content = await readFile(track.lyricsPath, 'utf8');
          lines = parseLyrics(content);
          lyricsCache.current.set(track.id, lines);
        } catch {
          lines = [];
        }
      }
      if (cancelled) return;
      setLyrics(lines ?? []);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueIndex, queue]);

  // Lookahead: enrich the upcoming track while the current one plays, so
  // switching only waits on the audio LOAD, never on tags/art/palette.
  useEffect(() => {
    const upcoming = stepIndex(order, queueIndex, 1, loopList);
    if (upcoming === undefined) return undefined;
    const target = queue[upcoming];
    if (!target || metaCache.current.has(target.id)) return undefined;
    let cancelled = false;
    void (async () => {
      const enriched = await loadTrackMeta(target, FALLBACK_COVER);
      if (cancelled) return;
      metaCache.current.set(target.id, enriched);
      const sampled = await sampleCoverTheme(enriched.coverSrc, themeRef.current);
      if (cancelled) return;
      paletteCache.current.set(enriched.coverSrc, sampled);
      if (target.lyricsPath) {
        try {
          const content = await readFile(target.lyricsPath, 'utf8');
          if (!cancelled) lyricsCache.current.set(target.id, parseLyrics(content));
        } catch {
          // No lyrics; nothing to cache.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueIndex, queue, shuffle, order, loopList]);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Play/pause transport, with the private spectrum feed mirrored.
  useEffect(() => {
    if (!track) return;
    const current = trackRef.current;
    if (isPlaying) {
      setAudioError(undefined);
      void backend().play();
      if (current) feed().start(current.audioPath, positionMsRef.current / 1000);
    } else {
      void backend().pause();
      feed().stop();
    }
    presenceRef.current?.updatePlaybackStatus(isPlaying, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  useEffect(() => {
    if (volume > 0) lastAudibleVolume.current = volume;
    void backend().setVolume(volume);
    updateConfig({ volume });
    presenceRef.current?.updateFlags(volume, shuffle, loopSingle, loopList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, shuffle, loopList, loopSingle]);

  // Stop everything when the app unmounts.
  useEffect(() => {
    const player = backend();
    const spectrum = spectrumRef.current;
    const feeder = feedRef.current;
    void SpectrumFeed.ensureFifo();
    return () => {
      void player.destroy();
      spectrum?.stop();
      feeder?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Position clock from the decoder itself (gapless backends report live
  // values; timer adapters estimate). Natural track end advances.
  useEffect(() => {
    if (!isPlaying || !track) return undefined;
    const timer = setInterval(() => {
      void (async () => {
        const player = backend();
        const position = await player.getPosition();
        const duration = (await player.getDuration()) ?? metaRef.current.durationMs;
        if (duration !== undefined && position >= duration) {
          trackEndRef.current();
          setPositionMs(0);
        } else {
          setPositionMs(position);
        }
      })();
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [isPlaying, track, queueIndex, queue]);

  const metaRef = useRef(meta);
  metaRef.current = meta;

  // Private spectrum feed: cava decodes only our track via FIFO, so desktop
  // audio never reaches the bars. Falls back to procedural when unavailable.
  const spectrumRef = useRef<CavaSpectrum | undefined>(undefined);
  useEffect(() => {
    if (!SpectrumFeed.ensureFifo()) return undefined;
    const spectrum = new CavaSpectrum({
      bars: 48,
      framerate: 30,
      inputMethod: 'fifo',
      fifoPath: spectrumFifoPath(),
    });
    spectrumRef.current = spectrum;
    const unsubscribe = spectrum.onLevels((levels) => {
      latestSpectrum.current = levels;
      lastLiveAt.current = Date.now();
    });
    spectrum.start();
    return () => {
      unsubscribe();
      spectrum.stop();
      spectrumRef.current = undefined;
    };
  }, []);

  const latestSpectrum = useRef<number[] | undefined>(undefined);
  const lastLiveAt = useRef(0);
  const stallSince = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timer = setInterval(() => {
      const raw = latestSpectrum.current;
      const fresh = raw && Date.now() - lastLiveAt.current < 600;
      if (fresh && raw) {
        stallSince.current = undefined;
        const boosted = raw.map((value) => Math.min(1, value * configRef.current.vizGain));
        setViz((previous) => applySpectrum(previous, boosted, vizColumns));
      } else {
        // Watchdog: a quiet feed while playing means the decoder stalled —
        // re-prime it at the current position instead of flatlining.
        if (isPlayingRef.current) {
          if (stallSince.current === undefined) {
            stallSince.current = Date.now();
          } else if (Date.now() - stallSince.current > 2500) {
            const current = trackRef.current;
            if (current) feed().start(current.audioPath, positionMsRef.current / 1000);
            stallSince.current = Date.now();
          }
        }
        setViz((previous) => stepViz(previous, vizColumns, Date.now() / 1000, isPlaying));
      }
    }, 66);
    return () => {
      clearInterval(timer);
    };
  }, [isPlaying, vizColumns]);

  const seekTo = (ms: number): void => {
    const duration = metaRef.current.durationMs;
    const clamped = Math.min(duration ?? Number.POSITIVE_INFINITY, Math.max(0, ms));
    setPositionMs(clamped);
    presenceRef.current?.reportSeek(clamped);
    const current = trackRef.current;
    void (async () => {
      await backend().seek(clamped);
      // Resurrect-after-seek: a spent decoder reloads paused, so resume
      // here when the UI transport is playing.
      if (isPlayingRef.current) {
        await backend().play();
      }
    })();
    if (current && isPlayingRef.current) {
      feed().start(current.audioPath, clamped / 1000);
    }
  };
  const seekToRef = useRef(seekTo);
  seekToRef.current = seekTo;

  const next = (): void => {
    const target = stepIndex(order, queueIndex, 1, loopList);
    if (target === undefined) {
      setPositionMs(meta.durationMs ?? 0);
      setIsPlaying(false);
    } else {
      goTo(target);
    }
  };

  const previous = (): void => {
    if (positionMs > RESTART_THRESHOLD_MS) {
      seekTo(0);
      return;
    }
    const target = stepIndex(order, queueIndex, -1, loopList);
    if (target === undefined) {
      seekTo(0);
    } else {
      goTo(target);
    }
  };
  const nextRef = useRef(next);
  nextRef.current = next;
  const prevRef = useRef(previous);
  prevRef.current = previous;

  // OS media presence: expose track + transport both ways.
  const presenceRef = useRef<MediaPresence | undefined>(undefined);
  useEffect(() => {
    const presence = new MediaPresence({
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
      toggle: () => setIsPlaying((previous) => !previous),
      next: () => nextRef.current(),
      previous: () => prevRef.current(),
      stop: () => setIsPlaying(false),
      seekTo: (ms) => seekToRef.current(ms),
      getPositionMs: () => positionMsRef.current,
    });
    presenceRef.current = presence;
    return () => {
      presenceRef.current = undefined;
    };
  }, []);

  const playSearchResult = (selected: Track): void => {
    const index = allTracks.findIndex((item) => item.id === selected.id);
    setPlaylistFilter(undefined);
    if (index >= 0) {
      setQueueIndex(index);
      setPositionMs(0);
      setIsPlaying(true);
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

  const closeOverlays = (): void => {
    setMenuOpen(false);
    setHelpOpen(false);
    setDiagnosticsOpen(false);
    setSearchOpen(false);
    setBrowseOpen(false);
    setQueueOpen(false);
  };

  const openQueue = (): void => {
    closeOverlays();
    setQueueSel(Math.max(0, order.indexOf(queueIndex)));
    setQueueOpen(true);
  };

  // Audio children outlive unmount cleanups: register them for both the
  // in-app quit path and OS signal handlers (see main.tsx).
  useEffect(() => {
    return onShutdown(() => {
      try {
        void backendRef.current?.destroy();
      } catch {
        // Ignore.
      }
      try {
        feedRef.current?.stop();
      } catch {
        // Ignore.
      }
      try {
        spectrumRef.current?.stop();
      } catch {
        // Ignore.
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quit = (): void => {
    runShutdown();
    try {
      renderer.destroy();
    } finally {
      // OpenTUI may deliver Ctrl+C as a keyboard event instead of SIGINT.
      // Force process completion after the renderer and audio children drain.
      setTimeout(() => process.exit(0), 100);
    }
  };

  useKeyboard((key) => {
    if (process.env.MATPLAY_DEBUG_KEYS === '1') {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ name: key.name, sequence: key.sequence }));
    }
    const pressed = new Set([key.name, key.sequence]);
    const has = (...options: string[]): boolean =>
      options.some((option) => pressed.has(option));
    // Arrow/enter names differ between legacy sequences and the Kitty
    // keyboard protocol; accept every known variant.
    const UP = ['up', 'ArrowUp'];
    const DOWN = ['down', 'ArrowDown'];
    const LEFT = ['left', 'ArrowLeft'];
    const RIGHT = ['right', 'ArrowRight'];
    const CONFIRM = ['return', 'enter'];

    if ((key.ctrl && has('c', 'C')) || key.sequence === '\x03') {
      quit();
      return;
    }

    if (setupOpen) {
      if (has(...CONFIRM)) {
        const candidate = scanLibrarySync(setupPath);
        setSetupDiagnostics(candidate.diagnostics);
        if (!candidate.diagnostics.some((item) => item.level === 'error')) {
          updateConfig({ musicRoot: setupPath });
          setSetupOpen(false);
        }
      } else if (has('q') && !key.shift) {
        quit();
      }
      return;
    }

    if (menuOpen) {
      if (has('escape', 's')) {
        setMenuOpen(false);
      } else if (has(...UP)) {
        setMenuIndex((index) => Math.max(0, index - 1));
      } else if (has(...DOWN)) {
        setMenuIndex((index) => Math.min(5, index + 1));
      } else if (has(...CONFIRM)) {
        if (menuIndex === 0) {
          setSetupPath(musicRoot);
          setSetupDiagnostics([]);
          setSetupOpen(true);
          setMenuOpen(false);
        } else if (menuIndex === 1) {
          const mode = config.theme === 'cover' ? 'light' : 'cover';
          updateConfig({ theme: mode });
          const sampled = paletteCache.current.get(meta.coverSrc) ?? KALYANI_COVER_THEME;
          setTheme(preferredTheme(sampled, { ...config, theme: mode }));
        } else if (menuIndex === 2) {
          const accents = ['auto', '#BB86FC', '#03DAC6', '#D9AB4E', '#FF5A00'];
          const currentAccent = config.accentColor === 'auto' ? 'auto' : config.accentColor.toUpperCase();
          const nextAccent = accents[(accents.indexOf(currentAccent) + 1) % accents.length] ?? accents[0]!;
          updateConfig({ accentColor: nextAccent });
          const sampled = paletteCache.current.get(meta.coverSrc) ?? themeRef.current;
          setTheme(nextAccent === 'auto' ? sampled : { ...themeRef.current, accent: nextAccent });
        } else if (menuIndex === 3) {
          updateConfig({ vizGain: config.vizGain >= 4 ? 0.2 : Math.round((config.vizGain + 0.2) * 10) / 10 });
        } else if (menuIndex === 4) {
          updateConfig({ vizMaxHeight: config.vizMaxHeight >= 1 ? 0.2 : Math.round((config.vizMaxHeight + 0.1) * 10) / 10 });
        } else {
          const reset = defaultConfig();
          configRef.current = reset;
          setConfig(reset);
          saveConfig(reset);
          setSetupPath(reset.musicRoot);
          setSetupDiagnostics([]);
          setSetupOpen(true);
          setMenuOpen(false);
        }
      }
      return;
    }

    if (diagnosticsOpen) {
      if (has('escape', 'd', 'D')) setDiagnosticsOpen(false);
      return;
    }

    // Text input owns every key except navigation while searching.
    if (searchOpen) {
      if (has('escape')) {
        setSearchOpen(false);
        setQuery('');
        setSearchIndex(0);
      } else if (has(...CONFIRM)) {
        const selected = results[searchIndex];
        if (selected) playSearchResult(selected);
      } else if (has(...UP)) {
        setSearchIndex((index) => Math.max(0, index - 1));
      } else if (has(...DOWN)) {
        setSearchIndex((index) => Math.min(results.length - 1, index + 1));
      }
      return;
    }

    const browseRows = library.playlists.length + 1;
    if (browseOpen) {
      if (has('escape')) {
        setBrowseOpen(false);
      } else if (has(...CONFIRM)) {
        const row = browseIndex - 1;
        choosePlaylist(row < 0 ? undefined : library.playlists[row]?.name);
      } else if (has(...UP)) {
        setBrowseIndex((index) => Math.max(0, index - 1));
        return;
      } else if (has(...DOWN)) {
        setBrowseIndex((index) => Math.min(browseRows - 1, index + 1));
        return;
      }
    }

    if (queueOpen) {
      if (has('escape')) {
        setQueueOpen(false);
      } else if (has(...CONFIRM)) {
        const bounded = Math.min(Math.max(0, queueSel), order.length - 1);
        goTo(order[bounded] ?? queueIndex);
        setQueueOpen(false);
      } else if (has(...UP)) {
        setQueueSel((index) => Math.max(0, index - 1));
        return;
      } else if (has(...DOWN)) {
        setQueueSel((index) => Math.min(queue.length - 1, index + 1));
        return;
      }
    }

    if (has('q') && !key.shift) {
      quit();
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
        quit();
      }
    } else if (has('space', ' ')) {
      setIsPlaying((previous) => !previous);
    } else if (has('?')) {
      const opening = !helpOpen;
      closeOverlays();
      setHelpOpen(opening);
    } else if (has('s')) {
      const opening = !menuOpen;
      closeOverlays();
      setMenuOpen(opening);
    } else if (has('d', 'D')) {
      const opening = !diagnosticsOpen;
      closeOverlays();
      setDiagnosticsOpen(opening);
    } else if (has('r')) {
      setLibraryRevision((revision) => revision + 1);
      setLibraryNotice('LIBRARY RESCANNED');
    } else if (has('l')) {
      setLyricsVisible((previous) => !previous);
    } else if (has('/')) {
      closeOverlays();
      setSearchIndex(0);
      setSearchOpen(true);
    } else if (has('b')) {
      const opening = !browseOpen;
      closeOverlays();
      setBrowseIndex(0);
      setBrowseOpen(opening);
    } else if (has('n')) {
      next();
    } else if (has('p')) {
      previous();
    } else if (has(...UP) && lyricsVisible) {
      setLyricsOffset((offset) => Math.max(0, offset - 1));
    } else if (has(...DOWN) && lyricsVisible) {
      setLyricsOffset((offset) => Math.min(Math.max(0, lyrics.length - 3), offset + 1));
    } else if (has(...LEFT)) {
      seekTo(positionMsRef.current - 5000);
    } else if (has(...RIGHT)) {
      seekTo(positionMsRef.current + 5000);
    } else if (has('+', '=', 'plus', 'equal')) {
      setVolume((previous) => Math.min(1, previous + 0.05));
    } else if (has('-', 'minus')) {
      setVolume((previous) => Math.max(0, previous - 0.05));
    } else if (has('m', 'mute')) {
      setVolume((previous) => (previous > 0 ? 0 : lastAudibleVolume.current));
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

  if (setupOpen) {
    return (
      <SetupScreen
        path={setupPath}
        diagnostics={setupDiagnostics}
        theme={theme}
        onPath={(value) => {
          setSetupPath(value);
          setSetupDiagnostics([]);
        }}
      />
    );
  }

  return (
    <box width="100%" height="100%" backgroundColor={theme.appBg} flexDirection="column">
      <box position="absolute" top={0} left={0} width={width} height={height}>
        <Visualizer
          levels={viz.levels}
          peaks={viz.peaks}
          rows={vizRows}
          maxHeight={config.vizMaxHeight}
          theme={theme}
        />
      </box>

      <box flexDirection="row" alignItems="center" paddingX={2} paddingTop={1} backgroundColor="transparent">
        <SettingsButton
          color={theme.accent}
          onActivate={() => {
            const opening = !menuOpen;
            closeOverlays();
            setMenuOpen(opening);
          }}
        />
        <box flexGrow={1} />
        <text fg={theme.muted}>{libraryNotice ?? meta.streamLabel}</text>
      </box>
      {audioError ? (
        <box justifyContent="center" backgroundColor={theme.card}>
          <text fg={theme.signal}><strong>AUDIO ERROR:</strong> {audioError}</text>
        </box>
      ) : null}

      <box flexGrow={1} justifyContent="center" alignItems="center">
        <box flexDirection="column" width={contentWidth} gap={1} backgroundColor="transparent">
          <box flexDirection={compact ? 'column' : 'row'} gap={compact ? 1 : 3} alignItems={compact ? 'center' : undefined}>
            {!tiny ? <AlbumArtwork src={meta.coverSrc} theme={theme} width={compact ? 16 : 26} height={compact ? 8 : 13} /> : null}
            <box flexDirection="column" gap={1} justifyContent="flex-start" paddingTop={1}>
              <TrackMetadata
                trackNo={queueIndex + 1}
                title={meta.title}
                artist={meta.artist}
                formatLabel={meta.formatLabel}
                theme={theme}
                maxWidth={seekWidth}
              />
              <SeekBar
                positionMs={positionMs}
                durationMs={meta.durationMs ?? 0}
                widthChars={seekWidth}
                theme={theme}
              />
              {lyricsVisible ? (
                <LyricsPanel lines={lyrics} positionMs={positionMs} theme={theme} scrollOffset={lyricsOffset} />
              ) : null}
            </box>
          </box>
          <text fg={theme.accent}>{'─'.repeat(contentWidth)}</text>
          <box flexDirection={contentWidth < 66 ? 'column' : 'row'} alignItems="center">
            <PlaybackControls
              isPlaying={isPlaying}
              shuffle={shuffle}
              loopList={loopList}
              loopSingle={loopSingle}
              theme={theme}
              onTogglePlay={() => setIsPlaying((previousState) => !previousState)}
              onPrevious={previous}
              onNext={next}
              onToggleShuffle={() => setShuffle((value) => !value)}
              onToggleLoopList={() => setLoopList((value) => !value)}
              onToggleLoopSingle={() => setLoopSingle((value) => !value)}
            />
            <box flexGrow={1} />
            <VolumeMeter volume={volume} theme={theme} />
          </box>
        </box>
      </box>

      {menuOpen ? (
        <box position="absolute" top={4} left={2}>
          <SettingsMenu
            musicDir={musicRoot}
            trackCount={queue.length}
            shuffle={shuffle}
            loopList={loopList}
            loopSingle={loopSingle}
            theme={theme}
            selectedIndex={menuIndex}
            themeMode={config.theme}
            accentColor={config.accentColor}
            vizGain={config.vizGain}
            vizMaxHeight={config.vizMaxHeight}
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
      {diagnosticsOpen ? (
        <box position="absolute" top={Math.max(0, Math.floor((height - 18) / 2))} left={Math.max(0, Math.floor((width - 68) / 2))}>
          <DiagnosticsPanel diagnostics={library.diagnostics} theme={theme} />
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
            order={order}
            currentPos={Math.max(0, order.indexOf(queueIndex))}
            selectedIndex={queueSel}
            playlistName={playlistFilter ?? 'all'}
            theme={theme}
          />
        </box>
      ) : null}
    </box>
  );
}
