/**
 * Aggregates the monthly series into quarters or years. Presentation,
 * not domain: it takes what monthlySeries already computed and regroups
 * it for the selected view (Month / Quarter / Year).
 */
import type { MonthPoint } from '@/domain/analytics/series';

export interface PeriodPoint {
  label: string;
  income: number;
  expense: number;
}

const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Cuts the series off at the current month: the chart is called
 * "historical" and it was showing the future.
 *
 * This isn't a rare case. Recurring rules get materialized ahead of time
 * (and now also when navigating to a far-off month), so the database has
 * 2027 transactions even while we're in 2026. Since the chart took the
 * LAST six months of everything that exists, the last six were the
 * future's: the "historical" chart showed months that hadn't happened
 * yet, and the current month didn't even appear.
 */
export function untilToday(points: MonthPoint[], today: string): MonthPoint[] {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const cap = y * 12 + m;
  return points.filter((p) => p.year * 12 + p.month <= cap);
}

/**
 * Fills with zeros the months with no transactions that fall BETWEEN two
 * that do have them. Without this, a blank month simply disappeared and
 * the neighboring bars ended up touching, as if no time had passed.
 *
 * On purpose it does NOT fill BEFORE the first month with data:
 * inventing zeros before the person started using the app would say
 * "you spent nothing", which is different from "you weren't here yet".
 */
export function fillGaps(points: MonthPoint[]): MonthPoint[] {
  if (points.length < 2) return points;
  const sorted = [...points].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
  const byKey = new Map(sorted.map((p) => [p.year * 12 + p.month, p]));

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const output: MonthPoint[] = [];
  for (let n = first.year * 12 + first.month; n <= last.year * 12 + last.month; n++) {
    const existingRow = byKey.get(n);
    if (existingRow) {
      output.push(existingRow);
    } else {
      const year = Math.floor((n - 1) / 12);
      output.push({ year, month: n - year * 12, income: 0, expense: 0 });
    }
  }
  return output;
}

export function toMonthlyPoints(points: MonthPoint[]): PeriodPoint[] {
  return points.map((p) => ({
    label: `${MONTH_ABBR[p.month - 1]} ${String(p.year).slice(2)}`,
    income: p.income,
    expense: p.expense,
  }));
}

export function toQuarterlyPoints(points: MonthPoint[]): PeriodPoint[] {
  const map = new Map<string, PeriodPoint>();
  for (const p of points) {
    const q = Math.floor((p.month - 1) / 3) + 1;
    const key = `${p.year}-Q${q}`;
    const existing = map.get(key) ?? { label: `T${q} ${String(p.year).slice(2)}`, income: 0, expense: 0 };
    existing.income += p.income;
    existing.expense += p.expense;
    map.set(key, existing);
  }
  return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
}

export function toYearlyPoints(points: MonthPoint[]): PeriodPoint[] {
  const map = new Map<number, PeriodPoint>();
  for (const p of points) {
    const existing = map.get(p.year) ?? { label: String(p.year), income: 0, expense: 0 };
    existing.income += p.income;
    existing.expense += p.expense;
    map.set(p.year, existing);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b).map(([, v]) => v);
}

/* ---------------------------------------------------------------------
   Month / Quarter / Year selector window.

   Bug this fixes: the previous filter was just `t.date >= inicio`, with
   no upper bound. Since materialize.ts creates recurring transactions up
   to 95 days ahead, the three options ended up including the same
   future and the cards (balance by category, expense distribution,
   fixed vs. variable) showed exactly the same thing under Month,
   Quarter and Year. With `to` bounded, each range covers only its own period.
--------------------------------------------------------------------- */
import { addDays, parseISO, toISO } from '@/domain/dates';
import { calculatePeriod, periodMonthOf, rangeFromKey, DEFAULT_PAY_DAYS, type PayDays } from '@/domain/period/period';
import { displayMonth, periodMonthOfDisplay, periodMonthSpan, type YM } from '@/domain/period/display';
import { resolveChargePeriod } from '@/domain/period/resolve';
import type { Transaction } from '@/domain/types';

