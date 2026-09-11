import { useEffect, useRef } from 'react';
import type { InputRenderable } from '@opentui/core';
import type { SpotdlMode } from '../../download/spotdl.js';
import type { StitchTheme } from '../stitchTheme.js';
import { truncateText } from '../text.js';

export type SpotdlPanelProps = {
  width: number;
  available: boolean | undefined;
  query: string;
  playlist: string;
  mode: SpotdlMode;
  deleteRemoved: boolean;
  selectedIndex: number;
  running: boolean;
  status: string;
  theme: StitchTheme;
  onQuery: (value: string) => void;
  onPlaylist: (value: string) => void;
};

function ChoiceRow({
  selected,
  label,
  value,
  warning = false,
  theme,
}: {
  selected: boolean;
  label: string;
  value: string;
  warning?: boolean;
  theme: StitchTheme;
}): React.ReactNode {
  return (
    <box backgroundColor={selected ? theme.accent : undefined} paddingX={1}>
      <text fg={selected ? theme.accentInk : warning ? theme.signal : theme.text}>
        {selected ? <strong>{`▸ ${label}  ${value}`}</strong> : `  ${label}  ${value}`}
      </text>
    </box>
  );
}

/** Wide settings workspace for downloads and saved-playlist synchronization. */
export function SpotdlPanel({
  width,
  available,
  query,
  playlist,
  mode,
  deleteRemoved,
  selectedIndex,
  running,
  status,
  theme,
  onQuery,
  onPlaylist,
}: SpotdlPanelProps): React.ReactNode {
  const queryRef = useRef<InputRenderable | null>(null);
  const playlistRef = useRef<InputRenderable | null>(null);
  useEffect(() => {
    if (running) return;
    if (selectedIndex === 0) queryRef.current?.focus();
    else if (selectedIndex === 1) playlistRef.current?.focus();
    else {
      queryRef.current?.blur();
      playlistRef.current?.blur();
    }
  }, [selectedIndex, running]);

  const inputWidth = Math.max(30, width - 8);
  return (
    <box
      width={width}
      borderStyle="single"
      borderColor={theme.accent}
      backgroundColor={theme.card}
      padding={1}
      flexDirection="column"
      gap={1}
    >
      <box flexDirection="row">
        <text fg={theme.accent}><strong>󰝚 SPOTDL LIBRARY</strong></text>
        <box flexGrow={1} />
        <text fg={available ? theme.complement : available === false ? theme.signal : theme.muted}>
          {available === undefined ? '● CHECKING' : available ? '● READY' : '● NOT INSTALLED'}
        </text>
      </box>
      <text fg={theme.muted}>
        Paste one or many song links, or type a song name. Files are arranged by artist and title.
      </text>

      <text fg={selectedIndex === 0 ? theme.accent : theme.muted}>QUERY / SPOTIFY URL</text>
      <box borderStyle="single" borderColor={selectedIndex === 0 ? theme.accent : theme.muted} paddingX={1}>
        <input
          ref={queryRef}
          width={inputWidth}
          focused={selectedIndex === 0 && !running}
          value={query}
          placeholder={mode === 'sync' ? 'one playlist URL (blank re-syncs saved state)' : 'song name or multiple links separated by spaces'}
          onInput={onQuery}
        />
      </box>

      <text fg={selectedIndex === 1 ? theme.accent : theme.muted}>LOCAL PLAYLIST</text>
      <box borderStyle="single" borderColor={selectedIndex === 1 ? theme.accent : theme.muted} paddingX={1}>
        <input
          ref={playlistRef}
          width={inputWidth}
          focused={selectedIndex === 1 && !running}
          value={playlist}
          placeholder="Downloads"
          onInput={onPlaylist}
        />
      </box>

      <ChoiceRow
        selected={selectedIndex === 2}
        label="ACTION"
        value={mode === 'download' ? '󰇚 DOWNLOAD / ADD' : '󰑐 SYNC SPOTIFY PLAYLIST'}
        theme={theme}
      />
      <ChoiceRow
        selected={selectedIndex === 3}
        label="REMOVED TRACKS"
        value={mode === 'sync' && deleteRemoved ? '󰆴 DELETE LOCAL (MIRROR)' : 'KEEP LOCAL (SAFE)'}
        warning={mode === 'sync' && deleteRemoved}
        theme={theme}
      />
      <ChoiceRow
        selected={selectedIndex === 4}
        label="RUN"
        value={running ? 'WORKING…' : 'ENTER TO START'}
        theme={theme}
      />

      <text fg={status.toLowerCase().includes('fail') || status.toLowerCase().includes('not installed') ? theme.signal : theme.muted}>
        {truncateText(status, width - 4)}
      </text>
      <text fg={theme.muted}>↑↓ fields · ←→ change options · ENTER continue/run · ESC close</text>
      <text fg={theme.muted}>Downloads come from YouTube via spotDL; obey applicable rights and laws.</text>
    </box>
  );
}
