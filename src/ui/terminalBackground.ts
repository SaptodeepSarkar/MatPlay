const OSC_TERMINATOR = '\x1b\\';

function canControlTerminal(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.MATPLAY_NO_TERMINAL_COLOR !== '1';
}

/**
 * Ask the terminal emulator to use MatPlay's page color as its default
 * background. In foot this also paints configured window padding, which is
 * outside OpenTUI's drawable cell grid.
 */
export function syncTerminalBackground(color: string): void {
  if (!canControlTerminal()) return;
  // Swiss-cheese: never emit unvalidated color into an OSC sequence.
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
  try {
    process.stdout.write(`\x1b]11;${color}${OSC_TERMINATOR}`);
  } catch {
    // Unsupported or detached terminal; the TUI itself remains usable.
  }
}

/** Reset dynamic background color to the terminal profile default. */
export function resetTerminalBackground(): void {
  if (!canControlTerminal()) return;
  try {
    process.stdout.write(`\x1b]111${OSC_TERMINATOR}`);
  } catch {
    // Terminal is already gone.
  }
}
