/**
 * Sync between IndexedDB (offline source of truth) and Supabase.
 *
 * Strategy: last-write-wins by updatedAt, plus tombstones for deletions
 * (without them, the device that still has the row resurrects it on the
 * next push — see tombstones.ts).
 *
 * Order of a full cycle:
 *   1. pull remote tombstones and apply them here
 *   2. pull rows and keep the ones newer than the local copies
 *   3. push local tombstones and delete those rows over there
 *   4. push local rows newer than the remote copies
 *
 * Tombstones go BEFORE rows in each direction: otherwise a row gets
 * pushed and immediately deleted, or worse, a row that was already
 * deleted gets pulled back in.
 *
 * Movements and tombstones are INCREMENTAL: pull asks only for what the
 * server stamped (synced_at, its own clock) after this device's cursor,
 * and push compares against (id, updated_at) instead of whole rows. They
 * used to be downloaded whole, twice, on every cycle — the cost grew with
 * the age of the account instead of with what changed.
 */
import { db } from '../db';
import {
  currentUserId, listTransactionsChangedSince, listTransactionVersions, supabaseRepository, upsertMany,
} from '../supabase/supabaseRepository';
import {
  categoryToRow, paymentMethodToRow, recurringRuleToRow, reminderToRow, transactionToRow,
} from '../supabase/mappers';
import {
  applyRemoteDeletions, listRemoteTombstoneIds, listRemoteTombstonesSince, saveRemoteTombstones,
} from '../supabase/deletions';
import { listRemoteBudgets, saveRemoteBudgets } from '../supabase/budgets';
import { deletedIdsOf, makeTombstone, mergeTombstones, type Tombstone } from './tombstones';
import { reconcileBudgets } from './budgets';
import { remindersToUpload } from './reminders';
import { newest as newer } from './newest';
import { reconcileOccurrences } from './duplicateOccurrences';
import type { Reminder, Settings, Transaction } from '@/domain/types';

export interface SyncResult {
  pushed: number;
  pulled: number;
  deleted: number;
}

/**
 * Which of the two settings survives.
 *
 * This exists because the app's most annoying bug came exactly from not
 * having it: pulling from the cloud straight into `db.settings.put(remoto)`
 * blindly. On the first login the cloud doesn't have a row yet, the
 * repository returned default values (onboardedAt = null), that
 * overwrote the local one and then got pushed — so EVERY login it went
 * back to asking for name, currency and categories, even though they'd
 * already been set up.
 *
 * Transactions already got resolved by updatedAt; Settings had nothing to
 * compare against.
 */
/**
 * Which of the two copies of a row survives. Same rule as elegirSettings,
 * kept separate so it can be tested without a database.
 */
export function chooseRow<T extends { updatedAt: string }>(local: T | undefined, remoteRow: T): T {
  if (!local) return remoteRow;
  return newer(remoteRow.updatedAt, local.updatedAt) ? remoteRow : local;
}

/**
 * Of each remote row, keeps whichever wins against its local copy. The
 * ones that win locally are returned as they already are here, so the
 * bulkPut that follows doesn't change them.
 */
async function keepNewest<T extends { id: string; updatedAt: string }>(
  remotas: T[],
  findLocal: (id: string) => Promise<T | undefined>,
): Promise<T[]> {
  const result: T[] = [];
  for (const remoteRow of remotas) {
    result.push(chooseRow(await findLocal(remoteRow.id), remoteRow));
  }
  return result;
}

export function chooseSettings(local: Settings | undefined, remoteRow: Settings): Settings {
  if (!local) return remoteRow;
  return newer(remoteRow.updatedAt, local.updatedAt) ? remoteRow : local;
}

/** Applies locally the deletions that come from another device. */
async function applyTombstonesLocally(tombstones: Tombstone[]): Promise<number> {
  if (tombstones.length === 0) return 0;
  const table = {
    transactions: db.transactions,
    categories: db.categories,
    paymentMethods: db.paymentMethods,
    recurringRules: db.recurringRules,
  } as const;

  let deletedCount = 0;
  for (const t of tombstones) {
    const exists = await table[t.entity].get(t.entityId);
    if (exists) {
      await table[t.entity].delete(t.entityId);
      // Same as localRepository.deleteTransaction: the reminder goes with
      // its transaction, even if the deletion comes from another device.
      if (t.entity === 'transactions') {
        await db.reminders.where('transactionId').equals(t.entityId).delete();
      }
      deletedCount += 1;
    }
  }
  return deletedCount;
}

