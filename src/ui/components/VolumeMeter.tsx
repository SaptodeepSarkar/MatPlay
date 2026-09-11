import type { StitchTheme } from '../stitchTheme.js';

export type VolumeMeterProps = {
  volume: number;
  theme: StitchTheme;
};

export function VolumeMeter({ volume, theme }: VolumeMeterProps): React.ReactNode {
  const filledBlocks = Math.round(volume * 8);
  const filled = '█'.repeat(filledBlocks);
  const empty = '░'.repeat(8 - filledBlocks);
  const db = volume <= 0 ? '-∞' : `${(20 * Math.log10(volume)).toFixed(1)}dB`;

  return (
    <box flexDirection="row" gap={1}>
      <text fg={theme.muted}>VOL</text>
      <text>
        <span fg={theme.accent}>{filled}</span>
        <span fg={theme.cardAlt}>{empty}</span>
      </text>
      <text fg={theme.text}>
        <strong>{db}</strong>
      </text>
      <box backgroundColor={theme.cardAlt}>
        <text fg={theme.muted}> LP_01 </text>
      </box>
    </box>
  );
}
