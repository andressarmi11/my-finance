import { describe, expect, it } from 'vitest';
import { calculateMonthFlow } from './available';
import type { Transaction } from '../types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    type: 'expense',
    concept: 'x',
    amount: 0,
    date: '2026-09-01',
    categoryId: null,
    paymentMethodId: null,
    status: 'paid',
    quincenaKey: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('calculateMonthFlow', () => {
  it('splits received / to receive / paid / to pay', () => {
    const f = calculateMonthFlow([
      tx({ type: 'income', amount: 3_000_000, status: 'paid' }),
      tx({ type: 'income', amount: 1_000_000, status: 'pending' }),
      tx({ type: 'expense', amount: 800_000, status: 'paid' }),
      tx({ type: 'expense', amount: 500_000, status: 'scheduled' }),
    ]);
    expect(f).toMatchObject({
      received: 3_000_000, toReceive: 1_000_000, paid: 800_000, toPay: 500_000,
    });
  });

  it('ignora cancelados', () => {
    const f = calculateMonthFlow([tx({ type: 'expense', amount: 999, status: 'cancelled' })]);
    expect(f.paid).toBe(0);
    expect(f.toPay).toBe(0);
  });

  it("netSoFar is what's already happened and projected is the whole month", () => {
    const f = calculateMonthFlow([
      tx({ type: 'income', amount: 2_000_000, status: 'paid' }),
      tx({ type: 'income', amount: 2_000_000, status: 'pending' }),
      tx({ type: 'expense', amount: 3_000_000, status: 'paid' }),
      tx({ type: 'expense', amount: 500_000, status: 'pending' }),
    ]);
    expect(f.netSoFar).toBe(-1_000_000);
    expect(f.projected).toBe(500_000);
  });

  it('none of the four components is ever negative', () => {
    const f = calculateMonthFlow([
      tx({ type: 'expense', amount: 100, status: 'pending' }),
    ]);
    for (const n of [f.received, f.toReceive, f.paid, f.toPay]) expect(n).toBeGreaterThanOrEqual(0);
  });
});
