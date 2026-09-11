#!/usr/bin/env node
// Cross-platform launcher (Linux/macOS/Windows). OpenTUI's native core
// requires --experimental-ffi, which npm bin shims cannot pass — so this
// re-executes node with the flag when missing, then loads the built app.
// (A shell wrapper cannot work on Windows; this file lets npm generate a
// working .cmd shim there.)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'main.js');

if (!process.execArgv.includes('--experimental-ffi')) {
  const result = spawnSync(
    process.execPath,
    ['--experimental-ffi', entry, ...process.argv.slice(2)],
    { stdio: 'inherit' },
  );
  process.exit(result.status ?? 0);
} else {
  await import(entry);
}
