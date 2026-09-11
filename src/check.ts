import { execFileSync } from 'node:child_process';

type Check = { name: string; ok: boolean; detail: string };

function commandVersion(command: string, args: string[]): string | undefined {
  try {
    const output = execFileSync(command, args, {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 8000,
    }).toString();
    return output.split('\n')[0]?.trim();
  } catch {
    return undefined;
  }
}

function majorMinor(version: string): [number, number] {
  const match = /(\d+)\.(\d+)/.exec(version);
  return [Number(match?.[1] ?? 0), Number(match?.[2] ?? 0)];
}

async function main(): Promise<void> {
  const checks: Check[] = [];

  const [major, minor] = majorMinor(process.version);
  checks.push({
    name: 'node >= 26.4',
    ok: major > 26 || (major === 26 && minor >= 4),
    detail: process.version,
  });

  const ffmpeg = commandVersion('ffmpeg', ['-version']);
  checks.push({ name: 'ffmpeg', ok: ffmpeg !== undefined, detail: ffmpeg ?? 'missing' });

  const ffplay = commandVersion('ffplay', ['-version']);
  checks.push({
    name: 'ffplay (audio output)',
    ok: ffplay !== undefined,
    detail: ffplay ?? 'missing — playback will be silent',
  });

  const cava = commandVersion('cava', ['-v']);
  checks.push({
    name: 'cava (live spectrum)',
    ok: cava !== undefined,
    detail: cava ?? 'missing — procedural visualizer fallback',
  });

  let fifo = false;
  if (process.platform !== 'win32') {
    try {
      execFileSync('mkfifo', ['--version'], { stdio: 'ignore' });
      fifo = true;
    } catch {
      fifo = false;
    }
  }
  checks.push({
    name: 'fifo (private spectrum feed)',
    ok: process.platform === 'win32' ? false : fifo,
    detail:
      process.platform === 'win32'
        ? 'unavailable on Windows — procedural fallback'
        : fifo
          ? 'ok'
          : 'missing mkfifo',
  });

  let failed = false;
  for (const check of checks) {
    if (!check.ok && (check.name.startsWith('node') || check.name === 'ffmpeg')) {
      failed = true;
    }
    // eslint-disable-next-line no-console
    console.log(`${check.ok ? 'PASS' : 'WARN'}  ${check.name} — ${check.detail}`);
  }
  process.exitCode = failed ? 1 : 0;
}

void main();
