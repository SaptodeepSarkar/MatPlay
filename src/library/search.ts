import type { Track } from './types.js';

export type SearchHit = {
  track: Track;
  /** 0 = playlist, 1 = artist, 2 = title match strength tier. */
  tier: number;
};

/**
 * Local substring search over title, artist, and playlist.
 * Ranked: title prefix > title substring > artist > playlist.
 */
export function searchTracks(tracks: Track[], query: string, limit = 12): Track[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];
  for (const track of tracks) {
    const title = track.title.toLowerCase();
    const artist = track.artist.toLowerCase();
    const playlist = track.playlist.toLowerCase();
    let tier = -1;
    if (title.startsWith(q)) tier = 3;
    else if (title.includes(q)) tier = 2;
    else if (artist.includes(q)) tier = 1;
    else if (playlist.includes(q)) tier = 0;
    if (tier >= 0) hits.push({ track, tier });
  }

  hits.sort((a, b) => b.tier - a.tier);
  return hits.slice(0, limit).map((hit) => hit.track);
}
