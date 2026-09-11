import type { Track } from '../../library/types.js';
import type { StitchTheme } from '../stitchTheme.js';

export type QueueOverlayProps = {
  queue: Track[];
  /** Play order (shuffled or sequential): positions into `queue`. */
  order: number[];
  /** Position of the current track inside `order`. */
  currentPos: number;
  /** Cursor position inside `order`. */
  selectedIndex: number;
  playlistName: string;
  theme: StitchTheme;
};

const WINDOW = 10;

/** Upcoming queue with jump-to support. */
export function QueueOverlay({
  queue,
  order,
  currentPos,
  selectedIndex,
  playlistName,
  theme,
}: QueueOverlayProps): React.ReactNode {
  const start = Math.max(0, Math.min(selectedIndex - 3, order.length - WINDOW));
  const visible = order.slice(start, start + WINDOW);

  return (
    <box
      width={52}
      borderStyle="single"
      borderColor={theme.muted}
      backgroundColor={theme.card}
      padding={1}
      flexDirection="column"
      gap={1}
    >
      <text fg={theme.accent}>
        <strong>[ QUEUE · {playlistName.toUpperCase()} ]</strong>
      </text>
      <box flexDirection="column">
        {visible.map((trackPosition, offset) => {
          const position = start + offset;
          const track = queue[trackPosition];
          if (!track) return null;
          const isCurrent = position === currentPos;
          const isSelected = position === selectedIndex;
          const marker = isCurrent ? '♪' : isSelected ? '▸' : ' ';
          const row = `${marker} ${String(position + 1).padStart(2, '0')}  ${track.title} — ${track.artist}`;
          if (isSelected) {
            return (
              <box key={track.id} backgroundColor={theme.accent}>
                <text fg={theme.accentInk}>
                  <strong>{row}</strong>
                </text>
              </box>
            );
          }
          return (
            <text key={track.id} fg={isCurrent ? theme.accent : theme.text}>
              {row}
            </text>
          );
        })}
        {queue.length === 0 ? <text fg={theme.muted}>Queue is empty.</text> : null}
      </box>
      <text fg={theme.muted}>↑↓ move · ENTER jump · ESC close</text>
    </box>
  );
}
