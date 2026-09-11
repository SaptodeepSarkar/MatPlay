import { execFile } from 'node:child_process';
import type { StitchTheme } from './stitchTheme.js';

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]: RGB): string {
  const pad = (value: number): string =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  return `#${pad(r)}${pad(g)}${pad(b)}`;
}

function luminance([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

const scale = (color: RGB, factor: number): RGB => [
  color[0] * factor,
  color[1] * factor,
  color[2] * factor,
];

/** Linear interpolation between two themes, for the cover-art fade. */
export function lerpTheme(from: StitchTheme, to: StitchTheme, t: number): StitchTheme {
  const clamped = Math.min(1, Math.max(0, t));
  const mix = (a: string, b: string): string => {
    const rgbA = hexToRgb(a);
    const rgbB = hexToRgb(b);
    return rgbToHex([
      rgbA[0] + (rgbB[0] - rgbA[0]) * clamped,
      rgbA[1] + (rgbB[1] - rgbA[1]) * clamped,
      rgbA[2] + (rgbB[2] - rgbA[2]) * clamped,
    ]);
  };
  return {
    appBg: mix(from.appBg, to.appBg),
    card: mix(from.card, to.card),
    cardAlt: mix(from.cardAlt, to.cardAlt),
    text: mix(from.text, to.text),
    muted: mix(from.muted, to.muted),
    accent: mix(from.accent, to.accent),
    accentInk: mix(from.accentInk, to.accentInk),
    signal: mix(from.signal, to.signal),
  };
}

function readPixels(coverPath: string): Promise<RGB[]> {
  return new Promise((resolve) => {
    execFile(
      'ffmpeg',
      [
        '-v', 'error',
        '-i', coverPath,
        '-vf', 'scale=8:8',
        '-f', 'rawvideo',
        '-pix_fmt', 'rgb24',
        '-',
      ],
      { encoding: 'buffer', maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error || stdout.length < 8 * 8 * 3) {
          resolve([]);
          return;
        }
        const pixels: RGB[] = [];
        for (let i = 0; i < 8 * 8; i++) {
          pixels.push([stdout[i * 3] ?? 0, stdout[i * 3 + 1] ?? 0, stdout[i * 3 + 2] ?? 0]);
        }
        resolve(pixels);
      },
    );
  });
}

/**
 * Sample a cover-art-driven theme using only ffmpeg (downscale to 8x8,
 * derive surfaces from dark pixels and the hero color from saturation).
 * Falls back to `fallback` when sampling fails. No new dependencies.
 */
export async function sampleCoverTheme(
  coverPath: string,
  fallback: StitchTheme,
): Promise<StitchTheme> {
  const pixels = await readPixels(coverPath);
  if (pixels.length === 0) return fallback;

  const byLuminance = [...pixels].sort((a, b) => luminance(a) - luminance(b));
  const darkest = byLuminance[0] ?? hexToRgb(fallback.appBg);
  // Hero color must be visible: most saturated pixel within a sane
  // brightness band, so near-black reds never become the accent.
  const candidates = pixels.filter((pixel) => {
    const lum = luminance(pixel);
    return lum > 0.22 && lum < 0.92;
  });
  const pool = candidates.length > 0 ? candidates : byLuminance;
  const vivid = [...pool].sort((a, b) => saturation(b) - saturation(a))[0]
    ?? hexToRgb(fallback.accent);

  const appBg = scale(darkest, 0.55);
  const card = scale(darkest, 1.15);
  const cardAlt = scale(darkest, 1.9);
  const hero: RGB = saturation(vivid) > 0.2 ? vivid : hexToRgb(fallback.accent);
  const bright = luminance(hero) < 0.22 ? scale(hero, 1.8) : hero;
  const darkPage = luminance(appBg) < 0.45;
  const text: RGB = darkPage ? hexToRgb('#f6e9d2') : hexToRgb('#1a0c08');

  return {
    appBg: rgbToHex(appBg),
    card: rgbToHex(card),
    cardAlt: rgbToHex(cardAlt),
    text: rgbToHex(text),
    muted: rgbToHex(scale(text, darkPage ? 0.62 : 1.7)),
    accent: rgbToHex(bright),
    accentInk: rgbToHex(appBg),
    signal: '#ff5a00',
  };
}
