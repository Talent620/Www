// End-to-end smoke test: client -> master -> relay -> slave -> echo adapter
// and all the way back. Proves the raw byte tunnel is transparent.

import { test } from 'node:test';
import assert from 'node:assert';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

const TOKEN = 'test-secret';
const SESSION = 'loopback';
const RELAY_PORT = 18080;
const MASTER_PORT = 18500;
let ADAPTER_PORT = 0;

const procs = [];
function run(file, env) {
  const p = spawn(process.execPath, [join(SRC, file)], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  p.stdout.on('data', (d) => process.stdout.write(`  [${file}] ${d}`));
  p.stderr.on('data', (d) => process.stdout.write(`  [${file}!] ${d}`));
  procs.push(p);
  return p;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startEchoAdapter() {
  return new Promise((resolve) => {
    const s = net.createServer((sock) => sock.pipe(sock)); // echo
    procs.push({ kill: () => s.close() });
    s.listen(0, '127.0.0.1', () => resolve(s.address().port));
  });
}

function relayHealthy() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${RELAY_PORT}/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
  });
}

// Connect, send payload, expect the same bytes echoed. Retries until the whole
// chain (master TCP open + peer paired + adapter open) is ready.
function tryRoundtrip(payload, timeoutMs) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port: MASTER_PORT });
    let buf = Buffer.alloc(0);
    const done = (ok) => { try { sock.destroy(); } catch {} resolve(ok); };
    const timer = setTimeout(() => done(false), timeoutMs);
    sock.on('connect', () => sock.write(payload));
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (buf.length >= payload.length) { clearTimeout(timer); done(buf.equals(payload)); }
    });
    sock.on('error', () => { clearTimeout(timer); done(false); });
  });
}

test('raw bytes survive the full master<->slave tunnel', async (t) => {
  t.after(() => procs.forEach((p) => { try { p.kill(); } catch {} }));

  ADAPTER_PORT = await startEchoAdapter();

  run('relay.js', { RELAY_PORT: String(RELAY_PORT), RELAY_TOKEN: TOKEN });
  for (let i = 0; i < 50 && !(await relayHealthy()); i++) await sleep(100);
  assert.ok(await relayHealthy(), 'relay should be healthy');

  const common = { RELAY_URL: `ws://127.0.0.1:${RELAY_PORT}`, RELAY_TOKEN: TOKEN, SESSION };
  run('slave.js', { ...common, ADAPTER_HOST: '127.0.0.1', ADAPTER_PORT: String(ADAPTER_PORT) });
  run('master.js', { ...common, MASTER_PORT: String(MASTER_PORT), MASTER_HOST: '127.0.0.1' });

  const payload = Buffer.from('ATZ\r0100\r', 'ascii');
  let ok = false;
  for (let i = 0; i < 40 && !ok; i++) {
    ok = await tryRoundtrip(payload, 500);
    if (!ok) await sleep(250);
  }
  assert.ok(ok, 'payload should round-trip through the tunnel unchanged');
});
