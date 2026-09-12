import { describe, expect, it } from 'vitest';
import {
  findBluezSink,
  parseSinkInputs,
  parseSinksShort,
} from '../src/platform/audioRoute.js';

describe('audio routing', () => {
  it('parses pactl sinks and finds the Echo BlueZ sink by MAC', () => {
    const sinks = parseSinksShort(
      '1\talsa_output.pci-0000_00_1f.3.analog-stereo\tPipeWire\ts16le 2ch 48000Hz\tIDLE\n' +
      '2\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 48000Hz\tIDLE\n',
    );
    expect(sinks).toHaveLength(2);
    expect(findBluezSink(sinks, 'AA:BB:CC:DD:EE:FF')).toBe('bluez_output.AA_BB_CC_DD_EE_FF.1');
    expect(findBluezSink(sinks, '11:22:33:44:55:66')).toBeUndefined();
  });

  it('parses sink-inputs with owning PIDs for selective moves', () => {
    const inputs = parseSinkInputs(
      'Sink Input #5\n\tDriver: PipeWire\n\tapplication.process.id = "1234"\n\tapplication.process.binary = "ffplay"\n' +
      'Sink Input #6\n\tDriver: PipeWire\n\tapplication.process.id = "9999"\n\tapplication.process.binary = "firefox"\n',
    );
    expect(inputs).toEqual([
      { index: 5, pid: 1234, binary: 'ffplay' },
      { index: 6, pid: 9999, binary: 'firefox' },
    ]);
  });
});
