import { execFile } from 'node:child_process';

export type BluetoothDevice = {
  mac: string;
  name: string;
};

export type BluetoothLinkState =
  | 'off'
  | 'linking'
  | 'linked'
  | 'no-bluetooth'
  | 'error';

export type BluetoothLinkStatus = {
  state: BluetoothLinkState;
  /** Human name of the Echo on the private link (when linked). */
  deviceName?: string;
  detail?: string;
};

const MAC_RE = /^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/i;

export function normalizeMac(value: string): string | undefined {
  const mac = value.trim().toUpperCase();
  return MAC_RE.test(mac) ? mac : undefined;
}

/**
 * Parse `bluetoothctl devices` output. Pure + unit-tested.
 * Lines look like: "Device AA:BB:CC:DD:EE:FF Echo Kitchen".
 */
export function parseBluetoothctlDevices(output: string): BluetoothDevice[] {
  const devices: BluetoothDevice[] = [];
  for (const line of output.split('\n')) {
    const match = /^Device\s+([0-9A-F:]{17})\s+(.+?)\s*$/.exec(line.trim());
    if (!match) continue;
    const mac = normalizeMac(match[1] ?? '');
    const name = (match[2] ?? '').trim();
    if (mac && name) devices.push({ mac, name });
  }
  return devices;
}

/** Parse `bluetoothctl info <mac>` — connected iff it reports Connected: yes. */
export function parseInfoConnected(output: string): boolean {
  return /^\s*Connected:\s*yes\s*$/im.test(output);
}

function runBlutoothctl(args: string[], timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('bluetoothctl', args, { timeout: timeoutMs }, (error, stdout) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      resolve(String(stdout));
    });
  });
}

/**
 * Private Echo link over Bluetooth.
 *
 * Rules (non-negotiable):
 * - Only the configured Echo MAC is ever connected/disconnected. Existing
 *   links (earphones, speakers, other apps' routes) are never touched.
 * - No scanning/pairing here: the Echo must already be paired once
 *   (say "Alexa, pair", pair from OS settings). We only manage the link.
 * - Linux-only (`bluetoothctl`); elsewhere reports `no-bluetooth` and the
 *   app silently defaults to normal local playback with Echo UI hidden.
 */
export class BluetoothLink {
  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'linux') return false;
    try {
      await runBlutoothctl(['show'], 5000);
      return true;
    } catch {
      return false;
    }
  }

  async listDevices(): Promise<BluetoothDevice[]> {
    const output = await runBlutoothctl(['devices']);
    return parseBluetoothctlDevices(output);
  }

  async isConnected(mac: string): Promise<boolean> {
    const valid = normalizeMac(mac);
    if (!valid) return false;
    try {
      return parseInfoConnected(await runBlutoothctl(['info', valid]));
    } catch {
      return false;
    }
  }

  /** Resolve the Echo MAC: explicit config wins, else match by speaker name. */
  async resolveEchoMac(configuredMac: string, nameHint: string): Promise<BluetoothDevice | undefined> {
    const explicit = normalizeMac(configuredMac);
    if (explicit) {
      try {
        const devices = await this.listDevices();
        return devices.find((d) => d.mac === explicit) ?? { mac: explicit, name: nameHint || explicit };
      } catch {
        return { mac: explicit, name: nameHint || explicit };
      }
    }
    const needle = nameHint.trim().toLowerCase();
    if (!needle) return undefined;
    const devices = await this.listDevices();
    return (
      devices.find((d) => d.name.toLowerCase() === needle) ??
      devices.find((d) => d.name.toLowerCase().includes(needle))
    );
  }

  /** Connect ONLY the Echo MAC. Never disconnects anything else first. */
  async connectEcho(mac: string): Promise<void> {
    const valid = normalizeMac(mac);
    if (!valid) throw new Error('invalid Echo Bluetooth MAC');
    if (await this.isConnected(valid)) return;
    await runBlutoothctl(['connect', valid], 15000);
  }

  /** Disconnect ONLY the Echo MAC. Earphones and other links are untouched. */
  async disconnectEcho(mac: string): Promise<void> {
    const valid = normalizeMac(mac);
    if (!valid) return;
    try {
      if (!(await this.isConnected(valid))) return;
    } catch {
      return;
    }
    try {
      await runBlutoothctl(['disconnect', valid], 10000);
    } catch {
      // Best-effort: link may already be gone.
    }
  }
}
