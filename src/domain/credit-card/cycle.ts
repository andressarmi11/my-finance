/**
 * Credit card cycle.
 *
 * Rule (generic, NEVER hardcoded for a given year):
 *  - A purchase made on day D belongs to this month's cutoff if D <= cutoffDay
 *    (clamped to the last day of the month). If D > cutoffDay, it belongs to
 *    next month's cutoff.
 *  - Payment falls on paymentDay of the month AFTER the cutoff.
 *
 * Example with cutoffDay=15, paymentDay=2:
 *   14 Jan -> cutoff 15 Jan -> payment 2 Feb
 *   16 Jan -> cutoff 15 Feb -> payment 2 Mar
 */
import { addDays, clampDay, parseISO, shiftMonth, toISO } from '../dates';
import type { ISODate } from '../types';

export interface CreditCardCycle {
  /** First day of the cycle the purchase belongs to. */
  cycleStart: ISODate;
  /** Cutoff date of the cycle (day D is included if D <= cutoffDay). */
  cycleCutoff: ISODate;
  /** Date on which that cycle is paid. */
  paymentDate: ISODate;
}

export function calculateCreditCardCycle(
  purchaseDate: ISODate,
  cutoffDay = 15,
  paymentDay = 2,
): CreditCardCycle {
  const { y, m, d } = parseISO(purchaseDate);

  const cutoffThisMonth = clampDay(y, m, cutoffDay);
  const cutoffYM = d <= cutoffThisMonth ? { y, m } : shiftMonth(y, m, 1);
  const cutoffDayClamped = clampDay(cutoffYM.y, cutoffYM.m, cutoffDay);

  const payYM = shiftMonth(cutoffYM.y, cutoffYM.m, 1);
  const paymentDayClamped = clampDay(payYM.y, payYM.m, paymentDay);

  const prevCutoffYM = shiftMonth(cutoffYM.y, cutoffYM.m, -1);
  const prevCutoffDay = clampDay(prevCutoffYM.y, prevCutoffYM.m, cutoffDay);
  const cycleStart = addDays({ ...prevCutoffYM, d: prevCutoffDay }, 1);

  return {
    cycleStart: toISO(cycleStart),
    cycleCutoff: toISO({ ...cutoffYM, d: cutoffDayClamped }),
    paymentDate: toISO({ ...payYM, d: paymentDayClamped }),
  };
}
