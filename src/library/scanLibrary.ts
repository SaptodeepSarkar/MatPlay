import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { artistId, playlistId, trackId } from '../utils/ids.js';
import { isAudioFile, isHidden, isLrcFile, isLyricsFile } from '../utils/paths.js';
import { DiagnosticCodes, makeDiagnostic } from './diagnostics.js';
import type {
  Artist,
  Diagnostic,
  Library,
  Playlist,
  Track,
} from './types.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function sortedNames(names: string[]): string[] {
  return [...names].sort((a, b) => collator.compare(a, b));
}

function readDirNames(dir: string, diagnostics: Diagnostic[]): string[] | undefined {
  try {
    return readdirSync(dir);
  } catch {
    diagnostics.push(
      makeDiagnostic(
        'warning',
        DiagnosticCodes.UNREADABLE_DIRECTORY,
        `Could not read directory, skipping.`,
        dir,
      ),
    );
    return undefined;
  }
}

function isDirectory(entryPath: string): boolean {
  try {
    return statSync(entryPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Synchronously scan the strict MatPlay folder layout:
 * musicRoot / playlist / artist / song / song.mp3 (+ optional lyrics).
 *
 * Pure filesystem work: no UI, no playback, no metadata parsing, never
 * throws. Durations/tags are enriched later from `audioPath`.
 */
export function scanLibrarySync(musicRoot: string): Library {
  const diagnostics: Diagnostic[] = [];
  const playlists: Playlist[] = [];

  if (!isDirectory(musicRoot)) {
    let code: string = DiagnosticCodes.ROOT_MISSING;
    try {
      statSync(musicRoot);
      code = DiagnosticCodes.ROOT_NOT_DIRECTORY;
    } catch {
      code = DiagnosticCodes.ROOT_MISSING;
    }
    diagnostics.push(
      makeDiagnostic(
        'error',
        code,
        `Music root is not a readable directory: ${musicRoot}`,
        musicRoot,
      ),
    );
    return { playlists, diagnostics };
  }

  const firstLevel = readDirNames(musicRoot, diagnostics) ?? [];
  for (const playlistName of sortedNames(firstLevel)) {
    if (isHidden(playlistName)) continue;
    const playlistPath = path.join(musicRoot, playlistName);
    if (!isDirectory(playlistPath)) {
      diagnostics.push(
        makeDiagnostic(
          'warning',
          DiagnosticCodes.NOT_A_PLAYLIST,
          `Expected a playlist folder, found a file. Ignoring.`,
          playlistPath,
        ),
      );
      continue;
    }
    playlists.push(scanPlaylist(playlistPath, playlistName, diagnostics));
  }

  return { playlists, diagnostics };
}

function scanPlaylist(
  playlistPath: string,
  playlistName: string,
  diagnostics: Diagnostic[],
): Playlist {
  const artists: Artist[] = [];
  const tracks: Track[] = [];

  const entries = readDirNames(playlistPath, diagnostics) ?? [];
  for (const artistName of sortedNames(entries)) {
    if (isHidden(artistName)) continue;
    const artistPath = path.join(playlistPath, artistName);
    if (!isDirectory(artistPath)) {
      diagnostics.push(
        makeDiagnostic(
          'info',
          DiagnosticCodes.UNEXPECTED_ENTRY,
          `Expected an artist folder, ignoring file.`,
          artistPath,
        ),
      );
      continue;
    }
    const artistTracks = scanArtist(artistPath, playlistName, artistName, diagnostics);
    if (artistTracks.length === 0) {
      diagnostics.push(
        makeDiagnostic(
          'warning',
          DiagnosticCodes.EMPTY_ARTIST,
          `Artist folder has no playable songs: ${artistName}`,
          artistPath,
        ),
      );
    }
    artists.push({ id: artistId(playlistName, artistName), name: artistName, tracks: artistTracks });
    tracks.push(...artistTracks);
  }

  if (artists.length === 0) {
    diagnostics.push(
      makeDiagnostic(
        'warning',
        DiagnosticCodes.EMPTY_PLAYLIST,
        `Playlist folder has no artists: ${playlistName}`,
        playlistPath,
      ),
    );
  }

  return { id: playlistId(playlistName), name: playlistName, artists, tracks };
}

function scanArtist(
  artistPath: string,
  playlistName: string,
  artistName: string,
  diagnostics: Diagnostic[],
): Track[] {
  const tracks: Track[] = [];
  const entries = readDirNames(artistPath, diagnostics) ?? [];

  for (const songName of sortedNames(entries)) {
    if (isHidden(songName)) continue;
    const songPath = path.join(artistPath, songName);
    if (!isDirectory(songPath)) {
      diagnostics.push(
        makeDiagnostic(
          'info',
          DiagnosticCodes.UNEXPECTED_ENTRY,
          `Expected a song folder, ignoring file.`,
          songPath,
        ),
      );
      continue;
    }
    const track = scanSong(songPath, playlistName, artistName, songName, diagnostics);
    if (track) tracks.push(track);
  }

  return tracks;
}

function scanSong(
  songPath: string,
  playlistName: string,
  artistName: string,
  songName: string,
  diagnostics: Diagnostic[],
): Track | undefined {
  const entries = readDirNames(songPath, diagnostics) ?? [];
  const audioFiles = sortedNames(
    entries.filter((name) => !isHidden(name) && isAudioFile(path.join(songPath, name))),
  );
  const lyricsFiles = sortedNames(
    entries.filter((name) => !isHidden(name) && isLyricsFile(path.join(songPath, name))),
  );

  if (audioFiles.length === 0) {
    diagnostics.push(
      makeDiagnostic(
        'warning',
        DiagnosticCodes.NO_AUDIO,
        `Song folder has no audio file, skipping: ${songName}`,
        songPath,
      ),
    );
    return undefined;
  }
  if (audioFiles.length > 1) {
    diagnostics.push(
      makeDiagnostic(
        'warning',
        DiagnosticCodes.MULTIPLE_AUDIO,
        `Song folder has ${audioFiles.length} audio files, using first: ${audioFiles[0]}`,
        songPath,
      ),
    );
  }

  let lyricsPath: string | undefined;
  if (lyricsFiles.length > 1) {
    diagnostics.push(
      makeDiagnostic(
        'warning',
        DiagnosticCodes.MULTIPLE_LYRICS,
        `Song folder has ${lyricsFiles.length} lyrics files, preferring .lrc.`,
        songPath,
      ),
    );
  }
  const preferred =
    lyricsFiles.find((name) => isLrcFile(path.join(songPath, name))) ?? lyricsFiles[0];
  if (preferred) lyricsPath = path.join(songPath, preferred);

  const audioPath = path.join(songPath, audioFiles[0] as string);
  return {
    id: trackId(playlistName, artistName, songName),
    title: songName,
    artist: artistName,
    playlist: playlistName,
    songFolder: songPath,
    audioPath,
    ...(lyricsPath ? { lyricsPath } : {}),
  };
}
