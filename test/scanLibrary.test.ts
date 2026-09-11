import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanLibrarySync } from '../src/library/scanLibrary.js';

function touch(file: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, '');
}

function fixture(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'matplay-scan-'));
  // Valid song with lyrics preference (.lrc wins over .txt).
  touch(path.join(root, 'Work', 'ARJN', 'KALYANI', 'song.mp3'));
  touch(path.join(root, 'Work', 'ARJN', 'KALYANI', 'song.lrc'));
  touch(path.join(root, 'Work', 'ARJN', 'KALYANI', 'notes.txt'));
  // Song folder with no audio -> skipped with warning.
  touch(path.join(root, 'Work', 'ARJN', 'EMPTY', 'lyrics.lrc'));
  // Multiple audio files -> first sorted wins with warning.
  touch(path.join(root, 'Work', 'BEATS', 'MULTI', 'b.mp3'));
  touch(path.join(root, 'Work', 'BEATS', 'MULTI', 'a.mp3'));
  // Hidden entries ignored everywhere.
  touch(path.join(root, 'Work', '.hidden-artist', 'X', 'x.mp3'));
  touch(path.join(root, 'Work', 'ARJN', 'KALYANI', '.hidden.mp3'));
  // Stray file where a playlist should be.
  touch(path.join(root, 'readme.txt'));
  return root;
}

describe('scanLibrarySync', () => {
  it('builds playlists, artists, and tracks from the strict layout', () => {
    const { playlists, diagnostics } = scanLibrarySync(fixture());
    expect(playlists.map((p) => p.name)).toEqual(['Work']);

    const work = playlists[0]!;
    expect(work.artists.map((a) => a.name).sort()).toEqual(['ARJN', 'BEATS']);
    expect(work.tracks.map((t) => t.title).sort()).toEqual(['KALYANI', 'MULTI']);

    const kalyani = work.tracks.find((t) => t.title === 'KALYANI')!;
    expect(kalyani.artist).toBe('ARJN');
    expect(kalyani.playlist).toBe('Work');
    expect(kalyani.audioPath.endsWith('song.mp3')).toBe(true);
    expect(kalyani.lyricsPath?.endsWith('song.lrc')).toBe(true);

    const multi = work.tracks.find((t) => t.title === 'MULTI')!;
    expect(multi.audioPath.endsWith('a.mp3')).toBe(true);

    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain('NO_AUDIO');
    expect(codes).toContain('MULTIPLE_AUDIO');
    expect(codes).toContain('MULTIPLE_LYRICS');
    expect(codes).toContain('NOT_A_PLAYLIST');
  });

  it('is deterministic across rescans', () => {
    const root = fixture();
    const first = scanLibrarySync(root);
    const second = scanLibrarySync(root);
    expect(second).toEqual(first);
  });

  it('reports a missing root without throwing', () => {
    const result = scanLibrarySync(path.join(os.tmpdir(), 'matplay-nope-404'));
    expect(result.playlists).toEqual([]);
    expect(result.diagnostics[0]?.level).toBe('error');
  });
});
