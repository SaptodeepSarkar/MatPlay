import type { StitchTheme } from '../stitchTheme.js';

export type TrackMetadataProps = {
  trackNo: number;
  title: string;
  artist: string;
  formatLabel: string;
  playlist: string;
  lyricCurrent?: string;
  lyricNext?: string;
  theme: StitchTheme;
};

export function TrackMetadata({
  trackNo,
  title,
  artist,
  formatLabel,
  playlist,
  lyricCurrent,
  lyricNext,
  theme,
}: TrackMetadataProps): React.ReactNode {
  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.accent}>
        <strong>
          SYS // TRACK {String(trackNo).padStart(2, '0')} • DIRECT STREAM
        </strong>
      </text>
      <text fg={theme.text}>
        <strong>{title.toUpperCase()}</strong>
      </text>
      <text fg={theme.muted}>
        {artist.toUpperCase()} {'  /  '}
        {formatLabel}
      </text>
      {lyricCurrent ? (
        <text fg={theme.accent}>
          <strong>♪ {lyricCurrent}</strong>
        </text>
      ) : null}
      {lyricNext ? <text fg={theme.muted}>{lyricNext}</text> : null}
      <text fg={theme.muted}>▤ {playlist}</text>
    </box>
  );
}
