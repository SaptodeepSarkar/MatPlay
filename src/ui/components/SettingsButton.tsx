/** Standard Font Awesome cog in a transparent, comfortably sized hit area. */
export function SettingsButton({ color, onActivate }: { color: string; onActivate: () => void }): React.ReactNode {
  return (
    <box width={5} height={3} justifyContent="center" alignItems="center" onMouseDown={onActivate} backgroundColor="transparent">
      <text fg={color}><strong>{'\uf013'}</strong></text>
    </box>
  );
}
