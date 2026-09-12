import type { StitchTheme } from '../stitchTheme.js';
import { truncateText } from '../text.js';

export type SettingsMenuProps = {
  musicDir: string;
  trackCount: number;
  shuffle: boolean;
  loopList: boolean;
  loopSingle: boolean;
  theme: StitchTheme;
  selectedIndex: number;
  themeMode: 'cover' | 'light';
  accentColor: string;
  vizGain: number;
  vizMaxHeight: number;
  spotdlInstalled: boolean | undefined;
  syncPlaylist: string;
  syncReady: boolean;
  alexaEnabled: boolean;
  alexaState: string;
  /** Feature flag: false hides the ALEXA row entirely (undiscoverable). */
  showAlexa: boolean;
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
  selectedIndex,
  themeMode,
  accentColor,
  vizGain,
  vizMaxHeight,
  spotdlInstalled,
  syncPlaylist,
  syncReady,
  alexaEnabled,
  alexaState,
  showAlexa,
}: SettingsMenuProps): React.ReactNode {
  const onOff = (active: boolean): { value: string; valueFg: string } =>
    active
      ? { value: 'ON', valueFg: theme.signal }
      : { value: 'OFF', valueFg: theme.muted };
  const settingRows = [
    truncateText(`MUSIC ROOT  ${musicDir}`, 29),
    `THEME       ${themeMode.toUpperCase()}`,
    `ACCENT      ${accentColor === 'auto' ? 'COVER AUTO' : accentColor.toUpperCase()}`,
    `VIZ GAIN    ${vizGain.toFixed(1)}`,
    `VIZ HEIGHT  ${Math.round(vizMaxHeight * 100)}%`,
    `SPOTDL      ${spotdlInstalled === undefined ? 'CHECKING' : spotdlInstalled ? 'DOWNLOADS' : 'NOT INSTALLED'}`,
    `SYNC NOW    ${syncReady ? truncateText(syncPlaylist, 16) : 'SET UP'}`,
    ...(showAlexa ? [`ALEXA       ${alexaEnabled ? alexaState.toUpperCase() : 'OFF'}`] : []),
    'RESET CONFIG',
  ];

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
      <text fg={theme.muted}>{trackCount} TRACKS · ↑↓ MOVE · ENTER CHANGE</text>
      <box flexDirection="column">
        {settingRows.map((label, index) => (
          <box key={label} backgroundColor={index === selectedIndex ? theme.accent : undefined}>
            <text fg={index === selectedIndex ? theme.accentInk : theme.text}>
              {index === selectedIndex ? <strong>{`▸ ${label}`}</strong> : `  ${label}`}
            </text>
          </box>
        ))}
      </box>
      <box flexDirection="column">
        <text fg={theme.muted}>PLAYBACK CONFIG</text>
        <Row label="[1] SHUFFLE" {...onOff(shuffle)} theme={theme} />
        <Row label="[2] LOOP PLAYLIST" {...onOff(loopList)} theme={theme} />
        <Row label="[3] LOOP SINGLE" {...onOff(loopSingle)} theme={theme} />
      </box>
      <text fg={theme.muted}>ESC close</text>
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
