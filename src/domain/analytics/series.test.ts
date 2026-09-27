import { describe, expect, it } from 'vitest';
import { calculateDebitVsCredit, calculateFixedVsVariable, monthlySeries } from './series';
import type { Transaction } from '../types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? Math.random().toString(36), type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-01', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

describe('monthlySeries', () => {
  it('adds up income and expenses per calendar month, in chronological order', () => {
    const points = monthlySeries([
      tx({ date: '2026-08-15', type: 'income', amount: 1_000_000 }),
      tx({ date: '2026-09-01', type: 'expense', amount: 200_000 }),
      tx({ date: '2026-09-20', type: 'expense', amount: 300_000 }),
    ]);
    expect(points).toEqual([
      { year: 2026, month: 8, income: 1_000_000, expense: 0 },
      { year: 2026, month: 9, income: 0, expense: 500_000 },
    ]);
  });

  it("ignores cancelled ones (it doesn't even emit an empty point)", () => {
    const points = monthlySeries([tx({ amount: 999_999, status: 'cancelled' })]);
    expect(points).toEqual([]);
  });
});

describe('calculateFixedVsVariable', () => {
  it('splits on whether it has a recurringRuleId', () => {
    const result = calculateFixedVsVariable([
      tx({ amount: 2_500_000, recurringRuleId: 'r1' }),
      tx({ amount: 85_000 }),
    ]);
    expect(result).toEqual({ fixed: 2_500_000, variable: 85_000 });
  });
});

describe('calculateDebitVsCredit', () => {
  it('splits by payment method', () => {
    const creditIds = new Set(['pm-tc']);
    const result = calculateDebitVsCredit([
      tx({ amount: 100_000, paymentMethodId: 'pm-debito' }),
      tx({ amount: 50_000, paymentMethodId: 'pm-tc' }),
    ], creditIds);
    expect(result).toEqual({ debit: 100_000, credit: 50_000 });
  });
});
