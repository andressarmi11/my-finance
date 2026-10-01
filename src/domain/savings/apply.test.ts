import { describe, expect, it } from 'vitest';
import type { Budget } from '../types';
import { applyPlan, planMonths, removePlan } from './apply';

const b = (categoryId: string, month: number, amount: number, extra: Partial<Budget> = {}): Budget =>
  ({ id: `${categoryId}-${month}`, categoryId, year: 2026, month, amount, updatedAt: 'old', ...extra });

const plan = {
  id: 'p1', startDate: '2026-09-01', endDate: '2026-10-31', mode: 'monthly' as const, prevBudgets: [] as Budget[],
  cuts: [{ categoryId: 'food', avg: 780_000, cut: 150_000, limit: 630_000 }, { categoryId: 'fun', avg: 500_000, cut: 0, limit: 500_000 }],
  goalCategoryId: 'savings', goalMonthly: 3_150_000,
};
let n = 0;
const newId = () => `new${++n}`;

describe('planMonths', () => {
  it('every calendar month the plan touches, across years', () => {
    expect(planMonths('2026-11-10', '2027-01-09')).toEqual([{ year: 2026, month: 11 }, { year: 2026, month: 12 }, { year: 2027, month: 1 }]);
  });
});

describe('applyPlan', () => {
  it('writes a limit per cut category and the goal, per month, marked with the plan', () => {
    const { rows, prevBudgets } = applyPlan(plan, [], 'now', newId);
    expect(rows).toHaveLength(4); // food × 2 months + savings × 2 (fun has no cut)
    expect(rows.filter((r) => r.categoryId === 'food').every((r) => r.amount === 630_000 && r.kind === 'limit' && r.planId === 'p1')).toBe(true);
    expect(rows.filter((r) => r.categoryId === 'savings').every((r) => r.amount === 3_150_000 && r.kind === 'goal')).toBe(true);
    expect(prevBudgets).toEqual([]);
  });

  it('keeps what was there in the snapshot and reuses its id', () => {
    const existing = [b('food', 9, 900_000), b('savings', 10, 1_000_000, { kind: 'goal' })];
    const { rows, prevBudgets } = applyPlan(plan, existing, 'now', newId);
    expect(rows.find((r) => r.categoryId === 'food' && r.month === 9)!.id).toBe('food-9');
    expect(prevBudgets.map((p) => p.id).sort()).toEqual(['food-9', 'savings-10']);
  });

  it('an update keeps the original snapshot and puts back what it no longer covers', () => {
    const first = applyPlan(plan, [b('food', 9, 900_000)], 'now', newId);
    const shorter = { ...plan, endDate: '2026-09-30', prevBudgets: first.prevBudgets };
    const { rows, prevBudgets } = applyPlan(shorter, first.rows, 'later', newId);
    expect(prevBudgets.map((p) => p.amount)).toEqual([900_000]); // not the plan's 630.000
    const octFood = rows.find((r) => r.categoryId === 'food' && r.month === 10)!;
    expect(octFood.amount).toBe(0); // October had nothing before the plan
    expect(octFood.planId).toBeUndefined();
  });
});

describe('removePlan', () => {
  it('restores the snapshot and removes what the plan created', () => {
    const before = [b('food', 9, 900_000)];
    const applied = applyPlan(plan, before, 'now', newId);
    const rows = removePlan({ id: 'p1', prevBudgets: applied.prevBudgets }, applied.rows, 'later');
    expect(rows).toHaveLength(4);
    const sepFood = rows.find((r) => r.categoryId === 'food' && r.month === 9)!;
    expect(sepFood).toMatchObject({ id: 'food-9', amount: 900_000 });
    expect(sepFood.planId).toBeUndefined();
    expect(rows.filter((r) => r !== sepFood).every((r) => r.amount === 0 && !r.planId)).toBe(true);
  });

  it('leaves budgets of other plans and the user alone', () => {
    const rows = removePlan({ id: 'p1', prevBudgets: [] }, [b('x', 9, 1, { planId: 'other' }), b('y', 9, 1)], 'now');
    expect(rows).toEqual([]);
  });
});
