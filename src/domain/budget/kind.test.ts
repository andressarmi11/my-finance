import { describe, expect, it } from 'vitest';
import { budgetKind, defaultBudgetKind, isSavingsCategory, summarizeBudgets } from './kind';

describe('budget kind', () => {
  it('a budget saved before kinds existed is a limit', () => {
    expect(budgetKind({})).toBe('limit');
    expect(budgetKind({ kind: 'goal' })).toBe('goal');
  });

  it('savings categories (the savings icon) start as goals', () => {
    expect(isSavingsCategory({ icon: 'savings' })).toBe(true);
    expect(defaultBudgetKind({ icon: 'savings' })).toBe('goal');
    expect(defaultBudgetKind({ icon: 'food' })).toBe('limit');
  });
});

describe('summarizeBudgets', () => {
  it('splits spending and savings, each only if it exists', () => {
    expect(summarizeBudgets([])).toEqual({});
    const onlyLimits = summarizeBudgets([{ kind: 'limit', spent: 2_500_000, limit: 3_000_000 }]);
    expect(onlyLimits.savings).toBeUndefined();
    expect(onlyLimits.spending).toEqual({ spent: 2_500_000, limit: 3_000_000, pct: 83, over: false });
  });

  it('going over a limit is over; going over a goal never is', () => {
    const s = summarizeBudgets([
      { kind: 'limit', spent: 1_200_000, limit: 1_000_000 },
      { kind: 'goal', spent: 4_000_000, limit: 3_500_000 },
    ]);
    expect(s.spending).toMatchObject({ pct: 120, over: true });
    expect(s.savings).toMatchObject({ pct: 114, over: false });
  });

  it('ignores rows without a limit', () => {
    expect(summarizeBudgets([{ kind: 'goal', spent: 100, limit: 0 }])).toEqual({});
  });
});
