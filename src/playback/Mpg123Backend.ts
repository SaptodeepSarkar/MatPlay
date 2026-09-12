import { spawn, type ChildProcess } from 'node:child_process';
import { statSync } from 'node:fs';
import { parseFile } from 'music-metadata';
import type { Track } from '../library/types.js';
import type { AudioBackend } from './AudioBackend.js';
import { hasProtocolBreakers } from '../security/sanitize.js';

const MAX_PROTOCOL_LINE = 64 * 1024;

function isSafeAudioPath(audioPath: string): boolean {
  if (!audioPath || hasProtocolBreakers(audioPath)) return false;
  try {
    return statSync(audioPath).isFile();
  } catch {
    return false;
  }
}

/**
 * Gapless playback via `mpg123` remote control (`-R`).
 *
 * Unlike process-per-action adapters, a single mpg123 instance lives for
 * the whole session: LOADPAUSED/PAUSE/STOP/JUMP/VOLUME are commands on a
 * control pipe, so volume steps, pause/resume, and seeks never restart
 * anything audible. Position and duration come from the decoder's own
 * `@F` status lines, not a wall-clock estimate.
 *
 * Falls back silently (timer-only, no sound) when the binary is missing
 * or cannot start — same contract as the ffplay adapter.
 */
export class Mpg123Backend implements AudioBackend {
  onEnded: (() => void) | undefined;
  onError: ((message: string) => void) | undefined;

  private proc: ChildProcess | undefined;
  private buffer = '';
  private available = true;
  private playing = false;
  private endedSinceLoad = false;
  private expectStop = false;
  private positionMs = 0;
  private durationMs: number | undefined;
  private volume = 0.62;
  private lastPath: string | undefined;
  private endTimer: NodeJS.Timeout | undefined;

  private clearEndTimer(): void {
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = undefined;
  }

  private scheduleEnd(): void {
    this.clearEndTimer();
    if (!this.playing || this.durationMs === undefined) return;
    const remaining = Math.max(0, this.durationMs - this.positionMs);
    this.endTimer = setTimeout(() => this.finishNaturally(), remaining + 250);
  }

  private finishNaturally(): void {
    if (!this.playing || this.endedSinceLoad) return;
    this.clearEndTimer();
    this.positionMs = this.durationMs ?? this.positionMs;
    this.playing = false;
    this.endedSinceLoad = true;
    this.onEnded?.();
  }

