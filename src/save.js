// Speichern im localStorage (pro Gerät/Browser) plus Export/Import als Text-Code.

import { SAVE_VERSION } from './sim.js';

const KEY = 'fantasycrafter.save';

// savedAt = Echtzeit, bis zu der die Simulation gerechnet hat (nicht der Speicherzeitpunkt)
export function saveGame(state, speed, savedAt = Date.now()) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ state, speed, savedAt }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.state?.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* egal */ }
}

export function exportCode(state, speed) {
  const json = JSON.stringify({ state, speed, savedAt: Date.now() });
  return btoa(unescape(encodeURIComponent(json)));
}

export function importCode(code) {
  const json = decodeURIComponent(escape(atob(code.trim())));
  const data = JSON.parse(json);
  if (data?.state?.version !== SAVE_VERSION) throw new Error('Unbekannte Spielstand-Version');
  return data;
}
