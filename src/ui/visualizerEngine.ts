/**
 * Procedural stand-in for CAVA FFT output. Produces smoothly wandering bar
 * levels with slow peak-hold caps. The UI only consumes `levels`/`peaks`,
 * so a real analyzer can replace `stepViz` without touching components.
 */
export type VizState = {
  levels: number[];
  peaks: number[];
};

const PEAK_FALLOFF = 0.06;

function targetLevel(index: number, count: number, t: number): number {
  const wave =
    Math.abs(Math.sin(t * 2.1 + index * 0.55)) *
    Math.abs(Math.sin(t * 0.7 + index * 0.21 + count));
  const jitter = 0.6 + Math.random() * 0.4;
  return Math.min(1, 0.18 + 0.82 * wave * jitter);
}

export function stepViz(
  previous: VizState,
  columns: number,
  t: number,
  energetic: boolean,
): VizState {
  const levels: number[] = [];
  const peaks: number[] = [];

  for (let i = 0; i < columns; i++) {
    const previousLevel = previous.levels[i] ?? 0.05;
    const previousPeak = previous.peaks[i] ?? 0.05;
    const target = energetic ? targetLevel(i, columns, t) : 0.04;
    const rate = target > previousLevel ? 0.5 : 0.25;
    const level = Math.min(1, Math.max(0, previousLevel + (target - previousLevel) * rate));
    const peak = Math.min(1, Math.max(level, previousPeak - PEAK_FALLOFF));
    levels.push(level);
    peaks.push(peak);
  }

  return { levels, peaks };
}