  private ensure(): boolean {
    if (this.proc || !this.available) return this.available;
    if (process.env.MATPLAY_NO_AUDIO === '1') {
      this.available = false;
      return false;
    }
    try {
      // NOTE: @F progress lines arrive on stderr, control replies on
      // stdout — ingest both streams into the same line parser.
      const child = spawn('mpg123', ['-R', '--remote-err'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.proc = child;
      child.on('error', () => {
        this.available = false;
        this.proc = undefined;
        this.onError?.('mpg123 could not start. Install mpg123 or ffplay.');
      });
      child.on('exit', () => {
        if (this.proc === child) {
          this.available = false;
          this.proc = undefined;
          this.playing = false;
        }
      });
      child.stdout?.on('data', (chunk: Buffer) => {
        this.ingest(chunk.toString('utf8'));
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        this.ingest(chunk.toString('utf8'));
      });
      return true;
    } catch {
      this.available = false;
      this.onError?.('mpg123 could not start. Install mpg123 or ffplay.');
      return false;
    }
  }

  async load(track: Track): Promise<void> {
    this.clearEndTimer();
    this.positionMs = 0;
    this.playing = false;
    this.endedSinceLoad = false;
    this.lastPath = track.audioPath;
    this.durationMs = track.durationMs;
    const tags = (async () => {
      try {
        const meta = await parseFile(track.audioPath, { duration: true });
        if (typeof meta.format.duration === 'number' && Number.isFinite(meta.format.duration)) {
          this.durationMs = Math.round(meta.format.duration * 1000);
        }
      } catch {
        // Duration arrives live from @F lines once playing.
      }
    })();
    if (!this.ensure()) {
      await tags;
      return;
    }
    this.expectStop = true;
    const acked = this.waitForLoadAck();
    if (!isSafeAudioPath(track.audioPath)) {
      this.flushLoadWaiters();
      await tags;
      this.onError?.('Refusing to load unsafe audio path.');
      return;
    }
    this.send(`LOADPAUSED ${track.audioPath}`);
    await Promise.all([tags, acked]);
  }

  /** Resolve when the decoder acknowledges the load (@P 1/@P 2). */
  private loadWaiters: Array<() => void> = [];

  private waitForLoadAck(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 2000);
      this.loadWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private flushLoadWaiters(): void {
    const waiters = this.loadWaiters;
    this.loadWaiters = [];
    for (const resolve of waiters) resolve();
  }

  async play(): Promise<void> {
    if (this.playing || !this.ensure()) return;
    if (this.endedSinceLoad) {
      // After natural EOF the decoder is spent; reload before resuming.
      this.endedSinceLoad = false;
      this.expectStop = true;
      if (this.lastPath && isSafeAudioPath(this.lastPath)) this.send(`LOADPAUSED ${this.lastPath}`);
    }
    this.send('PAUSE');
    this.playing = true;
    this.scheduleEnd();
  }

  async pause(): Promise<void> {
    if (!this.playing || !this.ensure()) return;
    this.send('PAUSE');
    this.playing = false;
    this.clearEndTimer();
  }

  async stop(): Promise<void> {
    this.clearEndTimer();
    this.positionMs = 0;
    this.playing = false;
    if (!this.ensure()) return;
    this.expectStop = true;
    this.send('STOP');
  }

  async seek(ms: number): Promise<void> {
    if (!Number.isFinite(ms)) return;
    const clamped = Math.min(this.durationMs ?? Number.MAX_SAFE_INTEGER, Math.max(0, ms));
    this.positionMs = clamped;
    if (!this.ensure()) return;
    if (this.endedSinceLoad) {
      // A spent decoder ignores JUMP: reload paused at the target, then
      // let play() resume from there.
      this.expectStop = true;
      if (this.lastPath && isSafeAudioPath(this.lastPath)) this.send(`LOADPAUSED ${this.lastPath}`);
      this.endedSinceLoad = false;
    }
    this.send(`JUMP ${(clamped / 1000).toFixed(2)}s`);
    this.scheduleEnd();
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.min(1, Math.max(0, volume));
    if (!this.ensure()) return;
    // Live command: no restart, no audible gap.
    this.send(`VOLUME ${Math.round(this.volume * 100)}`);
  }

  async getPosition(): Promise<number> {
    return this.positionMs;
  }

  async getDuration(): Promise<number | undefined> {
    return this.durationMs;
  }

  async destroy(): Promise<void> {
    this.clearEndTimer();
    this.playing = false;
    const child = this.proc;
    this.proc = undefined;
    if (child && !child.killed && child.exitCode === null) {
      try {
        child.kill('SIGKILL');
      } catch {
        // Already gone.
      }
    }
  }

  private send(command: string): void {
    const stdin = this.proc?.stdin;
    if (!stdin || stdin.destroyed) return;
    try {
      stdin.write(`${command}\n`);
    } catch {
      // Broken pipe: the exit handler marks us unavailable.
    }
  }

  private ingest(text: string): void {
    this.buffer += text;
    if (this.buffer.length > MAX_PROTOCOL_LINE) {
      // Malformed decoder output without newline: drop to bound memory.
      this.buffer = this.buffer.slice(-MAX_PROTOCOL_LINE);
    }
    const newlineIndex = this.buffer.lastIndexOf('\n');
    if (newlineIndex < 0) return;
    const complete = this.buffer.slice(0, newlineIndex);
    this.buffer = this.buffer.slice(newlineIndex + 1);
    for (const line of complete.split('\n')) {
      this.handleLine(line.trim());
    }
  }

  private handleLine(line: string): void {
    if (line.startsWith('@F ')) {
      const parts = line.slice(3).split(/\s+/);
      const elapsed = Number(parts[2]);
      const remaining = Number(parts[3]);
      if (Number.isFinite(elapsed)) {
        this.positionMs = Math.round(elapsed * 1000);
      }
      if (Number.isFinite(elapsed) && Number.isFinite(remaining)) {
        this.durationMs = Math.round((elapsed + remaining) * 1000);
        this.scheduleEnd();
      }
    } else if (line === '@P 2') {
      this.playing = true;
      this.endedSinceLoad = false;
      // A fresh play cycle disarms any stale stop expectation, so a later
      // natural EOF is reported instead of swallowed.
      this.expectStop = false;
      this.scheduleEnd();
      this.flushLoadWaiters();
    } else if (line === '@P 1') {
      this.playing = false;
      this.clearEndTimer();
      this.flushLoadWaiters();
    } else if (line === '@P 0') {
      const wasPlaying = this.playing;
      this.playing = false;
      const expected = this.expectStop;
      this.expectStop = false;
      if (wasPlaying && !expected) {
        this.playing = true;
        this.finishNaturally();
      }
    }
    // @P 3 (transient), @V/@J (acks), @S/@I/@T (info) need no action.
  }
}
