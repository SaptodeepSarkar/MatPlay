/**
 * Process-lifetime shutdown hooks for audio child processes
 * (mpg123/ffplay/cava/ffmpeg). React unmount cleanups do not reliably run
 * when the renderer is destroyed or the process receives a signal, so
 * every spawned process registers its stop routine here and both the
 * in-app quit path and OS signal handlers drain the registry.
 */
const hooks = new Set<() => void>();

export function onShutdown(hook: () => void): () => void {
  hooks.add(hook);
  return () => {
    hooks.delete(hook);
  };
}

export function runShutdown(): void {
  for (const hook of [...hooks]) {
    try {
      hook();
    } catch {
      // One failing hook must not block the rest.
    }
  }
  hooks.clear();
}
