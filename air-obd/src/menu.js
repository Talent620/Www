// ============================================================================
//  AIR OBD — Kreator „klikam i działa"
//  Jedno menu, każda opcja z opisem decyzji i tego, co się stanie po wyborze.
//  Kontrolki ✓/✗ na każdym kroku. Prowadzi za rękę i sprawdza poprawność.
//  Uruchamiane przez plik startowy (start.bat / start.sh) albo: node src/menu.js
//  Tryb diagnostyczny bez pytań:  node src/menu.js --doctor
// ============================================================================

import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cfg, saveConfig, getAll } from './config.js';
import {
  checkNode, checkDeps, checkConfig,
  tcpReachable, portFree, relayHealthy,
} from './checks.js';
import { scan } from './scan-obd.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = __dirname;

// ---- kolory / ozdoby (działają w Windows 10/11, macOS, Linux) ----------------
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', blue: '\x1b[34m',
};
const paint = (c, s) => `${C[c]}${s}${C.reset}`;
const ok = (s) => paint('green', '✓ ' + s);
const bad = (s) => paint('red', '✗ ' + s);
const wait = (s) => paint('yellow', '… ' + s);

function clear() { stdout.write('\x1b[2J\x1b[H'); }
function hr() { console.log(paint('gray', '─'.repeat(64))); }
function title(t) {
  hr();
  console.log(paint('bold', '  ' + t));
  hr();
}

// Pokaż kontrolkę i zwróć jej stan.
function kontrolka(isOk, label, detail = '', hint = '') {
  const line = isOk ? ok(label) : bad(label);
  console.log('   ' + line + (detail ? paint('gray', '  — ' + detail) : ''));
  if (!isOk && hint) console.log('     ' + paint('yellow', '➜ ' + hint));
  return isOk;
}

let rl;
const ask = async (q) => (await rl.question(q)).trim();

async function confirm(q, def = true) {
  const suffix = def ? ' (T/n) ' : ' (t/N) ';
  const a = (await ask(paint('cyan', q) + suffix)).toLowerCase();
  if (!a) return def;
  return a === 't' || a === 'tak' || a === 'y' || a === 'yes';
}

function pause() { return ask(paint('gray', '\n  Naciśnij ENTER, aby kontynuować…')); }

// ---- panel z kontrolkami na górze ekranu -------------------------------------
async function dashboard() {
  clear();
  title('AIR OBD — zdalna diagnostyka (Master ↔ Slave)');
  console.log(paint('bold', '  Stan urządzenia:'));
  const n = checkNode(); kontrolka(n.ok, n.label, n.detail, n.hint);
  const d = checkDeps(); kontrolka(d.ok, d.label, d.detail, d.hint);
  const c = checkConfig(); kontrolka(c.ok, c.label, c.detail, c.hint);
  const role = cfg('ROLE', '');
  if (role) console.log('   ' + paint('blue', 'ℹ Ostatnia rola: ' + role));
  console.log('');
}

// ---- panel wyjaśniający przed każdą akcją ------------------------------------
function explain({ co, stanie, spowoduje, potrzebujesz }) {
  console.log('');
  console.log(paint('bold', '  Co to robi:'));
  console.log('   ' + co);
  console.log(paint('bold', '  Co się stanie po wybraniu:'));
  for (const s of stanie) console.log('   • ' + s);
  console.log(paint('bold', '  Co to spowoduje:'));
  console.log('   ' + spowoduje);
  if (potrzebujesz && potrzebujesz.length) {
    console.log(paint('bold', '  Czego potrzebujesz:'));
    for (const p of potrzebujesz) console.log('   • ' + p);
  }
  console.log('');
}

function step(no, label) {
  console.log('');
  console.log(paint('cyan', `  KROK ${no}: `) + paint('bold', label));
}

