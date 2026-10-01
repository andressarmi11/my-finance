/**
 * An active savings plan read against the period on screen (the plan card
 * in Análisis, with its pace line). Pure: the screens pass today.
 */
import { addDays, clampDay, daysInMonth, parseISO, shiftMonth, toISO } from '../dates';
import type { ISODate } from '../types';
import type { ProgressInput, ProgressResult } from './types';

const round1000 = (n: number) => Math.round(n / 1000) * 1000;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const minISO = (a: ISODate, b: ISODate) => (a < b ? a : b);
const maxISO = (a: ISODate, b: ISODate) => (a > b ? a : b);
/** A pace margin before a category reads as "ahead". */
const AHEAD_MARGIN = 0.03;

/**
 * Calendar months covered by the inclusive day range [a, b]: each month
 * adds days covered / days in that month. 3 decimals; 0 if a > b.
 */
export function calMonths(a: ISODate, b: ISODate): number {
  if (a > b) return 0;
  const start = parseISO(a);
  const end = parseISO(b);
  let total = 0;
  let { y, m } = start;
  for (;;) {
    const dim = daysInMonth(y, m);
    const fromD = y === start.y && m === start.m ? start.d : 1;
    const toD = y === end.y && m === end.m ? end.d : dim;
    total += (toD - fromD + 1) / dim;
    if (y === end.y && m === end.m) break;
    ({ y, m } = shiftMonth(y, m, 1));
  }
  return round3(total);
}

/** Start + n months, minus a day. A start day the target month lacks ends on its last day. */
function monthsEnd(startDate: ISODate, months: number): ISODate {
  const s = parseISO(startDate);
  const t = shiftMonth(s.y, s.m, months);
  if (s.d > daysInMonth(t.y, t.m)) return toISO({ y: t.y, m: t.m, d: daysInMonth(t.y, t.m) });
  return toISO(addDays({ y: t.y, m: t.m, d: clampDay(t.y, t.m, s.d) }, -1));
}

/** Inclusive end of a plan that lasts n units from startDate. */
export function planEndDate(startDate: ISODate, unit: 'days' | 'weeks' | 'months' | 'year', n: number): ISODate {
  switch (unit) {
    case 'days':
      return toISO(addDays(parseISO(startDate), n - 1));
    case 'weeks':
      return toISO(addDays(parseISO(startDate), n * 7 - 1));
    case 'months':
      return monthsEnd(startDate, n);
    case 'year':
      return monthsEnd(startDate, n * 12);
  }
}

/** Inclusive end of a goal plan that takes `months` months. */
export function goalEndDate(startDate: ISODate, months: number): ISODate {
  return monthsEnd(startDate, months);
}

export function planProgress(input: ProgressInput): ProgressResult {
  const { plan, from, to, today } = input;
  const start = maxISO(plan.startDate, from);
  const end = minISO(plan.endDate, to);
  if (start > end) return { covers: false, reason: plan.startDate > to ? 'notStarted' : 'ended' };

  let planMonths = calMonths(start, end);
  if (input.isPayPeriod) planMonths = Math.min(0.5, planMonths);
  const elapsedEnd = minISO(end, today);
  const elapsedMonths = today < start ? 0 : Math.min(planMonths, calMonths(start, elapsedEnd));
  const pace = planMonths ? Math.min(1, elapsedMonths / planMonths) : 0;

  const rows = plan.cuts.map((c) => {
    const top = round1000(c.limit * planMonths);
    // Empty when today is before the overlap (elapsedEnd < start).
    const spent = input.transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.status !== 'cancelled' &&
          t.categoryId === c.categoryId &&
          t.date >= start &&
          t.date <= elapsedEnd,
      )
      .reduce((a, t) => a + t.amount, 0);
    return {
      categoryId: c.categoryId,
      spent,
      top,
      ahead: top > 0 && spent / top > pace + AHEAD_MARGIN && elapsedMonths > 0,
      exceeded: spent > top && top > 0,
    };
  });

  const saved = plan.cuts.reduce((a, c, i) => a + Math.max(0, round1000(c.avg * elapsedMonths) - rows[i]!.spent), 0);
  const yearEnd = `${from.slice(0, 4)}-12-31`;
  const monthsToDecember = calMonths(plan.startDate, minISO(plan.endDate, yearEnd));

  return {
    covers: true,
    planMonths,
    elapsedMonths,
    goal: round1000(plan.monthlyTarget * planMonths),
    saved,
    pace,
    started: elapsedMonths > 0,
    rows,
    monthsToDecember,
    projection: round1000(plan.monthlyTarget * monthsToDecember),
  };
}
