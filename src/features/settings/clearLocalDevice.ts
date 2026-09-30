import { db } from '@/data/db';

/**
 * "Borrar también de este teléfono" (redesign §11 item 4): after signing
 * out, nothing of the account stays on this device.
 *
 * The whole IndexedDB goes — not table by table: deleting the database also
 * drops the owner marker and the sync cursors, so this browser is truly
 * blank — and is opened again empty, because the app still holds `db` and
 * the login screen reads from it.
 *
 * Then the device preferences in localStorage (language, collapsed groups,
 * chart layout, the day's exchange rates…). The Supabase session keys
 * (`sb-…`) are left to supabase-js, which already removed them on signOut.
 */
export async function clearLocalDevice(): Promise<void> {
  // disableAutoOpen: false — the screens still on show keep querying while
  // this runs; with auto-open they wait for the fresh database instead of
  // failing with DatabaseClosedError.
  await db.delete({ disableAutoOpen: false });
  await db.open();
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.startsWith('sb-')) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    // Storage blocked (private mode): there's nothing stored to clear.
  }
}
