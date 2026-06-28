// Testy kontrolek (checks.js) i trybu doktora menu (--doctor).

import { test } from 'node:test';
import assert from 'node:assert';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { checkNode, checkDeps, tcpReachable, portFree } from '../src/checks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MENU = join(__dirname, '..', 'src', 'menu.js');

test('checkNode wykrywa działający Node', () => {
  const r = checkNode();
  assert.equal(r.ok, true);
  assert.match(r.detail, /^v\d+/);
});

test('checkDeps widzi zainstalowane składniki', () => {
  assert.equal(checkDeps().ok, true);
});

test('tcpReachable: true dla otwartego portu, false dla zamkniętego', async () => {
  const srv = net.createServer((s) => s.end());
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  assert.equal(await tcpReachable('127.0.0.1', port, 1500), true);
  await new Promise((r) => srv.close(r));
  assert.equal(await tcpReachable('127.0.0.1', port, 1000), false);
});

test('portFree: true gdy wolny, false gdy zajęty', async () => {
  const srv = net.createServer();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  assert.equal(await portFree(port), false);
  await new Promise((r) => srv.close(r));
  assert.equal(await portFree(port), true);
});

test('menu --doctor kończy się kodem 0 i wypisuje kontrolki', async () => {
  const out = await new Promise((resolve) => {
    const p = spawn(process.execPath, [MENU, '--doctor'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    p.stdout.on('data', (d) => (buf += d));
    p.stderr.on('data', (d) => (buf += d));
    p.on('exit', (code) => resolve({ code, buf }));
  });
  assert.equal(out.code, 0, 'doktor powinien zakończyć się sukcesem w czystym repo');
  assert.match(out.buf, /Node\.js/);
});
