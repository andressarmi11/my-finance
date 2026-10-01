/**
 * Tope and Meta (PRESUPUESTOS-Y-AHORRO.md, part A).
 *
 * A budget can be a spending limit or a savings goal, so "% used" can't
 * read both: a goal at 120% is good news. What's counted is the same in
 * both cases (what was recorded in the category that month); only the
 * reading changes.
 */
import type { Budget, BudgetKind, Category } from '../types';

export function budgetKind(b: Pick<Budget, 'kind'>): BudgetKind {
  return b.kind === 'goal' ? 'goal' : 'limit';
}

/**
 * Savings categories: there's no "savings" type, so it's the icon. The
 * seeded "Ahorro" has it, and so does any category the user gives it.
 */
export function isSavingsCategory(c: Pick<Category, 'icon'>): boolean {
  return c.icon === 'savings';
}

/** What a new budget for this category starts as. */
export function defaultBudgetKind(c: Pick<Category, 'icon'>): BudgetKind {
  return isSavingsCategory(c) ? 'goal' : 'limit';
}

export interface KindTotals {
  /** Spent (limits) or saved (goals). */
  spent: number;
  limit: number;
  /** Rounded percentage. */
  pct: number;
  /** Only limits can be over. */
  over: boolean;
}

export interface BudgetSummary {
  /** Absent when there's no limit at all. */
  spending?: KindTotals;
  /** Absent when there's no goal at all. */
  savings?: KindTotals;
}

/** "Gastos 89% · Ahorro 86%": each part only if it exists. */
export function summarizeBudgets(rows: ReadonlyArray<{ kind: BudgetKind; spent: number; limit: number }>): BudgetSummary {
  const out: BudgetSummary = {};
  for (const kind of ['limit', 'goal'] as const) {
    const these = rows.filter((r) => r.kind === kind && r.limit > 0);
    if (these.length === 0) continue;
    const spent = these.reduce((a, r) => a + r.spent, 0);
    const limit = these.reduce((a, r) => a + r.limit, 0);
    const totals = { spent, limit, pct: Math.round((spent / limit) * 100), over: kind === 'limit' && spent > limit };
    if (kind === 'limit') out.spending = totals;
    else out.savings = totals;
  }
  return out;
}
