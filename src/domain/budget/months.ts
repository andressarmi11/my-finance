import type { Budget, Id } from '../types';

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

/** `count` consecutive months starting at `from` (inclusive), crossing years. */
export function rollingMonths(from: YearMonth, count = 12): YearMonth[] {
  const base = from.year * 12 + (from.month - 1);
  return Array.from({ length: count }, (_, i) => {
    const t = base + i;
    return { year: Math.floor(t / 12), month: (t % 12) + 1 };
  });
}

/**
 * Rows to write for "set this amount in these months" (one batch, one upsert
 * on sync). An existing row (even a 0 one) keeps its id so it's an update, not
 * a second row for the same natural key. `replaced` counts months that already
 * had a real (> 0) budget.
 */
export function planBudgetSet(
  existing: readonly Budget[],
  categoryId: Id,
  months: readonly YearMonth[],
  amount: number,
  now: string,
  newId: () => Id,
): { rows: Budget[]; replaced: number } {
  const byMonth = new Map(existing.map((b) => [`${b.year}|${b.month}`, b]));
  let replaced = 0;
  const rows = months.map((m) => {
    const prev = byMonth.get(`${m.year}|${m.month}`);
    if (prev && prev.amount > 0) replaced++;
    return { id: prev?.id ?? newId(), categoryId, year: m.year, month: m.month, amount, updatedAt: now };
  });
  return { rows, replaced };
}
