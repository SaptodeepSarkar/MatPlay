import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { AlexaConfigSchema } from '../alexa/types.js';

const ConfigSchema = z.object({
  /** Main music folder: playlist / artist / song / song.mp3. Must be absolute. */
  musicRoot: z.string().min(1).refine((v) => path.isAbsolute(v), {
    message: 'musicRoot must be an absolute path',
  }),
  /** 0..1, restored on startup. */
  volume: z.number().min(0).max(1),
  /** Spectrum amplification applied before bar mapping. */
  vizGain: z.number().min(0.2).max(4),
  /** Fraction of the screen height bars may never exceed. */
  vizMaxHeight: z.number().min(0.2).max(1),
  /** Resume state: last open playlist and track. */
  lastPlaylist: z.string().optional(),
  lastTrackId: z.string().optional(),
  /** Reserved for a future manual theme override. */
  theme: z.enum(['cover', 'light']).default('cover'),
  /** Reserved for a future manual accent override. */
  accentColor: z.union([z.literal('auto'), z.string().regex(/^#[0-9a-fA-F]{6}$/)]).default('auto'),
  /** Detachable Alexa hybrid (alexa-remote2, no SmartHome skill). Off = never loaded. */
  alexa: AlexaConfigSchema.default({}),
  /** Local cast server: MatPlay serves its own MP3s so Echo needs no Spotify. */
  cast: z.object({
    enabled: z.boolean().default(false),
    port: z.number().min(1024).max(65535).default(8173),
    /** false = loopback only; true = LAN with token auth (explicit opt-in). */
    lan: z.boolean().default(false),
    token: z.string().min(16).max(256).default('matplay-local-cast-token-change-me'),
  }).default({ enabled: false, port: 8173, lan: false, token: 'matplay-local-cast-token-change-me' }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function defaultConfig(): AppConfig {
  return {
    musicRoot: path.join(os.homedir(), 'Music', 'Spotify'),
    volume: 0.62,
    vizGain: 1.6,
    vizMaxHeight: 0.92,
    theme: 'cover',
    accentColor: 'auto',
    alexa: {
      enabled: false,
      device: '',
      amazonPage: 'amazon.com',
      mirrorToEcho: true,
      bluetoothMac: '',
    },
    cast: {
      enabled: false,
      port: 8173,
      lan: false,
      token: 'matplay-local-cast-token-change-me',
    },
  };
}

export function configDir(): string {
  if (process.platform === 'win32') {
    const roaming = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(roaming, 'matplay');
  }
  const base = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(base, 'matplay');
}

export function configPath(): string {
  return path.join(configDir(), 'config.json');
}

export function configExists(): boolean {
  return existsSync(configPath());
}

/** Load config, merging over defaults so new keys survive old files. */
export function loadConfig(): AppConfig {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as unknown;
    const migrated = typeof raw === 'object' && raw !== null
      ? { ...raw as Record<string, unknown> }
      : {};
    // The original settings implementation wrote these fixed defaults even
    // though MatPlay was intended to follow cover art. Treat them as legacy
    // values; users can still select explicit colors from Settings.
    if (migrated.theme === 'dark') migrated.theme = 'cover';
    if (migrated.accentColor === '#BB86FC') migrated.accentColor = 'auto';
    return ConfigSchema.parse({ ...defaultConfig(), ...migrated });
  } catch {
    return defaultConfig();
  }
}

/** Persist config atomically (tmp + rename) with 0600 perms. Best-effort. */
export function saveConfig(config: AppConfig): void {
  try {
    mkdirSync(configDir(), { recursive: true, mode: 0o700 });
    const target = configPath();
    const tmp = `${target}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, target);
  } catch {
    // Ignore: config is a convenience, not a requirement.
  }
}
