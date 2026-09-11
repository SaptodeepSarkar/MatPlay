import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type SpectrumListener = (levels: number[]) => void;

export type CavaSpectrumOptions = {
  /** Bars per frame. Resampled to the UI width downstream. */
  bars?: number;
  /** Frames per second requested from cava. */
  framerate?: number;
  /** `pulse` taps the live monitor; `fifo` decodes a fixed source. */
  inputMethod?: 'pulse' | 'fifo';
  /** FIFO path when `inputMethod` is `fifo`. */
  fifoPath?: string;
};

const DEFAULT_BARS = 48;

/**
 * Live spectrum data from `cava` in raw-ASCII mode.
 *
 * Default `pulse` mode taps the default sink monitor, so the bars show
 * what is actually audible: they dance while sound plays and fall flat
 * on pause with zero sync code. `fifo` mode decodes a fixed source and
 * is used for headless verification.
 */
export class CavaSpectrum {
  readonly bars: number;
  private readonly options: Required<Omit<CavaSpectrumOptions, 'fifoPath'>> &
    Pick<CavaSpectrumOptions, 'fifoPath'>;
  private proc: ChildProcess | undefined;
  private buffer = '';
  private listeners = new Set<SpectrumListener>();
  private started = false;

  constructor(options: CavaSpectrumOptions = {}) {
    this.bars = options.bars ?? DEFAULT_BARS;
    this.options = {
      bars: this.bars,
      framerate: options.framerate ?? 30,
      inputMethod: options.inputMethod ?? 'pulse',
      fifoPath: options.fifoPath,
    };
  }

  onLevels(listener: SpectrumListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): boolean {
    if (this.started) return true;
    const config = [
      '[general]',
      `framerate = ${this.options.framerate}`,
      `bars = ${this.options.bars}`,
      '',
      '[input]',
      `method = ${this.options.inputMethod}`,
      'sensitivity = 100',
      'autosens = 1',
      ...(this.options.inputMethod === 'fifo'
        ? [
            `source = ${this.options.fifoPath ?? '/tmp/cava.fifo'}`,
            'sample_rate = 44100',
            'channels = 2',
          ]
        : ['source = auto']),
      '',
      '[output]',
      'method = raw',
      'raw_target = /dev/stdout',
      'data_format = ascii',
      'ascii_max_range = 100',
      'bar_delimiter = 59',
      'frame_delimiter = 10',
      '',
    ].join('\n');

    let configPath: string;
    try {
      const dir = mkdtempSync(path.join(os.tmpdir(), 'matplay-cava-'));
      configPath = path.join(dir, 'config');
      writeFileSync(configPath, config);
    } catch {
      return false;
    }

    try {
      const child = spawn('cava', ['-p', configPath], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      this.proc = child;
      this.started = true;
      child.on('error', () => {
        this.started = false;
        this.proc = undefined;
      });
      child.on('exit', () => {
        if (this.proc === child) {
          this.started = false;
          this.proc = undefined;
        }
      });
      child.stdout?.on('data', (chunk: Buffer) => {
        this.ingest(chunk.toString('utf8'));
      });
      return true;
    } catch {
      this.started = false;
      return false;
    }
  }

  stop(): void {
    const child = this.proc;
    this.proc = undefined;
    this.started = false;
    if (child && !child.killed && child.exitCode === null) {
      try {
        child.kill('SIGKILL');
      } catch {
        // Already gone.
      }
    }
  }

  private ingest(text: string): void {
    this.buffer += text;
    const newlineIndex = this.buffer.lastIndexOf('\n');
    if (newlineIndex < 0) return;
    const complete = this.buffer.slice(0, newlineIndex);
    this.buffer = this.buffer.slice(newlineIndex + 1);
    const lines = complete.split('\n');
    const last = lines[lines.length - 1] ?? '';
    const values = last
      .split(';')
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.min(1, Math.max(0, value / 100)));
    if (values.length === 0) return;
    for (const listener of this.listeners) {
      listener(values);
    }
  }
}
