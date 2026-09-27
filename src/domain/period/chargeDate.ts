/**
 * When the money for a transaction actually LEAVES.
 *
 * For almost everything it's its own date. For a card purchase it's the day
 * the statement gets paid, which can be two months later.
 *
 * It lives in domain/ and not in a feature folder because the answer has to
 * be ONE. It was born inside features/dashboard/upcoming.ts, and while it
 * lived there Analytics didn't use it: it filtered on raw tx.date and
 * counted card purchases on the day you made them. It's the same bug
 * already fixed in the balance (see domain/period/resolve.ts), which
 * survived on the other screen precisely because the idea was duplicated.
 *
 * Different from resolveChargePeriod: that one returns the KEY of the
 * payment period, useful for grouping by pay period. This returns the DATE,
 * which is what anyone working with calendar ranges needs.
 */
import type { ISODate, Transaction } from '../types';

export function chargeDate(tx: Transaction): ISODate {
  return tx.cyclePaymentDate ?? tx.date;
}
