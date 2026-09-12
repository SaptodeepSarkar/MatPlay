/**
 * One-time Alexa login for MatPlay's detachable hybrid connector.
 *
 * Starts the alexa-remote2 auth proxy (same flow as the Alexa mobile app).
 * Open the printed URL in a browser ON A MACHINE WITHOUT the Alexa app,
 * log in, then the captured cookie is saved to the MatPlay config dir as
 * `alexa-cookie.json`. Afterwards flip Settings > ALEXA to ON.
 *
 * Usage:
 *   npm run alexa:login -- [--amazon-page=amazon.com] [--port=3001]
 *   MATPLAY_AMAZON_PAGE=amazon.co.uk npm run alexa:login
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    return match ? [match[1], match[2] ?? 'true'] : ['_', arg];
  }),
);

const amazonPage = args['amazon-page'] ?? process.env.MATPLAY_AMAZON_PAGE ?? 'amazon.com';
const proxyPort = Number(args.port ?? 3001);
const bindIp = args['bind-ip'] ?? '0.0.0.0';

function configDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'matplay');
  }
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'matplay');
}

const { default: Alexa } = await import('alexa-remote2');
const alexa = new Alexa();

alexa.on('cookie', () => {
  try {
    const dir = configDir();
    mkdirSync(dir, { recursive: true });
    const target = path.join(dir, 'alexa-cookie.json');
    writeFileSync(target, `${JSON.stringify(alexa.cookieData ?? {}, null, 2)}\n`);
    console.log(`\nSaved Alexa cookie to ${target}`);
    console.log('You can close this and turn Settings > ALEXA to ON in MatPlay.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to save cookie:', error);
    process.exit(1);
  }
});

console.log(`Starting Alexa login proxy (amazonPage=${amazonPage}, port=${proxyPort})…`);
alexa.init(
  {
    proxyOnly: true,
    proxyOwnIp: bindIp === '0.0.0.0' ? 'localhost' : bindIp,
    proxyPort,
    amazonPage,
  },
  (err) => {
    if (err) {
      console.error('Proxy start failed:', err.message ?? err);
      process.exit(1);
      return;
    }
    const url = `http://localhost:${proxyPort}/`;
    console.log(`\nOpen this URL in your browser and log in with Amazon:\n\n  ${url}\n`);
    console.log('Waiting for login… (Ctrl+C to abort)');
    if (existsSync(configDir())) {
      console.log(`Cookie will be saved under ${configDir()}/alexa-cookie.json`);
    }
  },
);
