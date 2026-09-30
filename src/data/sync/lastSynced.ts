/**
 * When this device last finished a sync, for "Sincronizado · hace 2 min" in
 * Perfil (redesign §9e). A device fact, so localStorage — and it goes with
 * the rest of the device's preferences when "Borrar también de este
 * teléfono" wipes them.
 */
const KEY = 'step-up:last-synced';

export function markSynced(at = Date.now()): void {
  try { localStorage.setItem(KEY, String(at)); } catch { /* storage blocked */ }
}

export function lastSynced(): number | null {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