/**
 * Re-read this much before the cursor. A row is stamped when its statement
 * starts but becomes visible when it commits; one that committed a moment
 * after a pull already read past its stamp would otherwise be skipped
 * forever. Re-reading is harmless: last-write-wins makes it a no-op.
 */
const CURSOR_OVERLAP_MS = 2 * 60_000;
/**
 * The server forgets tombstones after 180 days (cleanup_expired in
 * 0009). A device whose cursor is older may hold rows deleted elsewhere
 * with no tombstone left to say so: it re-downloads everything instead of
 * trusting its copy. A margin short of 180, for clock skew.
 */
const STALE_AFTER_MS = 170 * 24 * 60 * 60_000;
/** Reminders the server also drops (cleanup_expired): 15 days past due. */
const REMINDER_KEEP_MS = 15 * 24 * 60 * 60_000;

const TX_CURSOR = 'cursor:transactions';
const TOMB_CURSOR = 'cursor:deletions';

async function readCursor(key: string): Promise<string | null> {
  return (await db.meta.get(key))?.value ?? null;
}
async function advanceCursor(key: string, seen: string | null): Promise<void> {
  if (!seen) return;
  const prev = await readCursor(key);
  if (!prev || seen > prev) await db.meta.put({ id: key, value: seen });
}
/**
 * Only while the cursor is fresh: a late commit can land minutes after,
 * never hours. Re-reading the window from an OLD cursor re-downloaded, on
 * every cycle, whatever batch sat at the cursor — an import or a first
 * upload shares one timestamp — until something newer moved it.
 */
const OVERLAP_ONLY_WITHIN_MS = 10 * 60_000;

export function since(cursor: string | null, now = Date.now()): string | null {
  if (!cursor) return null;
  const at = Date.parse(cursor);
  return now - at < OVERLAP_ONLY_WITHIN_MS ? new Date(at - CURSOR_OVERLAP_MS).toISOString() : cursor;
}

export function isStale(cursor: string | null, now = Date.now()): boolean {
  return cursor !== null && now - Date.parse(cursor) > STALE_AFTER_MS;
}

/**
 * A stale device just downloaded the whole account. A local movement the
 * cloud no longer has was deleted elsewhere — if it's older than this
 * device's last sync, which means the cloud had it once. Newer ones were
 * made here while offline and still have to go up.
 */
export function goneWhileAway(local: Transaction[], remoteIds: Set<string>, lastCursor: string): string[] {
  return local.filter((t) => !remoteIds.has(t.id) && !newer(t.updatedAt, lastCursor)).map((t) => t.id);
}

function reminderExpired(r: Reminder, now = Date.now()): boolean {
  return now - Date.parse(r.remindAt) > REMINDER_KEEP_MS;
}

