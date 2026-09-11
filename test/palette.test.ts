import { describe, expect, it } from 'vitest';
import { hexToRgb, lerpTheme, rgbToHex } from '../src/ui/palette.js';
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
});
