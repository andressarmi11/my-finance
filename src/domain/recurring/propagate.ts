/**
 * Decides how an edit to a recurring RULE reaches the occurrences it already
 * generated. Pure: the caller (data/local/recurringEdit.ts) applies the plan.
 *
 * The principle: an occurrence follows the rule ONLY in the fields the user
 * never touched. "Untouched" is judged field by field against what the OLD
 * rule would have produced, so a hand-edited amount survives while the
 * category still propagates. Paid/cancelled/past occurrences are history and
 * are never looked at.
 */
import { calculateCreditCardCycle } from '../credit-card/cycle';
import { parseISO } from '../dates';
import type { ISODate, PaymentMethod, RecurringRule, Transaction } from '../types';
import { expandRecurringRule } from './expansion';

/** Same value as data/local/materialize GENERATED_AT (domain can't import data). */
const NEVER_EDITED = '1970-01-01T00:00:00.000Z';

export interface PropagationChange {
  id: string;
  kind: 'update' | 'remove';
  /** The occurrence's date BEFORE the change. */
  date: ISODate;
  patch: Partial<Transaction>;
  /** New date minus old date, in days (0 when the date did not move). */
  dateDeltaDays: number;
}

function daysBetween(a: ISODate, b: ISODate): number {
  const x = parseISO(a);
  const y = parseISO(b);
  return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 86_400_000);
}

/**
 * THE definition of "the user never touched this occurrence".
 *
 * Either it still carries the generation stamp, or every field a rule
 * propagates still equals what `rule` produces for it. The second clause is
 * needed because propagation itself stamps a real updatedAt (so the change
 * syncs); judging by the stamp alone made propagated rows look hand-edited and
 * a later delete / end date left them behind as orphans.
 */
export function isUntouched(tx: Transaction, rule: RecurringRule | undefined): boolean {
  if (tx.updatedAt === NEVER_EDITED) return true;
  if (!rule || !tx.periodKey) return false;
  const produced = expandRecurringRule({ ...rule, isActive: true }, { from: tx.date, to: tx.date })
    .some((o) => o.periodKey === tx.periodKey);
  return produced && tx.amount === rule.amount && tx.concept === rule.name
    && tx.categoryId === rule.categoryId && tx.paymentMethodId === rule.paymentMethodId;
}

export function planPropagation(
  oldRule: RecurringRule,
  next: RecurringRule,
  occurrences: readonly Transaction[],
  today: ISODate,
  methodById: ReadonlyMap<string, PaymentMethod>,
): PropagationChange[] {
  // Switching a rule off never touched existing occurrences; keep it that way.
  if (!next.isActive) return [];
  const targets = occurrences.filter(
    (t) => t.recurringRuleId === next.id && t.status === 'pending' && t.date >= today && t.periodKey,
  );
  if (targets.length === 0) return [];

  const dates = targets.map((t) => t.date).sort();
  const last = dates[dates.length - 1]!;
  // From the 1st of the earliest month: a day moved earlier in the same month
  // lands before the occurrence's current date.
  const first = dates[0]!;
  // Likewise to the end of the last month: a day moved later must still be found.
  const from = `${first.slice(0, 7)}-01`;
  const to = `${last.slice(0, 7)}-31`;
  const newByKey = new Map(expandRecurringRule(next, { from, to }).map((o) => [o.periodKey, o]));
  const oldActive = { ...oldRule, isActive: true };

  const changes: PropagationChange[] = [];
  for (const tx of targets) {
    const key = tx.periodKey!;
    const target = newByKey.get(key);
    if (!target) {
      // Falls outside the new rule (end date, pattern, start date). Only
      // a row nobody edited is deleted; an edited one is the user's data.
      if (isUntouched(tx, oldRule)) {
        changes.push({ id: tx.id, kind: 'remove', date: tx.date, patch: {}, dateDeltaDays: 0 });
      }
      continue;
    }

    const patch: Partial<Transaction> = {};
    if (tx.amount === oldRule.amount && next.amount !== tx.amount) patch.amount = next.amount;
    if (tx.concept === oldRule.name && next.name !== tx.concept) patch.concept = next.name;
    if (tx.categoryId === oldRule.categoryId && next.categoryId !== tx.categoryId) patch.categoryId = next.categoryId;
    if (tx.paymentMethodId === oldRule.paymentMethodId && next.paymentMethodId !== tx.paymentMethodId) {
      patch.paymentMethodId = next.paymentMethodId;
    }
    // The date follows only if the old rule would have put it exactly here.
    const oldProduced = expandRecurringRule(oldActive, { from: tx.date, to: tx.date })
      .some((o) => o.periodKey === key);
    if (oldProduced && target.date !== tx.date) patch.date = target.date;

    if (patch.date !== undefined || patch.paymentMethodId !== undefined) {
      const date = patch.date ?? tx.date;
      const methodId = patch.paymentMethodId !== undefined ? patch.paymentMethodId : tx.paymentMethodId;
      const method = methodId ? methodById.get(methodId) : undefined;
      const cycle = method?.type === 'credit'
        ? calculateCreditCardCycle(date, method.cutoffDay, method.paymentDay)
        : null;
      patch.cycleCutoffDate = cycle?.cycleCutoff;
      patch.cyclePaymentDate = cycle?.paymentDate;
    }

    if (Object.keys(patch).length === 0) continue;
    changes.push({
      id: tx.id, kind: 'update', date: tx.date, patch,
      dateDeltaDays: patch.date ? daysBetween(tx.date, patch.date) : 0,
    });
  }
  return changes;
}

/**
 * Old cached clients expand a 'custom' rule as if it were yearly and write
 * pending rows keyed ruleId:YYYY. Those rows are never edited (GENERATED_AT)
 * and their periodKey is not one the real expansion produces, so they are
 * safe to delete. Only rows inside `range` are judged: outside it we can't
 * know what the rule produces.
 */
export function staleCustomOccurrences(
  rule: RecurringRule,
  occurrences: readonly Transaction[],
  range: { from: ISODate; to: ISODate },
): Transaction[] {
  if (rule.frequency !== 'custom' || !rule.isActive) return [];
  const valid = new Set(expandRecurringRule(rule, range).map((o) => o.periodKey));
  return occurrences.filter(
    (t) => t.recurringRuleId === rule.id && t.status === 'pending' && t.updatedAt === NEVER_EDITED
      && t.periodKey && t.date >= range.from && t.date <= range.to && !valid.has(t.periodKey),
  );
}

/**
 * Deleting a rule removes what it hasn't delivered yet: pending, from today on,
 * never edited. Paid, past and hand-edited occurrences stay in the history.
 */
export function removableOnRuleDelete(
  rule: RecurringRule,
  occurrences: readonly Transaction[],
  today: ISODate,
): Transaction[] {
  return occurrences.filter(
    (t) => t.recurringRuleId === rule.id && t.status === 'pending' && t.date >= today && isUntouched(t, rule),
  );
}
