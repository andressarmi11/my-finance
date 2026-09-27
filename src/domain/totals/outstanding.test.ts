import { describe, expect, it } from 'vitest';
import { calculateOutstanding } from './outstanding';
import { calculateMonthFlow } from './available';
import type { Transaction } from '../types';

function tx(o: Partial<Transaction>): Transaction {
  return {
    id: o.id ?? Math.random().toString(36), type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-12', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...o,
  };
}

describe('calculateOutstanding', () => {
  it('THE BUG: a pending expense on a card was counted twice', () => {
    const onCard = tx({ id: 'tc', amount: 210_000, status: 'pending', cyclePaymentDate: '2026-11-02' });
    const r = calculateOutstanding([onCard]);

    expect(r.count).toBe(1);
    expect(r.amount).toBe(210_000);
    expect(r.onCard).toHaveLength(1);
    expect(r.pending).toHaveLength(0); // antes caía acá TAMBIÉN
  });

  it('the three sets are disjoint and add up to the total', () => {
    const r = calculateOutstanding([
      tx({ id: 'a', amount: 100, status: 'pending' }),
      tx({ id: 'b', amount: 200, status: 'scheduled' }),
      tx({ id: 'c', amount: 300, status: 'pending', cyclePaymentDate: '2026-11-02' }),
      tx({ id: 'd', amount: 400, status: 'scheduled', cyclePaymentDate: '2026-11-02' }),
    ]);
    expect(r.pending.map((t) => t.id)).toEqual(['a']);
    expect(r.scheduled.map((t) => t.id)).toEqual(['b']);
    expect(r.onCard.map((t) => t.id)).toEqual(['c', 'd']);
    expect(r.pending.length + r.scheduled.length + r.onCard.length).toBe(r.count);
    expect(r.amount).toBe(1000);
  });

  it('the total ALWAYS matches the hero’s "left to pay"', () => {
    // This is the contradiction the user saw: the sheet said more than the
    // number that opened it.
    const list = [
      tx({ amount: 145_000, status: 'pending' }),
      tx({ amount: 210_000, status: 'pending', cyclePaymentDate: '2026-11-02' }),
      tx({ amount: 200_000, status: 'scheduled' }),
      tx({ amount: 999, status: 'paid' }),
      tx({ amount: 999, status: 'cancelled' }),
      tx({ amount: 999, type: 'income', status: 'pending' }),
    ];
    expect(calculateOutstanding(list).amount).toBe(calculateMonthFlow(list).toPay);
  });

  it('ignora pagados, cancelados e ingresos', () => {
    const r = calculateOutstanding([
      tx({ status: 'paid', amount: 1 }),
      tx({ status: 'cancelled', amount: 1 }),
      tx({ type: 'income', status: 'pending', amount: 1 }),
    ]);
    expect(r.count).toBe(0);
    expect(r.amount).toBe(0);
  });

  it("with nothing pending it gives zero, it doesn't blow up", () => {
    expect(calculateOutstanding([]).count).toBe(0);
  });
});
