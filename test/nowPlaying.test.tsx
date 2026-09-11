import { describe, expect, it } from 'vitest';
import React from 'react';
import { testRender } from '@opentui/react/test-utils';
import { App } from '../src/app/App.js';

describe('now playing mock', () => {
  it('renders the Kalyani track card', async () => {
    const setup = await testRender(<App />, { width: 100, height: 40 });
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain('KALYANI');
    expect(frame).toContain('PLAYING');
    expect(frame).toContain('04:20');
    setup.renderer.destroy();
  });
});
