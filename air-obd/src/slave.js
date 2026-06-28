// Slave agent — runs in the car, plugged into the OBD2 port.
//
// Talks to the physical adapter (a WiFi ELM327 over TCP, or a serial / USB
// adapter) on one side and to the relay on the other. It opens the adapter
// ONLY while a master is connected, so the car's CAN bus is not kept awake.

import net from 'node:net';
import WebSocket from 'ws';
import { CONTROL, parseControl } from './protocol.js';
import { makeLogger } from './log.js';

const log = makeLogger('slave');

function required(name) {
  const v = process.env[name];
  if (!v) { console.error(`Missing required env ${name}`); process.exit(1); }
  return v;
}

const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:8080';
const SESSION = required('SESSION');
const TOKEN = process.env.RELAY_TOKEN || '';
const RECONNECT_MS = Number(process.env.RECONNECT_MS || 3000);

// Upstream OBD adapter — pick ONE:
const ADAPTER_HOST = process.env.ADAPTER_HOST;          // WiFi ELM327, e.g. 192.168.0.10
const ADAPTER_PORT = Number(process.env.ADAPTER_PORT || 35000);
const SERIAL_PATH = process.env.SERIAL_PATH;            // e.g. /dev/ttyUSB0 or COM3
const SERIAL_BAUD = Number(process.env.SERIAL_BAUD || 38400);

let ws = null;
let upstream = null;
let peerReady = false;

// Returns a uniform adapter handle regardless of TCP vs serial transport.
async function openUpstream() {
  if (SERIAL_PATH) {
    const { SerialPort } = await import('serialport'); // optional dependency
    const port = new SerialPort({ path: SERIAL_PATH, baudRate: SERIAL_BAUD });
    return {
      label: `serial ${SERIAL_PATH}@${SERIAL_BAUD}`,
      write: (b) => port.write(b),
      close: () => { try { port.close(() => {}); } catch {} },
      onData: (cb) => port.on('data', cb),
      onClose: (cb) => port.on('close', cb),
      onError: (cb) => port.on('error', cb),
      ready: new Promise((res, rej) => { port.once('open', res); port.once('error', rej); }),
    };
  }
  if (!ADAPTER_HOST) {
    log.error('Set ADAPTER_HOST (WiFi adapter) or SERIAL_PATH (serial adapter)');
    process.exit(1);
  }
  const sock = net.connect({ host: ADAPTER_HOST, port: ADAPTER_PORT });
  sock.setNoDelay(true);
  return {
    label: `tcp ${ADAPTER_HOST}:${ADAPTER_PORT}`,
    write: (b) => sock.write(b),
    close: () => sock.destroy(),
    onData: (cb) => sock.on('data', cb),
    onClose: (cb) => sock.on('close', cb),
    onError: (cb) => sock.on('error', cb),
    ready: new Promise((res, rej) => { sock.once('connect', res); sock.once('error', rej); }),
  };
}

async function handlePeerConnected() {
  if (upstream) return;
  log.info('master ONLINE — opening OBD adapter…');
  try {
    const up = await openUpstream();
    await up.ready;
    upstream = up;
    log.info(`OBD adapter open (${up.label}) — tunnel live`);
    up.onData((chunk) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(chunk, { binary: true }); });
    up.onClose(() => { log.warn('OBD adapter closed'); if (upstream === up) upstream = null; });
    up.onError((e) => log.warn(`adapter error: ${e.message}`));
  } catch (e) {
    log.error(`failed to open adapter: ${e.message}`);
    upstream = null;
  }
}

function closeUpstream() {
  if (!upstream) return;
  upstream.close();
  upstream = null;
  log.info('OBD adapter released');
}

function connectRelay() {
  const url = `${RELAY_URL}/?role=slave&session=${encodeURIComponent(SESSION)}&token=${encodeURIComponent(TOKEN)}`;
  ws = new WebSocket(url);

  ws.on('open', () => log.info(`connected to relay as in-car device (session ${SESSION}) — waiting for master…`));

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      if (upstream) upstream.write(data);
      return;
    }
    const msg = parseControl(data.toString());
    if (!msg) return;
    if (msg.t === CONTROL.PEER_CONNECTED) {
      peerReady = true;
      handlePeerConnected();
    } else if (msg.t === CONTROL.PEER_DISCONNECTED) {
      peerReady = false;
      closeUpstream();
    }
  });

  ws.on('close', () => {
    log.warn(`relay connection closed — reconnecting in ${RECONNECT_MS}ms`);
    peerReady = false;
    closeUpstream();
    ws = null;
    setTimeout(connectRelay, RECONNECT_MS);
  });

  ws.on('error', (e) => log.error(`relay error: ${e.message}`));
}

connectRelay();