export async function pullCloudToLocal(): Promise<SyncResult> {
  const [txCursor, tombCursor] = await Promise.all([readCursor(TX_CURSOR), readCursor(TOMB_CURSOR)]);
  const stale = isStale(txCursor);

  const { tombstones: remoteTombstones, maxSyncedAt: tombSeen } =
    await listRemoteTombstonesSince(stale ? null : since(tombCursor));
  const localTombstones = await db.deletions.toArray();
  const all = mergeTombstones(localTombstones, remoteTombstones);
  await db.deletions.bulkPut(all);
  const deleted = await applyTombstonesLocally(remoteTombstones);

  const [{ rows: remoteTx, maxSyncedAt: txSeen }, categories, methods, rules, settings, remoteBudgets, remoteReminders] = await Promise.all([
    listTransactionsChangedSince(stale ? null : since(txCursor)),
    supabaseRepository.listCategories(),
    supabaseRepository.listPaymentMethods(),
    supabaseRepository.listRecurringRules(),
    supabaseRepository.getSettings(),
    listRemoteBudgets(),
    supabaseRepository.listReminders(),
  ]);

  // Nothing that's been deleted comes back in, no matter where it's from.
  const deletedTx = deletedIdsOf(all, 'transactions');
  const deletedCat = deletedIdsOf(all, 'categories');
  const deletedPm = deletedIdsOf(all, 'paymentMethods');
  const deletedRr = deletedIdsOf(all, 'recurringRules');

  // Keeps the newest from each side, same as with transactions.
  //
  // This used to be a blind bulkPut, and the effect was NOT just losing a
  // change made offline: since the cycle always starts by pulling and
  // saving doesn't trigger a push, renaming a category, archiving it,
  // changing a card's cutoff day, or turning off a recurring rule would
  // undo ITSELF on the very next visibilitychange, with a single device
  // and with internet. A row with no updatedAt gives NaN and loses, which
  // is the old behavior: the migration comes for free.
  await db.categories.bulkPut(
    await keepNewest(categories.filter((c) => !deletedCat.has(c.id)), (id) => db.categories.get(id)),
  );
  await db.paymentMethods.bulkPut(
    await keepNewest(methods.filter((m) => !deletedPm.has(m.id)), (id) => db.paymentMethods.get(id)),
  );
  await db.recurringRules.bulkPut(
    await keepNewest(rules.filter((r) => !deletedRr.has(r.id)), (id) => db.recurringRules.get(id)),
  );
  await db.settings.put(chooseSettings(await db.settings.get('singleton'), settings));

  // Budgets: paired by category+month, not by id — see presupuestos.ts.
  // They go AFTER categories because in Postgres they point to them
  // with an FK.
  const planBudgets = reconcileBudgets(await db.budgets.toArray(), remoteBudgets);
  if (planBudgets.deleteLocal.length > 0) await db.budgets.bulkDelete(planBudgets.deleteLocal);
  if (planBudgets.saveLocal.length > 0) await db.budgets.bulkPut(planBudgets.saveLocal);

  // Reminders: plain last-write-wins by id, none of the budgets' back and
  // forth, because their id IS the transaction's — two devices generate
  // the same one. Pulling them matters so the 'sent' the server sets when
  // it sends the notification doesn't get overwritten back by this copy.
  //
  // Expired ones (15 days past due) are dropped on both sides, same rule
  // as the server's cleanup — kept here, push would upload them right back.
  const expired = (await db.reminders.toArray()).filter((r) => reminderExpired(r)).map((r) => r.id);
  if (expired.length > 0) await db.reminders.bulkDelete(expired);
  const liveReminders = remoteReminders.filter((r) => !deletedTx.has(r.transactionId) && !reminderExpired(r));
  const remindersToSave = await keepNewest(liveReminders, (id) => db.reminders.get(id));
  if (remindersToSave.length > 0) await db.reminders.bulkPut(remindersToSave);

  let localAll = await db.transactions.toArray();

  if (stale && txCursor) {
    const gone = goneWhileAway(localAll, new Set(remoteTx.map((t) => t.id)), txCursor);
    if (gone.length > 0) {
      await db.transactions.bulkDelete(gone);
      localAll = await db.transactions.toArray();
    }
  }

  // A recurring occurrence with two ids is the SAME occurrence, and the
  // pair (recurringRuleId, periodKey) is a unique index in Dexie: letting
  // both through to bulkPut threw ConstraintError and, since this call is
  // the last one in the pull, killed the entire cycle. See ocurrenciasDuplicadas.ts.
  const plan = reconcileOccurrences(
    remoteTx.filter((tx) => !deletedTx.has(tx.id)),
    localAll,
  );

  if (plan.toDelete.length > 0) {
    const now = new Date().toISOString();
    await db.transactions.bulkDelete(plan.toDelete);
    // With a tombstone: without it, the other device, which still has the
    // row with the old id, uploads it again and the collision comes back.
    await db.deletions.bulkPut(plan.toDelete.map((id) => makeTombstone('transactions', id, now)));
  }

  const localById = new Map(localAll.map((t) => [t.id, t]));
  const toPut: Transaction[] = [];
  for (const tx of plan.toSave) {
    const local = localById.get(tx.id);
    if (!local || newer(tx.updatedAt, local.updatedAt)) toPut.push(tx);
  }
  if (toPut.length > 0) await saveTolerant(toPut);

  // Only now: everything up to here is merged locally.
  await advanceCursor(TX_CURSOR, txSeen);
  await advanceCursor(TOMB_CURSOR, tombSeen);

  return {
    pushed: 0,
    pulled: toPut.length + planBudgets.saveLocal.length + remindersToSave.length,
    deleted,
  };
}

/** Local rows that win against their cloud copy — the only ones worth uploading. */
function newerThanRemote<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  return local.filter((l) => {
    const r = remoteById.get(l.id);
    return !r || newer(l.updatedAt, r.updatedAt);
  });
}

