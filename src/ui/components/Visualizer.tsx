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
 * Build the visualizer as terminal cells in one string.  This component is
 * refreshed continuously, so representing every cell as its own React span
 * creates thousands of native OpenTUI objects per frame.  OpenTUI releases
 * those objects asynchronously; over a long session allocation can outrun
 * cleanup and grow RSS by gigabytes.  One text node keeps the native render
 * tree constant-sized while preserving the same bar/peak silhouette.
 */
export function visualizerText(
  levels: number[],
  peaks: number[],
  rows: number,
  maxHeight: number,
): string {
  const lines: string[] = [];
  const barRows = Math.max(1, Math.floor(rows * Math.min(1, Math.max(0, maxHeight))));

  for (let row = 0; row < rows; row++) {
    const fromBottom = rows - 1 - row;
    let line = '';
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i] ?? 0;
      const peak = peaks[i] ?? 0;
      const filled = fromBottom < Math.round(level * barRows);
      const peakRow = Math.max(0, Math.min(barRows - 1, Math.ceil(peak * barRows) - 1));
      const capped = !filled && fromBottom === peakRow && peak > 0.02;
      line += capped || filled ? '█ ' : '  ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

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
  return (
    <box backgroundColor={theme.appBg}>
      <text fg={theme.cardAlt}>{visualizerText(levels, peaks, rows, maxHeight)}</text>
    </box>
  );
}
