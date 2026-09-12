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

/** Echo Dot / Echo / Alexa adapter names never equal account names. */
export function looksLikeEcho(name: string): boolean {
  return /echo|alexa|\bdot\b/i.test(name);
}

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
}

/**
 * Match a configured speaker name against BT adapter names. Pure +
 * unit-tested. Matches exact, either-direction substring, or any shared
 * 2+ char token ("RJ" vs "Echo Dot RJ", "Kitchen" vs "Kitchen Echo").
 */
export function matchByName(devices: BluetoothDevice[], hint: string): BluetoothDevice | undefined {
  const needle = hint.trim().toLowerCase();
  if (!needle) return undefined;
  const exact = devices.find((d) => d.name.toLowerCase() === needle);
  if (exact) return exact;
  const sub = devices.find(
    (d) => d.name.toLowerCase().includes(needle) || needle.includes(d.name.toLowerCase()),
  );
  if (sub) return sub;
  const hintTokens = new Set(tokens(needle));
  if (hintTokens.size === 0) return undefined;
  return devices.find((d) => tokens(d.name).some((t) => hintTokens.has(t)));
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
      // No default controller via `show`, but the agent may still list.
      try {
        await runBlutoothctl(['devices'], 5000);
        return true;
      } catch {
        return false;
      }
    }
  }

  async listDevices(): Promise<BluetoothDevice[]> {
    const seen = new Map<string, BluetoothDevice>();
    // `devices` covers known devices; `paired-devices` catches entries some
    // BlueZ versions omit from the former. Merge, dedupe by MAC.
    for (const args of [['devices'], ['paired-devices']] as const) {
      try {
        for (const device of parseBluetoothctlDevices(await runBlutoothctl([...args]))) {
          if (!seen.has(device.mac)) seen.set(device.mac, device);
        }
      } catch {
        // One source failing must not hide the other.
      }
    }
    return [...seen.values()];
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

  /**
   * Resolve the Echo among paired Bluetooth devices.
   *
   * Order (first hit wins, earphones never selected by accident):
   * 1. Explicit `bluetoothMac` from config.
   * 2. Speaker-name match against BT names (exact, either-direction
   *    substring, or shared token — BT names like "Echo Dot-XXX" rarely
   *    equal the Alexa account name like "Kitchen").
   * 3. A CONNECTED device whose name looks like an Echo
   *    (/echo|alexa|dot/i) — covers "already connected, name differs".
   * 4. Otherwise undefined, with the full candidate list for diagnostics
   *    so the UI can tell the user exactly what MatPlay sees.
   */
  async resolveEchoMac(
    configuredMac: string,
    nameHint: string,
  ): Promise<{ device?: BluetoothDevice; candidates: BluetoothDevice[] }> {
    let candidates: BluetoothDevice[] = [];
    try {
      candidates = await this.listDevices();
    } catch {
      candidates = [];
    }
    const explicit = normalizeMac(configuredMac);
    if (explicit) {
      const known = candidates.find((d) => d.mac === explicit);
      return { device: known ?? { mac: explicit, name: nameHint || explicit }, candidates };
    }
    const byName = matchByName(candidates, nameHint);
    if (byName) return { device: byName, candidates };
    // Fallback: the Echo the user already connected (e.g. an "Echo Dot-XXX"
    // whose name matches nothing in config). Only Echo-like names qualify —
    // a connected earphone must never be adopted.
    for (const candidate of candidates) {
      if (!looksLikeEcho(candidate.name)) continue;
      try {
        if (await this.isConnected(candidate.mac)) return { device: candidate, candidates };
      } catch {
        // Ignore and keep scanning.
      }
    }
    return { device: undefined, candidates };
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
