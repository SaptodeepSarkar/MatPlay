import type { StitchTheme } from '../stitchTheme.js';

export type TrackMetadataProps = {
  trackNo: number;
  title: string;
  artist: string;
  formatLabel: string;
  theme: StitchTheme;
};

export function TrackMetadata({
  trackNo,
  title,
  artist,
  formatLabel,
  theme,
}: TrackMetadataProps): React.ReactNode {
  return (
    <box flexDirection="column" gap={1} backgroundColor="transparent">
      <text fg={theme.accent}>
        <strong>
          SYS // TRACK {String(trackNo).padStart(2, '0')} • DIRECT STREAM
        </strong>
      </text>
      <text fg={theme.text}>
        <strong>{title.toUpperCase()}</strong>
      </text>
      <text fg={theme.muted}>
        {artist.toUpperCase()}  /  {formatLabel}
      </text>
    </box>
  );
}
