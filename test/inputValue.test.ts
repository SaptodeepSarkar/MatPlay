import { describe, expect, it } from 'vitest';
import { mergeInputValue } from '../src/ui/inputValue.js';

describe('input value reconciliation', () => {
  it('retains characters emitted one at a time across rerenders', () => {
    let value = '';
    for (const character of ['k', 'a', 'l']) value = mergeInputValue(value, character);
    expect(value).toBe('kal');
  });

  it('accepts complete values and backspace events', () => {
    expect(mergeInputValue('ka', 'kal')).toBe('kal');
    expect(mergeInputValue('kal', 'ka')).toBe('ka');
    expect(mergeInputValue('kal', '')).toBe('ka');
  });

  it('keeps repeated characters', () => {
    expect(mergeInputValue('k', 'k')).toBe('kk');
  });
});
