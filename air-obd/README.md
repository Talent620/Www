# Air OBD Tunnel — zdalna diagnostyka Master + Slave

Transparentny tunel surowych pakietów OBD-II przez internet. Sprawia, że
oprogramowanie diagnostyczne na laptopie (VCDS, OBDeleven, itp.) „widzi" auto
stojące na drugim końcu miasta tak, jakby było podpięte kablem.

```
[VCDS / OBD app] ──TCP──► [MASTER] ──WSS──► [RELAY] ◄──WSS── [SLAVE] ──► [adapter OBD] ──► auto
   laptop technika          u Ciebie         VPS w chmurze      w aucie       (ELM327 / serial)
```

To jest właśnie „narzędzie, którego brakuje" między fizycznym Masterem
a Slave'em: oba urządzenia łączą się **na zewnątrz** do serwera relay, więc
działa przez hotspot z telefonu i sieć domową **bez przekierowania portów**.

## ⭐ Najprościej: kliknij i działaj (dla każdego)

Nie musisz znać żadnych komend.

- **Windows:** kliknij dwa razy **`START TUTAJ.bat`**.
- **macOS / Linux:** uruchom **`./start.sh`** (raz nadaj prawa: `chmod +x start.sh`).

Plik startowy **sam** sprawdzi czy masz Node.js (jak nie — otworzy stronę do
pobrania), **sam** doinstaluje składniki i otworzy **kreator z menu**:

```
  Stan urządzenia:
   ✓ Node.js — v20.x
   ✓ Składniki programu — zainstalowane
   ✗ Konfiguracja — jeszcze nie ustawiona

  Co chcesz zrobić? Wpisz numer i ENTER:
   1) JESTEM W AUCIE — udostępniam auto            (SLAVE)
   2) JESTEM PRZY LAPTOPIE — łączę się z autem     (MASTER)
   3) URUCHOM SERWER                               (RELAY)
   4) SPRAWDŹ POŁĄCZENIE (doktor)
   5) ZNAJDŹ ADAPTER OBD w sieci
   6) USTAWIENIA
   7) POMOC
   0) Wyjście
```

Każda opcja **najpierw tłumaczy**, co się stanie po wybraniu i co to spowoduje,
prowadzi **krok po kroku** i po każdym kroku pokazuje **kontrolkę ✓/✗** (czy
adapter odpowiada, czy serwer żyje, czy port wolny, czy mechanik się połączył).
Gdy coś jest na czerwono — pokazuje **podpowiedź, jak naprawić**. Nie da się
„czegoś nie uruchomić" — zawsze widać, co jest dalej do zrobienia.

> Ustawienia zapisują się same do `airobd.config.json` — **nie trzeba** ręcznie
> edytować żadnych plików. „Doktor" (opcja 4) w każdej chwili sprawdzi cały stan.

## Trzy komponenty

| Komponent  | Gdzie działa            | Rola |
|------------|-------------------------|------|
| `relay.js`  | VPS z publicznym IP     | Paruje urządzenia po `SESSION` + token, przepuszcza bajty. Nie zagląda do payloadu. |
| `slave.js`  | W aucie (telefon/router) | Gada z adapterem (WiFi ELM327 po TCP lub serial) i z relayem. |
| `master.js` | Przy laptopie technika   | Wystawia lokalny port TCP dla oprogramowania diagnostycznego. |

## Szybki start

```bash
npm install
```

### 1. Relay (na VPS)

```bash
RELAY_TOKEN=długi-losowy-sekret RELAY_PORT=8080 npm run relay
```

W produkcji postaw przed nim TLS (Caddy/Nginx) i łącz się przez `wss://`.
Gotowy `docker-compose.yml` jest w repo.

### 2. Slave (w aucie)

WiFi ELM327:

```bash
RELAY_URL=wss://relay.example.com RELAY_TOKEN=... SESSION=leon-123 \
ADAPTER_HOST=192.168.0.10 ADAPTER_PORT=35000 npm run slave
```

Adapter szeregowy/USB (wymaga opcjonalnego `serialport`):

```bash
RELAY_URL=wss://relay.example.com RELAY_TOKEN=... SESSION=leon-123 \
SERIAL_PATH=/dev/ttyUSB0 SERIAL_BAUD=38400 npm run slave
```

### 3. Master (przy laptopie)

```bash
RELAY_URL=wss://relay.example.com RELAY_TOKEN=... SESSION=leon-123 \
MASTER_PORT=35000 npm run master
```

Teraz w oprogramowaniu diagnostycznym wybierz połączenie typu **WiFi/TCP
ELM327** i wskaż `127.0.0.1:35000`. `SESSION` musi być **identyczny** po obu
stronach.

## Oprogramowanie obsługujące tylko port COM

Jeśli Twój program nie umie łączyć się po TCP, zmostkuj lokalny port TCP
mastera na wirtualny COM:

- **Windows:** `com0com` (wirtualna para COM) + `com2tcp` →
  `com2tcp \\.\CNCB0 127.0.0.1 35000`, w programie wybierz `CNCA0`.
- **Linux/macOS:** `socat pty,link=/tmp/obd,raw tcp:127.0.0.1:35000`,
  w programie wskaż `/tmp/obd`.

## Bezpieczeństwo

- `RELAY_TOKEN` — wspólny sekret, sprawdzany w czasie stałym. Bez niego każdy,
  kto zna `SESSION`, może się podłączyć.
- Zawsze używaj `wss://` (TLS) w internecie — surowe ramki OBD nie są
  szyfrowane na poziomie aplikacji.
- `SESSION` traktuj jak hasło jednorazowe do konkretnej sesji.

## ⚠️ Ostrzeżenie o flashowaniu (ECU)

Tunel jest transparentny, ale internet bywa zawodny. Odczyt błędów czy drobne
kodowanie wybaczą chwilowe zacięcie. **Zerwanie łącza podczas flashowania
sterownika (ECU) z dużym prawdopodobieństwem go „uceli"** — konieczna będzie
fizyczna naprawa na stole.

Dlatego ten tool:
- ma **heartbeat** na relayu (15 s) i wykrywa martwe łącze,
- **natychmiast zrywa** połączenie diagnostyczne, gdy auto zniknie z sieci
  (zamiast cicho zawiesić transfer w połowie),
- ustawia `TCP_NODELAY` po obu stronach, by minimalizować opóźnienia.

Mimo to: **do flashowania używaj najbardziej stabilnego łącza, jakie masz
(najlepiej kablowego/LAN po stronie auta), pilnuj zasilania w aucie i nie rób
tego na słabym 4G.**

## Testy

```bash
npm test
```

Test end-to-end uruchamia cały łańcuch (klient → master → relay → slave →
adapter echo) i sprawdza, że bajty wracają nienaruszone.

## Licencja

MIT. Do legalnej diagnostyki/strojenia własnych aut lub aut, do których masz
upoważnienie.
