#!/usr/bin/env node
/**
 * Prints the URLs at which the Aurea dev/start server is reachable on this
 * machine and across the local network. Run alongside `npm run dev`/`npm start`
 * (which bind to 0.0.0.0) so you can open the app from your phone, tablet, or
 * another computer on the same Wi-Fi/LAN.
 *
 * Usage: npm run lan            (defaults to port 3000)
 *        PORT=3100 npm run lan
 */
import os from 'node:os';

const port = process.env.PORT || '3000';
const nets = os.networkInterfaces();
const lanAddresses = [];

for (const addrs of Object.values(nets)) {
  for (const net of addrs ?? []) {
    // IPv4, non-internal (skip loopback) → a real LAN address.
    const isIPv4 = net.family === 'IPv4' || net.family === 4;
    if (isIPv4 && !net.internal) lanAddresses.push(net.address);
  }
}

const line = '─'.repeat(46);
console.log(`\n  Aurea — local network access\n  ${line}`);
console.log(`  Local:    http://localhost:${port}`);

if (lanAddresses.length === 0) {
  console.log('  Network:  (no LAN interface detected — are you online?)');
} else {
  for (const ip of lanAddresses) {
    console.log(`  Network:  http://${ip}:${port}`);
  }
}

console.log(`  ${line}`);
console.log('  Open a "Network" URL on any device on the same Wi-Fi/LAN.');
console.log('  If it does not load, allow the port through your firewall:');
console.log(`    • macOS:   System Settings → Network → Firewall`);
console.log(`    • Linux:   sudo ufw allow ${port}/tcp`);
console.log(`    • Windows: New-NetFirewallRule -DisplayName "Aurea" \\`);
console.log(`               -Direction Inbound -LocalPort ${port} -Protocol TCP -Action Allow\n`);
