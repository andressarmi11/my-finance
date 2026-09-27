/**
 * The breakdown of what's left to pay, as DISJOINT sets.
 *
 * It exists because the breakdown used to be assembled in the component
 * with three independent filters, and a pending expense paid by card
 * matched two of them at once. What that looked like on screen:
 *   - the chip said "7 · $500,000" when there were 5 transactions: the
 *     count added duplicates next to a total that didn't;
 *   - the sheet added the money up THREE separate times, so it showed a
 *     total larger than the hero that opened it, and listed the same
 *     transaction twice.
 *
 * The tie-breaker: an expense with a card payment date is "on card" and
 * doesn't count in the other two. It's the rule that serves the user —
 * what matters about a card purchase is when the money leaves, not what
 * state the row was left in.
 */
import type { Transaction } from '../types';

export interface Outstanding {
  /** Pending, NOT on a card. */
  pending: Transaction[];
  /** Scheduled, NOT on a card. */
  scheduled: Transaction[];
  /** Everything paid by card, pending or scheduled. */
  onCard: Transaction[];
  /** How many transactions in total. Each counted exactly once. */
  count: number;
  /** How much money in total. Equal to MonthFlow.toPay, by construction. */
  amount: number;
}

export function calculateOutstanding(transactions: Transaction[]): Outstanding {
  const pending: Transaction[] = [];
  const scheduled: Transaction[] = [];
  const onCard: Transaction[] = [];

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (tx.status === 'paid' || tx.status === 'cancelled') continue;

    if (tx.cyclePaymentDate) onCard.push(tx);
    else if (tx.status === 'scheduled') scheduled.push(tx);
    else pending.push(tx);
  }

  const all = [...pending, ...scheduled, ...onCard];
  return {
    pending,
    scheduled,
    onCard,
    count: all.length,
    amount: all.reduce((a, t) => a + t.amount, 0),
  };
}