// ---- pytanie o pojedyncze ustawienie (z walidacją i wartością domyślną) -------
async function ensure(key, label, { def = '', secret = false, validate } = {}) {
  const cur = cfg(key, '');
  if (cur) {
    const shown = secret ? '••••••' : cur;
    const v = await ask(`   ${label}\n   ${paint('gray', 'obecnie: ' + shown)}\n   ${paint('gray', 'ENTER = zostaw, lub wpisz nową wartość:')} `);
    if (v) { saveConfig({ [key]: v }); return v; }
    return cur;
  }
  let val = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const hintDef = def ? paint('gray', ` (ENTER = ${def})`) : '';
    val = await ask(`   ${label}${hintDef}: `);
    if (!val && def) val = def;
    if (!val) { console.log('   ' + bad('To pole jest wymagane.')); continue; }
    if (validate) { const err = validate(val); if (err) { console.log('   ' + bad(err)); continue; } }
    break;
  }
  saveConfig({ [key]: val });
  return val;
}

const isPort = (v) => (/^\d+$/.test(v) && +v >= 1 && +v <= 65535 ? '' : 'Podaj numer portu 1–65535.');

// ---- uruchomienie agenta (slave/master/relay) z kontrolkami na żywo ----------
function runAgent(file, milestones) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(SRC, file)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    const onData = (buf) => {
      const text = buf.toString();
      process.stdout.write(paint('gray', text.replace(/\s+$/, '') + '\n'));
      for (const m of milestones) {
        if (!m.hit && text.includes(m.match)) {
          m.hit = true;
          kontrolka(m.ok !== false, m.label, m.detail || '', m.hint || '');
        }
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    console.log('\n  ' + paint('green', '▶ Uruchomiono. ZOSTAW TO OKNO OTWARTE.'));
    console.log('  ' + paint('yellow', 'Naciśnij ENTER, aby zatrzymać i wrócić do menu.\n'));

    ask('').then(() => {
      try { child.kill(); } catch {}
    });
    child.on('exit', () => resolve());
  });
}

// ============================ KREATORY ROLI ===================================

async function wizardSlave() {
  await dashboard();
  title('JESTEM W AUCIE — udostępniam auto (SLAVE)');
  explain({
    co: 'Zamienia ten komputer/telefon w aucie w „przedłużacz" gniazda OBD przez internet.',
    stanie: [
      'Zapytam o adres serwera, hasło i ID sesji (to samo, co u osoby z Masterem).',
      'Sprawdzę kontrolką, czy widzę adapter OBD w aucie.',
      'Sprawdzę, czy serwer odpowiada.',
      'Uruchomię połączenie i będę pokazywać, czy mechanik się połączył.',
    ],
    spowoduje: 'Osoba z Masterem (np. mechanik) zobaczy Twoje auto tak, jakby siedziała obok.',
    potrzebujesz: [
      'Adapter OBD wpięty w gniazdo, zapłon włączony.',
      'Internet w aucie (hotspot z telefonu / router).',
      'Od osoby z Masterem: adres serwera, hasło, ID sesji.',
    ],
  });
  if (!await confirm('Kontynuować?')) return;
  saveConfig({ ROLE: 'slave' });

  step(1, 'Ustawienia połączenia');
  await ensure('RELAY_URL', 'Adres serwera (np. wss://serwer.pl albo ws://192.168.0.50:8080)', { def: 'ws://localhost:8080' });
  await ensure('RELAY_TOKEN', 'Hasło/token serwera (identyczne po obu stronach)', { secret: true });
  await ensure('SESSION', 'ID sesji — wspólne hasło tej sesji, takie samo jak Master (np. leon-123)');
  console.log('   ' + paint('bold', 'Adapter OBD w aucie:'));
  if (await confirm('   Nie znasz adresu adaptera? Poszukać go automatycznie?', false)) {
    await doScan();
  }
  await ensure('ADAPTER_HOST', 'Adres adaptera OBD WiFi (np. 192.168.0.10)', { def: '192.168.0.10' });
  await ensure('ADAPTER_PORT', 'Port adaptera (zwykle 35000)', { def: '35000', validate: isPort });
  console.log('   ' + ok('Ustawienia zapisane.'));

  step(2, 'Kontrolka: czy widzę adapter OBD w aucie');
  const aHost = cfg('ADAPTER_HOST'); const aPort = cfg('ADAPTER_PORT');
  console.log('   ' + wait(`łączę się z ${aHost}:${aPort} …`));
  const adapterOk = await tcpReachable(aHost, aPort);
  kontrolka(adapterOk, 'Adapter OBD', adapterOk ? 'odpowiada' : 'NIE odpowiada',
    'Sprawdź: adapter wpięty i świeci, zapłon ON, ten komputer w tej samej sieci WiFi co adapter.');
  if (!adapterOk && !await confirm('Adapter nie odpowiada. Uruchomić mimo to?', false)) return;

  step(3, 'Kontrolka: czy serwer odpowiada');
  const relayUrl = cfg('RELAY_URL');
  console.log('   ' + wait(`sprawdzam ${relayUrl} …`));
  const relOk = await relayHealthy(relayUrl);
  kontrolka(relOk, 'Serwer (relay)', relOk ? 'odpowiada' : 'brak odpowiedzi (spróbuję połączyć i tak)',
    'Upewnij się, że serwer jest uruchomiony i adres jest poprawny.');

  step(4, 'Uruchamiam połączenie SLAVE');
  await runAgent('slave.js', [
    { match: 'connected to relay as in-car device', label: 'Połączono z serwerem' },
    { match: 'master ONLINE', label: 'Mechanik (Master) się połączył' },
    { match: 'OBD adapter open', label: 'Adapter OBD otwarty — tunel działa' },
    { match: 'failed to open adapter', label: 'Nie udało się otworzyć adaptera', ok: false, hint: 'Sprawdź adres/port adaptera i sieć WiFi.' },
  ]);
}

