/**
 * Upcoming transactions: what hasn't happened yet, both expenses AND income.
 *
 * Does NOT filter by date: it receives the list already scoped to the
 * month the caller is showing. It used to sweep every transaction with no
 * cap, and since materialize.ts creates recurring ones up to 95 days
 * ahead, the dashboard showed payments from three months out. The scoping
 * is done outside, with the same pay-period criterion the rest of the
 * dashboard uses, so "left to pay" in the hero and "expect to spend"
 * down here never say different things.
 */
import { compareISO } from '@/domain/dates';
import { chargeDate } from '@/domain/period/chargeDate';
import type { Transaction } from '@/domain/types';

/**
 * The date that matters: the credit card's payment date if it exists,
 * otherwise the transaction's own date. This used to live here, and being
 * in a feature folder Analytics never used it — see
 * domain/period/chargeDate.ts. The name is kept so this screen's call
 * sites don't need to change.
 */
export const relevantDate = chargeDate;

function isUpcoming(tx: Transaction): boolean {
  return tx.status === 'pending' || tx.status === 'scheduled';
}

/** The `limit` closest to the date, whatever is due soonest first. */
export function selectUpcoming(monthTransactions: Transaction[], limit = 8): Transaction[] {
  return monthTransactions
    .filter(isUpcoming)
    .slice()
    .sort((a, b) => compareISO(relevantDate(a), relevantDate(b)))
    .slice(0, limit);
}

/** What you expect to receive and what you expect to spend in the month. */
export function upcomingTotals(monthTransactions: Transaction[]): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const t of monthTransactions) {
    if (!isUpcoming(t)) continue;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense };
}
