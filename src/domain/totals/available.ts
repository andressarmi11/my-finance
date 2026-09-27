/**
 * The month's flow: the four numbers the user actually needs.
 *
 * There used to be an "Available now" = paid - committed, which over a
 * single month came out negative almost always (expenses get recorded, the
 * month's salary hasn't arrived yet / wasn't marked received) and meant
 * nothing. It's replaced by the explicit breakdown: what came in, what's
 * still to come in, what went out, what's still to go out. None of the four
 * can be negative, and the net is shown labelled, not as "available".
 */
import type { Transaction } from '../types';

export interface MonthFlow {
  /** Income already received (status 'paid'). */
  received: number;
  /** Income you're still waiting on (pending + scheduled). */
  toReceive: number;
  /** Expenses already paid. */
  paid: number;
  /** Expenses you still expect to pay (pending + scheduled). */
  toPay: number;
  /** What has actually moved already: received - paid. Can be negative. */
  netSoFar: number;
  /** How the month ends if everything happens: (received+toReceive) - (paid+toPay). */
  projected: number;
}

export function calculateMonthFlow(transactions: Transaction[]): MonthFlow {
  let received = 0;
  let toReceive = 0;
  let paid = 0;
  let toPay = 0;

  for (const tx of transactions) {
    if (tx.status === 'cancelled') continue;
    const isPaid = tx.status === 'paid';
    if (tx.type === 'income') {
      if (isPaid) received += tx.amount;
      else toReceive += tx.amount;
    } else {
      if (isPaid) paid += tx.amount;
      else toPay += tx.amount;
    }
  }

  return {
    received,
    toReceive,
    paid,
    toPay,
    netSoFar: received - paid,
    projected: received + toReceive - (paid + toPay),
  };
}
