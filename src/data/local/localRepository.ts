import { db } from '../db';
import type { Repository } from '../repository';
import type { Settings } from '@/domain/types';
import { importBackup } from '../backup/exportImport';
import { BackupSchema } from '../backup/schema';
import { normalize } from '@/domain/inference/conceptInference';
import { makeTombstone, type DeletableEntity } from '../sync/tombstones';
import { removableOnRuleDelete } from '@/domain/recurring/propagate';
import { todayISO } from '@/lib/todayISO';
import { requestSyncSoon } from '../sync/useCloudSync';

/**
 * Every deletion leaves a tombstone. That's what lets the deletion travel
 * to other devices instead of them resurrecting it on the next sync (see
 * data/sync/tombstones.ts).
 */
/**
 * Stamps the save timestamp. It goes here, in the single place all saves
 * pass through, and not in every screen: this way none of them can forget
 * and leave a row that sync doesn't know how to date.
 */
function seal<T extends { updatedAt: string }>(row: T): T {
  return { ...row, updatedAt: new Date().toISOString() };
}

async function deleteWithTombstone(entity: DeletableEntity, id: string): Promise<void> {
  await db.deletions.put(makeTombstone(entity, id, new Date().toISOString()));
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  displayName: '',
  currency: 'COP',
  locale: 'es-CO',
  payDays: [10, 25], // two pay dates = biweekly
  defaultPaymentMethodId: null,
  reminderDefaultDaysBefore: 1,
  theme: 'system',
  quickCurrencies: ['COP', 'USD', 'EUR'],
  onboardedAt: null,
  // Empty on purpose: a row that was never saved can't beat any row from
  // the cloud in the "which one is newer" comparison.
  updatedAt: '',
};

/**
 * Fills in missing fields with the defaults. Without this, every new
 * Settings field leaves `undefined` in the database of anyone who was
 * already using the app (displayName, onboardedAt...) and the UI breaks
 * silently.
 */
export function withDefaults(stored: Settings | undefined): Settings {
  const base = { ...DEFAULT_SETTINGS, ...(stored ?? {}), id: 'singleton' as const };

  // Bridge for anyone who was already using the app: their days lived in
  // `quincenaStartDays` first, then in `diasDePago`, and are now in
  // `payDays`. Without this, the spread above would leave the default
  // value, and someone with pay dates on, say, the 5th and the 20th would
  // revert to 10 and 25 without noticing.
  //
  // Both old names are still read because the rename happened twice and a
  // phone that skipped the middle version exists just as much as one that
  // didn't. The next save writes the current name and the bridge stops
  // mattering for that device.
  const legacy = stored as unknown as
    { quincenaStartDays?: unknown; diasDePago?: unknown } | undefined;
  const old = legacy?.diasDePago ?? legacy?.quincenaStartDays;
  if (!Array.isArray(stored?.payDays) && Array.isArray(old)) {
    return { ...base, payDays: [...(old as number[])] };
  }
  return base;
}

