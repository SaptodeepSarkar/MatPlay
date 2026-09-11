import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb, lerpTheme, rgbToHex, themeFromPixels } from '../src/ui/palette.js';
import { KALYANI_COVER_THEME, stitchFallbackTheme } from '../src/ui/stitchTheme.js';

describe('palette helpers', () => {
  it('round-trips hex colors', () => {
    expect(rgbToHex(hexToRgb('#d9ab4e'))).toBe('#d9ab4e');
  });

  it('interpolates themes for the fade', () => {
    const mid = lerpTheme(KALYANI_COVER_THEME, stitchFallbackTheme, 0.5);
    expect(mid.appBg).not.toBe(KALYANI_COVER_THEME.appBg);
    expect(mid.appBg).not.toBe(stitchFallbackTheme.appBg);
    expect(lerpTheme(KALYANI_COVER_THEME, stitchFallbackTheme, 0).appBg).toBe(
      KALYANI_COVER_THEME.appBg,
    );
    expect(lerpTheme(KALYANI_COVER_THEME, stitchFallbackTheme, 1).appBg).toBe(
      stitchFallbackTheme.appBg,
    );
    expect(lerpTheme(KALYANI_COVER_THEME, stitchFallbackTheme, 99).appBg).toBe(
      stitchFallbackTheme.appBg,
    );
  });

  it('darkens neon covers and guarantees readable token contrast', () => {
    const theme = themeFromPixels([
      [0, 0, 255],
      [0, 20, 240],
      [0, 220, 255],
      [15, 15, 30],
    ], KALYANI_COVER_THEME);
    const background = hexToRgb(theme.appBg);

    expect(contrastRatio(hexToRgb(theme.text), background)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(hexToRgb(theme.muted), background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexToRgb(theme.accent), background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexToRgb(theme.accentInk), hexToRgb(theme.accent))).toBeGreaterThanOrEqual(4.5);
    expect(theme.appBg).not.toBe('#0000b3');
  });

  it('preserves the hue family of ordinary cover palettes', () => {
    const theme = themeFromPixels([
      [32, 7, 5],
      [58, 16, 9],
      [217, 171, 78],
      [246, 233, 210],
    ], KALYANI_COVER_THEME);
    const [r, , b] = hexToRgb(theme.appBg);
    expect(r).toBeGreaterThan(b);
  });
});
