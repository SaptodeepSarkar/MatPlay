import { describe, expect, it } from 'vitest';
import { buildMetadata } from '../src/platform/presence.js';
import type { Track } from '../src/library/types.js';
import type { TrackMeta } from '../src/playback/trackMeta.js';

const TRACK: Track = {
  id: 'abc123',
  title: 'Kalyani',
  artist: 'ARJN',
  playlist: 'Work',
  songFolder: '/music/kalyani',
  audioPath: '/music/kalyani/song.mp3',
  lyricsPath: '/music/kalyani/song.lrc',
};

const META: TrackMeta = {
  title: 'Kalyani (Remix)',
  artist: 'ARJN',
  formatLabel: 'MP3 · 128KBPS · 48.0KHZ',
  streamLabel: 'PCM 48.0 KHZ • DIRECT STREAM',
  durationMs: 260_016,
  coverSrc: '/tmp/matplay-covers/abc123.jpg',
};

describe('buildMetadata', () => {
  it('maps track + tags to MPRIS fields', () => {
    const metadata = buildMetadata(TRACK, META);
    expect(metadata['xesam:title']).toBe('Kalyani (Remix)');
    expect(metadata['xesam:artist']).toEqual(['ARJN']);
    expect(metadata['xesam:album']).toBe('Work');
    expect(metadata['mpris:length']).toBe(260_016_000);
    expect(metadata['mpris:artUrl']).toBe('file:///tmp/matplay-covers/abc123.jpg');
  });

  it('omits length and art when unknown', () => {
    const metadata = buildMetadata(TRACK, { ...META, durationMs: undefined, coverSrc: '' });
    expect(metadata['mpris:length']).toBeUndefined();
    expect(metadata['mpris:artUrl']).toBeUndefined();
  });
});
