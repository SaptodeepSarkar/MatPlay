import { describe, expect, it } from 'vitest';
import { parseAlexaMatplayCommand } from '../src/alexa/commandParser.js';

describe('parseAlexaMatplayCommand', () => {
  it('maps pause/next/previous/play utterances', () => {
    expect(parseAlexaMatplayCommand('pause on matplay')).toBe('pause');
    expect(parseAlexaMatplayCommand('Alexa pause MatPlay')).toBe('pause');
    expect(parseAlexaMatplayCommand('next on matplay')).toBe('next');
    expect(parseAlexaMatplayCommand('matplay skip this song')).toBe('next');
    expect(parseAlexaMatplayCommand('go back on matplay')).toBe('previous');
    expect(parseAlexaMatplayCommand('resume matplay')).toBe('play');
    expect(parseAlexaMatplayCommand('stop on matplay')).toBe('stop');
  });

  it('ignores utterances that do not mention matplay', () => {
    expect(parseAlexaMatplayCommand('pause')).toBeNull();
    expect(parseAlexaMatplayCommand('next')).toBeNull();
    expect(parseAlexaMatplayCommand('play some jazz on spotify')).toBeNull();
  });

  it('treats bare matplay as toggle and unknown verbs as null', () => {
    expect(parseAlexaMatplayCommand('matplay')).toBe('toggle');
    expect(parseAlexaMatplayCommand('what time is it matplay')).toBeNull();
  });
});
