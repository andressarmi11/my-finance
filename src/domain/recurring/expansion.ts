/**
 * Expands a recurring RULE into concrete INSTANCES within a date range.
 * It's a pure function: it writes nothing. The caller upserts each instance
 * using (recurringRuleId, periodKey) as the key — that UNIQUE index in the
 * database is what makes duplication impossible, not this function.
 */
import { addDays, clampDay, compareISO, parseISO, shiftMonth, toISO } from '../dates';
import type { ISODate, RecurringRule } from '../types';

export interface RecurringOccurrence {
  /** Idempotent key: 'YYYY-MM' for monthly, 'YYYY' for yearly, the date itself for weekly/biweekly. */
  periodKey: string;
  date: ISODate;
}

function compareYM(a: { y: number; m: number }, b: { y: number; m: number }): number {
  return a.y * 12 + a.m - (b.y * 12 + b.m);
}

export function expandRecurringRule(
  rule: RecurringRule,
  range: { from: ISODate; to: ISODate },
): RecurringOccurrence[] {
  if (!rule.isActive) return [];

  const effectiveFrom = compareISO(rule.startDate, range.from) > 0 ? rule.startDate : range.from;
  const effectiveTo = rule.endDate && compareISO(rule.endDate, range.to) < 0 ? rule.endDate : range.to;
  if (compareISO(effectiveFrom, effectiveTo) > 0) return [];

  const occurrences: RecurringOccurrence[] = [];

  if (rule.frequency === 'monthly') {
    const fromYMD = parseISO(effectiveFrom);
    const toYMD = parseISO(effectiveTo);
    let cursor = { y: fromYMD.y, m: fromYMD.m };
    while (compareYM(cursor, { y: toYMD.y, m: toYMD.m }) <= 0) {
      const day = clampDay(cursor.y, cursor.m, rule.dayOfMonth ?? 1);
      const date = toISO({ ...cursor, d: day });
      if (compareISO(date, effectiveFrom) >= 0 && compareISO(date, effectiveTo) <= 0) {
        occurrences.push({ periodKey: date.slice(0, 7), date });
      }
      cursor = shiftMonth(cursor.y, cursor.m, 1);
    }
    return occurrences;
  }

  if (rule.frequency === 'weekly' || rule.frequency === 'biweekly') {
    const step = rule.frequency === 'weekly' ? 7 : 14;
    let cursor = parseISO(rule.startDate);
    while (compareISO(toISO(cursor), effectiveFrom) < 0) cursor = addDays(cursor, step);
    while (compareISO(toISO(cursor), effectiveTo) <= 0) {
      const date = toISO(cursor);
      occurrences.push({ periodKey: date, date });
      cursor = addDays(cursor, step);
    }
    return occurrences;
  }

  // yearly
  const anchor = parseISO(rule.startDate);
  const fromYMD = parseISO(effectiveFrom);
  const toYMD = parseISO(effectiveTo);
  for (let y = fromYMD.y; y <= toYMD.y; y++) {
    const day = clampDay(y, anchor.m, anchor.d); // Feb 29 -> Feb 28 in a non-leap year
    const date = toISO({ y, m: anchor.m, d: day });
    if (compareISO(date, effectiveFrom) >= 0 && compareISO(date, effectiveTo) <= 0) {
      occurrences.push({ periodKey: String(y), date });
    }
  }
  return occurrences;
}
