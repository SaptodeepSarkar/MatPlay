import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './app/App.js';
import { KALYANI_COVER_THEME } from './ui/stitchTheme.js';

const renderer = await createCliRenderer({
  backgroundColor: KALYANI_COVER_THEME.appBg,
});

createRoot(renderer).render(<App />);
