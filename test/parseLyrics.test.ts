import { describe, expect, it } from 'vitest';
import { lyricIndexAt, parseLyrics } from '../src/lyrics/parseLyrics.js';

describe('parseLyrics', () => {
  it('parses lrc timestamps including multiple tags per line', () => {
    const lines = parseLyrics('[ti:Title]\n[00:01.00] hello\n[00:02.50][00:05.00] again\n');
    expect(lines).toEqual([
      { timeMs: 1000, text: 'hello' },
      { timeMs: 2500, text: 'again' },
      { timeMs: 5000, text: 'again' },
    ]);
  });

  it('keeps plain txt lines as untimed entries', () => {
    const lines = parseLyrics('first line\nsecond line\n');
    expect(lines).toEqual([{ text: 'first line' }, { text: 'second line' }]);
  });

  it('finds the active line for a playback position', () => {
    const lines = parseLyrics('[00:01.00] a\n[00:05.00] b\n[00:10.00] c\n');
    expect(lyricIndexAt(lines, 0)).toBe(-1);
    expect(lyricIndexAt(lines, 1000)).toBe(0);
    expect(lyricIndexAt(lines, 7000)).toBe(1);
    expect(lyricIndexAt(lines, 60_000)).toBe(2);
  });
});
