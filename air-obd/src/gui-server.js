// ============================================================================
//  AIR OBD — serwer GUI (okno w przeglądarce)
//  Plik startowy uruchamia ten serwer i sam otwiera okno. Użytkownik klika
//  przyciski, widzi kontrolki ✓/✗ i podgląd na żywo. Bez znajomości komend.
//  API:  GET /api/status | POST /api/config | POST /api/start | POST /api/stop
//        POST /api/scan   | WebSocket /ws (logi + stan na żywo)
// ============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { cfg, saveConfig, getAll, loadConfig } from './config.js';
import { checkNode, checkDeps, checkConfig, tcpReachable, portFree, relayHealthy } from './checks.js';
import { scan } from './scan-obd.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = __dirname;
const PUBLIC = path.join(__dirname, '..', 'public');
const GUI_PORT = Number(process.env.GUI_PORT || 7777);

// ---- co znaczą poszczególne wpisy z logów agentów (kontrolki na żywo) --------
const MILESTONES = {
  slave: [
    { match: 'connected to relay as in-car device', label: 'Połączono z serwerem' },
    { match: 'master ONLINE', label: 'Mechanik (Master) się połączył' },
    { match: 'OBD adapter open', label: 'Adapter OBD otwarty — tunel działa' },
    { match: 'failed to open adapter', label: 'Nie udało się otworzyć adaptera', ok: false },
  ],
  master: [
    { match: 'connected to relay', label: 'Połączono z serwerem' },
    { match: 'in-car device ONLINE', label: 'Auto online — można łączyć diagnostykę' },
    { match: 'diagnostic software connected', label: 'Program diagnostyczny podłączony — tunel działa' },
    { match: 'in-car device OFFLINE', label: 'Auto zniknęło z sieci', ok: false },
  ],
  relay: [
    { match: 'relay listening', label: 'Serwer działa' },
    { match: 'fully paired', label: 'Master i Slave połączone — tunel otwarty' },
  ],
};

let child = null;
let childRole = null;
let milestones = [];
const logBuffer = [];
const MAX_LOG = 400;
const wsClients = new Set();

function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const ws of wsClients) { try { ws.send(s); } catch {} }
}

function pushLog(line) {
  const entry = { type: 'log', t: new Date().toISOString(), line };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG) logBuffer.shift();
  broadcast(entry);
}

function startAgent(role) {
  stopAgent();
  loadConfig();
  childRole = role;
  milestones = [];
  broadcast({ type: 'running', role });
  broadcast({ type: 'milestones', role, milestones });
  pushLog(`[uruchamiam: ${role}]`);

  child = spawn(process.execPath, [path.join(SRC, role + '.js')], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const onData = (buf) => {
    for (const raw of buf.toString().split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      pushLog(line);
      for (const m of MILESTONES[role] || []) {
        if (line.includes(m.match) && !milestones.some((x) => x.label === m.label)) {
          milestones.push({ ok: m.ok !== false, label: m.label });
          broadcast({ type: 'milestones', role, milestones });
        }
      }
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('exit', (code) => {
    pushLog(`[proces ${role} zatrzymany (kod ${code ?? 0})]`);
    child = null; childRole = null;
    broadcast({ type: 'running', role: null });
  });
}

function stopAgent() {
  if (child) { try { child.kill(); } catch {} }
}

function maskedConfig() {
  return getAll(); // GUI działa lokalnie na 127.0.0.1 — pola (w tym token) wracają do formularza
}

async function buildStatus() {
  const basics = [checkNode(), checkDeps(), checkConfig()];
  const conn = [];
  const relayUrl = cfg('RELAY_URL', '');
  if (relayUrl) {
    conn.push({ ok: await relayHealthy(relayUrl), label: 'Serwer (relay)', detail: relayUrl, hint: 'Uruchom serwer lub popraw adres.' });
  }
  const aHost = cfg('ADAPTER_HOST', '');
  if (aHost) {
    const aPort = cfg('ADAPTER_PORT', '35000');
    conn.push({ ok: await tcpReachable(aHost, aPort), label: 'Adapter OBD', detail: `${aHost}:${aPort}`, hint: 'Sprawdź zasilanie adaptera i sieć WiFi.' });
  }
  const mPort = cfg('MASTER_PORT', '');
  if (mPort) {
    const f = await portFree(mPort);
    conn.push({ ok: f, label: `Lokalny port ${mPort}`, detail: f ? 'wolny' : 'zajęty', hint: 'Zamknij program używający portu lub zmień port.' });
  }
  return { basics, conn, running: childRole, milestones, config: maskedConfig() };
}

// ---- HTTP ------------------------------------------------------------------
function json(res, obj, code = 200) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function sendFile(res, file, type) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': type });
    res.end(data);
  });
}
function readJson(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  try {
    if (req.method === 'GET' && (p === '/' || p === '/index.html'))
      return sendFile(res, path.join(PUBLIC, 'index.html'), 'text/html; charset=utf-8');
    if (req.method === 'GET' && p === '/api/status')
      return json(res, await buildStatus());
    if (req.method === 'POST' && p === '/api/config') {
      const body = await readJson(req);
      const clean = {};
      for (const [k, v] of Object.entries(body)) if (typeof v === 'string') clean[k] = v.trim();
      saveConfig(clean);
      return json(res, { ok: true, config: maskedConfig() });
    }
    if (req.method === 'POST' && p === '/api/start') {
      const body = await readJson(req);
      if (!['slave', 'master', 'relay'].includes(body.role)) return json(res, { ok: false, error: 'zła rola' }, 400);
      startAgent(body.role);
      return json(res, { ok: true });
    }
    if (req.method === 'POST' && p === '/api/stop') { stopAgent(); return json(res, { ok: true }); }
    if (req.method === 'POST' && p === '/api/scan') {
      const found = await scan();
      if (found[0]) saveConfig({ ADAPTER_HOST: found[0].host, ADAPTER_PORT: String(found[0].port) });
      return json(res, { ok: true, found });
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    json(res, { ok: false, error: String((e && e.message) || e) }, 500);
  }
});

// ---- WebSocket (logi + stan na żywo) ---------------------------------------
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname !== '/ws') return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    wsClients.add(ws);
    ws.send(JSON.stringify({ type: 'running', role: childRole }));
    ws.send(JSON.stringify({ type: 'milestones', role: childRole, milestones }));
    for (const e of logBuffer.slice(-120)) ws.send(JSON.stringify(e));
    ws.on('close', () => wsClients.delete(ws));
    ws.on('error', () => wsClients.delete(ws));
  });
});

// ---- otwarcie przeglądarki -------------------------------------------------
function openBrowser(url) {
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch {}
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { stopAgent(); process.exit(0); });
}

server.listen(GUI_PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${GUI_PORT}`;
  console.log('============================================================');
  console.log('  AIR OBD — GUI uruchomione.');
  console.log('  Otwórz w przeglądarce:  ' + url);
  console.log('  (to okno zostaw otwarte — zamknięcie wyłącza program)');
  console.log('============================================================');
  if (!process.env.GUI_NO_OPEN) openBrowser(url);
});
