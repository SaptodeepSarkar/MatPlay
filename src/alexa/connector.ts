import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { configDir } from '../app/config.js';
import { parseAlexaMatplayCommand } from './commandParser.js';
import type {
  AlexaConfig,
  AlexaRemoteAction,
  AlexaStatus,
  AlexaTransport,
} from './types.js';

export type AlexaConnectorOptions = {
  config: AlexaConfig;
  transport: AlexaTransport;
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
  getCustomerHistoryRecords: (
    options: unknown,
    cb: (err?: Error, body?: unknown) => void,
  ) => void;
  find: (name: string) => unknown;
  serialNumbers: Record<string, { accountName?: string }>;
  cookieData?: unknown;
};

type HistoryRecord = {
  utteranceId?: string;
  summary?: string;
  voiceHistoryRecord?: { summary?: string; utteranceId?: string };
  creationTimestamp?: number;
};

/**
 * Detachable hybrid connector — no SmartHome skill, no Lambda.
 *
 * OUTBOUND: remoteAction() sends play/pause/next/previous/stop to the Echo
 *   via alexa-remote2 sendCommand (same endpoint the Alexa app uses).
 * INBOUND: polls getCustomerHistoryRecords for utterances containing
 *   "matplay" and replays them into the local transport.
 *
 * Lifecycle: construction does NOTHING (no imports, no sockets).
 * start() dynamically imports alexa-remote2, so when disabled the heavy
 * dependency is never loaded and GC can reclaim everything on dispose().
 */
export class AlexaConnector {
  private alexa: AlexaRemoteInstance | undefined;
  private pollTimer: NodeJS.Timeout | undefined;
  private seenUtterances = new Set<string>();
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

  /** OUTBOUND: drive the Echo from MatPlay (space/n/p mirror). */
  remoteAction(action: AlexaRemoteAction, value: unknown = true): void {
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
        cookie = JSON.parse(readFileSync(cookieFile, 'utf8')) as unknown;
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
          mkdirSync(configDir(), { recursive: true });
          writeFileSync(cookieFile, `${JSON.stringify(alexa.cookieData ?? cookie, null, 2)}\n`);
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
            const count = Object.keys(alexa.serialNumbers ?? {}).length;
            this.setStatus({ state: 'ready', detail: `${count} echo(s)`, deviceCount: count });
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
      return;
    }
    if (this.status.state === 'ready' && this.options.config.respondToVoice) {
      this.beginPolling();
    }
  }

  private resolveTarget(alexa: AlexaRemoteInstance): unknown {
    const want = this.options.config.device.trim();
    if (want) {
      try {
        const found = alexa.find(want);
        if (found) return found;
      } catch {
        // Fall through to first device.
      }
    }
    const serials = Object.keys(alexa.serialNumbers ?? {});
    return serials[0] ? alexa.find(serials[0]) ?? serials[0] : undefined;
  }

  private beginPolling(): void {
    this.stopPolling();
    const pollOnce = (): void => {
      if (this.disposed || this.status.state !== 'ready') return;
      const alexa = this.alexa;
      if (!alexa) return;
      const now = Date.now();
      try {
        alexa.getCustomerHistoryRecords(
          {
            startTime: now - 60_000,
            endTime: now,
            recordType: 'VOICE_HISTORY',
            maxRecordSize: 10,
          },
          (err?: Error, body?: unknown) => {
            if (err || this.disposed) return;
            this.handleHistory(body);
          },
        );
      } catch {
        // Poll failures are routine (rate limits); next tick retries.
      }
    };
    pollOnce();
    this.pollTimer = setInterval(pollOnce, this.options.config.pollMs);
    if (typeof this.pollTimer === 'object' && 'unref' in this.pollTimer) {
      (this.pollTimer as NodeJS.Timeout).unref?.();
    }
  }

  private handleHistory(body: unknown): void {
    const records = extractRecords(body);
    for (const record of records) {
      const text = record.summary ?? record.voiceHistoryRecord?.summary ?? '';
      const id =
        record.utteranceId ?? record.voiceHistoryRecord?.utteranceId ?? `${record.creationTimestamp ?? 0}:${text}`;
      if (!text || this.seenUtterances.has(id)) continue;
      this.seenUtterances.add(id);
      if (this.seenUtterances.size > 200) {
        const first = this.seenUtterances.values().next().value;
        if (first !== undefined) this.seenUtterances.delete(first);
      }
      const action = parseAlexaMatplayCommand(text);
      if (!action) continue;
      this.setStatus({ state: 'ready', lastVoiceText: text, lastVoiceAt: Date.now() });
      applyToTransport(this.options.transport, action);
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private teardown(): void {
    this.stopPolling();
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
    this.seenUtterances.clear();
  }

  /** Idempotent. After dispose the instance must not be restarted. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.teardown();
    this.setStatus({ state: 'off' });
  }
}

function extractRecords(body: unknown): HistoryRecord[] {
  if (!body || typeof body !== 'object') return [];
  const root = body as Record<string, unknown>;
  const candidates = [
    root.customerHistoryRecords,
    root.history,
    root.records,
    (root.data as Record<string, unknown> | undefined)?.customerHistoryRecords,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as HistoryRecord[];
  }
  return [];
}

function applyToTransport(transport: AlexaTransport, action: AlexaRemoteAction | 'toggle'): void {
  switch (action) {
    case 'play':
      transport.play();
      break;
    case 'pause':
      transport.pause();
      break;
    case 'toggle':
      transport.toggle();
      break;
    case 'next':
      transport.next();
      break;
    case 'previous':
      transport.previous();
      break;
    case 'stop':
      transport.stop();
      break;
  }
}
