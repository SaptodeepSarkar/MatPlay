/**
 * OpenTUI normally emits the complete input value. Some rerender paths can
 * recreate the native input and emit only the newest edit instead. Reconcile
 * both event shapes without losing already typed text.
 */
export function mergeInputValue(previous: string, emitted: string): string {
  if (emitted === '') return previous.slice(0, -1);
  if (emitted === previous) return previous + emitted;
  if (emitted.startsWith(previous) || previous.startsWith(emitted)) return emitted;
  return previous + emitted;
}