export type Range = 'quincena' | 'mes' | 'trimestre' | 'año';

/**
 * The months a range covers, by the names the screens show (Inicio's
 * "Octubre"), first and last.
 */
export function rangeMonths(range: Exclude<Range, 'quincena'>, today: string, payDays: PayDays = DEFAULT_PAY_DAYS): { first: YM; last: YM } {
  const shown = displayMonth(periodMonthOf(today, payDays), payDays);
  if (range === 'mes') return { first: shown, last: shown };
  if (range === 'trimestre') {
    const m = shown.m - ((shown.m - 1) % 3);
    return { first: { y: shown.y, m }, last: { y: shown.y, m: m + 2 } };
  }
  return { first: { y: shown.y, m: 1 }, last: { y: shown.y, m: 12 } };
}

/**
 * Inclusive [from, to] bounds of the range that contains `today`.
 *
 * Every range is built from the user's pay days, like Inicio and
 * Movimientos. They used to be calendar ranges (only 'quincena' wasn't),
 * and paid once a month on the 30th that split one month of money in two:
 * Inicio showed the salary of the 30th of September and October's
 * expenses together, and Análisis showed October with "Ingresos $0".
 *
 *   'quincena'  the pay period holding today (paid monthly, the whole month)
 *   'mes'       the month of periods holding today: 30 Sep → 29 Oct
 *   'trimestre' three of those months, named Oct–Dec: 30 Sep → 29 Dec
 *   'año'       twelve, named Jan–Dec
 *
 * Paid on the 1st, these are exactly the calendar ranges.
 */
export function rangeBounds(
  range: Range,
  today: string,
  payDays: PayDays = DEFAULT_PAY_DAYS,
): { from: string; to: string } {
  if (range === 'quincena') {
    const p = calculatePeriod(today, payDays);
    return { from: p.start, to: p.end };
  }
  const { first, last } = rangeMonths(range, today, payDays);
  return {
    from: periodMonthSpan(periodMonthOfDisplay(first, payDays), payDays).start,
    to: periodMonthSpan(periodMonthOfDisplay(last, payDays), payDays).end,
  };
}

/**
 * The same kind of range, one step back or forward from `anchor`.
 *
 * Jumps to the day just outside the current bounds instead of doing
 * month arithmetic per range: that way a pay period (25th → 9th) moves to
 * the neighbouring pay period, a quarter to the next quarter, and so on,
 * with the one definition of "range" rangeBounds already has.
 */
export function shiftAnchor(range: Range, anchor: string, dir: -1 | 1, payDays: PayDays = DEFAULT_PAY_DAYS): string {
  const { from, to } = rangeBounds(range, anchor, payDays);
  return dir < 0 ? toISO(addDays(parseISO(from), -1)) : toISO(addDays(parseISO(to), 1));
}

/** Whether the range around `anchor` is the one happening now. */
export function containsToday(range: Range, anchor: string, today: string, payDays: PayDays = DEFAULT_PAY_DAYS): boolean {
  const { from, to } = rangeBounds(range, anchor, payDays);
  return from <= today && today <= to;
}

/**
 * By the CHARGE period, the same one Inicio adds up.
 *
 * It used to filter by raw t.date, so a September 20th card purchase
 * that gets paid on November 2nd counted as a September expense. Then by
 * the charge DATE, which still ignored a transaction moved to another
 * period by hand: Inicio counted it where it was moved, Análisis where its
 * date fell. Now both ask resolveChargePeriod. Every range is made of whole
 * periods, so a period is in it when its first day is.
 */
export function filterByRange(
  transactions: Transaction[],
  range: Range,
  today: string,
  payDays: PayDays = DEFAULT_PAY_DAYS,
): Transaction[] {
  const { from, to } = rangeBounds(range, today, payDays);
  const startOf = new Map<string, string>();
  return transactions.filter((t) => {
    const key = resolveChargePeriod(t, payDays);
    let start = startOf.get(key);
    if (start === undefined) {
      start = rangeFromKey(key, payDays).start;
      startOf.set(key, start);
    }
    return start >= from && start <= to;
  });
}
