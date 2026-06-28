// Skaner adapterów OBD w sieci lokalnej. Sprawdza typowe porty diagnostyczne:
//   35000 = WiFi ELM327,  13400 = DoIP (np. bramy AIR OBD2 i inne).
// Uruchamiany z menu (opcja "Znajdź adapter OBD") lub: node src/scan-obd.js

import os from 'node:os';
import { tcpReachable } from './checks.js';

const PORTS = [35000, 13400];
const TIMEOUT = 400;
const CONCURRENCY = 64;

function localSubnets() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) {
        const base = ni.address.split('.').slice(0, 3).join('.');
        if (!out.includes(base)) out.push(base);
      }
    }
  }
  return out;
}

async function pool(tasks, size) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return results;
}

export async function scan() {
  const subnets = localSubnets();
  if (subnets.length === 0) return [];
  const targets = [];
  for (const base of subnets) {
    for (let h = 1; h <= 254; h++) {
      for (const port of PORTS) targets.push({ host: `${base}.${h}`, port });
    }
  }
  const tasks = targets.map((t) => async () => (await tcpReachable(t.host, t.port, TIMEOUT) ? t : null));
  const found = (await pool(tasks, CONCURRENCY)).filter(Boolean);
  return found;
}

// Uruchomienie bezpośrednie (poza menu).
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Skanuję sieć lokalną w poszukiwaniu adapterów OBD (35000, 13400)…');
  scan().then((found) => {
    if (found.length === 0) {
      console.log('Nie znaleziono adapterów. Sprawdź, czy adapter jest wpięty, włączony i w tej samej sieci WiFi.');
    } else {
      console.log('Znaleziono:');
      for (const f of found) console.log(`  - ${f.host}:${f.port}`);
      const first = found[0];
      console.log(`\nWpisz w kreatorze:  ADAPTER_HOST=${first.host}  ADAPTER_PORT=${first.port}`);
    }
  });
}
