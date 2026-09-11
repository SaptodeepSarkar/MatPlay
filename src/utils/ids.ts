import { createHash } from 'node:crypto';

/**
 * Stable deterministic IDs derived from relative paths, so a track keeps
 * the same ID across rescans as long as it stays in the same location.
 */
export function stableId(input: string): string {
  return createHash('sha1').update(input, 'utf8').digest('hex').slice(0, 12);
}

export function playlistId(playlistName: string): string {
  return stableId(`playlist:${playlistName}`);
}

export function artistId(playlistName: string, artistName: string): string {
  return stableId(`artist:${playlistName}/${artistName}`);
}

export function trackId(
  playlistName: string,
  artistName: string,
  songName: string,
): string {
  return stableId(`track:${playlistName}/${artistName}/${songName}`);
}
