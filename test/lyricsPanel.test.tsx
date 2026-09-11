import { describe, expect, it } from 'vitest';
import React from 'react';
import { testRender } from '@opentui/react/test-utils';
import { LyricsPanel } from '../src/ui/components/LyricsPanel.js';
import { KALYANI_COVER_THEME } from '../src/ui/stitchTheme.js';
import type { LyricLine } from '../src/library/types.js';

const LINES: LyricLine[] = [
  { timeMs: 6000, text: 'first' },
  { timeMs: 12000, text: 'second' },
  { timeMs: 18000, text: 'third' },
  { timeMs: 24000, text: 'fourth' },
  { timeMs: 30000, text: 'fifth' },
  { timeMs: 36000, text: 'sixth' },
  { timeMs: 42000, text: 'seventh' },
];

async function frameAt(positionMs: number): Promise<string> {
  const setup = await testRender(
    <LyricsPanel lines={LINES} positionMs={positionMs} theme={KALYANI_COVER_THEME} />,
    { width: 40, height: 6 },
  );
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  setup.renderer.destroy();
  return frame;
}

describe('LyricsPanel', () => {
  it('rolls the window as playback crosses timestamps', async () => {
    const early = await frameAt(7000);
    expect(early).toContain('first');
    expect(early).toContain('fifth');
    expect(early).not.toContain('seventh');

    const late = await frameAt(37000);
    expect(late).toContain('seventh');
    expect(late).not.toContain('first');
    expect(late).not.toContain('second');
  });

  it('shows a placeholder before the first timestamp', async () => {
    const frame = await frameAt(1000);
    expect(frame).toContain('first');
  });
});
