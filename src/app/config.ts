import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

const ConfigSchema = z.object({
  /** Main music folder: playlist / artist / song / song.mp3. */
  musicRoot: z.string().min(1),
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
  theme: z.enum(['dark', 'light']).default('dark'),
  /** Reserved for a future manual accent override. */
  accentColor: z.string().default('#BB86FC'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function defaultConfig(): AppConfig {
  return {
    musicRoot: path.join(os.homedir(), 'Music', 'Spotify'),
    volume: 0.62,
    vizGain: 1.6,
    vizMaxHeight: 0.92,
    theme: 'dark',
    accentColor: '#BB86FC',
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
    return ConfigSchema.parse({ ...defaultConfig(), ...(typeof raw === 'object' && raw !== null ? raw : {}) });
  } catch {
    return defaultConfig();
  }
}

/** Persist config. Best-effort: the player works without a writable home. */
export function saveConfig(config: AppConfig): void {
  try {
    mkdirSync(configDir(), { recursive: true });
    writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`);
  } catch {
    // Ignore: config is a convenience, not a requirement.
  }
}
