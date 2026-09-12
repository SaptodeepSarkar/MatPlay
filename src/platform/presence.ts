import Player from 'mpris-service';
import type { MprisPlayer } from 'mpris-service';
import type { Track } from '../library/types.js';
import type { TrackMeta } from '../playback/trackMeta.js';

export type PresenceControls = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
  seekTo: (ms: number) => void;
  getPositionMs: () => number;
};

/**
 * Build MPRIS metadata from a library track + enriched tags.
 * Pure and unit-tested; lengths are microseconds, art is a file:// URL.
 */
export function buildMetadata(track: Track, meta: TrackMeta): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    'xesam:title': meta.title,
    'xesam:artist': [meta.artist],
    'xesam:album': track.playlist,
  };
  if (meta.durationMs !== undefined) {
    metadata['mpris:length'] = meta.durationMs * 1000;
  }
  if (meta.coverSrc) {
    metadata['mpris:artUrl'] = meta.coverSrc.startsWith('file://')
      ? meta.coverSrc
      : `file://${meta.coverSrc}`;
  }
  return metadata;
}

/**
 * OS media presence (Linux MPRIS over D-Bus): exposes title, artist,
 * album, duration, and cover art to desktop applets (KDE/GNOME media
 * controls), and routes their transport keys back into the app.
 *
 * Best-effort by design: construction never throws, and every update is
 * guarded, so a missing bus (containers, Windows, macOS) simply means
 * no presence instead of a crash. Windows SMTC / macOS NowPlaying need
 * native helpers and are tracked as future platform backends.
 */
export class MediaPresence {
  readonly active: boolean = false;
  private player: MprisPlayer | undefined;

  constructor(controls: PresenceControls) {
    let player: MprisPlayer | undefined;
    try {
      if (process.platform !== 'linux' || process.env.MATPLAY_NO_AUDIO === '1' || process.env.MATPLAY_NO_MPRIS === '1') return;
      player = Player({
        name: 'matplay',
        identity: 'MatPlay',
        supportedUriSchemes: ['file'],
        supportedMimeTypes: ['audio/mpeg'],
        supportedInterfaces: ['player'],
      });
    } catch {
      return;
    }
    this.player = player;
    this.active = true;

    player.canPlay = true;
    player.canPause = true;
    player.canGoNext = true;
    player.canGoPrevious = true;
    player.canSeek = true;
    player.rate = 1.0;
    player.getPosition = () => controls.getPositionMs() * 1000;

    player.on('play', () => controls.play());
    player.on('pause', () => controls.pause());
    player.on('playpause', () => controls.toggle());
    player.on('stop', () => controls.stop());
    player.on('next', () => controls.next());
    player.on('previous', () => controls.previous());
    player.on('quit', () => controls.stop());
    player.on('seek', (offsetUs: number) => {
      if (!Number.isFinite(offsetUs)) return;
      const target = controls.getPositionMs() + offsetUs / 1000;
      if (!Number.isFinite(target)) return;
      controls.seekTo(Math.max(0, target));
    });
    player.on('volume', (volume: number) => {
      void volume;
    });
  }

  updateTrack(track: Track, meta: TrackMeta): void {
    const player = this.player;
    if (!player) return;
    try {
      player.metadata = {
        'mpris:trackid': player.objectPath(`track/${track.id}`),
        ...buildMetadata(track, meta),
      };
    } catch {
      // Bus went away; stay silent.
    }
  }

  updatePlaybackStatus(isPlaying: boolean, hasTrack: boolean): void {
    const player = this.player;
    if (!player) return;
    try {
      player.playbackStatus = !hasTrack ? 'Stopped' : isPlaying ? 'Playing' : 'Paused';
    } catch {
      // Ignore.
    }
  }

  updateFlags(volume: number, shuffle: boolean, repeatOne: boolean, repeatAll: boolean): void {
    const player = this.player;
    if (!player) return;
    try {
      player.volume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0));
      player.shuffle = shuffle;
      player.loopStatus = repeatOne ? 'Track' : repeatAll ? 'Playlist' : 'None';
    } catch {
      // Ignore.
    }
  }

  reportSeek(positionMs: number): void {
    const player = this.player;
    if (!player) return;
    try {
      player.seeked(Math.round(positionMs * 1000));
    } catch {
      // Ignore.
    }
  }
}
