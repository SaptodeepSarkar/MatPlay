/**
 * Amazon's device list mixes real speakers with ghosts: Alexa apps on
 * phones/tablets, old registrations, Fire TV, multiroom scaffolding.
 * Only entries with a music player are usable as MatPlay remote targets,
 * so every count/selection here is speakers-only.
 */
export type AlexaDeviceInfo = {
  serial: string;
  name: string;
  family?: string;
  online: boolean;
  music: boolean;
};

/** Pick the remote target: explicit config name/serial first, then best speaker. */
export function pickMusicDevice(
  devices: AlexaDeviceInfo[],
  want: string,
): AlexaDeviceInfo | undefined {
  const needle = want.trim().toLowerCase();
  if (needle) {
    const exact = devices.find(
      (d) => d.name.toLowerCase() === needle || d.serial.toLowerCase() === needle,
    );
    if (exact) return exact;
    const partial = devices.find((d) => d.name.toLowerCase().includes(needle));
    if (partial) return partial;
    // Fail-closed: an explicit pin that matches nothing must not fall
    // through to the wrong room's speaker.
    return undefined;
  }
  const speakers = devices.filter((d) => d.music);
  const pool = speakers.length > 0 ? speakers : devices;
  return pool.find((d) => d.online) ?? pool[0];
}

/** Human status line, e.g. "Kitchen · 1 speaker". */
export function describeDevices(devices: AlexaDeviceInfo[], target?: AlexaDeviceInfo): string {
  const speakers = devices.filter((d) => d.music);
  if (speakers.length === 0) {
    return `no speaker found (${devices.length} app device(s))`;
  }
  const name = target?.name ?? speakers[0]?.name ?? 'Echo';
  const s = speakers.length === 1 ? 'speaker' : 'speakers';
  return `${name} · ${speakers.length} ${s}`;
}
