import type { Budget, BudgetKind, Id } from '../types';

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
 *
 * A live budget keeps what it was (Tope/Meta, its plan); a new one, or one
 * that had been removed (amount 0), starts as `kindForNew` (default 'limit').
 * Changing Tope/Meta is setBudgetKind's job, not this one's.
 */
export function planBudgetSet(
  existing: readonly Budget[],
  categoryId: Id,
  months: readonly YearMonth[],
  amount: number,
  now: string,
  newId: () => Id,
  kindForNew: BudgetKind = 'limit',
): { rows: Budget[]; replaced: number } {
  const byMonth = new Map(existing.map((b) => [`${b.year}|${b.month}`, b]));
  let replaced = 0;
  const rows = months.map((m) => {
    const prev = byMonth.get(`${m.year}|${m.month}`);
    const live = prev && prev.amount > 0 ? prev : undefined;
    if (live) replaced++;
    const row: Budget = { id: prev?.id ?? newId(), categoryId, year: m.year, month: m.month, amount, updatedAt: now };
    const rowKind = live ? live.kind : kindForNew;
    if (rowKind) row.kind = rowKind;
    if (live?.planId) row.planId = live.planId;
    if (live?.goalName) row.goalName = live.goalName;
    if (live?.goalAmount != null) row.goalAmount = live.goalAmount;
    return row;
  });
  return { rows, replaced };
}