async function wizardMaster() {
  await dashboard();
  title('JESTEM PRZY LAPTOPIE z VCDS — łączę się z autem (MASTER)');
  explain({
    co: 'Tworzy na tym laptopie lokalne „gniazdo sieciowe", do którego podłączasz program diagnostyczny.',
    stanie: [
      'Zapytam o adres serwera, hasło i ID sesji (to samo, co w aucie).',
      'Sprawdzę, czy lokalny port jest wolny i czy serwer odpowiada.',
      'Uruchomię Master i pokażę, kiedy auto jest online.',
      'Podam dokładnie, co wpisać w VCDS/OBD (adres i port).',
    ],
    spowoduje: 'Program diagnostyczny zobaczy auto stojące gdzie indziej tak, jakby było podpięte kablem.',
    potrzebujesz: [
      'Program diagnostyczny obsługujący połączenie sieciowe/WiFi/TCP.',
      'Od osoby w aucie: że Slave jest uruchomiony na tym samym ID sesji.',
      'Adres serwera, hasło i ID sesji.',
    ],
  });
  if (!await confirm('Kontynuować?')) return;
  saveConfig({ ROLE: 'master' });

  step(1, 'Ustawienia połączenia');
  await ensure('RELAY_URL', 'Adres serwera (np. wss://serwer.pl albo ws://192.168.0.50:8080)', { def: 'ws://localhost:8080' });
  await ensure('RELAY_TOKEN', 'Hasło/token serwera (identyczne po obu stronach)', { secret: true });
  await ensure('SESSION', 'ID sesji — takie samo jak w aucie (np. leon-123)');
  await ensure('MASTER_PORT', 'Lokalny port dla programu diagnostycznego (zwykle 35000)', { def: '35000', validate: isPort });
  console.log('   ' + ok('Ustawienia zapisane.'));

  step(2, 'Kontrolka: czy lokalny port jest wolny');
  const mPort = cfg('MASTER_PORT');
  const free = await portFree(mPort);
  kontrolka(free, `Port ${mPort}`, free ? 'wolny' : 'zajęty',
    'Zamknij program, który używa tego portu, albo wybierz inny w ustawieniach.');
  if (!free && !await confirm('Port zajęty. Kontynuować mimo to?', false)) return;

  step(3, 'Kontrolka: czy serwer odpowiada');
  const relayUrl = cfg('RELAY_URL');
  console.log('   ' + wait(`sprawdzam ${relayUrl} …`));
  const relOk = await relayHealthy(relayUrl);
  kontrolka(relOk, 'Serwer (relay)', relOk ? 'odpowiada' : 'brak odpowiedzi (spróbuję połączyć i tak)',
    'Upewnij się, że serwer jest uruchomiony i adres jest poprawny.');

  step(4, 'Uruchamiam MASTER');
  console.log('   ' + paint('bold', `W programie diagnostycznym (VCDS itp.) wybierz połączenie WiFi/sieć/TCP i wpisz:`));
  console.log('   ' + paint('green', `   Adres: 127.0.0.1     Port: ${mPort}`));
  await runAgent('master.js', [
    { match: 'connected to relay', label: 'Połączono z serwerem' },
    { match: 'in-car device ONLINE', label: 'Auto online — możesz łączyć program diagnostyczny' },
    { match: 'diagnostic software connected', label: 'Program diagnostyczny podłączony — tunel działa' },
    { match: 'in-car device OFFLINE', label: 'Auto zniknęło z sieci', ok: false, hint: 'Sprawdź internet w aucie / czy Slave działa. NIE flashuj teraz!' },
  ]);
}

