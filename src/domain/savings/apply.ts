/**
 * Writing a savings plan into budgets, and taking it back out
 * (PRESUPUESTOS-Y-AHORRO.md, "Al confirmar" and "Eliminar el plan").
 *
 * Budgets are per category AND calendar month, so a plan writes one row
 * per category with a cut and per month it touches, plus the savings goal.
 * Before overwriting anything it keeps a snapshot of what was there; the
 * snapshot is taken once, when the plan is first created, and only grows
 * with keys an update touches for the first time. Deleting or ending the
 * plan puts the snapshot back and removes (amount 0) what the plan created.
 */
import type { YearMonth } from '../budget/months';
import type { Budget, ISODate, SavingsPlan } from '../types';

const key = (b: Pick<Budget, 'categoryId' | 'year' | 'month'>) => `${b.categoryId}|${b.year}|${b.month}`;

/** Calendar months from start's to end's, inclusive (at most 24). */
export function planMonths(startDate: ISODate, endDate: ISODate): YearMonth[] {
  const [sy, sm] = startDate.split('-').map(Number) as [number, number];
  const [ey, em] = endDate.split('-').map(Number) as [number, number];
  const out: YearMonth[] = [];
  for (let t = sy * 12 + sm - 1; t <= ey * 12 + em - 1 && out.length < 24; t++) {
    out.push({ year: Math.floor(t / 12), month: (t % 12) + 1 });
  }
  return out;
}

export interface ApplyResult {
  /** Rows to put in Dexie (new, overwritten or removed with amount 0). */
  rows: Budget[];
  /** The snapshot to store in the plan. */
  prevBudgets: Budget[];
}

/**
 * The budget rows for `plan` over its months. `existing` is every budget
 * the device has; rows another plan version created and this one no longer
 * covers are put back (snapshot) or removed.
 */
export function applyPlan(
  plan: Pick<SavingsPlan, 'id' | 'startDate' | 'endDate' | 'cuts' | 'goalCategoryId' | 'goalMonthly' | 'goalName' | 'goalAmount' | 'mode' | 'prevBudgets'>,
  existing: readonly Budget[],
  now: string,
  newId: () => string,
): ApplyResult {
  const months = planMonths(plan.startDate, plan.endDate);
  const byKey = new Map(existing.map((b) => [key(b), b]));
  const snapshot = new Map(plan.prevBudgets.map((b) => [key(b), b]));
  const wanted = new Map<string, Budget>();

  const want = (categoryId: string, ym: YearMonth, fields: Partial<Budget> & { amount: number }) => {
    const k = key({ categoryId, ...ym });
    const prev = byKey.get(k);
    // First time this plan touches the key: remember what the user had.
    if (prev && prev.amount > 0 && prev.planId !== plan.id && !snapshot.has(k)) snapshot.set(k, prev);
    const row: Budget = { id: prev?.id ?? newId(), categoryId, year: ym.year, month: ym.month, updatedAt: now, planId: plan.id, ...fields };
    wanted.set(k, row);
  };

  for (const ym of months) {
    for (const c of plan.cuts) {
      if (c.cut > 0 && c.limit > 0) want(c.categoryId, ym, { amount: c.limit, kind: 'limit' });
    }
    if (plan.goalCategoryId && plan.goalMonthly > 0) {
      want(plan.goalCategoryId, ym, {
        amount: plan.goalMonthly, kind: 'goal',
        ...(plan.mode === 'goal' && plan.goalName ? { goalName: plan.goalName } : {}),
        ...(plan.mode === 'goal' && plan.goalAmount ? { goalAmount: plan.goalAmount } : {}),
      });
    }
  }

  const rows = [...wanted.values()];
  // What an earlier version of this plan wrote and this one doesn't.
  for (const b of existing) {
    if (b.planId !== plan.id || wanted.has(key(b))) continue;
    rows.push(restored(b, snapshot.get(key(b)), now));
  }
  return { rows, prevBudgets: [...snapshot.values()] };
}

/** Deleting / ending: every row of the plan goes back to its snapshot or away. */
export function removePlan(
  plan: Pick<SavingsPlan, 'id' | 'prevBudgets'>,
  existing: readonly Budget[],
  now: string,
): Budget[] {
  const snapshot = new Map(plan.prevBudgets.map((b) => [key(b), b]));
  return existing.filter((b) => b.planId === plan.id).map((b) => restored(b, snapshot.get(key(b)), now));
}

function restored(current: Budget, before: Budget | undefined, now: string): Budget {
  // Same id (it's the row sync knows); what it was, or 0 = removed.
  const row: Budget = { id: current.id, categoryId: current.categoryId, year: current.year, month: current.month, amount: 0, updatedAt: now };
  if (!before) return row;
  row.amount = before.amount;
  if (before.kind) row.kind = before.kind;
  if (before.goalName) row.goalName = before.goalName;
  if (before.goalAmount != null) row.goalAmount = before.goalAmount;
  return row;
}
