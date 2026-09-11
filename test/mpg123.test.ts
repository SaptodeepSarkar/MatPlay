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

// Live-decoder test: loads silently (LOADPAUSED, no audio needed for the
// duration path) and verifies transport state transitions.
const describeLive = mpg123Present() ? describe : describe.skip;

describeLive('Mpg123Backend', () => {
  it('loads tags without playing and cleans up', async () => {
    const backend = new Mpg123Backend();
    await backend.load(TRACK);
    // Duration resolves from tags even before any audio flows.
    const duration = await backend.getDuration();
    expect(duration).toBeGreaterThan(200_000);
    expect(await backend.getPosition()).toBe(0);
    await backend.setVolume(0.5);
    await backend.stop();
  }, 15000);
});