async function wizardRelay() {
  await dashboard();
  title('SERWER (RELAY) — łączy Master ze Slave (zaawansowane)');
  explain({
    co: 'Uruchamia serwer pośredniczący, do którego łączą się oba urządzenia (działa przez NAT/hotspot).',
    stanie: [
      'Zapytam o port i hasło/token serwera.',
      'Sprawdzę, czy port jest wolny.',
      'Uruchomię serwer i pokażę adres do wpisania po obu stronach.',
    ],
    spowoduje: 'Master i Slave będą mogły się odnaleźć po ID sesji i tokenie.',
    potrzebujesz: [
      'Najlepiej VPS z publicznym adresem IP / domeną (w produkcji za HTTPS → wss://).',
      'Do testu w domu wystarczy ten komputer (ws://adres-LAN:8080).',
    ],
  });
  if (!await confirm('Kontynuować?')) return;
  saveConfig({ ROLE: 'relay' });

  step(1, 'Ustawienia serwera');
  await ensure('RELAY_PORT', 'Port serwera (zwykle 8080)', { def: '8080', validate: isPort });
  await ensure('RELAY_TOKEN', 'Hasło/token serwera (wymyśl długi, losowy — podasz go obu stronom)', { secret: true });
  console.log('   ' + ok('Ustawienia zapisane.'));

  step(2, 'Kontrolka: czy port jest wolny');
  const rPort = cfg('RELAY_PORT');
  const free = await portFree(rPort, '0.0.0.0');
  kontrolka(free, `Port ${rPort}`, free ? 'wolny' : 'zajęty',
    'Inny program zajmuje ten port. Wybierz inny w ustawieniach.');
  if (!free && !await confirm('Port zajęty. Kontynuować mimo to?', false)) return;

  step(3, 'Uruchamiam serwer');
  console.log('   ' + paint('bold', 'Podaj obu stronom (Master i Slave):'));
  console.log('   ' + paint('green', `   Adres serwera: ws://<adres-tego-komputera>:${rPort}`));
  console.log('   ' + paint('green', `   Token:         (to, które przed chwilą ustawiłeś)`));
  await runAgent('relay.js', [
    { match: 'relay listening', label: 'Serwer działa' },
    { match: 'fully paired', label: 'Master i Slave połączone — tunel otwarty' },
  ]);
}

// ============================ NARZĘDZIA =======================================