const baseRepository: Repository = {
  async getSettings() {
    return withDefaults(await db.settings.get('singleton'));
  },
  async saveSettings(settings) {
    // The timestamp is set here and not in every screen: it's the single
    // place all saves pass through, so it's impossible to forget and
    // leave a Settings that sync doesn't know how to date.
    await db.settings.put({ ...settings, updatedAt: new Date().toISOString() });
  },

  listCategories: () => db.categories.orderBy('sortOrder').toArray(),
  saveCategory: async (category) => { await db.categories.put(seal(category)); },
  deleteCategory: async (id) => { await db.categories.delete(id); await deleteWithTombstone('categories', id); },

  listPaymentMethods: () => db.paymentMethods.toArray(),
  savePaymentMethod: async (method) => { await db.paymentMethods.put(seal(method)); },
  deletePaymentMethod: async (id) => {
    // References are released BEFORE deleting the card. In Postgres this
    // is the FK's ON DELETE SET NULL; here it has to be done by hand, or
    // transactions are left pointing at a card that no longer exists until
    // the next sync pulls down the version with null. Same case as
    // deleteTransaction with its reminders.
    //
    // Transactions are NOT deleted: that's money that really was spent.
    // They're left without a method, and the UI already tolerates
    // paymentMethod undefined.
    await db.transactions.where('paymentMethodId').equals(id).modify({ paymentMethodId: null });
    // filter, not where: recurringRules only indexes 'id, frequency' (db.ts),
    // so where('paymentMethodId') would blow up. There are few rules anyway.
    const rules = await db.recurringRules.filter((r) => r.paymentMethodId === id).toArray();
    for (const rule of rules) {
      await db.recurringRules.put(seal({ ...rule, paymentMethodId: null }));
    }
    await db.paymentMethods.delete(id);
    await deleteWithTombstone('paymentMethods', id);
  },

  listTransactions: (range) =>
    range
      ? db.transactions.where('date').between(range.from, range.to, true, true).toArray()
      : db.transactions.toArray(),
  saveTransaction: async (tx) => {
    await db.transactions.put(tx);
    // Updates the concept index for the form's smart-fill.
    // Only manual entries from the user (not the ones materialized from
    // recurring rules) feed the index: if the user comes back to that
    // concept, they want to get back the last category/method they used.
    if (!tx.recurringRuleId && tx.concept.trim()) {
      const key = normalize(tx.concept);
      if (key) {
        const prev = await db.conceptIndex.get(key);
        await db.conceptIndex.put({
          id: key,
          displayName: tx.concept.trim(),
          categoryId: tx.categoryId,
          paymentMethodId: tx.paymentMethodId,
          count: (prev?.count ?? 0) + 1,
          lastUsedAt: tx.updatedAt,
        });
      }
    }
  },
  deleteTransaction: async (id) => {
    await db.transactions.delete(id);
    // Its reminder goes with it. In Postgres this is the ON DELETE
    // CASCADE; here it has to be done by hand, or orphans are left behind
    // that push would also try to upload against an FK that no longer exists.
    await db.reminders.where('transactionId').equals(id).delete();
    await deleteWithTombstone('transactions', id);
  },

  listRecurringRules: () => db.recurringRules.toArray(),
  saveRecurringRule: async (rule) => { await db.recurringRules.put(seal(rule)); },
  deleteRecurringRule: async (id) => {
    // The confirmation promises: pending ones go, paid/past/hand-edited stay.
    // Tombstones keep the removed ids from coming back through sync.
    const now = new Date().toISOString();
    await db.transaction('rw', [db.recurringRules, db.transactions, db.reminders, db.deletions], async () => {
      const occurrences = await db.transactions
        .where('[recurringRuleId+periodKey]').between([id, ''], [id, '\uffff'], true, true).toArray();
      const rule = await db.recurringRules.get(id);
      for (const t of rule ? removableOnRuleDelete(rule, occurrences, todayISO()) : []) {
        await db.transactions.delete(t.id);
        await db.reminders.where('transactionId').equals(t.id).delete();
        await db.deletions.put(makeTombstone('transactions', t.id, now));
      }
      await db.recurringRules.delete(id);
      await db.deletions.put(makeTombstone('recurringRules', id, now));
    });
  },

  // amount 0 = deleted (see data/local/budgetMonths.ts); hidden from every reader.
  listBudgets: async (year, month) =>
    (await db.budgets.where('[year+month]').equals([year, month]).toArray()).filter((b) => b.amount > 0),
  // sellar like everything else: without updatedAt there's nothing to
  // decide which copy wins when syncing between devices.
  saveBudget: async (budget) => { await db.budgets.put(seal(budget)); },

  listReminders: () => db.reminders.toArray(),
  saveReminder: async (reminder) => { await db.reminders.put(seal(reminder)); },

  async exportAll() {
    const [settings, categories, paymentMethods, transactions, recurringRules, budgets, reminders] =
      await Promise.all([
        db.settings.toArray(), db.categories.toArray(), db.paymentMethods.toArray(),
        db.transactions.toArray(), db.recurringRules.toArray(),
        db.budgets.filter((b) => b.amount > 0).toArray(), // 0 = deleted
        db.reminders.toArray(),
      ]);
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings, categories, paymentMethods, transactions, recurringRules, budgets, reminders,
    };
  },

  async importAll(data) {
    const parsed = BackupSchema.parse(data); // the caller (UI) should already have validated with parseBackupFile
    await importBackup(parsed);
  },
};

/**
 * Every write the user makes goes up on its own a moment later. This is
 * the single door user edits pass through (sync writes to Dexie directly,
 * so it can't loop back into itself).
 */
const WRITES = [
  'saveSettings', 'saveCategory', 'deleteCategory', 'savePaymentMethod', 'deletePaymentMethod',
  'saveTransaction', 'deleteTransaction', 'saveRecurringRule', 'deleteRecurringRule',
  'saveBudget', 'saveReminder', 'importAll',
] as const;

export const localRepository: Repository = { ...baseRepository };
for (const name of WRITES) {
  const original = baseRepository[name] as (...args: unknown[]) => Promise<void>;
  (localRepository as unknown as Record<string, unknown>)[name] = async (...args: unknown[]) => {
    await original(...args);
    requestSyncSoon();
  };
}
