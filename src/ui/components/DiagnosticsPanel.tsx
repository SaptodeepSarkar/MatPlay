import { formatDiagnostic } from '../../library/diagnostics.js';
import type { Diagnostic } from '../../library/types.js';
import type { StitchTheme } from '../stitchTheme.js';

export function DiagnosticsPanel({ diagnostics, theme }: { diagnostics: Diagnostic[]; theme: StitchTheme }): React.ReactNode {
  return (
    <box width={68} borderStyle="single" borderColor={theme.muted} backgroundColor={theme.card} padding={1} flexDirection="column" gap={1}>
      <text fg={theme.accent}><strong>[ LIBRARY DIAGNOSTICS · {diagnostics.length} ]</strong></text>
      <box height={12} overflow="hidden" flexDirection="column">
        {diagnostics.length === 0 ? <text fg={theme.text}>No library problems found.</text> : diagnostics.slice(0, 12).map((item, index) => (
          <text key={`${item.code}-${item.path ?? index}`} fg={item.level === 'error' ? theme.signal : item.level === 'warning' ? theme.accent : theme.muted}>
            {formatDiagnostic(item)}
          </text>
        ))}
      </box>
      <text fg={theme.muted}>D or ESC close</text>
    </box>
  );
}
