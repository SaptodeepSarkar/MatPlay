import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSpotdlInvocation, sanitizePlaylistName } from '../src/download/spotdl.js';

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

  it('defaults sync to no deletion and reuses saved playlist state', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'matplay-spotdl-'));
    const stateDir = path.join(root, 'Saved', '.matplay');
    mkdirSync(stateDir, { recursive: true });
    const syncFile = path.join(stateDir, 'playlist.sync.spotdl');
    writeFileSync(syncFile, '{}');

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

  it('sanitizes traversal and platform separators', () => {
    const sanitized = sanitizePlaylistName('../../Bad\\Name');
    expect(sanitized).not.toContain('..');
    expect(sanitized).not.toMatch(/[/\\]/);
  });
});
