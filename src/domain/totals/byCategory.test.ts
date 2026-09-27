import { describe, expect, it } from 'vitest';
import { calculateSpendByCategory } from './byCategory';
import type { Transaction } from '../types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? Math.random().toString(36), type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-01', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

describe('calculateSpendByCategory', () => {
  it('adds up per category and sorts high to low', () => {
    const result = calculateSpendByCategory([
      tx({ categoryId: 'viajes', amount: 850_000 }),
      tx({ categoryId: 'alimentacion', amount: 600_000 }),
      tx({ categoryId: 'hogar', amount: 2_100_000 }),
    ]);
    expect(result.map((r) => r.categoryId)).toEqual(['hogar', 'viajes', 'alimentacion']);
  });

  it('ignora ingresos y cancelados', () => {
    const result = calculateSpendByCategory([
      tx({ categoryId: 'hogar', amount: 100_000, type: 'income' }),
      tx({ categoryId: 'hogar', amount: 999_999, status: 'cancelled' }),
      tx({ categoryId: 'hogar', amount: 50_000 }),
    ]);
    expect(result).toEqual([{ categoryId: 'hogar', amount: 50_000, count: 1 }]);
  });

  it('groups uncategorized under null', () => {
    const result = calculateSpendByCategory([tx({ categoryId: null, amount: 10_000 })]);
    expect(result[0]?.categoryId).toBeNull();
  });
});
