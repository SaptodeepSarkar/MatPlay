import type { AlexaRemoteAction } from './types.js';

/**
 * Pure parser for inbound voice commands.
 *
 * alexa-remote2 returns raw ASR text like "pause on matplay" or
 * "matplay next". We ONLY act when the utterance mentions matplay,
 * so normal Echo use ("pause", "next" for Spotify) is never hijacked.
 *
 * Returns the local transport action, or null to ignore.
 */
export function parseAlexaMatplayCommand(input: string): AlexaRemoteAction | 'toggle' | null {
  const text = input.toLowerCase().trim();
  if (!text.includes('matplay') && !text.includes('mat play') && !text.includes('matt play')) {
    return null;
  }
  // Strip the wake keyword so "matplay next" and "next on matplay" converge.
  const core = text
    .replace(/matt play/g, '')
    .replace(/mat play/g, '')
    .replace(/matplay/g, '')
    .trim();

  const has = (...words: string[]): boolean =>
    words.some((w) => new RegExp(`\\b${w}\\b`).test(core));

  // Order matters: "pause" beats "play" in "pause the playback", etc.
  if (has('stop', 'halt', 'quit', 'shut')) return 'stop';
  if (has('pause', 'hold', 'wait', 'freeze')) return 'pause';
  if (has('previous', 'prev', 'last', 'back', 'rewind', 'restart')) return 'previous';
  if (has('next', 'skip', 'forward', 'advance')) return 'next';
  if (has('resume', 'continue', 'play', 'start', 'go', 'unpause')) return 'play';
  if (has('toggle')) return 'toggle';
  // Bare "matplay" with no verb: treat as toggle so users get feedback.
  if (core === '' || core === 'on' || core === 'please') return 'toggle';
  return null;
}
