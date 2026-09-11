import { spawn, type ChildProcess } from 'node:child_process';
import { parseFile } from 'music-metadata';
import type { Track } from '../library/types.js';
import type { AudioBackend } from './AudioBackend.js';

/**
 * Audible playback via an `ffplay` child process (ships with ffmpeg).
 *
 * Honest limitations of this adapter, to be fixed by an mpv-IPC backend:
 * - Position is a local timer, not queried from the decoder (~tens of ms
 *   of seek granularity on MP3).
 * - Volume changes restart the process, so stepping volume has a brief
 *   gap. Runtime volume needs mpv (`set_property volume` over IPC).
 * - If `ffplay` is missing or has no audio device, playback silently
 *   degrades to timer-only mode: the UI keeps working, there is no sound.
 */
export class FfplayBackend implements AudioBackend {
  onEnded: (() => void) | undefined;

  private proc: ChildProcess | undefined;
  private killedByUs = false;
  private available = true;
  private currentPath: string | undefined;
  private baseMs = 0;
  private startedAt = 0;
  private playing = false;
  private durationMs: number | undefined;
  private volume = 0.62;

  get isOutputAvailable(): boolean {
    return this.available;
  }

  async load(track: Track): Promise<void> {
    this.stopProcess();
    this.currentPath = track.audioPath;
    this.baseMs = 0;
    this.playing = false;
    this.durationMs = track.durationMs;
    try {
      const meta = await parseFile(track.audioPath, { duration: true });
      if (typeof meta.format.duration === 'number' && Number.isFinite(meta.format.duration)) {
        this.durationMs = Math.round(meta.format.duration * 1000);
      }
    } catch {
      // Keep duration unknown; the UI falls back to folder metadata.
    }
  }

  async play(): Promise<void> {
    if (!this.currentPath || this.playing) return;
    this.startProcess(this.baseMs);
  }

  async pause(): Promise<void> {
    if (!this.playing) return;
    this.baseMs = this.readPosition();
    this.playing = false;
    this.stopProcess();
  }

  async stop(): Promise<void> {
    this.baseMs = 0;
    this.playing = false;
    this.stopProcess();
  }

  async seek(ms: number): Promise<void> {
    this.baseMs = Math.max(0, ms);
    if (this.playing) {
      this.startProcess(this.baseMs);
    }
  }

  async setVolume(volume: number): Promise<void> {
    const clamped = Math.min(1, Math.max(0, volume));
    const changed = clamped !== this.volume;
    this.volume = clamped;
    // ffplay has no runtime volume control: restart so the change is
    // audible immediately instead of silently waiting for the next track.
    if (changed && this.playing) {
      this.baseMs = this.readPosition();
      this.startProcess(this.baseMs);
    }
  }

  async getPosition(): Promise<number> {
    return this.readPosition();
  }

  async getDuration(): Promise<number | undefined> {
    return this.durationMs;
  }

  async destroy(): Promise<void> {
    this.playing = false;
    this.stopProcess();
  }

  private readPosition(): number {
    if (!this.playing) return this.baseMs;
    return this.baseMs + (Date.now() - this.startedAt);
  }

  private startProcess(offsetMs: number): void {
    if (!this.currentPath) return;
    this.stopProcess();
    // Test harness and headless runs: never spawn real audio output.
    if (process.env.MATPLAY_NO_AUDIO === '1') {
      this.startedAt = Date.now();
      this.playing = true;
      return;
    }
    this.killedByUs = false;
    const offsetSec = Math.max(0, offsetMs / 1000).toFixed(2);
    const child = spawn('ffplay', [
      '-nodisp',
      '-autoexit',
      '-loglevel', 'error',
      '-ss', offsetSec,
      '-volume', String(Math.round(this.volume * 100)),
      '-i', this.currentPath,
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
    this.proc = child;
    this.startedAt = Date.now();
    this.playing = true;
    child.on('error', () => {
      // ffplay missing: degrade to silent timer mode.
      this.available = false;
      this.proc = undefined;
    });
    child.on('exit', () => {
      if (this.proc !== child) return;
      this.proc = undefined;
      if (this.playing && !this.killedByUs) {
        this.playing = false;
        this.baseMs = this.durationMs ?? this.baseMs;
        this.onEnded?.();
      }
    });
  }

  private stopProcess(): void {
    const child = this.proc;
    this.proc = undefined;
    if (child && !child.killed && child.exitCode === null) {
      this.killedByUs = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // Already gone; nothing to do.
      }
    }
  }
}
