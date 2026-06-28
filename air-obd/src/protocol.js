// Shared wire protocol between relay, master and slave.
//
// Two kinds of WebSocket frames travel between agents and the relay:
//   - BINARY frames  -> raw OBD bytes, forwarded verbatim to the peer.
//   - TEXT frames    -> JSON control messages (peer up/down, errors).
// Keeping them on separate frame types means raw diagnostic traffic is never
// parsed or mutated, which is exactly what flashing an ECU requires.

export const ROLES = ['master', 'slave'];

export const CONTROL = {
  PEER_CONNECTED: 'peer-connected',
  PEER_DISCONNECTED: 'peer-disconnected',
  ERROR: 'error',
};

export function encodeControl(type, extra = {}) {
  return JSON.stringify({ t: type, ...extra });
}

export function parseControl(str) {
  try {
    const m = JSON.parse(str);
    return m && typeof m.t === 'string' ? m : null;
  } catch {
    return null;
  }
}

export function peerRole(role) {
  return role === 'master' ? 'slave' : 'master';
}
