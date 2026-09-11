import type { StitchTheme } from '../stitchTheme.js';

export type PlaybackControlsProps = {
  isPlaying: boolean;
  shuffle: boolean;
  loopList: boolean;
  loopSingle: boolean;
  theme: StitchTheme;
};

/** Borderless icon slot, after the Stitch transport: only the play button
 *  carries a fill, icons sit centered in equal slots. */
function IconButton({
  glyph,
  active,
  activeFg,
  theme,
}: {
  glyph: string;
  active: boolean;
  activeFg: string;
  theme: StitchTheme;
}): React.ReactNode {
  return (
    <box
      width={5}
      height={3}
      justifyContent="center"
      alignItems="center"
    >
      <text fg={active ? activeFg : theme.muted}>
        {active ? <strong>{glyph}</strong> : glyph}
      </text>
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
  return (
    <box flexDirection="row" gap={1}>
      <IconButton glyph="⇄" active={shuffle} activeFg={theme.signal} theme={theme} />
      <IconButton glyph="◀◀" active={false} activeFg={theme.text} theme={theme} />
      <box
        height={3}
        backgroundColor={theme.accent}
        justifyContent="center"
        alignItems="center"
      >
        <text fg={theme.accentInk}>
          <strong>{isPlaying ? '  ❚❚ PLAYING  ' : '  ▶ PAUSED  '}</strong>
        </text>
      </box>
      <IconButton glyph="▶▶" active={false} activeFg={theme.text} theme={theme} />
      <IconButton glyph="↻1" active={loopSingle} activeFg={theme.signal} theme={theme} />
      <IconButton glyph="↻" active={loopList} activeFg={theme.text} theme={theme} />
    </box>
  );
}
