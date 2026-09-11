import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb, lerpTheme, rgbToHex, themeFromPixels } from '../src/ui/palette.js';
import { KALYANI_COVER_THEME, stitchFallbackTheme } from '../src/ui/stitchTheme.js';

function saturation([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

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

  it('keeps neutral cover accents in the cover hue family', () => {
    const theme = themeFromPixels([
      [192, 178, 150],
      [139, 119, 101],
      [45, 45, 45],
      [28, 28, 28],
    ], KALYANI_COVER_THEME);
    // Accent must NOT inherit the fallback (previous song's) accent.
    expect(theme.accent).not.toBe(KALYANI_COVER_THEME.accent);
    // For a neutral cover, the accent should be low-saturation (warm gray/beige).
    expect(saturation(hexToRgb(theme.accent))).toBeLessThan(0.3);
  });
});
