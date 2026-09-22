import { describe, expect, it, vi } from 'vitest';
import { Mpg123Backend } from '../src/playback/Mpg123Backend.js';

describe('mpg123 load acknowledgement cleanup', () => {
  it('does not retain timed-out load waiters', async () => {
    vi.useFakeTimers();
    try {
      const backend = new Mpg123Backend() as unknown as {
        waitForLoadAck: () => Promise<void>;
        loadWaiters: Set<() => void>;
      };
      const pending = Array.from({ length: 2000 }, () => backend.waitForLoadAck());
      expect(backend.loadWaiters.size).toBe(2000);
      await vi.advanceTimersByTimeAsync(2000);
      await Promise.all(pending);
      expect(backend.loadWaiters.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
