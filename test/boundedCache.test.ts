import { describe, expect, it } from 'vitest';
import { BoundedCache } from '../src/utils/boundedCache.js';

describe('BoundedCache', () => {
  it('evicts the least recently used entry', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.size).toBe(2);
  });

  it('rejects an invalid limit', () => {
    expect(() => new BoundedCache<string, number>(0)).toThrow(RangeError);
  });
});
