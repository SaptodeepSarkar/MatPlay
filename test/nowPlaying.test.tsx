import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { testRender } from '@opentui/react/test-utils';
import { stepViz, applySpectrum } from '../src/ui/visualizerEngine.js';

function musicFixture(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'matplay-app-'));
  const kalyani = path.join(root, 'Work', 'ARJN', 'KALYANI');
  mkdirSync(kalyani, { recursive: true });
  // Empty file: tags unparseable, so the folder-name fallback path is used.
  writeFileSync(path.join(kalyani, 'song.mp3'), '');
  writeFileSync(path.join(kalyani, 'song.lrc'), '[00:01.00] hello\n');
  const jupiter = path.join(root, 'Jupiter', 'SH3RWIN', 'LOUD');
  mkdirSync(jupiter, { recursive: true });
  writeFileSync(path.join(jupiter, 'track.mp3'), '');
  return root;
}

process.env.MATPLAY_MUSIC_ROOT = musicFixture();
const { App } = await import('../src/app/App.js');

describe('now playing mock', () => {
  it('renders the scanned queue with folder-name fallback', async () => {
    const setup = await testRender(<App />, { width: 100, height: 48 });
    await setup.renderOnce();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    const frame = setup.captureCharFrame();
    expect(frame).toContain('KALYANI');
    // Resume-paused: no autoplay on startup.
    expect(frame).toContain('PAUSED');
    expect(frame).toContain('ARJN');
    setup.renderer.destroy();
  });

  it('searches the library by title', async () => {
    const setup = await testRender(<App />, { width: 110, height: 50 });
    await setup.renderOnce();
    await setup.mockInput.pressKey('/');
    await new Promise((resolve) => setTimeout(resolve, 600));
    await setup.renderOnce();
    for (const character of ['k', 'a', 'l']) {
      await setup.mockInput.typeText(character);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await setup.renderOnce();
    }
    const frame = setup.captureCharFrame();
    expect(frame).toContain('1 match');
    expect(frame).toContain('kal');
    expect(frame).toContain('KALYANI');
    setup.renderer.destroy();
  });

  it('opens the wide spotDL workspace from settings', async () => {
    const setup = await testRender(<App />, { width: 110, height: 50 });
    await setup.renderOnce();
    await act(async () => {
      await setup.mockInput.pressKey('s');
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    await setup.renderOnce();
    for (let index = 0; index < 5; index++) {
      await act(async () => {
        setup.mockInput.pressArrow('down');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      await setup.renderOnce();
    }
    await act(async () => {
      setup.mockInput.pressEnter();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain('SPOTDL LIBRARY');
    expect(frame).toContain('QUERY / SPOTIFY URL');
    expect(frame).toContain('LOCAL PLAYLIST');
    expect(frame).toContain('KEEP LOCAL (SAFE)');
    setup.renderer.destroy();
  });

  it('shows the SYNC NOW row in settings', async () => {
    const setup = await testRender(<App />, { width: 110, height: 50 });
    await setup.renderOnce();
    await act(async () => {
      await setup.mockInput.pressKey('s');
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    for (let index = 0; index < 6; index++) {
      await act(async () => {
        setup.mockInput.pressArrow('down');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      await setup.renderOnce();
    }
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain('SYNC NOW');
    setup.renderer.destroy();
  });

  it('warns before quitting during a download', async () => {
    const spotdl = await import('../src/download/spotdl.js');
    const runSpotdlSpy = vi.spyOn(spotdl, 'runSpotdl').mockReturnValue(new Promise(() => {}));
    const setup = await testRender(<App />, { width: 110, height: 50 });
    await setup.renderOnce();
    await act(async () => {
      await setup.mockInput.pressKey('s');
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    await setup.renderOnce();
    for (let index = 0; index < 6; index++) {
      await act(async () => {
        setup.mockInput.pressArrow('down');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      await setup.renderOnce();
    }
    await act(async () => {
      setup.mockInput.pressEnter();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    await setup.renderOnce();
    for (let index = 0; index < 4; index++) {
      await act(async () => {
        setup.mockInput.pressArrow('down');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      await setup.renderOnce();
    }
    await act(async () => {
      setup.mockInput.pressEnter();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    await setup.renderOnce();
    await act(async () => {
      setup.mockInput.pressKey('q');
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain('DOWNLOAD OR SYNC IS STILL RUNNING');
    runSpotdlSpy.mockRestore();
    setup.renderer.destroy();
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
