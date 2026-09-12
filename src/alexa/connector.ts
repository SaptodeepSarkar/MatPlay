import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { configDir } from '../app/config.js';
import { describeDevices, pickMusicDevice, type AlexaDeviceInfo } from './devices.js';
import type {
  AlexaConfig,
  AlexaRemoteAction,
  AlexaStatus,
} from './types.js';

const CookieSchema = z.object({}).passthrough();

function persistCookieAtomic(cookieFile: string, data: unknown): void {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  try {
    const st = lstatSync(cookieFile);
    if (st.isSymbolicLink()) return;
  } catch {
    // No existing file; proceed.
  }
  const tmp = `${cookieFile}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, cookieFile);
}

export type AlexaConnectorOptions = {
  config: AlexaConfig;
  onStatus?: (status: AlexaStatus) => void;
};

type AlexaRemoteInstance = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, listener: (...args: any[]) => void) => void;
  removeAllListeners: (event?: string) => void;
  init: (options: unknown, cb: (err?: Error) => void) => void;
  stop: () => void;
  sendCommand: (
    device: unknown,
    command: string,
    value: unknown,
    cb: (err?: Error) => void,
  ) => void;
  find: (name: string) => unknown;
  serialNumbers: Record<
    string,
    {
      accountName?: string;
      deviceFamily?: string;
      online?: boolean;
      hasMusicPlayer?: boolean;
    }
  >;
  cookieData?: unknown;
};

/**
 * Outbound-only Alexa remote — MatPlay drives the Echo, never the reverse.
 *
 * OUTBOUND: remoteAction() sends pause/stop/volume to the Echo via
 *   alexa-remote2 sendCommand (same endpoint the Alexa app uses), purely to
 *   silence competing audio when MatPlay plays over the private Bluetooth
 *   link. play/next/previous are never forwarded (wrong-content hijack).
 * INBOUND: removed. No voice-history polling, no utterance replay. Alexa
 *   cannot control the MatPlay stream, by design.
 *
 * Lifecycle: construction does NOTHING (no imports, no sockets).
 * start() dynamically imports alexa-remote2, so when disabled the heavy
 * dependency is never loaded and GC can reclaim everything on dispose().
 */
export class AlexaConnector {
  private alexa: AlexaRemoteInstance | undefined;
  private disposed = false;
  private status: AlexaStatus = { state: 'off' };

  constructor(private readonly options: AlexaConnectorOptions) {}

  get snapshot(): AlexaStatus {
    return { ...this.status };
  }

  static cookiePath(): string {
    return path.join(configDir(), 'alexa-cookie.json');
  }

  private setStatus(patch: Partial<AlexaStatus> & { state: AlexaStatus['state'] }): void {
    this.status = { ...this.status, ...patch };
    try {
      this.options.onStatus?.({ ...this.status });
    } catch {
      // Status listeners must never break playback.
    }
  }

  /**
   * OUTBOUND: silence the Echo's current source (usually Spotify) so it
   * doesn't compete with MatPlay's private Bluetooth audio. Only
   * pause/stop/volume are meaningful here; play/next/previous are dropped
   * to prevent driving the Echo's own queue with the wrong content.
   */
  remoteAction(action: AlexaRemoteAction, value: unknown = true): void {
    if (action !== 'pause' && action !== 'stop') return;
    const alexa = this.alexa;
    if (!alexa || this.status.state !== 'ready') return;
    const target = this.resolveTarget(alexa);
    if (!target) return;
    const command = action === 'stop' ? 'pause' : action;
    try {
      alexa.sendCommand(target, command, value, () => undefined);
    } catch {
      // Best-effort remote; local playback is authoritative.
    }
  }

  remoteVolume(level0to100: number): void {
    const alexa = this.alexa;
    if (!alexa || this.status.state !== 'ready') return;
    const target = this.resolveTarget(alexa);
    if (!target) return;
    try {
      alexa.sendCommand(target, 'volume', Math.max(0, Math.min(100, Math.round(level0to100))), () => undefined);
    } catch {
      // Ignore.
    }
  }

  async start(): Promise<void> {
    if (this.disposed || this.alexa) return;
    this.setStatus({ state: 'starting', detail: 'loading alexa-remote2' });
    let mod: { default: new () => AlexaRemoteInstance };
    try {
      // Dynamic import = zero cost when Settings > ALEXA is OFF.
      // Cast through unknown: alexa-remote2 ships loose .d.ts types that
      // we narrow to just the surface this connector uses.
      mod = (await import('alexa-remote2')) as unknown as {
        default: new () => AlexaRemoteInstance;
      };
    } catch (error) {
      this.setStatus({
        state: 'error',
        detail: error instanceof Error ? error.message : 'install with: npm i alexa-remote2',
      });
      return;
    }
    if (this.disposed) return;
    const cookieFile = AlexaConnector.cookiePath();
    let cookie: unknown;
    try {
      if (existsSync(cookieFile)) {
        if (lstatSync(cookieFile).isSymbolicLink()) {
          this.setStatus({ state: 'error', detail: 'cookie path is a symlink; refusing to read' });
          return;
        }
        const parsed: unknown = JSON.parse(readFileSync(cookieFile, 'utf8'));
        const validated = CookieSchema.safeParse(parsed);
        cookie = validated.success ? validated.data : undefined;
      }
    } catch {
      cookie = undefined;
    }
    if (!cookie) {
      this.setStatus({
        state: 'needs-login',
        detail: `no cookie — run: npx alexa-cookie2 proxy, then save to ${cookieFile}`,
      });
      return;
    }
    const alexa = new mod.default();
    this.alexa = alexa;
    try {
      alexa.on('cookie', () => {
        try {
          persistCookieAtomic(cookieFile, alexa.cookieData ?? cookie);
        } catch {
          // Persist is best-effort.
        }
      });
    } catch {
      // Older builds may not emit cookie; continue.
    }
    const { amazonPage } = this.options.config;
    await new Promise<void>((resolve) => {
      try {
        alexa.init(
          {
            cookie,
            amazonPage,
            usePushConnection: true,
            autoQueryActivityOnTrigger: false,
            cookieRefreshInterval: 4 * 24 * 60 * 60 * 1000,
          },
          (err?: Error) => {
            if (err) {
              this.setStatus({ state: 'needs-login', detail: err.message });
              resolve();
              return;
            }
            const devices = AlexaConnector.readDevices(alexa);
            const target = pickMusicDevice(devices, this.options.config.device);
            const detail = describeDevices(devices, target);
            this.setStatus({ state: 'ready', detail, deviceCount: devices.filter((d) => d.music).length });
            resolve();
          },
        );
      } catch (error) {
        this.setStatus({
          state: 'error',
          detail: error instanceof Error ? error.message : String(error),
        });
        resolve();
      }
    });
    if (this.disposed) {
      this.teardown();
    }
  }

  /** Speakers-only view of Amazon's mixed device list (apps/phones excluded). */
  static readDevices(alexa: AlexaRemoteInstance): AlexaDeviceInfo[] {
    return Object.entries(alexa.serialNumbers ?? {}).map(([serial, d]) => ({
      serial,
      name: d.accountName ?? serial,
      family: d.deviceFamily,
      online: d.online ?? false,
      music: d.hasMusicPlayer ?? false,
    }));
  }

  private resolveTarget(alexa: AlexaRemoteInstance): unknown {
    const target = pickMusicDevice(
      AlexaConnector.readDevices(alexa),
      this.options.config.device,
    );
    if (!target) return undefined;
    try {
      return alexa.find(target.serial) ?? alexa.find(target.name) ?? target.serial;
    } catch {
      return target.serial;
    }
  }

  private teardown(): void {
    try {
      this.alexa?.removeAllListeners();
    } catch {
      // Ignore.
    }
    try {
      this.alexa?.stop();
    } catch {
      // Ignore.
    }
    this.alexa = undefined;
  }

  /** Idempotent. After dispose the instance must not be restarted. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.teardown();
    this.setStatus({ state: 'off' });
  }
}
