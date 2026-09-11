import type { LyricLine } from '../../library/types.js';
import { lyricIndexAt } from '../../lyrics/parseLyrics.js';
import type { StitchTheme } from '../stitchTheme.js';

export type LyricsPanelProps = {
  lines: LyricLine[];
  positionMs: number;
  theme: StitchTheme;
};

/**
 * Rolling synced-lyrics window: previous line dim, current line
 * highlighted, next line dim. When playback crosses a timestamp the
 * window rolls up and the bottom line takes focus — the ascending morph.
 * Untimed (plain `.txt`) lyrics render as a static block instead.
 */
export function LyricsPanel({
  lines,
  positionMs,
  theme,
}: LyricsPanelProps): React.ReactNode {
  if (lines.length === 0) {
    return <text fg={theme.muted}>No lyrics found.</text>;
  }

  const timed = lines.filter((line) => line.timeMs !== undefined);
  if (timed.length === 0) {
    return (
      <box flexDirection="column">
        {lines.slice(0, 3).map((line, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <text key={index} fg={theme.muted}>
            {line.text}
          </text>
        ))}
      </box>
    );
  }

  const active = lyricIndexAt(timed, positionMs);
  const current = active >= 0 ? timed[active] : undefined;
  const previous = active > 0 ? timed[active - 1] : undefined;
  const next = timed[active + 1];

  return (
    <box flexDirection="column">
      {previous ? <text fg={theme.muted}>  {previous.text}</text> : null}
      {current ? (
        <text fg={theme.accent}>
          <strong>{`▸ ${current.text}`}</strong>
        </text>
      ) : (
        <text fg={theme.muted}>  …</text>
      )}
      {next ? <text fg={theme.muted}>  {next.text}</text> : null}
    </box>
  );
}
