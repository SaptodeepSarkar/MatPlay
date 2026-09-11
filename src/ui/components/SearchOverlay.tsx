import type { Track } from '../../library/types.js';
import type { StitchTheme } from '../stitchTheme.js';
import { truncateText } from '../text.js';

export type SearchOverlayProps = {
  query: string;
  results: Track[];
  selectedIndex: number;
  theme: StitchTheme;
};

/** Live filter over title / artist / playlist. */
export function SearchOverlay({
  query,
  results,
  selectedIndex,
  theme,
}: SearchOverlayProps): React.ReactNode {
  const windowSize = 8;
  const start = Math.max(0, Math.min(selectedIndex - 3, results.length - windowSize));
  const visibleResults = results.slice(start, start + windowSize);
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
      <box flexDirection="row" gap={1}>
        <text fg={theme.accent}>
          <strong>/</strong>
        </text>
        <text fg={query ? theme.text : theme.muted}>
          {query || 'title or artist…'}<span fg={theme.accent}>▌</span>
        </text>
      </box>
      <text fg={theme.muted}>
        {query ? `${results.length} match${results.length === 1 ? '' : 'es'}` : 'type to search'}
      </text>
      <box flexDirection="column">
        {visibleResults.map((track, offset) => {
          const index = start + offset;
          return (
          <box key={track.id} backgroundColor={index === selectedIndex ? theme.accent : undefined}>
            <text fg={index === selectedIndex ? theme.accentInk : theme.text}>
              {index === selectedIndex ? <strong>{truncateText(`▸ ${track.title} — ${track.artist}`, 47)}</strong> : truncateText(`  ${track.title} — ${track.artist}`, 47)}
            </text>
          </box>
          );
        })}
        {results.length === 0 && query ? (
          <text fg={theme.muted}>No matches in this library.</text>
        ) : null}
      </box>
      <text fg={theme.muted}>↑↓ move · ENTER play · ESC close</text>
    </box>
  );
}
