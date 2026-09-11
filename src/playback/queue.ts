/**
 * Play-order logic: sequential queue or a stable shuffled order.
 * Pure and unit-tested; the UI preloads whatever these helpers resolve.
 */

/** Fisher-Yates order with `startIndex` pinned first. */
export function buildPlayOrder(
  length: number,
  startIndex: number,
  shuffle: boolean,
  random: () => number = Math.random,
): number[] {
  const order = Array.from({ length }, (_, index) => index);
  if (!shuffle || length === 0) return order;
  const start = Math.min(Math.max(0, startIndex), length - 1);
  const rest = order.filter((index) => index !== start);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = rest[i]!;
    rest[i] = rest[j]!;
    rest[j] = tmp;
  }
  return [start, ...rest];
}

/**
 * Resolve the queue index `delta` steps from `current` inside `order`.
 * Returns undefined at a dead end (loop off), so callers can stop instead.
 */
export function stepIndex(
  order: number[],
  current: number,
  delta: 1 | -1,
  loop: boolean,
): number | undefined {
  if (order.length === 0) return undefined;
  const position = order.indexOf(current);
  if (position < 0) return order[0];
  const next = position + delta;
  if (next < 0 || next >= order.length) {
    return loop ? order[(next + order.length) % order.length] : undefined;
  }
  return order[next];
}
