import { useEffect, useRef } from 'react';
import type { InputRenderable } from '@opentui/core';
import type { Track } from '../../library/types.js';
import type { StitchTheme } from '../stitchTheme.js';
import { truncateText } from '../text.js';

export type SearchOverlayProps = {
  query: string;
  results: Track[];
  selectedIndex: number;
  theme: StitchTheme;
  onQuery: (value: string) => void;
};

/** Live filter over title / artist / playlist. */
export function SearchOverlay({
  query,
  results,
  selectedIndex,
  theme,
  onQuery,
}: SearchOverlayProps): React.ReactNode {
  const inputRef = useRef<InputRenderable | null>(null);
  const windowSize = 8;
  const start = Math.max(0, Math.min(selectedIndex - 3, results.length - windowSize));
  const visibleResults = results.slice(start, start + windowSize);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
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
        <input ref={inputRef} focused placeholder="title or artist…" onInput={onQuery} />
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
