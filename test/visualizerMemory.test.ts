import { describe, expect, it } from 'vitest';
import { visualizerText } from '../src/ui/components/Visualizer.js';

describe('visualizer render shape', () => {
  it('renders a complete frame as one bounded text value', () => {
    const columns = 80;
    const rows = 60;
    const levels = Array.from({ length: columns }, (_, index) => (index % 10) / 10);
    const peaks = levels.map((level) => Math.min(1, level + 0.1));
    const frame = visualizerText(levels, peaks, rows, 0.8);

    expect(frame.split('\n')).toHaveLength(rows);
    expect(frame.length).toBe(rows * columns * 2 + rows - 1);
  });

  it('does not draw above the configured maximum height', () => {
    const frame = visualizerText([1], [1], 10, 0.3).split('\n');
    expect(frame.filter((line) => line.includes('█'))).toHaveLength(3);
  });
});
