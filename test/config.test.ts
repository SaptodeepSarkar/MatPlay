import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultConfig, loadConfig, saveConfig } from '../src/app/config.js';

describe('config', () => {
  it('round-trips through an isolated config home', () => {
    process.env.XDG_CONFIG_HOME = mkdtempSync(path.join(os.tmpdir(), 'matplay-cfg-'));
    const config = {
      ...defaultConfig(),
      musicRoot: '/music',
      volume: 0.3,
      vizGain: 2.2,
      vizMaxHeight: 0.7,
      lastTrackId: 'abc123',
    };
    saveConfig(config);
    expect(loadConfig()).toEqual(config);
    delete process.env.XDG_CONFIG_HOME;
  });

  it('falls back to defaults on corrupt files', () => {
    expect(loadConfig().musicRoot).toContain('Spotify');
  });
});
