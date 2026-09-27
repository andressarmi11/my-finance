/**
 * Turns recurring RULES into real INSTANCES within a time window.
 *
 * Never touches an instance that already exists (won't overwrite if the
 * user already marked it paid or edited it) — only adds the ones that are
 * missing. The real protection against duplicates is the UNIQUE index
 * [recurringRuleId+periodKey] in Dexie (see data/db.ts); this just avoids
 * doing extra work.
 *
 * The window is a parameter. It used to be fixed at +95 days from today,
 * so a "no end date" rule created in September would get cut off in
 * December and the following months would come up empty. Now the screen
 * explicitly asks for the month it's looking at (ensureMonthMaterialized).
 */
import { addDays, daysInMonth, parseISO, toISO } from '@/domain/dates';
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
import { expandRecurringRule } from '@/domain/recurring/expansion';
import type { ISODate, Transaction } from '@/domain/types';
import { nowISO, todayISO } from '@/lib/todayISO';
import { db } from '../db';
import { deletedIdsOf } from '../sync/tombstones';

const WINDOW_BEFORE_DAYS = 31; // in case a rule was left unmaterialized last month
const WINDOW_AFTER_DAYS = 95; // ~3 months ahead, for "upcoming payments"

/**
 * A recurring instance's id IS its identity: rule + period.
 *
 * It used to be a randomUUID(). That made it impossible to honor a
 * deletion: the tombstone stores the row's id, and with a random id there
 * was no way to know which occurrence it belonged to once it was deleted.
 * The result: you deleted "Rent, September" and it was reborn on the next
 * start-up.
 *
 * Being deterministic, the tombstone already says which occurrence died,
 * and it travels between devices without needing a new column.
 *
 * It's still not guessable from the outside: ruleId is a randomUUID.
 */
export function occurrenceId(ruleId: string, periodKey: string): string {
  return `${ruleId}:${periodKey}`;
}

export interface Range {
  from: ISODate;
  to: ISODate;
}

/** The default window at start-up: last month and the ~3 following ones. */
export function defaultRange(today = todayISO()): Range {
  const t = parseISO(today);
  return {
    from: toISO(addDays(t, -WINDOW_BEFORE_DAYS)),
    to: toISO(addDays(t, WINDOW_AFTER_DAYS)),
  };
}

export async function materializeRecurringRules(range: Range = defaultRange()): Promise<number> {
  const [allRules, paymentMethods] = await Promise.all([
    db.recurringRules.toArray(),
    db.paymentMethods.toArray(),
  ]);
  const rules = allRules.filter((r) => r.isActive);
  if (rules.length === 0) return 0;

  const methodById = new Map(paymentMethods.map((m) => [m.id, m]));

  // A single read of what already exists, instead of a query per
  // occurrence. With a one-year window that's ~12 occurrences per rule,
  // and before that meant 12 round-trips to IndexedDB per rule, on every
  // month change.
  const existing = new Set<string>();
  await db.transactions.each((tx) => {
    if (tx.recurringRuleId && tx.periodKey) existing.add(`${tx.recurringRuleId}|${tx.periodKey}`);
  });

  // And what the user DELETED. Without this, materializing becomes a
  // resurrection machine: the deleted instance is no longer among the
  // live ones, so it got recreated on the next start-up or when
  // navigating between months.
  const deletedIds = deletedIdsOf(await db.deletions.toArray(), 'transactions');

  const fresh: Transaction[] = [];
  for (const rule of rules) {
    const method = rule.paymentMethodId ? methodById.get(rule.paymentMethodId) : undefined;
    for (const occ of expandRecurringRule(rule, range)) {
      if (existing.has(`${rule.id}|${occ.periodKey}`)) continue;
      const id = occurrenceId(rule.id, occ.periodKey);
      if (deletedIds.has(id)) continue;
      existing.add(`${rule.id}|${occ.periodKey}`);

      const cycle = method?.type === 'credit'
        ? calculateCreditCardCycle(occ.date, method.cutoffDay, method.paymentDay)
        : null;

      const now = nowISO();
      fresh.push({
        id,
        type: rule.type,
        concept: rule.name,
        amount: rule.amount,
        date: occ.date,
        categoryId: rule.categoryId,
        paymentMethodId: rule.paymentMethodId,
        status: 'pending',
        quincenaKey: null,
        recurringRuleId: rule.id,
        periodKey: occ.periodKey,
        cycleCutoffDate: cycle?.cycleCutoff,
        cyclePaymentDate: cycle?.paymentDate,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  if (fresh.length === 0) return 0;
  // Tolerant bulkAdd: if another tab put the same instance in first, the
  // unique index rejects just that row instead of taking down the whole batch.
  await db.transactions.bulkAdd(fresh).catch((e: unknown) => {
    if (!(e instanceof Error) || !e.name.includes('Bulk')) throw e;
  });
  return fresh.length;
}

/**
 * Ensures a specific month has its recurring instances. Called by
 * Dashboard and Transactions every time the visible month changes, so
 * navigating to next year's March shows the rent just like today.
 *
 * The whole month is requested plus a 10-day cushion on each side: the
 * "25th pay period" of one month stretches into the 9th of the next.
 */
export async function ensureMonthMaterialized(year: number, month: number): Promise<number> {
  const from = toISO(addDays({ y: year, m: month, d: 1 }, -10));
  const to = toISO(addDays({ y: year, m: month, d: daysInMonth(year, month) }, 10));
  return materializeRecurringRules({ from, to });
}
