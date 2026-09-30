import type { RecurringRule } from '@/domain/types';

/** Average weeks in a month (52 / 12). */
const WEEKS_PER_MONTH = 52 / 12;

/**
 * What a rule adds up to in an average month, for "Entran al mes / Salen
 * al mes" (redesign §9d). A weekly gym is ~4.3 charges a month, a yearly
 * insurance a twelfth of itself: summing raw amounts would lie in both
 * directions.
 */
export function monthlyEquivalent(rule: RecurringRule): number {
  switch (rule.frequency) {
    case 'monthly': return rule.amount;
    case 'biweekly': return rule.amount * 2;
    case 'weekly': return rule.amount * WEEKS_PER_MONTH;
    case 'yearly': return rule.amount / 12;
    case 'custom': {
      if (rule.months?.length) return (rule.amount * rule.months.length) / 12;
      if (rule.interval) {
        const every = Math.max(1, rule.interval.every);
        return rule.interval.unit === 'months' ? rule.amount / every : (rule.amount * WEEKS_PER_MONTH) / every;
      }
      return rule.amount;
    }
  }
}

/** Active rules only, rounded to whole units like every amount in the app. */
export function monthlyTotals(rules: RecurringRule[]): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const r of rules) {
    if (!r.isActive) continue;
    if (r.type === 'income') income += monthlyEquivalent(r);
    else expense += monthlyEquivalent(r);
  }
  return { income: Math.round(income), expense: Math.round(expense) };
}
