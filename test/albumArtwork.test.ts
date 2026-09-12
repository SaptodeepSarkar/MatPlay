import { describe, expect, it } from 'vitest';
import { AlbumArtwork } from '../src/ui/components/AlbumArtwork.js';
import { KALYANI_COVER_THEME } from '../src/ui/stitchTheme.js';

// Regression: the native image view must remount on every cover change,
// otherwise the previous track's art sticks (e.g. a no-art song wearing
// MONTAGEM ROYAL's cover, or the Kalyani boot fallback forever).
describe('AlbumArtwork', () => {
  it('keys the image by source so cover swaps reload', () => {
    const first = AlbumArtwork({ src: '/tmp/covers/aaa.jpg', theme: KALYANI_COVER_THEME });
    const second = AlbumArtwork({ src: '/tmp/covers/bbb.jpg', theme: KALYANI_COVER_THEME });
    expect(first).toMatchObject({ key: '/tmp/covers/aaa.jpg' });
    expect(second).toMatchObject({ key: '/tmp/covers/bbb.jpg' });
    expect(first.key).not.toBe(second.key);
  });
});
