import type { StitchTheme } from '../stitchTheme.js';

export type AlbumArtworkProps = {
  src: string;
  theme: StitchTheme;
  width?: number;
  height?: number;
};

export function AlbumArtwork({ src, width = 26, height = 13 }: AlbumArtworkProps): React.ReactNode {
  return (
    <image
      source={src}
      fit="cover"
      protocol="auto"
      style={{ width, height }}
    />
  );
}
