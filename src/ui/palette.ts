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

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);
  let hue = 0;
  if (max === rn) hue = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) hue = ((bn - rn) / delta + 2) * 60;
  else hue = ((rn - gn) / delta + 4) * 60;
  return [hue, saturation, lightness];
}

function hslToRgb([h, s, l]: [number, number, number]): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hueToChannel = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  return [
    hueToChannel(p, q, hk + 1 / 3) * 255,
    hueToChannel(p, q, hk) * 255,
    hueToChannel(p, q, hk - 1 / 3) * 255,
  ];
}

/** Hue-rotate a color (180° = complementary). */
export function rotateHue(color: RGB, degrees: number): RGB {
  const [h, s, l] = rgbToHsl(color);
  return hslToRgb([(h + degrees + 360) % 360, s, l]);
}

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
    complement: mix(from.complement, to.complement),
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
  const rawComplement = rotateHue(bright, 180);
  const complement: RGB = luminance(rawComplement) < 0.18
    ? scale(rawComplement, 1.6)
    : rawComplement;

  return {
    appBg: rgbToHex(appBg),
    card: rgbToHex(card),
    cardAlt: rgbToHex(cardAlt),
    text: rgbToHex(text),
    muted: rgbToHex(scale(text, darkPage ? 0.62 : 1.7)),
    accent: rgbToHex(bright),
    accentInk: rgbToHex(appBg),
    signal: '#ff5a00',
    complement: rgbToHex(complement),
  };
}
