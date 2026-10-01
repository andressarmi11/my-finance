/**
 * The PERIODS the app organizes money into.
 *
 * This generalizes what used to be "quincena" (a Colombian half-month pay
 * period). The underlying idea doesn't change: a period is the window from
 * one pay day to the next, not a division of the calendar. What changes is
 * how many pay days there are.
 *
 *   payDays = [10, 25]  ->  two periods a month (biweekly)
 *        10 -> 24  and  25 -> 9th of the next month
 *   payDays = [1]       ->  one a month, the calendar month
 *        1 -> end of month
 *   payDays = [30]      ->  one a month, starting on the pay day
 *        30 -> 29th of the next month
 *
 * THE NUMBER OF PAY DAYS IS THE MODE. There's no separate field saying
 * "biweekly" or "monthly" that could contradict the list: if you get paid
 * once a month there's one day; if you get paid twice, there are two. That
 * also avoids a migration —the column is already a variable-length array—
 * and leaves the door open to weekly without touching the model again.
 *
 * The month's last period ALWAYS crosses into the next month, just as the
 * 25th pay period used to. That's why "Rent", paid on October 1st, falls in
 * September's period: it's September's money.
 *
 * The key keeps the 'YYYY-MM-Qn' format already stored on transactions, so
 * nothing old stops being readable.
 */
import { addDays, clampDay, parseISO, shiftMonth, toISO } from '../dates';
import type { ISODate, PeriodKey } from '../types';

/** The days of the month money comes in. One = monthly, two = biweekly. */
export type PayDays = number[];

export const DEFAULT_PAY_DAYS: PayDays = [10, 25];

export interface Period {
  key: PeriodKey;
  start: ISODate;
  end: ISODate;
  /** Which of the month's periods this is, starting at 1. */
  index: number;
}

/** You get paid just once a month. */
export function isMonthly(payDays: PayDays): boolean {
  return normalizePayDays(payDays).length === 1;
}

/**
 * Sorted, deduplicated and within 1..31. An empty list makes no sense
 * —there's always at least one pay day— and falls back to the default
 * instead of blowing up later with an out-of-range index.
 */
export function normalizePayDays(payDays: PayDays): PayDays {
  const clean = [...new Set(payDays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 31))]
    .sort((a, b) => a - b);
  return clean.length > 0 ? clean : [...DEFAULT_PAY_DAYS];
}

export function makePeriodKey(y: number, m: number, n: number): PeriodKey {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-Q${n}`;
}

export function calculatePeriod(date: ISODate, payDays: PayDays = DEFAULT_PAY_DAYS): Period {
  const days = normalizePayDays(payDays);
  const { y, m, d } = parseISO(date);

  // clampDay for short months: a pay day of 31 is the 28th in February.
  const anchors = days.map((day) => clampDay(y, m, day));

  // Before the month's first pay day: we're still in LAST month's final
  // period, the one that crossed the month boundary.
  if (d < anchors[0]!) {
    const prev = shiftMonth(y, m, -1);
    const lastOfPrev = clampDay(prev.y, prev.m, days[days.length - 1]!);
    return {
      key: makePeriodKey(prev.y, prev.m, days.length),
      start: toISO({ ...prev, d: lastOfPrev }),
      end: toISO(addDays({ y, m, d: anchors[0]! }, -1)),
      index: days.length,
    };
  }

  // The last pay day that has already passed.
  let i = 0;
  for (let k = 0; k < anchors.length; k++) {
    if (d >= anchors[k]!) i = k;
  }

  // The month's last period crosses into the next one; the rest end where
  // the following one starts.
  if (i === days.length - 1) {
    const next = shiftMonth(y, m, 1);
    const firstOfNext = clampDay(next.y, next.m, days[0]!);
    return {
      key: makePeriodKey(y, m, days.length),
      start: toISO({ y, m, d: anchors[i]! }),
      end: toISO(addDays({ ...next, d: firstOfNext }, -1)),
      index: days.length,
    };
  }

  return {
    key: makePeriodKey(y, m, i + 1),
    start: toISO({ y, m, d: anchors[i]! }),
    end: toISO(addDays({ y, m, d: anchors[i + 1]! }, -1)),
    index: i + 1,
  };
}

/** The keys of a month's periods, in order. */
export function periodsOfMonth(year: number, month: number, payDays: PayDays = DEFAULT_PAY_DAYS): PeriodKey[] {
  return normalizePayDays(payDays).map((_, i) => makePeriodKey(year, month, i + 1));
}

/**
 * The month whose periods hold `date`: the month the screens open on.
 *
 * Not always the calendar month. Paid on the 10th and the 25th, October
 * 1st–9th still belong to "the period of the 25th" of SEPTEMBER, so a
 * month view anchored on October showed them nowhere until the 10th: an
 * expense recorded on the 1st vanished from Movimientos and Inicio.
 */
export function periodMonthOf(date: ISODate, payDays: PayDays = DEFAULT_PAY_DAYS): { y: number; m: number } {
  const match = /^(\d{4})-(\d{2})-Q\d+$/.exec(calculatePeriod(date, payDays).key)!;
  return { y: Number(match[1]), m: Number(match[2]) };
}

/**
 * Rebuilds the range from a key, without needing a transaction in hand.
 * Used by the list headers and the calendar.
 *
 * A key saved when there were two periods a month can ask for the Q2 of
 * someone who now gets paid once: in that case the last one that exists is
 * returned, so a settings change doesn't blow up the screen.
 */
export function rangeFromKey(key: PeriodKey, payDays: PayDays = DEFAULT_PAY_DAYS): Period {
  const match = /^(\d{4})-(\d{2})-Q(\d+)$/.exec(key);
  if (!match) throw new Error(`Invalid period key: "${key}"`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const days = normalizePayDays(payDays);
  const n = Math.min(Number(match[3]), days.length);
  const anchor = toISO({ y, m, d: clampDay(y, m, days[n - 1]!) });
  return calculatePeriod(anchor, days);
}
