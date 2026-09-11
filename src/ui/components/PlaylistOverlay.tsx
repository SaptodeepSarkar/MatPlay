import type { Playlist } from '../../library/types.js';
import type { StitchTheme } from '../stitchTheme.js';
import { truncateText } from '../text.js';

export type PlaylistOverlayProps = {
  playlists: Playlist[];
  totalTracks: number;
  activePlaylist: string | undefined;
  selectedIndex: number;
  theme: StitchTheme;
};

/** Pick which playlist feeds the queue (or everything). */
export function PlaylistOverlay({
  playlists,
  totalTracks,
  activePlaylist,
  selectedIndex,
  theme,
}: PlaylistOverlayProps): React.ReactNode {
  const rows: Array<{ key: string; label: string; detail: string; active: boolean }> = [
    {
      key: '__all__',
      label: 'All playlists',
      detail: `${totalTracks} tracks`,
      active: activePlaylist === undefined,
    },
    ...playlists.map((playlist) => ({
      key: playlist.id,
      label: playlist.name,
      detail: `${playlist.tracks.length} tracks`,
      active: activePlaylist === playlist.name,
    })),
  ];
  const windowSize = 10;
  const start = Math.max(0, Math.min(selectedIndex - 3, rows.length - windowSize));
  const visibleRows = rows.slice(start, start + windowSize);

  return (
    <box
      width={44}
      borderStyle="single"
      borderColor={theme.muted}
      backgroundColor={theme.card}
      padding={1}
      flexDirection="column"
      gap={1}
    >
      <text fg={theme.accent}>
        <strong>[ PLAYLISTS ]</strong>
      </text>
      <box flexDirection="column">
        {visibleRows.map((row, offset) => {
          const index = start + offset;
          const label = truncateText(`${index === selectedIndex ? '▸' : ' '} ${row.label}${row.active ? '  ●' : `  · ${row.detail}`}`, 39);
          return (
          <box key={row.key} backgroundColor={index === selectedIndex ? theme.accent : undefined}>
            <text fg={index === selectedIndex ? theme.accentInk : theme.text}>
              {index === selectedIndex ? <strong>{label}</strong> : label}
            </text>
          </box>
          );
        })}
      </box>
      <text fg={theme.muted}>↑↓ move · ENTER select · ESC close</text>
    </box>
  );
}
