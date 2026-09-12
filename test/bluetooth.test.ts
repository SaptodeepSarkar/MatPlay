import { describe, expect, it } from 'vitest';
import {
  normalizeMac,
  parseBluetoothctlDevices,
  parseInfoConnected,
} from '../src/bluetooth/manager.js';

describe('bluetooth private link', () => {
  it('parses bluetoothctl device lines', () => {
    const devices = parseBluetoothctlDevices(
      'Device AA:BB:CC:DD:EE:FF Echo Kitchen\nDevice 11:22:33:44:55:66 Earphones\nnoise\n',
    );
    expect(devices).toEqual([
      { mac: 'AA:BB:CC:DD:EE:FF', name: 'Echo Kitchen' },
      { mac: '11:22:33:44:55:66', name: 'Earphones' },
    ]);
  });

  it('normalizes MACs and rejects junk', () => {
    expect(normalizeMac('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(normalizeMac('not-a-mac')).toBeUndefined();
  });

  it('detects connected state from info output', () => {
    expect(parseInfoConnected('Device AA:BB:CC:DD:EE:FF\n\tConnected: yes\n')).toBe(true);
    expect(parseInfoConnected('Device AA:BB:CC:DD:EE:FF\n\tConnected: no\n')).toBe(false);
  });
});
