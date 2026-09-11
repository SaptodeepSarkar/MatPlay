import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './app/App.js';
import { KALYANI_COVER_THEME } from './ui/stitchTheme.js';
import { runShutdown } from './app/shutdown.js';

const renderer = await createCliRenderer({
  backgroundColor: KALYANI_COVER_THEME.appBg,
});

createRoot(renderer).render(<App />);

// Audio child processes outlive React unmount cleanups, so drain them
// explicitly on every exit path — otherwise ffplay/mpg123/cava/ffmpeg
// keep playing after quit.
const shutdown = (): void => {
  runShutdown();
  try {
    renderer.destroy();
  } catch {
    // Already torn down.
  }
  setTimeout(() => process.exit(0), 300);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
