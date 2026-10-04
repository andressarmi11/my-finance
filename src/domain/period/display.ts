/**
 * What a "month" of periods is CALLED, and which days it covers.
 *
 * The period key says which month a period belongs to ('2026-09-Q1'), and
 * that's what the data stores. But the name on screen can't always be that
 * month. Paid on the 30th, September's period runs 30 Sep → 29 Oct: one
 * day of September and twenty-nine of October. Calling it "September" made
 * Inicio say "Septiembre" all through October, and Análisis, which used
 * calendar months, showed October with the salary of the 30th missing.
 *
 * The rule: a month of periods is named after the month holding most of
 * its days. With the first pay day after the 15th that's always the NEXT
 * month; on the 15th or before, the one it starts in. It's a fixed offset
 * per configuration on purpose: counting days month by month would name
 * 16 Jan → 15 Feb "January" and 16 Feb → 15 Mar "March" (February is
 * short), so February would vanish from the navigator.
 *
 * Paid on the 1st, or on the 10th and the 25th, the offset is 0 and
 * nothing changes.
 */
import { parseISO, shiftMonth } from '../dates';
import { makePeriodKey, normalizePayDays, periodMonthOf, rangeFromKey, DEFAULT_PAY_DAYS, type PayDays } from './period';
import type { ISODate } from '../types';

export interface YM { y: number; m: number }

/** Months between the key's month and the month it's named after: 0 or 1. */
export function nameOffset(payDays: PayDays = DEFAULT_PAY_DAYS): 0 | 1 {
  return normalizePayDays(payDays)[0]! > 15 ? 1 : 0;
}

/** The month a month of periods is shown as. */
export function displayMonth(periodMonth: YM, payDays: PayDays = DEFAULT_PAY_DAYS): YM {
  return shiftMonth(periodMonth.y, periodMonth.m, nameOffset(payDays));
}

/** The inverse: which month of periods is shown under this name. */
export function periodMonthOfDisplay(shown: YM, payDays: PayDays = DEFAULT_PAY_DAYS): YM {
  return shiftMonth(shown.y, shown.m, -nameOffset(payDays));
}

/** The name of the month `date` is in, as the screens show it. */
export function displayMonthOf(date: ISODate, payDays: PayDays = DEFAULT_PAY_DAYS): YM {
  return displayMonth(periodMonthOf(date, payDays), payDays);
}

/** First and last day of a month of periods: from its first pay day to the day before the next month's. */
export function periodMonthSpan(periodMonth: YM, payDays: PayDays = DEFAULT_PAY_DAYS): { start: ISODate; end: ISODate } {
  const days = normalizePayDays(payDays);
  return {
    start: rangeFromKey(makePeriodKey(periodMonth.y, periodMonth.m, 1), days).start,
    end: rangeFromKey(makePeriodKey(periodMonth.y, periodMonth.m, days.length), days).end,
  };
}

/** Whole days from `today` to `end`: 0 on the last day. */
export function daysLeft(today: ISODate, end: ISODate): number {
  const a = parseISO(today);
  const b = parseISO(end);
  const diff = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
  return Math.max(0, diff);
}
