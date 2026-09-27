import { db } from '../db';

/**
 * Who owns the data stored on THIS device.
 *
 * The app is offline-first: Dexie is the source of truth and the cloud is
 * a copy. That opens a hole that doesn't exist in a normal app — signing
 * out deletes the Supabase token, but doesn't delete IndexedDB. If
 * another account then signs in on the same browser, push takes ALL the
 * local rows and uploads them stamped with the user_id of whoever is
 * logged in now. It's not just that the second person sees the first
 * person's transactions: they end up copied into their account, in the
 * cloud, forever.
 *
 * The marker lives in IndexedDB and not in localStorage on purpose: it
 * has to die together with the data it describes. In localStorage it
 * could be cleared separately, and a missing marker next to data that's
 * still there would read as "nobody owns this" — exactly the case that
 * opens the leak.
 *
 * This marker is NEVER synced. It's a property of the device.
 */
const OWNER_KEY = 'owner';

export interface RowMeta {
  id: string;
  value: string;
}

/**
 * Does the local data need to be wiped before letting `entrante` in?
 *
 * - No previous marker: NO. It's someone who used the app without an
 *   account and is now signing up; their own data has to survive the
 *   first login.
 * - Same person: NO. That's the normal case.
 * - Another person: YES. Whatever belonged to the previous account can't
 *   come in here.
 */
export function shouldWipe(previous: string | null, entrante: string): boolean {
  return previous !== null && previous !== entrante;
}

export async function localOwner(): Promise<string | null> {
  const row = await db.meta.get(OWNER_KEY);
  return row?.value ?? null;
}

/** Wipes every trace of the previous account, including tombstones. */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

/**
 * Called on every login, BEFORE syncing. Returns true if a wipe was
 * needed, so the caller knows the screen changed under its feet.
 */
export async function ensureOwner(entrante: string): Promise<boolean> {
  const previous = await localOwner();
  const clear = shouldWipe(previous, entrante);
  if (clear) await clearLocalData();
  await db.meta.put({ id: OWNER_KEY, value: entrante });
  return clear;
}
