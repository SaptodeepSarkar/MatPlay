export type Track = {
  id: string;
  title: string;
  artist: string;
  playlist: string;
  songFolder: string;
  audioPath: string;
  lyricsPath?: string;
  durationMs?: number;
};

export type Artist = {
  id: string;
  name: string;
  tracks: Track[];
};

export type Playlist = {
  id: string;
  name: string;
  artists: Artist[];
  tracks: Track[];
};

export type DiagnosticLevel = 'info' | 'warning' | 'error';

export type Diagnostic = {
  level: DiagnosticLevel;
  code: string;
  message: string;
  path?: string;
};

export type Library = {
  playlists: Playlist[];
  diagnostics: Diagnostic[];
};

export type LyricLine = {
  timeMs?: number;
  text: string;
};

export type PlaybackStatus = 'stopped' | 'playing' | 'paused';

export type AppConfig = {
  musicRoot: string;
  theme: 'cover' | 'light';
  accentColor: string;
  volume: number;
  lastPlaylist?: string;
  lastTrackId?: string;
};
