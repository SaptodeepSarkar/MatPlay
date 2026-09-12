import { describe, expect, it } from 'vitest';
import {
  looksLikeEcho,
  matchByName,
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

  it('matches speaker names against Echo Dot adapter names', () => {
    const devices = [
      { mac: 'AA:BB:CC:DD:EE:FF', name: 'Echo Dot-ABC' },
      { mac: '11:22:33:44:55:66', name: 'Earphones' },
    ];
    // Shared token: "RJ" vs "Echo Dot RJ".
    expect(matchByName(
      [{ mac: 'AA:BB:CC:DD:EE:FF', name: 'Echo Dot RJ' }],
      'RJ',
    )?.mac).toBe('AA:BB:CC:DD:EE:FF');
    // Account name vs adapter name with shared token.
    expect(matchByName(devices, 'Kitchen Echo')?.mac).toBe('AA:BB:CC:DD:EE:FF');
    // Nothing shared with the earphones.
    expect(matchByName(devices, 'Kitchen')).toBeUndefined();
    expect(matchByName(devices, '')).toBeUndefined();
  });

  it('recognizes Echo-like adapter names only', () => {
    expect(looksLikeEcho('Echo Dot-ABC')).toBe(true);
    expect(looksLikeEcho('Alexa')).toBe(true);
    expect(looksLikeEcho('Earphones')).toBe(false);
  });
});
