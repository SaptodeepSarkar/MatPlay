import type { LyricLine } from '../../library/types.js';
import { lyricIndexAt } from '../../lyrics/parseLyrics.js';
import type { StitchTheme } from '../stitchTheme.js';

export type LyricsPanelProps = {
  lines: LyricLine[];
  positionMs: number;
  theme: StitchTheme;
  scrollOffset?: number;
};

const WINDOW = 3;
const LEAD = 1;

/**
 * Traveling synced-lyrics window: the highlighted line descends through a
 * five-line viewport as the song plays, and the list rolls once it passes
 * center. Untimed (plain `.txt`) lyrics render as a static block instead.
 */
export function LyricsPanel({
  lines,
  positionMs,
  theme,
  scrollOffset = 0,
}: LyricsPanelProps): React.ReactNode {
  if (lines.length === 0) {
    return <text fg={theme.muted}>No lyrics found.</text>;
  }

  const timed = lines.filter((line) => line.timeMs !== undefined);
  if (timed.length === 0) {
    return (
      <box flexDirection="column" backgroundColor="transparent">
        {lines.slice(scrollOffset, scrollOffset + WINDOW).map((line, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <text key={index} fg={theme.muted}>
            {`${scrollOffset + index + 1}. ${line.text}`}
          </text>
        ))}
      </box>
    );
  }

  const active = lyricIndexAt(timed, positionMs);
  const start = Math.max(
    0,
    Math.min(Math.max(0, active - LEAD), Math.max(0, timed.length - WINDOW)),
  );
  const visible = timed.slice(start, start + WINDOW);

  return (
    <box flexDirection="column" backgroundColor="transparent">
      {visible.map((line, offset) => {
        const globalIndex = start + offset;
        const isActive = globalIndex === active;
        return (
          <text
            key={`${line.timeMs}-${offset}`}
            fg={isActive ? theme.accent : theme.muted}
          >
            {isActive ? <strong>{`▸ ${line.text}`}</strong> : `  ${line.text}`}
          </text>
        );
      })}
    </box>
  );
}
