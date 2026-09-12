import { execFile } from 'node:child_process';

export type SinkInput = {
  index: number;
  pid?: number;
  binary?: string;
};

/**
 * Parse `pactl list sinks short` lines.
 * e.g. "2\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 48000Hz\tRUNNING"
 */
export function parseSinksShort(output: string): { index: number; name: string }[] {
  const sinks: { index: number; name: string }[] = [];
  for (const line of output.split('\n')) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const index = Number(parts[0]);
    const name = (parts[1] ?? '').trim();
    if (Number.isInteger(index) && name) sinks.push({ index, name });
  }
  return sinks;
}

/** BlueZ sink names embed the MAC with underscores: AA:BB:.. -> AA_BB_... */
export function findBluezSink(sinks: { name: string }[], mac: string): string | undefined {
  const flat = mac.trim().toUpperCase().replaceAll(':', '_');
  return sinks.map((s) => s.name).find((name) => name.toUpperCase().includes(flat));
}

/**
 * Parse `pactl list sink-inputs` into inputs with owning PID/binary.
 * Only the properties block matters; entries without PIDs are skipped by
 * callers that move streams (they can't be attributed safely).
 */
export function parseSinkInputs(output: string): SinkInput[] {
  const inputs: SinkInput[] = [];
  const blocks = output.split(/^Sink Input #/m);
  for (const block of blocks) {
    const indexMatch = /^(\d+)/.exec(block.trim());
    if (!indexMatch) continue;
    const pidMatch = /application\.process\.id\s*=\s*"(\d+)"/.exec(block);
    const binMatch = /application\.process\.binary\s*=\s*"([^"]+)"/.exec(block);
    inputs.push({
      index: Number(indexMatch[1]),
      pid: pidMatch ? Number(pidMatch[1]) : undefined,
      binary: binMatch ? binMatch[1] : undefined,
    });
  }
  return inputs;
}

function runPactl(args: string[], timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('pactl', args, { timeout: timeoutMs }, (error, stdout) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      resolve(String(stdout));
    });
  });
}

/**
 * Automatic audio routing for the private Echo link (Linux + PipeWire/Pulse).
 *
 * On link: remember the current default sink, switch the default to the
 * Echo's BlueZ sink, and move ONLY MatPlay's own decoder streams (matched
 * by child PID — earphone streams and other apps are never moved).
 * On unlink: restore the saved default and move our streams back.
 * Everything fails soft: no pactl / no BlueZ sink = manual routing, link
 * itself still works.
 */
export class AudioRoute {
  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'linux') return false;
    try {
      await runPactl(['info'], 5000);
      return true;
    } catch {
      return false;
    }
  }

  async getDefaultSink(): Promise<string | undefined> {
    try {
      const output = await runPactl(['get-default-sink']);
      const name = output.trim();
      return name || undefined;
    } catch {
      return undefined;
    }
  }

  async findEchoSink(mac: string): Promise<string | undefined> {
    try {
      return findBluezSink(parseSinksShort(await runPactl(['list', 'sinks', 'short'])), mac);
    } catch {
      return undefined;
    }
  }

  /** Route MatPlay's decoders to the Echo. Returns a restore token. */
  async routeToEcho(mac: string, ourPids: number[]): Promise<{ previousSink?: string; echoSink: string }> {
    const previousSink = await this.getDefaultSink();
    const echoSink = await this.findEchoSink(mac);
    if (!echoSink) throw new Error('Echo Bluetooth sink not found — is the link up?');
    await runPactl(['set-default-sink', echoSink]);
    await this.moveOurs(echoSink, ourPids);
    return { previousSink, echoSink };
  }

  async restore(previousSink: string | undefined, ourPids: number[]): Promise<void> {
    if (previousSink) {
      try {
        await runPactl(['set-default-sink', previousSink]);
      } catch {
        // Best-effort.
      }
      await this.moveOurs(previousSink, ourPids);
    }
  }

  /** Move ONLY streams owned by our decoder PIDs. */
  private async moveOurs(sink: string, ourPids: number[]): Promise<void> {
    if (ourPids.length === 0) return;
    let inputs: SinkInput[] = [];
    try {
      inputs = parseSinkInputs(await runPactl(['list', 'sink-inputs']));
    } catch {
      return;
    }
    const ours = new Set(ourPids);
    for (const input of inputs) {
      if (input.pid !== undefined && ours.has(input.pid)) {
        try {
          await runPactl(['move-sink-input', String(input.index), sink]);
        } catch {
          // Stream may have ended mid-move; ignore.
        }
      }
    }
  }
}
