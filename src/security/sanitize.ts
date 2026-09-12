/**
 * Swiss-cheese layer 1: central input sanitization.
 *
 * Every untrusted string (MP3 tags, filenames, lyric lines, log output,
 * config values, voice transcripts) must pass through here before it
 * reaches a terminal escape, a child-process protocol, or the UI.
 * No single caller is trusted to get it right — defense in depth.
 */

export const SAFE_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isSafeColor(value: string): boolean {
  return SAFE_COLOR_RE.test(value);
}

/** Strip C0 controls, DEL, ESC and OSC sequences for safe TUI rendering. */
export function sanitizeDisplayText(value: string, maxLength = 500): string {
  const stripped = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\u009B[^\u0007]*[\u0007\\]/g, '')
    .slice(0, maxLength);
  return stripped;
}

/** First-line, ANSI-stripped, length-capped log output (prevents log injection). */
export function sanitizeLogLine(value: string, maxLength = 200): string {
  const first = value.split('\n')[0] ?? '';
  return first
    // eslint-disable-next-line no-control-regex
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/** True when a value contains bytes that would break line-oriented protocols. */
export function hasProtocolBreakers(value: string): boolean {
  return /[\r\n\x00]/.test(value);
}

/** Clamp to a finite number in range, falling back when NaN/Infinity. */
export function clampFinite(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

const WINDOWS_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

export function isWindowsReservedName(value: string): boolean {
  return WINDOWS_RESERVED.has(value.trim().toUpperCase().replace(/\..*$/, ''));
}

/** Containment check on already-resolved absolute paths. */
export function isWithinDir(root: string, candidate: string, sep = '/'): boolean {
  if (candidate === root) return true;
  return candidate.startsWith(`${root}${sep}`);
}
