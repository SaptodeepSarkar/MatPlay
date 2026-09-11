import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { Mpg123Backend } from '../src/playback/Mpg123Backend.js';

const TRACK = {
  id: 'kalyani',
  title: 'KALYANI',
  artist: 'ARJN',
  playlist: 'Work',
  songFolder: '/music',
  audioPath: `${process.env.HOME}/Music/Spotify/Work❤️/ARJN/KALYANI (with Shreya Ghoshal) [Remix]/01 - KALYANI (with Shreya Ghoshal) - Remix.mp3`,
};

function mpg123Present(): boolean {
  try {
    execFileSync('mpg123', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// These tests drive a real decoder, so they opt out of the global
// MATPLAY_NO_AUDIO test mute (vitest isolates env per file).
process.env.MATPLAY_NO_AUDIO = '';

// Live-decoder test: loads silently (LOADPAUSED, no audio needed for the
// duration path) and verifies transport state transitions.
const describeLive = mpg123Present() ? describe : describe.skip;

describeLive('Mpg123Backend', () => {
  it('loads tags without playing and cleans up', async () => {
    const backend = new Mpg123Backend();
    try {
      await backend.load(TRACK);
      // Duration resolves from tags even before any audio flows.
      const duration = await backend.getDuration();
      expect(duration).toBeGreaterThan(200_000);
      expect(await backend.getPosition()).toBe(0);
      await backend.setVolume(0.5);
      await backend.stop();
    } finally {
      await backend.destroy();
    }
  }, 15000);

  it('reports natural end-of-track for auto-next', async () => {
    const backend = new Mpg123Backend();
    try {
      let ended = false;
      backend.onEnded = () => {
        ended = true;
      };
      await backend.load(TRACK);
      await backend.play();
      // Mute: the protocol is under test, not the speakers.
      await backend.setVolume(0);
      // Jump to the last two seconds and wait for the decoder to finish.
      await backend.seek(258_000);
      const deadline = Date.now() + 12000;
      while (!ended && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(ended).toBe(true);
    } finally {
      await backend.destroy();
    }
  }, 20000);

  it('resurrects a spent decoder on seek', async () => {
    const backend = new Mpg123Backend();
    try {
      await backend.load(TRACK);
      await backend.play();
      await backend.setVolume(0);
      await backend.seek(258_000);
      const deadline = Date.now() + 12000;
      while ((await backend.getPosition()) < 258_000 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      // Let it run past EOF, then seek back and resume.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await backend.seek(5000);
      await backend.play();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const position = await backend.getPosition();
      expect(position).toBeGreaterThan(4000);
      expect(position).toBeLessThan(30000);
    } finally {
      await backend.destroy();
    }
  }, 25000);
});
