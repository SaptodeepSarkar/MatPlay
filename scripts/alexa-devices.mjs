/**
 * List the Alexa devices on your account, speakers separated from ghosts.
 *
 * Amazon's API returns every registered endpoint (Echo speakers, Alexa apps
 * on phones/tablets, Fire TV, stale registrations). MatPlay only targets
 * entries with a music player — those are marked SPEAKER below.
 *
 * Usage: npm run alexa:devices [--amazon-page=amazon.com]
 * Uses the cookie saved by `npm run alexa:login` (no browser needed).
 */
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    return match ? [match[1], match[2] ?? 'true'] : ['_', arg];
  }),
);
const amazonPage = args['amazon-page'] ?? process.env.MATPLAY_AMAZON_PAGE ?? 'amazon.com';

function configDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'matplay');
  }
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'matplay');
}

const cookieFile = path.join(configDir(), 'alexa-cookie.json');
if (!existsSync(cookieFile)) {
  console.error(`No cookie at ${cookieFile} — run \`npm run alexa:login\` first.`);
  process.exit(1);
}
const cookie = JSON.parse(readFileSync(cookieFile, 'utf8'));

const { default: Alexa } = await import('alexa-remote2');
const alexa = new Alexa();

alexa.init({ cookie, amazonPage }, (err) => {
  if (err) {
    console.error('Login failed:', err.message ?? err);
    console.error('Re-run `npm run alexa:login` to refresh the cookie.');
    process.exit(1);
    return;
  }
  const entries = Object.entries(alexa.serialNumbers ?? {});
  if (entries.length === 0) {
    console.log('No devices found on this account.');
    process.exit(0);
    return;
  }
  console.log(`\n${entries.length} device(s) on ${amazonPage}:\n`);
  for (const [serial, d] of entries) {
    const speaker = d.hasMusicPlayer ? 'SPEAKER' : 'app/other';
    const online = d.online ? 'online ' : 'offline';
    console.log(`  [${speaker}] ${(d.accountName ?? '?').padEnd(22)} ${online} ${d.deviceFamily ?? ''}  ${serial}`);
  }
  console.log('\nTip: put a SPEAKER name in ~/.config/matplay/config.json under');
  console.log('alexa.device to pin MatPlay to it, e.g. { "alexa": { "device": "Kitchen" } }.\n');
  process.exit(0);
});
