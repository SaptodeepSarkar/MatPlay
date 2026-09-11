import type { StitchTheme } from '../stitchTheme.js';

export type SeekBarProps = {
  positionMs: number;
  durationMs: number;
  widthChars: number;
  theme: StitchTheme;
};

export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Hairline rail with a square head, after the Stitch scrubber.
 * Transparent container: the visualizer stays visible around the rail.
 */
export function SeekBar({
  positionMs,
  durationMs,
  widthChars,
  theme,
}: SeekBarProps): React.ReactNode {
  const ratio =
    durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
  const fillCount = Math.min(
    widthChars - 1,
    Math.floor(ratio * widthChars),
  );
  const fill = '─'.repeat(fillCount);
  const empty = '─'.repeat(Math.max(0, widthChars - fillCount - 1));
  const current = formatTime(positionMs);
  const total = formatTime(durationMs);
  const gap = ' '.repeat(
    Math.max(1, widthChars - current.length - total.length),
  );

  return (
    <box flexDirection="column" backgroundColor="transparent">
      <text>
        <span fg={theme.accent}>{fill}</span>
        <span fg={theme.signal}>■</span>
        <span fg={theme.cardAlt}>{empty}</span>
      </text>
      <text>
        <span fg={theme.accent}>
          <strong>{current}</strong>
        </span>
        <span>{gap}</span>
        <span fg={theme.muted}>{total}</span>
      </text>
    </box>
  );
}
