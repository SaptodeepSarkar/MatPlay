import { describe, expect, it } from 'vitest';
import { describeDevices, pickMusicDevice, type AlexaDeviceInfo } from '../src/alexa/devices.js';

const DEVICES: AlexaDeviceInfo[] = [
  { serial: 'phone1', name: 'Saptodeep Phone', online: true, music: false },
  { serial: 'echo1', name: 'Kitchen', family: 'ECHO', online: true, music: true },
  { serial: 'echo2', name: 'Bedroom', family: 'ECHO', online: false, music: true },
];

describe('pickMusicDevice', () => {
  it('prefers an explicit name/serial over everything else', () => {
    expect(pickMusicDevice(DEVICES, 'bedroom')?.serial).toBe('echo2');
    expect(pickMusicDevice(DEVICES, 'echo1')?.serial).toBe('echo1');
  });

  it('ignores phone apps and picks the online speaker by default', () => {
    expect(pickMusicDevice(DEVICES, '')?.serial).toBe('echo1');
  });

  it('fails closed when an explicit pin matches nothing', () => {
    expect(pickMusicDevice([], '')).toBeUndefined();
    expect(pickMusicDevice(DEVICES, 'nope')).toBeUndefined();
  });
});

describe('describeDevices', () => {
  it('counts speakers only, not phone apps', () => {
    expect(describeDevices(DEVICES, DEVICES[1])).toBe('Kitchen · 2 speakers');
    expect(describeDevices([DEVICES[0]])).toBe('no speaker found (1 app device(s))');
  });
});
