import { hexToRgb, rgbToHex, type RGB } from '../palette.js';
import type { StitchTheme } from '../stitchTheme.js';

export type VisualizerProps = {
  levels: number[];
  peaks: number[];
  rows: number;
  /** Fraction of `rows` bars may never exceed. Configurable limiter. */
  maxHeight: number;
  theme: StitchTheme;
};

/**
 * CAVA-style bar floor, after the Stitch visualizer screen: bottom-anchored
 * columns with bright peak caps. Takes normalized levels (0..1); the data
 * source is a prop so real FFT output can replace the mock engine later.
 */
export function Visualizer({
  levels,
  peaks,
  rows,
  maxHeight,
  theme,
}: VisualizerProps): React.ReactNode {
  const lines: React.ReactNode[] = [];
  const barRows = Math.max(1, Math.floor(rows * Math.min(1, Math.max(0, maxHeight))));

  for (let row = 0; row < rows; row++) {
    const fromBottom = rows - 1 - row;
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i] ?? 0;
      const peak = peaks[i] ?? 0;
      const filled = fromBottom < Math.round(level * barRows);
      const capped =
        !filled && fromBottom <= Math.round(peak * barRows) && peak > 0.02;
      // Brightness ramp: dim base swelling to glowing tips, so the field
      // stays readable behind the UI instead of shouting at full blast.
      const ramp = Math.pow(Math.min(1, Math.max(0, level)), 1.4);
      const low = hexToRgb(theme.cardAlt);
      const high = hexToRgb(theme.accent);
      const body: RGB = [
        low[0] + (high[0] - low[0]) * ramp,
        low[1] + (high[1] - low[1]) * ramp,
        low[2] + (high[2] - low[2]) * ramp,
      ];
      cells.push(
        <span key={i} fg={capped ? theme.signal : filled ? rgbToHex(body) : theme.appBg}>
          {capped || filled ? '█' : ' '}
        </span>,
      );
      cells.push(<span key={`g${i}`}> </span>);
    }
    // Row box carries the page background: the absolute layer composites
    // opaquely, so every cell needs a painted ancestor or it punches a
    // black hole instead of showing the page behind.
    lines.push(
      <box key={row} backgroundColor={theme.appBg}>
        <text>{cells}</text>
      </box>,
    );
  }

  return <box flexDirection="column">{lines}</box>;
}
