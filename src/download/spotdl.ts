import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export type SpotdlMode = 'download' | 'sync';

export type SpotdlRequest = {
  musicRoot: string;
  playlist: string;
  query: string;
  mode: SpotdlMode;
  deleteRemoved: boolean;
};

export type SpotdlInvocation = {
  command: 'spotdl';
  args: string[];
  playlist: string;
  targetDir: string;
  syncFile?: string;
};

export type SpotdlResult = {
  ok: boolean;
  message: string;
  playlist: string;
};

const activeChildren = new Set<ChildProcess>();

export function detectSpotdl(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('spotdl', ['--version'], { timeout: 8000 }, (error) => resolve(!error));
  });
}

/** Make user-entered playlist names safe while keeping readable Unicode. */
export function sanitizePlaylistName(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.\.+/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  return cleaned || 'Downloads';
}

/** Preserve a normal text search, but expand batches of pasted links. */
export function parseSpotdlQueries(value: string): string[] {
  const input = value.trim();
  if (!input) return [];
  const urls = input.match(/https?:\/\/[^\s,]+/g)?.map((url) =>
    url.replace(/[\])}>.,;]+$/g, ''),
  ) ?? [];
  if (urls.length > 1) return urls;
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length > 1 ? lines : [input];
}

export function buildSpotdlInvocation(request: SpotdlRequest): SpotdlInvocation {
  const playlist = sanitizePlaylistName(request.playlist);
  const root = path.resolve(request.musicRoot);
  const targetDir = path.resolve(root, playlist);
  if (targetDir !== root && !targetDir.startsWith(`${root}${path.sep}`)) {
    throw new Error('Playlist must stay inside the music library.');
  }

  const queries = parseSpotdlQueries(request.query);
  const output = path.join(
    targetDir,
    '{artist}',
    '{title}',
    '{title}.{output-ext}',
  );
  const common = ['--output', output, '--format', 'mp3', '--log-level', 'INFO'];

  if (request.mode === 'download') {
    if (queries.length === 0) throw new Error('Enter a song name or Spotify link.');
    return {
      command: 'spotdl',
      args: ['download', ...queries, ...common],
      playlist,
      targetDir,
    };
  }

  const stateDir = path.join(targetDir, '.matplay');
  const syncFile = path.join(stateDir, 'playlist.sync.spotdl');
  const hasSavedSync = existsSync(syncFile);
  if (!hasSavedSync && queries.length === 0) {
    throw new Error('Paste a Spotify playlist link to start syncing.');
  }
  if (!hasSavedSync && queries.length > 1) {
    throw new Error('Playlist sync accepts one Spotify playlist link.');
  }
  const args = hasSavedSync
    ? ['sync', syncFile, ...common]
    : ['sync', queries[0] as string, '--save-file', syncFile, ...common];
  if (!request.deleteRemoved) args.push('--sync-without-deleting');
  if (request.deleteRemoved) args.push('--sync-remove-lrc');
  return {
    command: 'spotdl',
    args,
    playlist,
    targetDir,
    syncFile,
  };
}

export function runSpotdl(
  request: SpotdlRequest,
  onStatus: (message: string) => void = () => undefined,
): Promise<SpotdlResult> {
  let invocation: SpotdlInvocation;
  try {
    invocation = buildSpotdlInvocation(request);
    mkdirSync(invocation.targetDir, { recursive: true });
    if (invocation.syncFile) mkdirSync(path.dirname(invocation.syncFile), { recursive: true });
  } catch (error) {
    return Promise.resolve({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      playlist: sanitizePlaylistName(request.playlist),
    });
  }

  return new Promise((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.targetDir,
      env: { ...process.env, NO_COLOR: '1', PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    activeChildren.add(child);
    let lastLine = 'Starting spotDL…';
    onStatus(lastLine);
    const acceptOutput = (chunk: Buffer): void => {
      const lines = chunk.toString().replace(/\r/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length > 0) {
        lastLine = lines.at(-1) ?? lastLine;
        onStatus(lastLine.slice(0, 140));
      }
    };
    child.stdout?.on('data', acceptOutput);
    child.stderr?.on('data', acceptOutput);
    child.once('error', (error) => {
      activeChildren.delete(child);
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      resolve({
        ok: false,
        message: missing
          ? 'spotDL is not installed. Re-run the installer with its spotDL option.'
          : error.message,
        playlist: invocation.playlist,
      });
    });
    child.once('close', (code) => {
      activeChildren.delete(child);
      resolve({
        ok: code === 0,
        message: code === 0 ? `Finished downloading to ${invocation.playlist}` : `spotDL failed: ${lastLine}`,
        playlist: invocation.playlist,
      });
    });
  });
}

export function stopSpotdlJobs(): void {
  for (const child of activeChildren) child.kill('SIGTERM');
  activeChildren.clear();
}
