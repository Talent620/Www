// Testy serwera GUI: status, zapis konfiguracji, start/stop agenta przez API.

import { test } from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tcpReachable } from '../src/checks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUI = join(__dirname, '..', 'src', 'gui-server.js');

const GUI_PORT = 17790;
const RELAY_PORT = 17791;
const BASE = `http://127.0.0.1:${GUI_PORT}`;
const TMP_CFG = join(os.tmpdir(), `airobd-gui-test-${process.pid}.json`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('GUI: status, config, start/stop relay', async (t) => {
  const srv = spawn(process.execPath, [GUI], {
    env: { ...process.env, GUI_PORT: String(GUI_PORT), GUI_NO_OPEN: '1', AIROBD_CONFIG: TMP_CFG },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { try { srv.kill(); } catch {} });

  // poczekaj aż GUI wstanie
  let up = false;
  for (let i = 0; i < 50 && !up; i++) { up = await tcpReachable('127.0.0.1', GUI_PORT, 500); if (!up) await sleep(100); }
  assert.ok(up, 'serwer GUI powinien wstać');

  // status ma podstawy z działającym Node
  const status = await (await fetch(`${BASE}/api/status`)).json();
  assert.ok(Array.isArray(status.basics), 'status.basics to lista');
  assert.equal(status.basics.find((b) => b.label === 'Node.js').ok, true);

  // zapis konfiguracji
  const save = await (await fetch(`${BASE}/api/config`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ RELAY_PORT: String(RELAY_PORT), RELAY_TOKEN: 'gui-test' }),
  })).json();
  assert.equal(save.ok, true);
  assert.equal(save.config.RELAY_PORT, String(RELAY_PORT));

  // start relay
  const start = await (await fetch(`${BASE}/api/start`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'relay' }),
  })).json();
  assert.equal(start.ok, true);

  // relay powinien zacząć słuchać i status pokazać running=relay
  let relayUp = false;
  for (let i = 0; i < 40 && !relayUp; i++) { relayUp = await tcpReachable('127.0.0.1', RELAY_PORT, 500); if (!relayUp) await sleep(150); }
  assert.ok(relayUp, 'relay uruchomiony przez GUI powinien słuchać');

  const running = await (await fetch(`${BASE}/api/status`)).json();
  assert.equal(running.running, 'relay');

  // stop
  await fetch(`${BASE}/api/stop`, { method: 'POST' });
  let relayDown = false;
  for (let i = 0; i < 40 && !relayDown; i++) { relayDown = !(await tcpReachable('127.0.0.1', RELAY_PORT, 400)); if (!relayDown) await sleep(150); }
  assert.ok(relayDown, 'relay powinien się zatrzymać po /api/stop');
});
