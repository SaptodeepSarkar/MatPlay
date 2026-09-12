import { lstatSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { artistId, playlistId, trackId } from '../utils/ids.js';
import { isAudioFile, isHidden, isLrcFile, isLyricsFile } from '../utils/paths.js';
import { isWithinDir } from '../security/sanitize.js';
import { DiagnosticCodes, makeDiagnostic } from './diagnostics.js';

const MAX_ENTRIES_PER_DIR = 5000;
const MAX_DIAGNOSTICS = 200;

function pushDiagnostic(diagnostics: Diagnostic[], diagnostic: Diagnostic): void {
  if (diagnostics.length >= MAX_DIAGNOSTICS) return;
  diagnostics.push(diagnostic);
}

/** Resolve and verify a child stays inside the library root (symlink-safe). */
function containedPath(root: string, ...segments: string[]): string | undefined {
  try {
    const candidate = path.join(root, ...segments);
    const resolved = realpathSync(candidate);
    if (resolved === root || isWithinDir(root, resolved, path.sep)) return resolved;
    return undefined;
  } catch {
    return undefined;
  }
}
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
    const names = readdirSync(dir);
    if (names.length > MAX_ENTRIES_PER_DIR) {
      pushDiagnostic(diagnostics, makeDiagnostic(
        'warning',
        DiagnosticCodes.UNREADABLE_DIRECTORY,
        `Directory has ${names.length} entries; truncating to ${MAX_ENTRIES_PER_DIR}.`,
        dir,
      ));
      return names.slice(0, MAX_ENTRIES_PER_DIR);
    }
    return names;
  } catch {
    pushDiagnostic(diagnostics, makeDiagnostic(
      'warning',
      DiagnosticCodes.UNREADABLE_DIRECTORY,
      `Could not read directory, skipping.`,
      dir,
    ));
    return undefined;
  }
}

function isDirectory(entryPath: string): boolean {
  try {
    // lstat: never follow a symlink here; containment is enforced by callers.
    if (lstatSync(entryPath).isSymbolicLink()) return false;
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

  let root: string;
  try {
    root = realpathSync(musicRoot);
  } catch {
    root = musicRoot;
  }
  if (!isDirectory(musicRoot)) {
    let code: string = DiagnosticCodes.ROOT_MISSING;
    try {
      statSync(musicRoot);
      code = DiagnosticCodes.ROOT_NOT_DIRECTORY;
    } catch {
      code = DiagnosticCodes.ROOT_MISSING;
    }
    pushDiagnostic(diagnostics, makeDiagnostic(
      'error',
      code,
      `Music root is not a readable directory: ${musicRoot}`,
      musicRoot,
    ));
    return { playlists, diagnostics };
  }

  const firstLevel = readDirNames(musicRoot, diagnostics) ?? [];
  for (const playlistName of sortedNames(firstLevel)) {
    if (isHidden(playlistName)) continue;
    const playlistPath = containedPath(root, playlistName);
    if (!playlistPath || !isDirectory(playlistPath)) {
      pushDiagnostic(diagnostics, makeDiagnostic(
        'warning',
        DiagnosticCodes.NOT_A_PLAYLIST,
        playlistPath ? `Expected a playlist folder, found a file. Ignoring.` : `Playlist escapes the music library; ignoring symlink.`,
        path.join(musicRoot, playlistName),
      ));
      continue;
    }
    playlists.push(scanPlaylist(playlistPath, root, playlistName, diagnostics));
  }

  return { playlists, diagnostics };
}

function scanPlaylist(
  playlistPath: string,
  root: string,
  playlistName: string,
  diagnostics: Diagnostic[],
): Playlist {
  const artists: Artist[] = [];
  const tracks: Track[] = [];

  const entries = readDirNames(playlistPath, diagnostics) ?? [];
  for (const artistName of sortedNames(entries)) {
    if (isHidden(artistName)) continue;
    const relArtist = path.relative(root, path.join(playlistPath, artistName));
    const artistPath = containedPath(root, relArtist);
    if (!artistPath || !isDirectory(artistPath)) {
      pushDiagnostic(diagnostics, makeDiagnostic(
        'info',
        DiagnosticCodes.UNEXPECTED_ENTRY,
        artistPath ? `Expected an artist folder, ignoring file.` : `Artist escapes the music library; ignoring symlink.`,
        path.join(playlistPath, artistName),
      ));
      continue;
    }
    const artistTracks = scanArtist(artistPath, root, playlistName, artistName, diagnostics);
    if (artistTracks.length === 0) {
      pushDiagnostic(diagnostics, makeDiagnostic(
        'warning',
        DiagnosticCodes.EMPTY_ARTIST,
        `Artist folder has no playable songs: ${artistName}`,
        artistPath,
      ));
    }
    artists.push({ id: artistId(playlistName, artistName), name: artistName, tracks: artistTracks });
    tracks.push(...artistTracks);
  }

  if (artists.length === 0) {
    pushDiagnostic(diagnostics, makeDiagnostic(
      'warning',
      DiagnosticCodes.EMPTY_PLAYLIST,
      `Playlist folder has no artists: ${playlistName}`,
      playlistPath,
    ));
  }

  return { id: playlistId(playlistName), name: playlistName, artists, tracks };
}

function scanArtist(
  artistPath: string,
  root: string,
  playlistName: string,
  artistName: string,
  diagnostics: Diagnostic[],
): Track[] {
  const tracks: Track[] = [];
  const entries = readDirNames(artistPath, diagnostics) ?? [];

  for (const songName of sortedNames(entries)) {
    if (isHidden(songName)) continue;
    const relSong = path.relative(root, path.join(artistPath, songName));
    const songPath = containedPath(root, relSong);
    if (!songPath || !isDirectory(songPath)) {
      pushDiagnostic(diagnostics, makeDiagnostic(
        'info',
        DiagnosticCodes.UNEXPECTED_ENTRY,
        songPath ? `Expected a song folder, ignoring file.` : `Song escapes the music library; ignoring symlink.`,
        path.join(artistPath, songName),
      ));
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
    pushDiagnostic(diagnostics, makeDiagnostic(
      'warning',
      DiagnosticCodes.NO_AUDIO,
      `Song folder has no audio file, skipping: ${songName}`,
      songPath,
    ));
    return undefined;
  }
  if (audioFiles.length > 1) {
    pushDiagnostic(diagnostics, makeDiagnostic(
      'warning',
      DiagnosticCodes.MULTIPLE_AUDIO,
      `Song folder has ${audioFiles.length} audio files, using first: ${audioFiles[0]}`,
      songPath,
    ));
  }

  let lyricsPath: string | undefined;
  if (lyricsFiles.length > 1) {
    pushDiagnostic(diagnostics, makeDiagnostic(
      'warning',
      DiagnosticCodes.MULTIPLE_LYRICS,
      `Song folder has ${lyricsFiles.length} lyrics files, preferring .lrc.`,
      songPath,
    ));
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
