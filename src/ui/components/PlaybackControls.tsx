import type { StitchTheme } from '../stitchTheme.js';

export type PlaybackControlsProps = {
  isPlaying: boolean;
  shuffle: boolean;
  loopList: boolean;
  loopSingle: boolean;
  theme: StitchTheme;
};

function Pill({
  label,
  bg,
  fg,
  bold = false,
}: {
  label: string;
  bg: string;
  fg: string;
  bold?: boolean;
}): React.ReactNode {
  return (
    <box backgroundColor={bg}>
      <text fg={fg}>{bold ? <strong>{` ${label} `}</strong> : ` ${label} `}</text>
    </box>
  );
}

export function PlaybackControls({
  isPlaying,
  shuffle,
  loopList,
  loopSingle,
  theme,
}: PlaybackControlsProps): React.ReactNode {
  const toggle = (label: string, active: boolean, activeFg = theme.accent): React.ReactNode => (
    <Pill label={label} bg={theme.cardAlt} fg={active ? activeFg : theme.muted} bold={active} />
  );

  return (
    <box flexDirection="row" gap={1}>
      {toggle('SHUF', shuffle)}
      <Pill label="◀ PREV" bg={theme.cardAlt} fg={theme.text} />
      <Pill
        label={isPlaying ? '❚❚ PLAYING' : '▶ PAUSED'}
        bg={theme.accent}
        fg={theme.accentInk}
        bold
      />
      <Pill label="NEXT ▶" bg={theme.cardAlt} fg={theme.text} />
      {toggle('LOOP', loopList, theme.text)}
      {toggle('1×', loopSingle)}
    </box>
  );
}
