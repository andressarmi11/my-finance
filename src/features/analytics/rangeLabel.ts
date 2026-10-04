/**
 * The words on the Analytics period navigator: the label for the range
 * being looked at, the widest one it can ever show, and the range buttons.
 * In the active language, months capitalised.
 */
import { monthName, widestMonthLabel } from '@/components/ui/MonthNav';
import { shortRange } from '@/lib/formatShortDate';
import { daysInMonth, parseISO } from '@/domain/dates';
import { rangeBounds, rangeMonths, type Range } from './periodAggregate';

/** The range buttons said the internal key ("mes", "trimestre") even in English. */
export const RANGE_KEY = {
  quincena: 'range.biweekly', mes: 'range.month', trimestre: 'range.quarter', año: 'range.year',
} as const;


/** Three-letter month, in the active language: "Jul", "Sep". */
function shortMonth(m: number): string {
  return monthName(m).slice(0, 3);
}

/**
 * The widest label a range can show, so the arrows keep their place while
 * paging within it (MonthNav reserves this width). Built from BOTH
 * languages' month names, like widestMonthLabel, so switching language
 * doesn't move them either.
 */
export function widestRangeLabel(range: Range): string {
  if (range === 'mes') return widestMonthLabel();
  if (range === 'año') return '0000';
  // Pixels, not characters: every three-letter month ties on length, but
  // "Mar" and "Ene" are not equally wide. "Mmm" is wider than any of them in
  // either language, so the reserved box always holds the real label.
  const m3 = 'Mmm';
  if (range === 'quincena') return `00 ${m3} – 00 ${m3}`;
  return `${m3} – ${m3} 0000`;
}

/**
 * Label for the period being looked at, so the user can see the selector
 * does change something. In the active language, months capitalised; it
 * used to be Spanish-only ("septiembre 2026", "2026 completo") even with
 * the app in English.
 */
/**
 * The navigator's own label, beside the title (prototype 1a: "Sep 2026").
 * Short on purpose: the long one ("Septiembre 2026") would push the arrows
 * under the title on a phone.
 */
export function shortRangeLabel(range: Range, today: string, payDays: number[]): string {
  if (range !== 'mes') return describeRange(range, today, payDays);
  const { y, m } = rangeMonths(range, today, payDays).first;
  return `${shortMonth(m)} ${y}`;
}

/** The widest short label, to reserve the navigator's width. */
export function widestShortRangeLabel(range: Range): string {
  return range === 'mes' ? widestMonthLabel(true) : widestRangeLabel(range);
}

/** What the hero calls the period: "Balance de Septiembre" — for a month, no year. */
export function heroRangeLabel(range: Range, today: string, payDays: number[]): string {
  if (range !== 'mes') return describeRange(range, today, payDays);
  return monthName(rangeMonths(range, today, payDays).first.m);
}

export function describeRange(range: Range, today: string, payDays: number[]): string {
  // A pay period is stated in days, not months: its whole point is that it
  // crosses the month boundary, and saying just "September" would hide that.
  if (range === 'quincena') {
    const { from, to } = rangeBounds(range, today, payDays);
    return shortRange(from, to);
  }
  // By the names Inicio uses, not the month the first day falls in: paid
  // on the 30th, 30 Sep → 29 Oct is "Octubre".
  const { first, last } = rangeMonths(range, today, payDays);
  if (range === 'mes') return `${monthName(first.m)} ${first.y}`;
  if (range === 'año') return String(first.y);
  // Abbreviated: the full "Octubre – Diciembre 2026" left no room on a
  // phone for the Today button beside the centred navigator.
  return `${shortMonth(first.m)} – ${shortMonth(last.m)} ${first.y}`;
}

/**
 * The real days behind a month, quarter or year, when they aren't the
 * calendar's: "30 Sep – 29 Oct". Empty when they are (or for a pay
 * period, whose label already is its days).
 */
export function rangeDays(range: Range, today: string, payDays: number[]): string {
  if (range === 'quincena') return '';
  const { from, to } = rangeBounds(range, today, payDays);
  const end = parseISO(to);
  if (from.endsWith('-01') && end.d === daysInMonth(end.y, end.m)) return '';
  return shortRange(from, to);
}
