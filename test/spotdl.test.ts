import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSpotdlInvocation, hasSpotdlSync, parseSpotdlQueries, sanitizePlaylistName, spotdlSyncFile } from '../src/download/spotdl.js';

describe('spotDL helper', () => {
  it('builds the MatPlay artist/song folder layout without a shell', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'matplay-spotdl-'));
    const invocation = buildSpotdlInvocation({
      musicRoot: root,
      playlist: 'Road / Trip',
      query: 'Daft Punk - Voyager',
      mode: 'download',
      deleteRemoved: false,
    });

    expect(invocation.command).toBe('spotdl');
    expect(invocation.playlist).toBe('Road _ Trip');
    expect(invocation.args).toContain('Daft Punk - Voyager');
    expect(invocation.args.join(' ')).toContain('{artist}');
    expect(invocation.args.join(' ')).toContain('{title}');
  });

  it('passes multiple pasted song links as separate spotDL queries', () => {
    const first = 'https://open.spotify.com/track/first';
    const second = 'https://open.spotify.com/track/second';
    const invocation = buildSpotdlInvocation({
      musicRoot: '/music',
      playlist: 'Batch',
      query: `${first}, ${second}`,
      mode: 'download',
      deleteRemoved: false,
    });

    expect(parseSpotdlQueries(`${first}\n${second}`)).toEqual([first, second]);
    expect(invocation.args.slice(0, 3)).toEqual(['download', first, second]);
  });

  it('defaults sync to no deletion and reuses saved playlist state', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'matplay-spotdl-'));
    const stateDir = path.join(root, 'Saved', '.matplay');
    mkdirSync(stateDir, { recursive: true });
    const syncFile = path.join(stateDir, 'playlist.sync.spotdl');
    writeFileSync(syncFile, '{}');
    expect(spotdlSyncFile(root, 'Saved')).toBe(syncFile);
    expect(hasSpotdlSync(root, 'Saved')).toBe(true);

    const invocation = buildSpotdlInvocation({
      musicRoot: root,
      playlist: 'Saved',
      query: '',
      mode: 'sync',
      deleteRemoved: false,
    });
    expect(invocation.args.slice(0, 2)).toEqual(['sync', syncFile]);
    expect(invocation.args).toContain('--sync-without-deleting');
  });

  it('only enables audio and lyric removal in explicit mirror mode', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'matplay-spotdl-'));
    const invocation = buildSpotdlInvocation({
      musicRoot: root,
      playlist: 'Mirror',
      query: 'https://open.spotify.com/playlist/example',
      mode: 'sync',
      deleteRemoved: true,
    });

    expect(invocation.args).toContain('--sync-remove-lrc');
    expect(invocation.args).not.toContain('--sync-without-deleting');
    expect(invocation.args).toContain('--save-file');
  });

  it('sanitizes traversal and platform separators', () => {
    const sanitized = sanitizePlaylistName('../../Bad\\Name');
    expect(sanitized).not.toContain('..');
    expect(sanitized).not.toMatch(/[/\\]/);
  });
});
