import path from 'node:path';

/** Hidden files/folders (dot-prefixed) are ignored by the scanner. */
export function isHidden(basename: string): boolean {
  return basename.startsWith('.');
}

/** Supported audio extensions for the MVP. */
const AUDIO_EXTENSIONS = new Set(['.mp3']);

/** Supported lyrics extensions for the MVP. */
const LYRICS_EXTENSIONS = new Set(['.lrc', '.txt']);

export function isAudioFile(filePath: string): boolean {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isLyricsFile(filePath: string): boolean {
  return LYRICS_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isLrcFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.lrc';
}

/** Normalize a path for stable IDs: relative + posix separators. */
export function toPosixSeparators(input: string): string {
  return input.split(path.sep).join('/');
}
