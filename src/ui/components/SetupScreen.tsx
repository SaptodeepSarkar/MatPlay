import { useEffect, useRef } from 'react';
import type { InputRenderable } from '@opentui/core';
import type { Diagnostic } from '../../library/types.js';
import type { StitchTheme } from '../stitchTheme.js';

export type SetupScreenProps = {
  path: string;
  diagnostics: Diagnostic[];
  theme: StitchTheme;
  onPath: (path: string) => void;
};

export function SetupScreen({ path, diagnostics, theme, onPath }: SetupScreenProps): React.ReactNode {
  const inputRef = useRef<InputRenderable | null>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const error = diagnostics.find((item) => item.level === 'error');

  return (
    <box width="100%" height="100%" justifyContent="center" alignItems="center" backgroundColor={theme.appBg}>
      <box width={64} borderStyle="single" borderColor={error ? theme.signal : theme.accent} backgroundColor={theme.card} padding={2} flexDirection="column" gap={1}>
        <text fg={theme.accent}><strong>[ WELCOME TO MATPLAY ]</strong></text>
        <text fg={theme.text}>Choose the folder that contains your playlist folders.</text>
        <text fg={theme.muted}>Expected: playlist / artist / song / song.mp3</text>
        <box borderStyle="single" borderColor={theme.muted} paddingX={1}>
          <input ref={inputRef} focused value={path} placeholder="/path/to/music" onInput={onPath} />
        </box>
        {error ? <text fg={theme.signal}>{error.message}</text> : null}
        <text fg={theme.muted}>ENTER validate and continue · q quit</text>
      </box>
    </box>
  );
}
