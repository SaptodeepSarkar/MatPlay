import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const pidPattern = /^\d+$/;

function runBash(command: string): string {
  return execFileSync('bash', ['-lc', command], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('process memory diagnostics', () => {
  it('inspects the requested PID and reports the top memory consumers', () => {
    const pid = process.env.MATPLAY_PID ?? '2755';
    expect(pid).toMatch(pidPattern);

    // Keep this command runnable on the host where the target process exists.
    const processInfo = runBash(
      `ps -p ${pid} -o pid,ppid,user,stat,etime,%cpu,%mem,rss,vsz,comm,args --no-headers || true`,
    ).trim();
    const topConsumers = runBash(
      "ps -eo pid,ppid,%mem,rss,vsz,comm,args --sort=-rss | head -15",
    ).trim();

    if (processInfo.length === 0) {
      console.info(`PID ${pid} is not running (it may have exited or belongs to another namespace).`);
    } else {
      console.info(`Memory details for PID ${pid}:\n${processInfo}`);
    }
    console.info(`Top memory consumers:\n${topConsumers}`);

    expect(topConsumers).toContain('PID');
  });
});
