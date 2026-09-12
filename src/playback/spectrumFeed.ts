import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { constants } from 'node:fs';
import { hasProtocolBreakers } from '../security/sanitize.js';

function fifoBaseDir(): string {
  // Per-user runtime dir first (0700, no cross-user snooping), tmp fallback.
  const runtime = process.env.XDG_RUNTIME_DIR;
  if (runtime) return path.join(runtime, `matplay-${process.getuid?.() ?? 'u'}`);
  const tmp = path.join(os.tmpdir(), `matplay-${process.getuid?.() ?? process.pid}`);
  return tmp;
}

export function spectrumFifoPath(): string {
  return path.join(fifoBaseDir(), 'cava.fifo');
}

/** True only for an owned FIFO (no symlink, no regular file, no foreign owner). */
function isOwnedFifo(fifoPath: string): boolean {
  try {
    const st = lstatSync(fifoPath);
    if (!st.isFIFO()) return false;
    if (typeof st.uid === 'number' && typeof process.getuid === 'function') {
      if (st.uid !== process.getuid()) return false;
    }
    return true;
  } catch {
    return false;
  }
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
      if (hasProtocolBreakers(fifoPath)) return false;
      try {
        mkdirSync(path.dirname(fifoPath), { recursive: true, mode: 0o700 });
      } catch {
        // Continue; mkfifo/open will fail closed below.
      }
      if (existsSync(fifoPath)) return isOwnedFifo(fifoPath);
      execFileSync('mkfifo', ['--', fifoPath], { stdio: 'ignore' });
      return isOwnedFifo(fifoPath);
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
    if (hasProtocolBreakers(audioPath)) return;
    const fifo = spectrumFifoPath();
    if (!isOwnedFifo(fifo)) return;
    let fd: number;
    try {
      // O_NOFOLLOW closes the symlink-swap TOCTOU; fstat re-verifies FIFO.
      fd = openSync(fifo, constants.O_RDWR | constants.O_NOFOLLOW);
      if (!fstatSync(fd).isFIFO()) {
        try { closeSync(fd); } catch { /* ignore */ }
        return;
      }
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
