import type { Diagnostic, DiagnosticLevel } from './types.js';

export const DiagnosticCodes = {
  ROOT_MISSING: 'ROOT_MISSING',
  ROOT_NOT_DIRECTORY: 'ROOT_NOT_DIRECTORY',
  NOT_A_PLAYLIST: 'NOT_A_PLAYLIST',
  EMPTY_PLAYLIST: 'EMPTY_PLAYLIST',
  EMPTY_ARTIST: 'EMPTY_ARTIST',
  NO_AUDIO: 'NO_AUDIO',
  MULTIPLE_AUDIO: 'MULTIPLE_AUDIO',
  MULTIPLE_LYRICS: 'MULTIPLE_LYRICS',
  UNREADABLE_DIRECTORY: 'UNREADABLE_DIRECTORY',
} as const;

export function makeDiagnostic(
  level: DiagnosticLevel,
  code: string,
  message: string,
  path?: string,
): Diagnostic {
  return path === undefined
    ? { level, code, message }
    : { level, code, message, path };
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const location = diagnostic.path ? ` @ ${diagnostic.path}` : '';
  return `[${diagnostic.level.toUpperCase()}/${diagnostic.code}] ${diagnostic.message}${location}`;
}
