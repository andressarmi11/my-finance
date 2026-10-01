import { describe, expect, it } from 'vitest';
import { planBudgetSet, rollingMonths } from './months';

describe('rollingMonths', () => {
  it('12 months starting at from, crossing the year', () => {
    const r = rollingMonths({ year: 2026, month: 9 });
    expect(r).toHaveLength(12);
    expect(r[0]).toEqual({ year: 2026, month: 9 });
    expect(r[4]).toEqual({ year: 2027, month: 1 });
    expect(r[11]).toEqual({ year: 2027, month: 8 });
  });
  it('respects count', () => {
    expect(rollingMonths({ year: 2026, month: 12 }, 2)).toEqual([{ year: 2026, month: 12 }, { year: 2027, month: 1 }]);
  });
});

describe('planBudgetSet', () => {
  const b = (month: number, amount: number, id = `b${month}`) =>
    ({ id, categoryId: 'c', year: 2026, month, amount, updatedAt: '' });
  it('an arbitrary month set (Apr/Jun/Dec) writes exactly 3 rows and counts replaced', () => {
    const months = [4, 6, 12].map((month) => ({ year: 2026, month }));
    let n = 0;
    const { rows, replaced } = planBudgetSet([b(4, 100), b(6, 0), b(9, 50)], 'c', months, 300, 'now', () => `new${++n}`);
    expect(rows.map((r) => [r.month, r.id, r.amount])).toEqual([[4, 'b4', 300], [6, 'b6', 300], [12, 'new1', 300]]);
    expect(replaced).toBe(1); // only April had a real budget; the 0 row is a deleted one
  });

  it('a live goal stays a goal; a new or removed one takes the kind asked for', () => {
    const goal = { ...b(4, 100), kind: 'goal' as const, planId: 'p1' };
    const removed = { ...b(5, 0), kind: 'goal' as const };
    const months = [4, 5, 6].map((month) => ({ year: 2026, month }));
    const { rows } = planBudgetSet([goal, removed], 'c', months, 300, 'now', () => 'new');
    expect(rows.map((r) => r.kind ?? 'limit')).toEqual(['goal', 'limit', 'limit']);
    expect(rows[0]!.planId).toBe('p1');
    const asGoal = planBudgetSet([removed, { ...b(7, 100), kind: 'limit' as const }], 'c',
      [5, 6, 7].map((month) => ({ year: 2026, month })), 300, 'now', () => 'new', 'goal').rows;
    expect(asGoal.map((r) => r.kind)).toEqual(['goal', 'goal', 'limit']);
  });
});
