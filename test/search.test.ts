import { describe, expect, it } from 'vitest';
import { searchTracks } from '../src/library/search.js';
import type { Track } from '../src/library/types.js';

const TRACKS: Track[] = [
  {
    id: 'a', title: 'Kalyani', artist: 'ARJN', playlist: 'Work',
    songFolder: '/w', audioPath: '/w/a.mp3',
  },
  {
    id: 'b', title: 'Aasa Kooda', artist: 'Sai Abhyankkar', playlist: 'Work',
    songFolder: '/w', audioPath: '/w/b.mp3',
  },
  {
    id: 'c', title: 'Midnight Raga', artist: 'ARJN Jr', playlist: 'Jupiter',
    songFolder: '/j', audioPath: '/j/c.mp3',
  },
];

describe('searchTracks', () => {
  it('ranks title-prefix above title-substring above artist above playlist', () => {
    expect(searchTracks(TRACKS, 'kal').map((t) => t.id)).toEqual(['a']);
    expect(searchTracks(TRACKS, 'arjn').map((t) => t.id)).toEqual(['a', 'c']);
    expect(searchTracks(TRACKS, 'jup').map((t) => t.id)).toEqual(['c']);
  });

  it('is case-insensitive and ignores blank queries', () => {
    expect(searchTracks(TRACKS, 'KALYANI').map((t) => t.id)).toEqual(['a']);
    expect(searchTracks(TRACKS, '   ')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(searchTracks(TRACKS, 'a', 1)).toHaveLength(1);
  });
});
