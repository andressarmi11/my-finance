/**
 * The bridge between "which period does this transaction belong to" and
 * "add up by period". It lives apart from balance.ts so that one can be
 * tested with fixture data without depending on date arithmetic.
 *
 * A transaction falls into TWO different periods, and confusing them was
 * the bug:
 *
 *   RECORD — when you made it. This is what orders the list and the
 *            calendar. It comes from tx.date.
 *   CHARGE — when the money leaves. This is what comes off the remainder.
 *            For a credit-card purchase it's the day the statement gets
 *            paid, which can be two months later.
 *
 * For everything that isn't a card the two coincide, which is why the
 * distinction wasn't needed until now.
 */
import { calculatePeriod, DEFAULT_PAY_DAYS, type PayDays } from './period';
import type { PeriodKey, Transaction } from '../types';

/**
 * Where it is RECORDED: the pay period or month in which you made it.
 *
 * tx.quincenaKey wins if it was set by hand; otherwise it's calculated.
 *
 * The field is still called quincenaKey because that's the column's name in
 * Postgres, and renaming it would need a migration for no gain: its content
 * is, and always was, the period key.
 */
export function resolveRecordPeriod(tx: Transaction, payDays: PayDays = DEFAULT_PAY_DAYS): PeriodKey {
  return tx.quincenaKey ?? calculatePeriod(tx.date, payDays).key;
}

/**
 * Where it is CHARGED: the period the money comes out of.
 *
 * A card purchase doesn't touch your pocket the day you make it, but the
 * day you pay the statement — which is why it resolves over
 * cyclePaymentDate, already calculated and stored on the transaction from
 * the moment it's created (see domain/credit-card/cycle.ts). The period
 * comes out of the SAME calculatePeriod as always, so the edge rule was
 * already right: a payment on November 2nd falls in the October 25th pay
 * period, which runs from the 25th to the 9th; if you get paid once a
 * month, it falls in November as a whole.
 *
 * quincenaKey still wins: if you moved the transaction by hand, that
 * decision outweighs the card's cycle — and it's the escape hatch for any
 * odd case (an instalment plan, a purchase you agreed to pay separately).
 */
export function resolveChargePeriod(tx: Transaction, payDays: PayDays = DEFAULT_PAY_DAYS): PeriodKey {
  return tx.quincenaKey ?? calculatePeriod(tx.cyclePaymentDate ?? tx.date, payDays).key;
}

export interface ResolvedPeriods {
  /** Where it gets listed. */
  recordPeriodKey: PeriodKey;
  /** Where the money comes from. Differs from the above only for card purchases. */
  chargePeriodKey: PeriodKey;
}

export function withResolvedPeriods<T extends Transaction>(
  transactions: T[],
  payDays: PayDays = DEFAULT_PAY_DAYS,
): Array<T & ResolvedPeriods> {
  return transactions.map((tx) => ({
    ...tx,
    recordPeriodKey: resolveRecordPeriod(tx, payDays),
    chargePeriodKey: resolveChargePeriod(tx, payDays),
  }));
}
