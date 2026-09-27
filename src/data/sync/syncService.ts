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
 */
import { db } from '../db';
import { supabaseRepository } from '../supabase/supabaseRepository';
import { applyRemoteDeletions, listRemoteTombstones, saveRemoteTombstones } from '../supabase/deletions';
import { listRemoteBudgets, saveRemoteBudgets } from '../supabase/budgets';
import { deletedIdsOf, makeTombstone, mergeTombstones, type Tombstone } from './tombstones';
import { reconcileBudgets } from './budgets';
import { remindersToUpload } from './reminders';
import { newest as newer } from './newest';
import { reconcileOccurrences } from './duplicateOccurrences';
import type { Settings, Transaction } from '@/domain/types';

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

export async function pullCloudToLocal(): Promise<SyncResult> {
  const remoteTombstones = await listRemoteTombstones();
  const localTombstones = await db.deletions.toArray();
  const all = mergeTombstones(localTombstones, remoteTombstones);
  await db.deletions.bulkPut(all);
  const deleted = await applyTombstonesLocally(remoteTombstones);

  const [remoteTx, categories, methods, rules, settings, remoteBudgets, remoteReminders] = await Promise.all([
    supabaseRepository.listTransactions(),
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
  const liveReminders = remoteReminders.filter((r) => !deletedTx.has(r.transactionId));
  const remindersToSave = await keepNewest(liveReminders, (id) => db.reminders.get(id));
  if (remindersToSave.length > 0) await db.reminders.bulkPut(remindersToSave);

  const localAll = await db.transactions.toArray();

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

  return {
    pushed: 0,
    pulled: toPut.length + planBudgets.saveLocal.length + remindersToSave.length,
    deleted,
  };
}

export async function pushLocalToCloud(): Promise<SyncResult> {
  // 1. Deletions first: push the tombstone and delete over there.
  const tombstones = await db.deletions.toArray();
  await saveRemoteTombstones(tombstones);
  await applyRemoteDeletions(tombstones);

  const deletedTx = deletedIdsOf(tombstones, 'transactions');
  const deletedCat = deletedIdsOf(tombstones, 'categories');
  const deletedPm = deletedIdsOf(tombstones, 'paymentMethods');
  const deletedRr = deletedIdsOf(tombstones, 'recurringRules');

  const [localTx, remoteTx, categories, methods, rules, settings, localBudgets, remoteBudgets, localReminders, remoteReminders] = await Promise.all([
    db.transactions.toArray(),
    supabaseRepository.listTransactions(),
    db.categories.toArray(),
    db.paymentMethods.toArray(),
    db.recurringRules.toArray(),
    db.settings.get('singleton'),
    db.budgets.toArray(),
    listRemoteBudgets(),
    db.reminders.toArray(),
    supabaseRepository.listReminders(),
  ]);

  // Categories and methods before transactions: Postgres's FKs reject a
  // transaction whose category doesn't exist over there yet.
  for (const c of categories.filter((c) => !deletedCat.has(c.id))) await supabaseRepository.saveCategory(c);
  for (const m of methods.filter((m) => !deletedPm.has(m.id))) await supabaseRepository.savePaymentMethod(m);
  for (const r of rules.filter((r) => !deletedRr.has(r.id))) await supabaseRepository.saveRecurringRule(r);
  if (settings) await supabaseRepository.saveSettings(settings);

  // Budgets: after categories, which is what their FK points to, and only
  // the ones that win by date. Skips the budget whose category was
  // deleted: the FK would reject it and take down the entire push.
  const planBudgets = reconcileBudgets(localBudgets, remoteBudgets);
  await saveRemoteBudgets(planBudgets.subir.filter((b) => !deletedCat.has(b.categoryId)));

  const remoteById = new Map(remoteTx.map((t) => [t.id, t]));
  let pushed = 0;
  for (const tx of localTx) {
    if (deletedTx.has(tx.id)) continue;
    const remote = remoteById.get(tx.id);
    if (!remote || newer(tx.updatedAt, remote.updatedAt)) {
      await supabaseRepository.saveTransaction(tx);
      pushed += 1;
    }
  }

  // Reminders LAST: their FK points to transactions, so the transaction
  // has to already exist over there. See recordatorios.ts for why orphans
  // get filtered out.
  const aliveIds = new Set(localTx.filter((t) => !deletedTx.has(t.id)).map((t) => t.id));
  for (const r of remindersToUpload(localReminders, remoteReminders, aliveIds)) {
    await supabaseRepository.saveReminder(r);
    pushed += 1;
  }

  return { pushed: pushed + planBudgets.subir.length, pulled: 0, deleted: tombstones.length };
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
