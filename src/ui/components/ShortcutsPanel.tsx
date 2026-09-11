import type { StitchTheme } from '../stitchTheme.js';

export type ShortcutsPanelProps = {
  theme: StitchTheme;
};

const SHORTCUTS: Array<[string, string]> = [
  ['SPACE', 'Play / pause'],
  ['N / P', 'Next / previous'],
  ['← →', 'Seek 5 seconds'],
  ['/', 'Search library'],
  ['B', 'Playlists'],
  ['Q', 'Queue'],
  ['1', 'Toggle shuffle'],
  ['2', 'Toggle loop playlist'],
  ['3', 'Toggle loop single'],
  ['+ −', 'Volume up / down'],
  ['M', 'Mute'],
  ['L', 'Toggle lyrics'],
  ['S', 'Settings menu'],
  ['D', 'Library diagnostics'],
  ['?', 'This panel'],
  ['q', 'Quit'],
];

/** Discoverable key map overlay. */
export function ShortcutsPanel({ theme }: ShortcutsPanelProps): React.ReactNode {
  return (
    <box
      width={40}
      borderStyle="single"
      borderColor={theme.muted}
      backgroundColor={theme.card}
      padding={1}
      flexDirection="column"
      gap={1}
    >
      <text fg={theme.accent}>
        <strong>[ SHORTCUTS ]</strong>
      </text>
      <box flexDirection="column">
        {SHORTCUTS.map(([key, action]) => (
          <text key={key}>
            <span fg={theme.text}>
              <strong>{key.padEnd(7, ' ')}</strong>
            </span>
            <span fg={theme.muted}>{action}</span>
          </text>
        ))}
      </box>
      <text fg={theme.muted}>? close · ESC back</text>
    </box>
  );
}
