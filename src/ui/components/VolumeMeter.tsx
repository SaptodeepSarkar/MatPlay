import type { StitchTheme } from '../stitchTheme.js';

export type VolumeMeterProps = {
  volume: number;
  theme: StitchTheme;
};

const BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/** Ascending segmented meter with dB readout, after the Stitch VU meter. */
export function VolumeMeter({ volume, theme }: VolumeMeterProps): React.ReactNode {
  const filledBlocks = Math.round(volume * BARS.length);
  const db = volume <= 0 ? '-∞' : `${(20 * Math.log10(volume)).toFixed(1)}dB`;

  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <text>
        {BARS.map((glyph, index) => (
          <span
            key={glyph}
            fg={index < filledBlocks ? theme.accent : theme.cardAlt}
          >
            {glyph}
          </span>
        ))}
      </text>
      <text fg={theme.text}>
        <strong>{db}</strong>
      </text>
    </box>
  );
}
