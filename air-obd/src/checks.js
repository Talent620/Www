// Kontrolki (zdrowie systemu). Każda funkcja zwraca obiekt:
//   { ok: boolean, label: string, detail: string, hint: string }
// albo Promise<...> dla testów sieciowych. Używa ich kreator (menu.js)
// oraz testy. Bez zależności zewnętrznych.

import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_PATH } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export function checkNode() {
  const v = process.versions.node;
  const major = Number(v.split('.')[0]);
  const ok = major >= 18;
  return {
    ok,
    label: 'Node.js',
    detail: 'v' + v,
    hint: ok ? '' : 'Zainstaluj Node.js w wersji 18 lub nowszej ze strony https://nodejs.org',
  };
}

export function checkDeps() {
  const ok = fs.existsSync(path.join(ROOT, 'node_modules', 'ws', 'package.json'));
  return {
    ok,
    label: 'Składniki programu',
    detail: ok ? 'zainstalowane' : 'brak',
    hint: ok ? '' : 'Uruchom: npm install (plik startowy zrobi to sam)',
  };
}

export function checkConfig() {
  const ok = fs.existsSync(CONFIG_PATH);
  return {
    ok,
    label: 'Konfiguracja',
    detail: ok ? 'zapisana' : 'jeszcze nie ustawiona',
    hint: ok ? '' : 'Wybierz rolę, wypełnij pola i naciśnij Start',
  };
}

// Czy da się połączyć z host:port (np. adapter OBD, serwer relay).
export function tcpReachable(host, port, timeout = 2500) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port: Number(port) });
    let done = false;
    const fin = (ok) => { if (done) return; done = true; try { sock.destroy(); } catch {} resolve(ok); };
    sock.setTimeout(timeout);
    sock.on('connect', () => fin(true));
    sock.on('timeout', () => fin(false));
    sock.on('error', () => fin(false));
  });
}

// Czy lokalny port jest wolny (żeby Master/relay mógł go zająć).
export function portFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(Number(port), host);
  });
}

// Czy serwer relay odpowiada na /health. Akceptuje ws:// i wss:// (zamienia na http/https).
export function relayHealthy(relayUrl, timeout = 3500) {
  return new Promise((resolve) => {
    let u;
    try {
      const httpish = relayUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
      u = new URL(httpish);
    } catch {
      return resolve(false);
    }
    const isHttps = u.protocol === 'https:';
    const mod = isHttps ? 'node:https' : 'node:http';
    import(mod).then(({ default: client }) => {
      const req = client.get(
        { hostname: u.hostname, port: u.port || (isHttps ? 443 : 80), path: '/health', timeout },
        (res) => { res.resume(); resolve(res.statusCode === 200); }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    }).catch(() => resolve(false));
  });
}

export { http };
