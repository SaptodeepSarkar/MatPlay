import { deflateSync } from 'node:zlib';
import { useMemo } from 'react';
import { hexToRgb } from '../palette.js';

const SIZE = 96;

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

/** Build a transparent PNG with a true circular field and centered gear. */
function settingsIcon(signal: string, ink: string): Uint8Array {
  const [sr, sg, sb] = hexToRgb(signal);
  const [ir, ig, ib] = hexToRgb(ink);
  const rows = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  const center = (SIZE - 1) / 2;

  for (let y = 0; y < SIZE; y++) {
    const row = y * (SIZE * 4 + 1);
    for (let x = 0; x < SIZE; x++) {
      const dx = x - center;
      const dy = y - center;
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const toothPhase = Math.abs((((angle + Math.PI / 8) % (Math.PI / 4)) + Math.PI / 4) % (Math.PI / 4) - Math.PI / 8);
      const gearEdge = toothPhase < 0.105 ? 24 : 19;
      const isGear = radius >= 8 && radius <= gearEdge;
      const alpha = Math.round(255 * Math.min(1, Math.max(0, 44 - radius)));
      const offset = row + 1 + x * 4;
      rows[offset] = isGear ? ir : sr;
      rows[offset + 1] = isGear ? ig : sg;
      rows[offset + 2] = isGear ? ib : sb;
      rows[offset + 3] = alpha;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function SettingsButton({ color, ink, onActivate }: { color: string; ink: string; onActivate: () => void }): React.ReactNode {
  const source = useMemo(() => settingsIcon(color, ink), [color, ink]);
  return (
    <box width={6} height={3} onMouseDown={onActivate} backgroundColor="transparent">
      <image source={source} fit="fit" protocol="auto" style={{ width: 6, height: 3 }} />
    </box>
  );
}
