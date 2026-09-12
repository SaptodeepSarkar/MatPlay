import type { StitchTheme } from '../stitchTheme.js';

export type AlbumArtworkProps = {
  src: string;
  theme: StitchTheme;
  width?: number;
  height?: number;
};

export function AlbumArtwork({ src, width = 26, height = 13 }: AlbumArtworkProps): React.ReactNode {
  // key={src}: the native image view must remount on every cover change.
  // Without it, source updates can be swallowed and the previous track's
  // art (or the Kalyani boot fallback) stays on screen forever.
  return (
    <image
      key={src}
      source={src}
      fit="cover"
      protocol="auto"
      style={{ width, height }}
    />
  );
}
