import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import type { Track } from '../library/types.js';

export type TrackMeta = {
  title: string;
  artist: string;
  formatLabel: string;
  durationMs: number | undefined;
  coverSrc: string;
};

const COVER_CACHE = path.join(os.tmpdir(), 'matplay-covers');

/** Synchronous folder-name fallback shown while tags load. */
export function metaFromFolder(track: Track, fallbackCover: string): TrackMeta {
  return {
    title: track.title,
    artist: track.artist,
    formatLabel: 'MP3',
    durationMs: undefined,
    coverSrc: fallbackCover,
  };
}

/**
 * Enrich a scanned track with real tags, duration, and extracted cover art.
 * Never throws: falls back to folder names and the provided cover.
 */
export async function loadTrackMeta(
  track: Track,
  fallbackCover: string,
): Promise<TrackMeta> {
  const meta = metaFromFolder(track, fallbackCover);
  try {
    const parsed = await parseFile(track.audioPath, { duration: true });
    if (parsed.common.title) meta.title = parsed.common.title;
    if (parsed.common.artist) meta.artist = parsed.common.artist;

    const parts: string[] = [];
    const codec = (parsed.format.codec ?? 'mp3')
      .toUpperCase()
      .replace('MPEG 1 LAYER 3', 'MP3');
    parts.push(codec);
    if (parsed.format.bitrate) parts.push(`${Math.round(parsed.format.bitrate / 1000)}KBPS`);
    if (parsed.format.sampleRate) parts.push(`${(parsed.format.sampleRate / 1000).toFixed(1)}KHZ`);
    meta.formatLabel = parts.join(' · ');

    if (typeof parsed.format.duration === 'number' && Number.isFinite(parsed.format.duration)) {
      meta.durationMs = Math.round(parsed.format.duration * 1000);
    }

    const picture = parsed.common.picture?.[0];
    if (picture?.data?.length) {
      mkdirSync(COVER_CACHE, { recursive: true });
      const coverPath = path.join(COVER_CACHE, `${track.id}.jpg`);
      if (!existsSync(coverPath)) {
        writeFileSync(coverPath, Buffer.from(picture.data));
      }
      meta.coverSrc = coverPath;
    }
  } catch {
    // Keep folder-name fallback.
  }
  return meta;
}
