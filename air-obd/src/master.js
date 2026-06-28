// Master agent — runs next to the diagnostic computer.
//
// Exposes a local TCP endpoint that mimics a WiFi OBD adapter. Point VCDS /
// OBDeleven / any "WiFi ELM327 at host:port" software at it. Bytes are tunnelled
// to the in-car slave over the relay and back, so the software believes the car
// is plugged in directly.
//
// COM-port-only software (some VCDS setups): bridge this TCP port to a virtual
// COM port with com0com + com2tcp (Windows) or socat (Linux/macOS). See README.

import net from 'node:net';
import WebSocket from 'ws';
import { CONTROL, parseControl } from './protocol.js';
import { makeLogger } from './log.js';

const log = makeLogger('master');

function required(name) {
  const v = process.env[name];
  if (!v) { console.error(`Missing required env ${name}`); process.exit(1); }
  return v;
}

const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:8080';
const SESSION = required('SESSION');
const TOKEN = process.env.RELAY_TOKEN || '';
const LISTEN_HOST = process.env.MASTER_HOST || '127.0.0.1';
const LISTEN_PORT = Number(process.env.MASTER_PORT || 35000);
const RECONNECT_MS = Number(process.env.RECONNECT_MS || 3000);

let ws = null;
let tcpClient = null;
let peerReady = false;

function connectRelay() {
  const url = `${RELAY_URL}/?role=master&session=${encodeURIComponent(SESSION)}&token=${encodeURIComponent(TOKEN)}`;
  ws = new WebSocket(url);

  ws.on('open', () => log.info('connected to relay — waiting for in-car (slave) device…'));

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      if (tcpClient && !tcpClient.destroyed) tcpClient.write(data);
      return;
    }
    const msg = parseControl(data.toString());
    if (!msg) return;
    if (msg.t === CONTROL.PEER_CONNECTED) {
      peerReady = true;
      log.info(`in-car device ONLINE — diagnostic link READY at ${LISTEN_HOST}:${LISTEN_PORT}`);
    } else if (msg.t === CONTROL.PEER_DISCONNECTED) {
      peerReady = false;
      log.warn('in-car device OFFLINE — closing diagnostic connection (do NOT flash now!)');
      if (tcpClient) tcpClient.destroy();
    }
  });

  ws.on('close', () => {
    log.warn(`relay connection closed — reconnecting in ${RECONNECT_MS}ms`);
    peerReady = false;
    if (tcpClient) tcpClient.destroy();
    ws = null;
    setTimeout(connectRelay, RECONNECT_MS);
  });

  ws.on('error', (e) => log.error(`relay error: ${e.message}`));
}

function startTcpServer() {
  const server = net.createServer((sock) => {
    if (tcpClient && !tcpClient.destroyed) {
      log.warn('another diagnostic client is already connected — rejecting');
      return sock.destroy();
    }
    if (!peerReady || !ws || ws.readyState !== WebSocket.OPEN) {
      log.warn('diagnostic client connected but in-car device is not ready — rejecting');
      return sock.destroy();
    }
    log.info('diagnostic software connected — tunnel live');
    tcpClient = sock;
    sock.setNoDelay(true); // latency matters for OBD timing

    sock.on('data', (chunk) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(chunk, { binary: true });
    });
    sock.on('close', () => {
      log.info('diagnostic software disconnected');
      if (tcpClient === sock) tcpClient = null;
    });
    sock.on('error', (e) => log.warn(`diagnostic client error: ${e.message}`));
  });

  server.on('error', (e) => { log.error(`local TCP server error: ${e.message}`); process.exit(1); });
  server.listen(LISTEN_PORT, LISTEN_HOST, () =>
    log.info(`local diagnostic endpoint on ${LISTEN_HOST}:${LISTEN_PORT} — point VCDS/OBD app here`));
}

startTcpServer();
connectRelay();
