/**
 * Splits an instalment purchase into N instalments.
 *
 * Unlike a recurring rule, an instalment purchase is FINITE and known in
 * full on the day of the purchase: the N instalments are calculated once
 * and there's never a need to revisit it. That's why this doesn't need
 * the machinery of data/local/materialize.ts (window, re-expansion,
 * unique index).
 *
 * Pure function: writes nothing. The caller assembles the transactions.
 */
import { clampDay, parseISO, shiftMonth, toISO } from '../dates';
import { calculateCreditCardCycle } from './cycle';
import type { ISODate } from '../types';

export interface Installment {
  /** 1..N */
  toNumber: number;
  amount: number;
  date: ISODate;
  cycleCutoffDate: ISODate;
  cyclePaymentDate: ISODate;
}

export function expandInstallments(
  purchaseDate: ISODate,
  total: number,
  installments: number,
  cutoffDay?: number,
  paymentDay?: number,
  /**
   * What the bank actually charges per instalment, when there's interest.
   * If provided, it overrides the split and the sum of the instalments
   * exceeds the total — that difference IS the interest. The app does
   * not calculate rates.
   */
  installmentAmount?: number,
): Installment[] {
  // 1 or fewer is not an instalment purchase. 0 and negatives are
  // tolerated instead of blowing up: the caller already decides not to
  // save the instalment fields.
  const n = Number.isInteger(installments) && installments > 1 ? installments : 1;
  const { y, m, d } = parseISO(purchaseDate);

  const amounts = installmentAmount && installmentAmount > 0
    ? Array.from({ length: n }, () => installmentAmount)
    : split(total, n);

  return amounts.map((amount, i) => {
    // Instalment i+1 is the purchase shifted by i months. clampDay
    // handles short months: buying on 31 January puts the second
    // instalment on 28 February.
    const ym = shiftMonth(y, m, i);
    const date = toISO({ ...ym, d: clampDay(ym.y, ym.m, d) });

    // The cycle comes from the date of EACH instalment. No special
    // arithmetic needed: a purchase on 20 Sep with cutoff 15 and payment
    // 2 gives instalments paid on 2 Nov, 2 Dec and 2 Jan — consecutive,
    // on their own.
    const cycle = calculateCreditCardCycle(date, cutoffDay, paymentDay);

    return {
      toNumber: i + 1,
      amount,
      date,
      cycleCutoffDate: cycle.cycleCutoff,
      cyclePaymentDate: cycle.paymentDate,
    };
  });
}

/**
 * The remainder goes entirely to the FIRST instalment.
 *
 * The invariant that matters is that the sum is exactly the total: spread
 * it "however it falls" and the instalments would no longer add up to the
 * purchase, leaving the credit limit off by a few pesos nobody could
 * account for. Money is an integer throughout the app; this is where
 * that matters.
 */
function split(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + rest : base));
}
