import type { StitchTheme } from '../stitchTheme.js';

export type SettingsMenuProps = {
  musicDir: string;
  trackCount: number;
  shuffle: boolean;
  loopList: boolean;
  loopSingle: boolean;
  theme: StitchTheme;
};

function Row({
  label,
  value,
  valueFg,
  theme,
}: {
  label: string;
  value: string;
  valueFg: string;
  theme: StitchTheme;
}): React.ReactNode {
  const gap = ' '.repeat(Math.max(1, 30 - label.length - value.length));
  return (
    <text>
      <span fg={theme.text}>{label}</span>
      <span>{gap}</span>
      <span fg={valueFg}>
        <strong>{value}</strong>
      </span>
    </text>
  );
}

/** Tactile config dropdown, after the Stitch [SYSTEM CONFIG] menu. */
export function SettingsMenu({
  musicDir,
  trackCount,
  shuffle,
  loopList,
  loopSingle,
  theme,
}: SettingsMenuProps): React.ReactNode {
  const onOff = (active: boolean): { value: string; valueFg: string } =>
    active
      ? { value: 'ON', valueFg: theme.signal }
      : { value: 'OFF', valueFg: theme.muted };

  return (
    <box
      width={34}
      borderStyle="single"
      borderColor={theme.muted}
      backgroundColor={theme.card}
      padding={1}
      flexDirection="column"
      gap={1}
    >
      <text fg={theme.accent}>
        <strong>[ SYS CONFIG ]</strong>
      </text>
      <box flexDirection="column">
        <text fg={theme.muted}>MUSIC DIRECTORY</text>
        <text fg={theme.text}>
          {musicDir}  {trackCount} TRACKS
        </text>
      </box>
      <box flexDirection="column">
        <text fg={theme.muted}>PLAYBACK CONFIG</text>
        <Row label="[1] SHUFFLE" {...onOff(shuffle)} theme={theme} />
        <Row label="[2] LOOP PLAYLIST" {...onOff(loopList)} theme={theme} />
        <Row label="[3] LOOP SINGLE" {...onOff(loopSingle)} theme={theme} />
      </box>
      <box flexDirection="column">
        <text fg={theme.muted}>DSP</text>
        <text>
          <span fg={theme.text}>PCM BIT-PERFECT  </span>
          <span fg={theme.signal}>
            <strong>ENGAGED</strong>
          </span>
        </text>
      </box>
    </box>
  );
}
