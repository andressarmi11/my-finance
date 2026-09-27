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
import { daysInMonth } from '@/domain/dates';
import { chargeDate } from '@/domain/period/chargeDate';
import { calculatePeriod, DEFAULT_PAY_DAYS, type PayDays } from '@/domain/period/period';
import type { Transaction } from '@/domain/types';

export type Range = 'quincena' | 'mes' | 'trimestre' | 'año';

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Inclusive [from, to] bounds of the range that contains `today`.
 *
 * Three of the four are pure CALENDAR ranges. 'quincena' is not: it
 * comes from the user's pay days, so the 25th's window stretches to the
 * 9th of the next month. They're two different axes and it's worth
 * keeping that visible — there's no such thing as a "quarter of pay
 * periods" and none gets invented.
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
  const [y, m] = today.split('-').map(Number) as [number, number];
  if (range === 'mes') {
    return { from: iso(y, m, 1), to: iso(y, m, daysInMonth(y, m)) };
  }
  if (range === 'trimestre') {
    const first = m - ((m - 1) % 3);
    const last = first + 2;
    return { from: iso(y, first, 1), to: iso(y, last, daysInMonth(y, last)) };
  }
  return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
}

/**
 * By the CHARGE date, not the entry date.
 *
 * It used to filter by raw t.date, so a September 20th card purchase
 * that gets paid on November 2nd counted as a September expense. It's
 * the same bug that got fixed in the balance (95e91ce) and survived here
 * because the function used to live in features/dashboard.
 */
export function filterByRange(
  transactions: Transaction[],
  range: Range,
  today: string,
  payDays: PayDays = DEFAULT_PAY_DAYS,
): Transaction[] {
  const { from, to } = rangeBounds(range, today, payDays);
  return transactions.filter((t) => {
    const charge = chargeDate(t);
    return charge >= from && charge <= to;
  });
}