async function doScan() {
  console.log('   ' + wait('skanuję sieć lokalną (to potrwa kilkanaście sekund)…'));
  const found = await scan();
  if (found.length === 0) {
    console.log('   ' + bad('Nie znaleziono adapterów.'));
    console.log('     ' + paint('yellow', '➜ Sprawdź, czy adapter jest wpięty, włączony i w tej samej sieci WiFi.'));
    return null;
  }
  console.log('   ' + ok(`Znaleziono ${found.length}:`));
  for (const f of found) console.log('     • ' + paint('green', `${f.host}:${f.port}`));
  const first = found[0];
  saveConfig({ ADAPTER_HOST: first.host, ADAPTER_PORT: String(first.port) });
  console.log('   ' + ok(`Zapisałem pierwszy: ${first.host}:${first.port}`));
  return first;
}

async function menuScan() {
  await dashboard();
  title('ZNAJDŹ ADAPTER OBD w sieci');
  explain({
    co: 'Przeszukuje Twoją sieć WiFi w poszukiwaniu adapterów OBD (porty 35000 i 13400).',
    stanie: ['Sprawdzę wszystkie adresy w sieci lokalnej.', 'Pokażę znalezione adaptery i zapiszę pierwszy.'],
    spowoduje: 'Nie musisz ręcznie szukać adresu IP adaptera.',
    potrzebujesz: ['Adapter wpięty do auta, włączony i w tej samej sieci WiFi co ten komputer.'],
  });
  if (!await confirm('Skanować teraz?')) return;
  await doScan();
  await pause();
}

async function doctor(silent = false) {
  if (!silent) { await dashboard(); title('SPRAWDŹ POŁĄCZENIE (doktor)'); }
  const n = checkNode();
  const d = checkDeps();
  const c = checkConfig();
  console.log(paint('bold', '  Podstawy:'));
  kontrolka(n.ok, n.label, n.detail, n.hint);
  kontrolka(d.ok, d.label, d.detail, d.hint);
  kontrolka(c.ok, c.label, c.detail, c.hint);

  console.log(paint('bold', '\n  Połączenia (jeśli skonfigurowane):'));
  const relayUrl = cfg('RELAY_URL', '');
  if (relayUrl) {
    const r = await relayHealthy(relayUrl);
    kontrolka(r, 'Serwer (relay)', relayUrl, 'Uruchom serwer lub popraw adres w ustawieniach.');
  } else {
    console.log('   ' + paint('gray', '· Serwer: nieustawiony'));
  }
  const aHost = cfg('ADAPTER_HOST', '');
  if (aHost) {
    const a = await tcpReachable(aHost, cfg('ADAPTER_PORT', '35000'));
    kontrolka(a, 'Adapter OBD', `${aHost}:${cfg('ADAPTER_PORT', '35000')}`, 'Sprawdź zasilanie adaptera i sieć WiFi.');
  } else {
    console.log('   ' + paint('gray', '· Adapter OBD: nieustawiony'));
  }
  const mPort = cfg('MASTER_PORT', '');
  if (mPort) {
    const f = await portFree(mPort);
    kontrolka(f, `Lokalny port ${mPort}`, f ? 'wolny' : 'zajęty', 'Zamknij program używający portu lub zmień port.');
  }

  const allOk = n.ok && d.ok;
  if (!silent) {
    console.log('');
    console.log(allOk ? '  ' + ok('Podstawy w porządku — możesz działać.') : '  ' + bad('Najpierw napraw podstawy powyżej.'));
    await pause();
  }
  return allOk;
}

async function showConfig() {
  await dashboard();
  title('USTAWIENIA');
  const all = getAll();
  if (Object.keys(all).length === 0) {
    console.log('  ' + paint('gray', 'Brak zapisanych ustawień. Przejdź przez kreator (1, 2 lub 3).'));
  } else {
    for (const [k, v] of Object.entries(all)) {
      const shown = k === 'RELAY_TOKEN' ? '••••••' : v;
      console.log('   ' + paint('bold', k) + ' = ' + shown);
    }
  }
  console.log('');
  if (await confirm('Zmienić któreś ustawienie ręcznie?', false)) {
    const key = await ask('   Nazwa ustawienia (np. RELAY_URL): ');
    if (key) {
      const val = await ask(`   Nowa wartość dla ${key}: `);
      saveConfig({ [key]: val });
      console.log('   ' + ok('Zapisano.'));
    }
  }
  await pause();
}

