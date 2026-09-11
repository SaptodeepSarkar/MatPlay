declare module 'mpris-service' {
  import type { EventEmitter } from 'node:events';

  export type MprisPlayerOptions = {
    name: string;
    identity?: string;
    supportedUriSchemes?: string[];
    supportedMimeTypes?: string[];
    supportedInterfaces?: Array<'player' | 'trackList' | 'playlists'>;
    desktopEntry?: string;
  };

  export type MprisMetadata = {
    'mpris:trackid'?: string;
    'mpris:length'?: number;
    'mpris:artUrl'?: string;
    'xesam:title'?: string;
    'xesam:album'?: string;
    'xesam:artist'?: string[];
    [key: string]: unknown;
  };

  export interface MprisPlayer extends EventEmitter {
    metadata: MprisMetadata;
    playbackStatus: 'Playing' | 'Paused' | 'Stopped';
    loopStatus: 'None' | 'Track' | 'Playlist';
    shuffle: boolean;
    volume: number;
    rate: number;
    canPlay: boolean;
    canPause: boolean;
    canGoNext: boolean;
    canGoPrevious: boolean;
    canSeek: boolean;
    objectPath(subpath: string): string;
    getPosition(): number;
    seeked(positionUs: number): void;
  }

  function Player(options: MprisPlayerOptions): MprisPlayer;
  export default Player;
}
