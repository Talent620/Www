// Ustawienia zapisywane w pliku airobd.config.json (obok projektu), żeby
// początkujący nie musieli dotykać zmiennych środowiskowych ani .env.
// Kolejność: zmienna środowiskowa > plik konfiguracyjny > wartość domyślna.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG_PATH = process.env.AIROBD_CONFIG || path.join(__dirname, '..', 'airobd.config.json');

let fileCfg = {};

export function loadConfig() {
  try {
    fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    fileCfg = {};
  }
  return fileCfg;
}

export function saveConfig(patch) {
  fileCfg = { ...fileCfg, ...patch };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(fileCfg, null, 2) + '\n');
  return fileCfg;
}

export function getAll() {
  return { ...fileCfg };
}

// Pobierz wartość: env ma pierwszeństwo, potem plik, potem fallback.
export function cfg(key, fallback = '') {
  const env = process.env[key];
  if (env != null && env !== '') return env;
  const f = fileCfg[key];
  if (f != null && f !== '') return f;
  return fallback;
}

loadConfig();
