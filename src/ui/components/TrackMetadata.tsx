import type { StitchTheme } from '../stitchTheme.js';
import { truncateText } from '../text.js';

export type TrackMetadataProps = {
  trackNo: number;
  title: string;
  artist: string;
  formatLabel: string;
  theme: StitchTheme;
  maxWidth?: number;
};

export function TrackMetadata({
  trackNo,
  title,
  artist,
  formatLabel,
  theme,
  maxWidth = 44,
}: TrackMetadataProps): React.ReactNode {
  return (
    <box flexDirection="column" gap={1} backgroundColor="transparent">
      <text fg={theme.accent}>
        <strong>
          SYS // TRACK {String(trackNo).padStart(2, '0')} • DIRECT STREAM
        </strong>
      </text>
      <text fg={theme.text}>
        <strong>{truncateText(title.toUpperCase(), maxWidth)}</strong>
      </text>
      <text fg={theme.muted}>
        {truncateText(`${artist.toUpperCase()}  /  ${formatLabel}`, maxWidth)}
      </text>
    </box>
  );
}