async function help() {
  await dashboard();
  title('POMOC — co to wszystko znaczy');
  console.log(`
  Trzy elementy układanki:

   ${paint('bold', 'SLAVE')}  — w aucie. Łączy adapter OBD z internetem.
   ${paint('bold', 'MASTER')} — przy laptopie. Udaje gniazdo OBD dla programu diagnostycznego.
   ${paint('bold', 'RELAY')}  — serwer pośredniczący, który ich łączy.

   Najprościej:
   1) Ktoś (lub VPS) uruchamia ${paint('bold', 'RELAY')} i podaje adres + token.
   2) Osoba w aucie wybiera ${paint('bold', '„JESTEM W AUCIE" (SLAVE)')}.
   3) Osoba z laptopem wybiera ${paint('bold', '„JESTEM PRZY LAPTOPIE" (MASTER)')}.
   ${paint('green', '   ID sesji i token muszą być IDENTYCZNE po obu stronach.')}

  ${paint('yellow', '⚠ Flashowanie ECU:')} rób tylko na bardzo stabilnym łączu. Zerwanie
   połączenia w trakcie może uszkodzić sterownik. Kreator zrywa połączenie,
   gdy auto zniknie z sieci — ale i tak nie flashuj na słabym 4G.
  `);
  await pause();
}

// ============================ PĘTLA GŁÓWNA ====================================

async function mainMenu() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await dashboard();
    console.log(paint('bold', '  Co chcesz zrobić? Wpisz numer i ENTER:'));
    console.log('');
    console.log('   ' + paint('green', '1') + ')  JESTEM W AUCIE — udostępniam auto            ' + paint('gray', '(SLAVE)'));
    console.log('   ' + paint('green', '2') + ')  JESTEM PRZY LAPTOPIE — łączę się z autem     ' + paint('gray', '(MASTER)'));
    console.log('   ' + paint('green', '3') + ')  URUCHOM SERWER                               ' + paint('gray', '(RELAY, zaawansowane)'));
    console.log('   ' + paint('green', '4') + ')  SPRAWDŹ POŁĄCZENIE (doktor)');
    console.log('   ' + paint('green', '5') + ')  ZNAJDŹ ADAPTER OBD w sieci');
    console.log('   ' + paint('green', '6') + ')  USTAWIENIA');
    console.log('   ' + paint('green', '7') + ')  POMOC');
    console.log('   ' + paint('green', '0') + ')  Wyjście');
    console.log('');
    const choice = await ask('  Twój wybór: ');
    try {
      if (choice === '1') await wizardSlave();
      else if (choice === '2') await wizardMaster();
      else if (choice === '3') await wizardRelay();
      else if (choice === '4') await doctor();
      else if (choice === '5') await menuScan();
      else if (choice === '6') await showConfig();
      else if (choice === '7') await help();
      else if (choice === '0' || choice.toLowerCase() === 'q') { break; }
      else { console.log('  ' + bad('Nie ma takiej opcji. Wpisz numer 0–7.')); await pause(); }
    } catch (e) {
      console.log('  ' + bad('Coś poszło nie tak: ' + (e && e.message ? e.message : e)));
      await pause();
    }
  }
  console.log('\n  Do zobaczenia!');
}

// ---- start -------------------------------------------------------------------
async function main() {
  if (process.argv.includes('--doctor')) {
    const okAll = await doctor(true);
    process.exit(okAll ? 0 : 1);
  }
  rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    await mainMenu();
  } finally {
    rl.close();
  }
}

main();
