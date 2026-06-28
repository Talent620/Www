#!/usr/bin/env bash
# AIR OBD — kreator „klikam i działa" (macOS / Linux)
set -e
cd "$(dirname "$0")"

echo
echo "  ============================================================"
echo "    AIR OBD — uruchamiam kreator…"
echo "  ============================================================"
echo

# 1. Node.js?
if ! command -v node >/dev/null 2>&1; then
  echo "  [!] Nie znaleziono Node.js."
  echo "      Zainstaluj Node.js 18+ ze strony https://nodejs.org"
  echo "      (albo: sudo apt install nodejs  /  brew install node), potem uruchom ponownie."
  exit 1
fi

# 2. Składniki?
if [ ! -f "node_modules/ws/package.json" ]; then
  echo "  Pierwsze uruchomienie — instaluję składniki…"
  npm install --no-audit --no-fund
fi

# 3. Menu
node src/menu.js
