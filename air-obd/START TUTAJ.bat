@echo off
chcp 65001 >nul
title AIR OBD - Kreator (klikam i dziala)
cd /d "%~dp0"

echo.
echo   ============================================================
echo     AIR OBD - uruchamiam kreator. Chwila cierpliwosci...
echo   ============================================================
echo.

REM --- 1. Czy jest Node.js? ---
where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Nie znaleziono Node.js - to "silnik", ktory uruchamia program.
  echo.
  echo       CO ZROBIC:
  echo       1^) Otworze za chwile strone https://nodejs.org
  echo       2^) Kliknij wielki przycisk "LTS" i zainstaluj (same OK / Dalej).
  echo       3^) Uruchom ten plik ponownie (dwuklik).
  echo.
  pause
  start "" https://nodejs.org/
  exit /b 1
)

REM --- 2. Czy sa skladniki? Jak nie - instaluje sam ---
if not exist "node_modules\ws\package.json" (
  echo   Pierwsze uruchomienie - instaluje skladniki. To potrwa chwilke...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   [!] Instalacja sie nie powiodla. Sprawdz polaczenie z internetem
    echo       i uruchom ten plik jeszcze raz.
    pause
    exit /b 1
  )
)

REM --- 3. Odpalamy menu ---
node "src\menu.js"

echo.
echo   Menu zamkniete. Mozesz zamknac to okno.
pause
