import { addDays, parseISO, toISO } from '@/domain/dates';
import { calculatePeriod, periodsOfMonth, rangeFromKey, type PayDays } from '@/domain/period/period';

export interface PreviewDay {
  day: number;
  /** Which of the month's periods it falls in (1 = first pay day). */
  index: number;
  /** It belongs to LAST month's final period (days before the first pay day). */
  fromPrevMonth: boolean;
}

export interface PreviewPeriod {
  index: number;
  startDay: number;
  endDay: number;
  /** Ends in the next month ("Del 25 al 9 del mes siguiente"). */
  endsNextMonth: boolean;
}

/**
 * The 30-day strip of "Cómo te pagan" (redesign §9d): each day of `month`
 * coloured by the period it belongs to, and the month's periods with their
 * ranges. Straight from the domain (calculatePeriod, periodsOfMonth), so
 * the preview can't drift from how transactions are actually grouped.
 */
export function payPreview(year: number, month: number, payDays: PayDays): { days: PreviewDay[]; periods: PreviewPeriod[] } {
  const monthKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const first = { y: year, m: month, d: 1 };
  const days: PreviewDay[] = [];
  for (let i = 0; i < 30; i++) {
    const ymd = addDays(first, i);
    const period = calculatePeriod(toISO(ymd), payDays);
    days.push({ day: ymd.d, index: period.index, fromPrevMonth: period.key.slice(0, 7) < monthKey });
  }
  const periods = periodsOfMonth(year, month, payDays).map((key) => {
    const range = rangeFromKey(key, payDays);
    const start = parseISO(range.start);
    const end = parseISO(range.end);
    return { index: range.index, startDay: start.d, endDay: end.d, endsNextMonth: end.m !== month || end.y !== year };
  });
  return { days, periods };
}
