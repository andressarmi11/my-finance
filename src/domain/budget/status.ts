/**
 * Budget: only informs, never blocks (explicit requirement).
 * 'warning' kicks in at 80% so the user still has time to react
 * before going over.
 */
export type BudgetState = 'ok' | 'warning' | 'exceeded';

export interface BudgetStatus {
  spent: number;
  budget: number;
  remaining: number;
  /** 0 to 1+ (can go past 1 if exceeded). */
  percentage: number;
  state: BudgetState;
}

const WARNING_THRESHOLD = 0.8;

export function calculateBudgetStatus(spent: number, budget: number): BudgetStatus {
  const remaining = budget - spent;
  const percentage = budget > 0 ? spent / budget : spent > 0 ? Infinity : 0;
  const state: BudgetState = spent > budget ? 'exceeded' : percentage >= WARNING_THRESHOLD ? 'warning' : 'ok';
  return { spent, budget, remaining, percentage, state };
}
