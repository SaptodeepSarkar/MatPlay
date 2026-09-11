/**
 * Stitch "Monochrome Terminal Audio" theme, extended for cover-art-adaptive
 * color. All components must read colors from a `StitchTheme` — never
 * hardcode hex — so the palette can follow the current cover art.
 */
export type StitchTheme = {
  /** Full-bleed page background. */
  appBg: string;
  /** Card / panel surface. */
  card: string;
  /** Inactive pills, dividers, hairlines. */
  cardAlt: string;
  /** Primary text. */
  text: string;
  /** Secondary text, inactive glyphs. */
  muted: string;
  /** Hero color: PLAYING pill, active toggles, progress fill. */
  accent: string;
  /** Text drawn on top of the accent. */
  accentInk: string;
  /** Tactical signal: playhead knob, live dots only. */
  signal: string;
};

/** Static fallback when no cover art is available. */
export const stitchFallbackTheme: StitchTheme = {
  appBg: '#f4f4f2',
  card: '#ffffff',
  cardAlt: '#e2e3e1',
  text: '#0a0a0a',
  muted: '#8c8c88',
  accent: '#0a0a0a',
  accentInk: '#f4f4f2',
  signal: '#ff3e00',
};

/** Palette sampled from cover art (dominant bg, surface, text, hero, signal). */
export type CoverPalette = {
  appBg: string;
  card: string;
  cardAlt: string;
  text: string;
  muted: string;
  accent: string;
  accentInk: string;
  signal: string;
};

/**
 * Build a UI theme from a cover-art palette. Today the palette is sampled
 * offline; later this takes raw art bytes and samples internally.
 */
export function themeFromCoverArt(palette: CoverPalette): StitchTheme {
  return { ...palette };
}

/** Palette sampled from the KALYANI cover art (maroon damask + gold). */
export const KALYANI_COVER_THEME: StitchTheme = themeFromCoverArt({
  appBg: '#200705',
  card: '#3a1009',
  cardAlt: '#5c2312',
  text: '#f6e9d2',
  muted: '#c08a5e',
  accent: '#d9ab4e',
  accentInk: '#2a0d05',
  signal: '#ff5a00',
});
