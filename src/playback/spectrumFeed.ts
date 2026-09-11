import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { closeSync, existsSync, openSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function spectrumFifoPath(): string {
  return path.join(os.tmpdir(), 'matplay-cava.fifo');
}

/**
 * Private audio feed for the visualizer: decodes only MatPlay's current
 * track into the cava FIFO. Unlike monitor tapping, desktop audio (Zen,
 * notifications, other players) never reaches the bars.
 *
 * The FIFO is opened O_RDWR so neither side blocks on open; when cava is
 * not draining, pipe backpressure stalls the decoder instead of buffering.
 */
export class SpectrumFeed {
  private proc: ChildProcess | undefined;
  private fd: number | undefined;

  /** Create the FIFO if possible. False on platforms without `mkfifo`. */
  static ensureFifo(fifoPath = spectrumFifoPath()): boolean {
    try {
      if (existsSync(fifoPath)) return true;
      execFileSync('mkfifo', [fifoPath], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  get active(): boolean {
    return this.proc !== undefined && !this.proc.killed && this.proc.exitCode === null;
  }

  start(audioPath: string, offsetSec: number): void {
    this.stop();
    if (process.env.MATPLAY_NO_AUDIO === '1') return;
    const fifo = spectrumFifoPath();
    let fd: number;
    try {
      if (!existsSync(fifo)) return;
      fd = openSync(fifo, 'r+');
    } catch {
      return;
    }
    try {
      const child = spawn(
        'ffmpeg',
        [
          '-v', 'error',
          // Realtime pacing: without -re the decoder dumps the whole
          // track in seconds, cava eats it instantly, and the bars die.
          '-re',
          '-ss', Math.max(0, offsetSec).toFixed(2),
          '-i', audioPath,
          '-map', '0:a',
          '-ac', '2',
          '-ar', '44100',
          '-f', 's16le',
          '-',
        ],
        { stdio: ['ignore', fd, 'ignore'] },
      );
      this.proc = child;
      this.fd = fd;
      const cleanup = (): void => {
        if (this.proc === child) this.proc = undefined;
        if (this.fd === fd) {
          try {
            closeSync(fd);
          } catch {
            // Already closed.
          }
          this.fd = undefined;
        }
      };
      child.on('error', cleanup);
      child.on('exit', cleanup);
    } catch {
      try {
        closeSync(fd);
      } catch {
        // Ignore.
      }
    }
  }

  stop(): void {
    const child = this.proc;
    this.proc = undefined;
    if (child && !child.killed && child.exitCode === null) {
      try {
        child.kill('SIGKILL');
      } catch {
        // Already gone.
      }
    }
    if (this.fd !== undefined) {
      try {
        closeSync(this.fd);
      } catch {
        // Already closed.
      }
      this.fd = undefined;
    }
  }
}
