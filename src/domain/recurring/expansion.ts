/**
 * Expands a recurring RULE into concrete INSTANCES within a date range.
 * It's a pure function: it writes nothing. The caller upserts each instance
 * using (recurringRuleId, periodKey) as the key — that UNIQUE index in the
 * database is what makes duplication impossible, not this function.
 */
import { addDays, clampDay, compareISO, parseISO, shiftMonth, toISO } from '../dates';
import type { ISODate, RecurringRule } from '../types';

export interface RecurringOccurrence {
  /** Idempotent key: 'YYYY-MM' for monthly/month-based custom, 'YYYY' for yearly, the date itself for weekly/biweekly/every-N-weeks. */
  periodKey: string;
  date: ISODate;
}

function compareYM(a: { y: number; m: number }, b: { y: number; m: number }): number {
  return a.y * 12 + a.m - (b.y * 12 + b.m);
}

/**
 * Patterns arrive from the cloud and from backups, so they are validated here
 * and not trusted: every = 0 would loop forever, 1.5 would never match.
 * Anything out of range is dropped (undefined), and a custom rule without a
 * usable pattern expands to nothing.
 */
export function cleanInterval(v: unknown): { every: number; unit: 'months' | 'weeks' } | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const { every, unit } = v as { every?: unknown; unit?: unknown };
  const max = unit === 'months' ? 12 : unit === 'weeks' ? 26 : 0;
  if (typeof every !== 'number' || !Number.isInteger(every) || every < 1 || every > max) return undefined;
  return { every, unit: unit as 'months' | 'weeks' };
}

/** Sorted, unique integers 1-12; undefined if any entry is invalid or it's empty. */
export function cleanMonths(v: unknown): number[] | undefined {
  if (!Array.isArray(v) || v.length === 0 || v.length > 12) return undefined;
  if (!v.every((m) => typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 12)) return undefined;
  return [...new Set(v as number[])].sort((a, b) => a - b);
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

  const custom = rule.frequency === 'custom' ? rule : null;
  const interval = custom ? cleanInterval(custom.interval) : undefined;
  const monthList = custom && !custom.interval ? cleanMonths(custom.months) : undefined;
  // Exactly one valid pattern, or nothing: never degrade to yearly, never loop.
  if (custom && !interval && !monthList) return [];
  const monthStep = interval?.unit === 'months' ? interval.every : 1;
  const weekStep = interval?.unit === 'weeks' ? interval.every * 7 : null;

  if (rule.frequency === 'monthly' || (custom && weekStep === null)) {
    const anchor = parseISO(rule.startDate);
    const fromYMD = parseISO(effectiveFrom);
    const toYMD = parseISO(effectiveTo);
    let cursor = { y: fromYMD.y, m: fromYMD.m };
    while (compareYM(cursor, { y: toYMD.y, m: toYMD.m }) <= 0) {
      // Custom: "every N months" counts from startDate's month; a month list is exact.
      const onPattern = !custom
        || (monthList ? monthList.includes(cursor.m) : (compareYM(cursor, { y: anchor.y, m: anchor.m }) % monthStep === 0));
      const day = clampDay(cursor.y, cursor.m, rule.dayOfMonth ?? (custom ? anchor.d : 1));
      const date = toISO({ ...cursor, d: day });
      if (onPattern && compareISO(date, effectiveFrom) >= 0 && compareISO(date, effectiveTo) <= 0) {
        occurrences.push({ periodKey: date.slice(0, 7), date });
      }
      cursor = shiftMonth(cursor.y, cursor.m, 1);
    }
    return occurrences;
  }

  if (rule.frequency === 'weekly' || rule.frequency === 'biweekly' || weekStep !== null) {
    const step = weekStep ?? (rule.frequency === 'weekly' ? 7 : 14);
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

/**
 * The next `n` occurrences on or after `today`, for the "next dates" preview.
 * Bounded search (n * 26 weeks max step, capped at 10 years) so a bad rule can't loop.
 */
export function nextOccurrences(rule: RecurringRule, today: ISODate, n = 3): ISODate[] {
  const t = parseISO(today);
  const from = compareISO(rule.startDate, today) > 0 ? rule.startDate : today;
  for (const years of [2, 10]) {
    const to = toISO({ y: t.y + years, m: t.m, d: 1 });
    const found = expandRecurringRule(rule, { from, to }).map((o) => o.date);
    if (found.length >= n || years === 10) return found.slice(0, n);
  }
  return [];
}
