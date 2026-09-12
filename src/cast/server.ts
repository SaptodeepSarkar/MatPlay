import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createReadStream, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { isWithinDir } from '../security/sanitize.js';

export type CastServerOptions = {
  port: number;
  /** false = loopback only. true = LAN (requires token, explicit opt-in). */
  lan: boolean;
  token: string;
  musicRoot: string;
  getCurrentFile: () => string | undefined;
  getStatus: () => Record<string, unknown>;
};

function sendJson(res: ServerResponse, code: number, body: unknown): void {
  const payload = `${JSON.stringify(body)}\n`;
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function isAuthorized(req: IncomingMessage, token: string, lan: boolean): boolean {
  if (!lan) return true; // loopback-only: OS routing is the boundary
  const header = req.headers.authorization ?? '';
  const url = new URL(req.url ?? '/', 'http://x');
  const queryToken = url.searchParams.get('token') ?? '';
  return header === `Bearer ${token}` || (queryToken !== '' && queryToken === token);
}

/**
 * Local MatPlay media server — Phase 1 of Echo casting without Spotify.
 *
 * Serves the CURRENT track only (`GET /stream`, Range-aware) plus
 * `GET /status`. The Echo cannot pull arbitrary LAN URLs via
 * alexa-remote2 alone (Amazon requires a Music Skill with public HTTPS),
 * so today the audible path is still Bluetooth — but this server is the
 * source of truth that a future private skill (or any DLNA/MPD client on
 * your LAN) streams from, with token auth + musicRoot containment.
 */
export class CastServer {
  private server: Server | undefined;
  private address = '';

  static generateToken(): string {
    return randomBytes(24).toString('hex');
  }

  start(options: CastServerOptions): string {
    this.stop();
    const host = options.lan ? '0.0.0.0' : '127.0.0.1';
    const server = createServer((req, res) => {
      try {
        this.handle(req, res, options);
      } catch {
        try { sendJson(res, 500, { ok: false }); } catch { /* ignore */ }
      }
    });
    server.listen(options.port, host);
    server.on('error', () => undefined);
    server.unref?.();
    this.server = server;
    this.address = `http://${options.lan ? '<lan-ip>' : '127.0.0.1'}:${options.port}`;
    return this.address;
  }

  stop(): void {
    try { this.server?.close(); } catch { /* ignore */ }
    this.server = undefined;
  }

  get url(): string {
    return this.address;
  }

  private handle(req: IncomingMessage, res: ServerResponse, options: CastServerOptions): void {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/status') {
      if (!isAuthorized(req, options.token, options.lan)) {
        sendJson(res, 401, { ok: false });
        return;
      }
      sendJson(res, 200, { ok: true, ...options.getStatus() });
      return;
    }
    if (url.pathname === '/stream') {
      if (!isAuthorized(req, options.token, options.lan)) {
        sendJson(res, 401, { ok: false });
        return;
      }
      const file = options.getCurrentFile();
      if (!file) {
        sendJson(res, 404, { ok: false, error: 'no track' });
        return;
      }
      let resolved: string;
      let root: string;
      try {
        root = realpathSync(options.musicRoot);
        resolved = realpathSync(file);
      } catch {
        sendJson(res, 404, { ok: false });
        return;
      }
      if (resolved !== root && !isWithinDir(root, resolved, path.sep)) {
        sendJson(res, 403, { ok: false });
        return;
      }
      let size = 0;
      try {
        const st = statSync(resolved);
        if (!st.isFile() || st.size <= 0 || st.size > 500 * 1024 * 1024) {
          sendJson(res, 404, { ok: false });
          return;
        }
        size = st.size;
      } catch {
        sendJson(res, 404, { ok: false });
        return;
      }
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        const start = match?.[1] ? Number(match[1]) : 0;
        const end = match?.[2] ? Number(match[2]) : size - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= size || start > end) {
          res.writeHead(416, { 'content-range': `bytes */${size}` });
          res.end();
          return;
        }
        res.writeHead(206, {
          'content-type': 'audio/mpeg',
          'content-length': end - start + 1,
          'content-range': `bytes ${start}-${end}/${size}`,
          'accept-ranges': 'bytes',
          'cache-control': 'no-store',
        });
        createReadStream(resolved, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, {
        'content-type': 'audio/mpeg',
        'content-length': size,
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      });
      createReadStream(resolved).pipe(res);
      return;
    }
    sendJson(res, 404, { ok: false });
  }
}
