import type { StitchTheme } from '../stitchTheme.js';

export type AlbumArtworkProps = {
  src: string;
  theme: StitchTheme;
};

export function AlbumArtwork({ src }: AlbumArtworkProps): React.ReactNode {
  return (
    <image
      source={src}
      fit="cover"
      protocol="auto"
      style={{ width: 26, height: 13 }}
    />
  );
}
