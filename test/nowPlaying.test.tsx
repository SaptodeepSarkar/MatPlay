import { describe, expect, it } from 'vitest';
import React from 'react';
import { testRender } from '@opentui/react/test-utils';
import { App } from '../src/app/App.js';
import { stepViz } from '../src/ui/visualizerEngine.js';

describe('now playing mock', () => {
  it('renders the Kalyani track card', async () => {
    const setup = await testRender(<App />, { width: 100, height: 48 });
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain('KALYANI');
    expect(frame).toContain('PLAYING');
    expect(frame).toContain('04:20');
    setup.renderer.destroy();
  });
});

describe('visualizer engine', () => {
  it('keeps levels and peaks bounded and in sync', () => {
    let state = stepViz({ levels: [], peaks: [] }, 32, 1.0, true);
    for (let t = 2; t < 20; t++) {
      state = stepViz(state, 32, t, true);
    }
    expect(state.levels).toHaveLength(32);
    expect(state.peaks).toHaveLength(32);
    for (const level of state.levels) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
    for (let i = 0; i < 32; i++) {
      expect(state.peaks[i]).toBeGreaterThanOrEqual(state.levels[i] ?? 0);
    }
  });

  it('idles near zero when paused', () => {
    const state = stepViz(
      {
        levels: Array.from({ length: 16 }, () => 0.9),
        peaks: Array.from({ length: 16 }, () => 0.9),
      },
      16,
      1.0,
      false,
    );
    for (const level of state.levels) {
      expect(level).toBeLessThan(0.9);
    }
  });
});
