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
      cells.push(
        <span
          key={i}
          fg={capped ? theme.accent : filled ? theme.cardAlt : theme.appBg}
        >
          {capped || filled ? '█' : ' '}
        </span>,
      );
      cells.push(<span key={`g${i}`}> </span>);
    }
    lines.push(
      <text key={row}>{cells}</text>,
    );
  }

  return <box flexDirection="column">{lines}</box>;
}
