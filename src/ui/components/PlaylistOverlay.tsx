import type { Playlist } from '../../library/types.js';
import type { StitchTheme } from '../stitchTheme.js';

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
        {rows.map((row, index) => (
          <box key={row.key} backgroundColor={index === selectedIndex ? theme.accent : undefined}>
            <text fg={index === selectedIndex ? theme.accentInk : theme.text}>
              {index === selectedIndex ? <strong>{`▸ ${row.label}`}</strong> : `  ${row.label}`}
              {row.active ? '  ●' : `  · ${row.detail}`}
            </text>
          </box>
        ))}
      </box>
      <text fg={theme.muted}>↑↓ move · ENTER select · ESC close</text>
    </box>
  );
}
