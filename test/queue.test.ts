import { describe, expect, it } from 'vitest';
import { buildPlayOrder, stepIndex } from '../src/playback/queue.js';

describe('buildPlayOrder', () => {
  it('is sequential when shuffle is off', () => {
    expect(buildPlayOrder(4, 2, false)).toEqual([0, 1, 2, 3]);
  });

  it('pins the current track first and covers every index when shuffling', () => {
    const order = buildPlayOrder(5, 3, true, () => 0.5);
    expect(order[0]).toBe(3);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('handles empty queues', () => {
    expect(buildPlayOrder(0, 0, true)).toEqual([]);
  });
});

describe('stepIndex', () => {
  const order = [2, 0, 4, 1, 3];

  it('steps within the order', () => {
    expect(stepIndex(order, 2, 1, true)).toBe(0);
    expect(stepIndex(order, 4, -1, true)).toBe(0);
  });

  it('wraps only when looping', () => {
    expect(stepIndex(order, 3, 1, true)).toBe(2);
    expect(stepIndex(order, 3, 1, false)).toBeUndefined();
    expect(stepIndex(order, 2, -1, true)).toBe(3);
    expect(stepIndex(order, 2, -1, false)).toBeUndefined();
  });

  it('recovers unknown positions at the head', () => {
    expect(stepIndex(order, 99, 1, false)).toBe(2);
  });
});
