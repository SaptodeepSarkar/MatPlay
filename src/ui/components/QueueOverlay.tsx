import type { Track } from '../../library/types.js';
import type { StitchTheme } from '../stitchTheme.js';

export type QueueOverlayProps = {
  queue: Track[];
  queueIndex: number;
  selectedIndex: number;
  playlistName: string;
  theme: StitchTheme;
};

const WINDOW = 10;

/** Upcoming queue with jump-to support. */
export function QueueOverlay({
  queue,
  queueIndex,
  selectedIndex,
  playlistName,
  theme,
}: QueueOverlayProps): React.ReactNode {
  const start = Math.max(0, Math.min(queueIndex - 3, queue.length - WINDOW));
  const visible = queue.slice(start, start + WINDOW);

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
        {visible.map((track, offset) => {
          const index = start + offset;
          const isCurrent = index === queueIndex;
          const isSelected = index === selectedIndex;
          const marker = isCurrent ? '♪' : isSelected ? '▸' : ' ';
          const row = `${marker} ${String(index + 1).padStart(2, '0')}  ${track.title} — ${track.artist}`;
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
