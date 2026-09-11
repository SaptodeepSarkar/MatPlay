import type { LyricLine } from '../library/types.js';

const TAG_PATTERN = String.raw`\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]`;

function extractTimes(line: string): number[] {
  const times: number[] = [];
  const pattern = new RegExp(TAG_PATTERN, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const fraction = Number(`0.${match[3] ?? '0'}`);
    times.push(minutes * 60_000 + seconds * 1000 + Math.round(fraction * 1000));
  }
  return times;
}

/**
 * Parse `.lrc` (timestamped) and `.txt` (plain) lyrics.
 * - Strips metadata tags (`[ti:]`, `[ar:]`, …) — they carry no text.
 * - One line with several tags fans out to several timed entries.
 * - Lines without any tag are kept as untimed entries (plain `.txt`).
 * - Timed entries come out ascending; untimed keep file order at the end.
 */
export function parseLyrics(content: string): LyricLine[] {
  const timed: LyricLine[] = [];
  const untimed: LyricLine[] = [];

  for (const raw of content.split(/\r?\n/)) {
    const times = extractTimes(raw);
    // Drop metadata tags ([ti:], [ar:], [by:], …) along with timestamps.
    const text = raw
      .replace(new RegExp(TAG_PATTERN, 'g'), '')
      .replace(/\[[a-z]+:[^\]]*\]/gi, '')
      .trim();
    if (!text) continue;
    if (times.length === 0) {
      untimed.push({ text });
    } else {
      for (const timeMs of times) timed.push({ timeMs, text });
    }
  }

  timed.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
  return [...timed, ...untimed];
}

/** Index of the line active at `positionMs` (last line at or before it). */
export function lyricIndexAt(lines: LyricLine[], positionMs: number): number {
  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    const timeMs = lines[i]?.timeMs;
    if (timeMs !== undefined && timeMs <= positionMs) {
      active = i;
    } else if (timeMs !== undefined) {
      break;
    }
  }
  return active;
}
