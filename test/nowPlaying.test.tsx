import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { testRender } from '@opentui/react/test-utils';
import { stepViz, applySpectrum } from '../src/ui/visualizerEngine.js';

function musicFixture(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'matplay-app-'));
  const song = path.join(root, 'Work', 'ARJN', 'KALYANI');
  mkdirSync(song, { recursive: true });
  // Empty file: tags unparseable, so the folder-name fallback path is used.
  writeFileSync(path.join(song, 'song.mp3'), '');
  writeFileSync(path.join(song, 'song.lrc'), '[00:01.00] hello\n');
  return root;
}

describe('now playing mock', () => {
  it('renders the scanned queue with folder-name fallback', async () => {
    process.env.MATPLAY_MUSIC_ROOT = musicFixture();
    const { App } = await import('../src/app/App.js');
    const setup = await testRender(<App />, { width: 100, height: 48 });
    await setup.renderOnce();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    const frame = setup.captureCharFrame();
    expect(frame).toContain('KALYANI');
    expect(frame).toContain('PLAYING');
    expect(frame).toContain('ARJN');
    setup.renderer.destroy();
    delete process.env.MATPLAY_MUSIC_ROOT;
  });
});

describe('visualizer engine', () => {
  it('keeps procedural levels bounded with peaks above levels', () => {
    let state = stepViz({ levels: [], peaks: [] }, 32, 1.0, true);
    for (let t = 2; t < 20; t++) {
      state = stepViz(state, 32, t, true);
    }
    expect(state.levels).toHaveLength(32);
    for (const level of state.levels) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
    for (let i = 0; i < 32; i++) {
      expect(state.peaks[i]).toBeGreaterThanOrEqual(state.levels[i] ?? 0);
    }
  });

  it('folds live analyzer output into columns with perceptual curve', () => {
    const raw = [0, 0.04, 0.16, 0.64, 1.0, 0.25];
    const state = applySpectrum({ levels: [], peaks: [] }, raw, 3);
    expect(state.levels).toHaveLength(3);
    expect(state.levels[0] ?? 0).toBeCloseTo(Math.sqrt(0.02), 5);
    expect(state.levels[1] ?? 0).toBeCloseTo(Math.sqrt(0.4), 5);
    expect(state.levels[2] ?? 0).toBeCloseTo(Math.sqrt(0.625), 5);
    for (let i = 0; i < 3; i++) {
      expect(state.peaks[i]).toBeGreaterThanOrEqual(state.levels[i] ?? 0);
    }
  });
});
