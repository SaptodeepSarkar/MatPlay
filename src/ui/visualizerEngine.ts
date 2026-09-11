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
): VizState {  const levels: number[] = [];
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

/**
 * Fold live analyzer output into state. Raw bars are resampled to the UI
 * column count by averaging; peaks keep their slow falloff so caps linger.
 */
export function applySpectrum(
  previous: VizState,
  raw: number[],
  columns: number,
): VizState {
  const levels: number[] = [];
  const peaks: number[] = [];
  const usable = raw.filter((value) => Number.isFinite(value));
  const source = usable.length > 0 ? usable : [0];

  for (let i = 0; i < columns; i++) {
    const from = Math.floor((i * source.length) / columns);
    const to = Math.max(from + 1, Math.floor(((i + 1) * source.length) / columns));
    let sum = 0;
    for (let j = from; j < to; j++) sum += source[j] ?? 0;
    // Square-root perceptual curve: raw FFT magnitudes cluster near zero,
    // this spreads them across the bar height without touching peaks.
    const average = sum / (to - from);
    const level = Math.min(1, Math.max(0, Math.sqrt(Math.max(0, average))));
    const previousPeak = previous.peaks[i] ?? 0;
    levels.push(level);
    peaks.push(Math.min(1, Math.max(level, previousPeak - PEAK_FALLOFF)));
  }

  return { levels, peaks };
}
