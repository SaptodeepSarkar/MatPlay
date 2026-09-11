import type { StitchTheme } from '../stitchTheme.js';

export type AlbumArtworkProps = {
  src: string;
  theme: StitchTheme;
};

export function AlbumArtwork({ src, theme }: AlbumArtworkProps): React.ReactNode {
  return (
    <box borderStyle="single" borderColor={theme.muted}>
      <image
        source={src}
        fit="cover"
        protocol="auto"
        style={{ width: 26, height: 13 }}
      />
    </box>
  );
}
