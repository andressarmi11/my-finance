/**
 * Saving an edited recurring rule AND carrying the edit to the occurrences it
 * already generated (pending, from today on). The decisions live in
 * domain/recurring/propagate.ts; this file only reads, applies and syncs.
 *
 * Why not delete everything and regenerate: an occurrence's id is
 * ruleId:periodKey and a deleted one leaves a tombstone, so a tombstoned id
 * can never be generated again. We update in place and delete only what the
 * new rule no longer produces.
 */
import { planPropagation, type PropagationChange } from '@/domain/recurring/propagate';
import type { ISODate, PaymentMethod, RecurringRule, Transaction } from '@/domain/types';
import { nowISO, todayISO } from '@/lib/todayISO';
import { db } from '../db';
import { makeTombstone } from '../sync/tombstones';
import { requestSyncSoon } from '../sync/useCloudSync';
import { materializeRecurringRules } from './materialize';

async function occurrencesOf(ruleId: string): Promise<Transaction[]> {
  return db.transactions
    .where('[recurringRuleId+periodKey]')
    .between([ruleId, ''], [ruleId, '￿'], true, true)
    .toArray();
}

/**
 * `methods` come from the caller: saveRecurringRule runs plan() INSIDE a Dexie
 * transaction that doesn't include paymentMethods, and touching a table outside
 * a transaction's list throws NotFoundError (the edit then never saved).
 * recurringEdit.test.ts guards the table list.
 */
async function plan(next: RecurringRule, methods: PaymentMethod[]): Promise<PropagationChange[]> {
  const old = await db.recurringRules.get(next.id);
  if (!old) return []; // brand new rule: nothing generated yet
  const occurrences = await occurrencesOf(next.id);
  return planPropagation(old, next, occurrences, todayISO(), new Map(methods.map((m) => [m.id, m])));
}

/** How many occurrences the edit would change or remove, and the earliest one. */
export async function previewRuleSave(next: RecurringRule): Promise<{ affected: number; from: ISODate | null }> {
  const changes = await plan(next, await db.paymentMethods.toArray());
  const dates = changes.map((c) => c.date).sort();
  return { affected: changes.length, from: dates[0] ?? null };
}

export async function saveRecurringRule(next: RecurringRule): Promise<{ updated: number; removed: number }> {
  const now = nowISO();
  const sealed: RecurringRule = { ...next, updatedAt: now };
  let updated = 0;
  let removed = 0;
  const methods = await db.paymentMethods.toArray(); // BEFORE the transaction, see plan()

  await db.transaction('rw', [db.recurringRules, db.transactions, db.reminders, db.deletions], async () => {
    // Planned INSIDE the transaction so it reads the same state it writes.
    const changes = await plan(next, methods);
    await db.recurringRules.put(sealed);

    for (const c of changes) {
      if (c.kind === 'remove') {
        await db.transactions.delete(c.id);
        await db.reminders.where('transactionId').equals(c.id).delete();
        await db.deletions.put(makeTombstone('transactions', c.id, now));
        removed++;
        continue;
      }
      // Real updatedAt: a GENERATED_AT row would lose to the cloud copy on sync.
      await db.transactions.update(c.id, { ...c.patch, updatedAt: now });
      if (c.dateDeltaDays !== 0) {
        const shift = c.dateDeltaDays * 86_400_000;
        await db.reminders.where('transactionId').equals(c.id).modify((r) => {
          r.remindAt = new Date(Date.parse(r.remindAt) + shift).toISOString();
          r.updatedAt = now;
        });
      }
      updated++;
    }
  });

  // ponytail: an occurrence whose id was tombstoned earlier can't come back,
  // so a rule edited to cover a period the user once deleted leaves it empty.
  // Fix would be un-tombstoning on sync; not worth it until someone hits it.
  await materializeRecurringRules();
  requestSyncSoon();
  return { updated, removed };
}