export async function pushLocalToCloud(): Promise<SyncResult> {
  const userId = await currentUserId();

  // 1. Deletions first: push the tombstone and delete over there. Only the
  //    ones the cloud doesn't have yet — re-sending the whole history on
  //    every cycle grew without limit, and the delete's id list, which
  //    travels in the URL, eventually got too long for the server.
  const [tombstones, known] = await Promise.all([db.deletions.toArray(), listRemoteTombstoneIds()]);
  const newTombstones = tombstones.filter((t) => !known.has(t.id));
  await saveRemoteTombstones(newTombstones);
  await applyRemoteDeletions(newTombstones);

  const deletedTx = deletedIdsOf(tombstones, 'transactions');
  const deletedCat = deletedIdsOf(tombstones, 'categories');
  const deletedPm = deletedIdsOf(tombstones, 'paymentMethods');
  const deletedRr = deletedIdsOf(tombstones, 'recurringRules');

  const [
    localTx, remoteVersions, categories, remoteCategories, methods, remoteMethods, rules, remoteRules,
    settings, remoteSettings, localBudgets, remoteBudgets, localReminders, remoteReminders,
  ] = await Promise.all([
    db.transactions.toArray(),
    listTransactionVersions(),
    db.categories.toArray(),
    supabaseRepository.listCategories(),
    db.paymentMethods.toArray(),
    supabaseRepository.listPaymentMethods(),
    db.recurringRules.toArray(),
    supabaseRepository.listRecurringRules(),
    db.settings.get('singleton'),
    supabaseRepository.getSettings(),
    db.budgets.toArray(),
    listRemoteBudgets(),
    db.reminders.toArray(),
    supabaseRepository.listReminders(),
  ]);

  // Categories and methods before transactions: Postgres's FKs reject a
  // transaction whose category doesn't exist over there yet.
  const catUp = newerThanRemote(categories.filter((c) => !deletedCat.has(c.id)), remoteCategories);
  const pmUp = newerThanRemote(methods.filter((m) => !deletedPm.has(m.id)), remoteMethods);
  const rrUp = newerThanRemote(rules.filter((r) => !deletedRr.has(r.id)), remoteRules);
  await upsertMany('categories', catUp.map((c) => categoryToRow(userId, c)));
  await upsertMany('payment_methods', pmUp.map((m) => paymentMethodToRow(userId, m)));
  await upsertMany('recurring_rules', rrUp.map((r) => recurringRuleToRow(userId, r)));
  if (settings && newer(settings.updatedAt, remoteSettings.updatedAt)) await supabaseRepository.saveSettings(settings);

  // Budgets: after categories, which is what their FK points to, and only
  // the ones that win by date. Skips the budget whose category was
  // deleted: the FK would reject it and take down the entire push.
  const planBudgets = reconcileBudgets(localBudgets, remoteBudgets);
  await saveRemoteBudgets(planBudgets.subir.filter((b) => !deletedCat.has(b.categoryId)));

  const txUp = localTx.filter((tx) => {
    if (deletedTx.has(tx.id)) return false;
    const remoteVersion = remoteVersions.get(tx.id);
    return remoteVersion === undefined || newer(tx.updatedAt, remoteVersion);
  });
  await upsertMany('transactions', txUp.map((tx) => transactionToRow(userId, tx)));

  // Reminders LAST: their FK points to transactions, so the transaction
  // has to already exist over there. See recordatorios.ts for why orphans
  // get filtered out.
  const aliveIds = new Set(localTx.filter((t) => !deletedTx.has(t.id)).map((t) => t.id));
  const remUp = remindersToUpload(localReminders, remoteReminders, aliveIds);
  await upsertMany('reminders', remUp.map((r) => reminderToRow(userId, r)));

  return {
    pushed: catUp.length + pmUp.length + rrUp.length + txUp.length + remUp.length + planBudgets.subir.length,
    pulled: 0,
    deleted: newTombstones.length,
  };
}

export async function syncBidirectional(): Promise<SyncResult> {
  const pull = await pullCloudToLocal();
  const push = await pushLocalToCloud();
  return { pushed: push.pushed, pulled: pull.pulled, deleted: pull.deleted };
}

/**
 * One bad row can't kill the sync cycle.
 *
 * bulkPut throws if ANY row violates an index, and since the pull ends
 * here, a single collision left the user with nothing synced —neither
 * pull nor push— and the same error repeating on every attempt.
 *
 * conciliarOcurrencias already removes the known case; this is the belt
 * in case another one shows up. Same approach as materialize.ts's
 * bulkAdd: retry row by row and log whatever didn't make it in, instead
 * of losing the 149 that were actually fine.
 */
async function saveTolerant(rows: Transaction[]): Promise<void> {
  try {
    await db.transactions.bulkPut(rows);
  } catch {
    let failed = 0;
    for (const row of rows) {
      try {
        await db.transactions.put(row);
      } catch {
        failed += 1;
      }
    }
    if (failed > 0) {
      console.warn(`Sync: ${failed} de ${rows.length} movimientos no se pudieron guardar localmente.`);
    }
  }
}
