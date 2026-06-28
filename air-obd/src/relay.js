// Relay / rendezvous server.
//
// Both the in-car (slave) device and the diagnostic-PC (master) device dial OUT
// to this server, so it works through phone hotspots and home routers without
// any port forwarding. The relay pairs the two by SESSION id and pipes raw
// binary frames between them. It never inspects the OBD payload.

import http from 'node:http';
import { URL } from 'node:url';
import { WebSocketServer } from 'ws';
import { ROLES, CONTROL, encodeControl, peerRole } from './protocol.js';
import { makeLogger } from './log.js';

const log = makeLogger('relay');

const PORT = Number(process.env.RELAY_PORT || 8080);
const HOST = process.env.RELAY_HOST || '0.0.0.0';
const TOKEN = process.env.RELAY_TOKEN || '';
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS || 15000);

if (!TOKEN) {
  log.warn('RELAY_TOKEN is empty — anyone who knows a SESSION id can connect. Set RELAY_TOKEN in production.');
}

/** @type {Map<string, {master?: import('ws').WebSocket, slave?: import('ws').WebSocket}>} */
const sessions = new Map();

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  let u;
  try {
    u = new URL(req.url, 'http://localhost');
  } catch {
    return socket.destroy();
  }
  const role = u.searchParams.get('role');
  const code = u.searchParams.get('session');
  const token = u.searchParams.get('token') || '';

  if (!ROLES.includes(role) || !code) return socket.destroy();
  if (TOKEN && !timingSafeEqual(token, TOKEN)) {
    log.warn(`rejected ${role}/${code}: bad token`);
    return socket.destroy();
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.role = role;
    ws.code = code;
    ws.isAlive = true;
    onConnect(ws);
  });
});

function onConnect(ws) {
  let sess = sessions.get(ws.code);
  if (!sess) {
    sess = {};
    sessions.set(ws.code, sess);
  }
  if (sess[ws.role] && sess[ws.role].readyState === sess[ws.role].OPEN) {
    log.warn(`duplicate ${ws.role} for session ${ws.code} — closing the previous one`);
    try { sess[ws.role].close(4001, 'replaced'); } catch {}
  }
  sess[ws.role] = ws;
  log.info(`${ws.role} joined session ${ws.code}`);

  const other = peerRole(ws.role);
  if (sess.master && sess.slave) {
    safeSend(sess.master, encodeControl(CONTROL.PEER_CONNECTED));
    safeSend(sess.slave, encodeControl(CONTROL.PEER_CONNECTED));
    log.info(`session ${ws.code} fully paired — tunnel open`);
  }

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data, isBinary) => {
    // Only raw OBD bytes (binary) are forwarded; agents send no control frames.
    if (!isBinary) return;
    const peer = sess[other];
    if (peer && peer.readyState === peer.OPEN) peer.send(data, { binary: true });
  });

  ws.on('close', () => {
    log.info(`${ws.role} left session ${ws.code}`);
    if (sess[ws.role] === ws) delete sess[ws.role];
    const peer = sess[other];
    if (peer && peer.readyState === peer.OPEN) {
      safeSend(peer, encodeControl(CONTROL.PEER_DISCONNECTED));
    }
    if (!sess.master && !sess.slave) sessions.delete(ws.code);
  });

  ws.on('error', (e) => log.warn(`${ws.role}/${ws.code} ws error: ${e.message}`));
}

function safeSend(ws, payload) {
  try { ws.send(payload); } catch {}
}

// Constant-time-ish comparison so a token can't be guessed by timing.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Heartbeat: drop sockets that stopped answering (dead hotspot / lost link).
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      log.warn(`terminating unresponsive ${ws.role}/${ws.code}`);
      return ws.terminate();
    }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  });
}, HEARTBEAT_MS);
wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, HOST, () => log.info(`relay listening on ${HOST}:${PORT} (heartbeat ${HEARTBEAT_MS}ms)`));
