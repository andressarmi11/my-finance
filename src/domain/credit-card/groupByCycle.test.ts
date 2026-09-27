import { describe, expect, it } from 'vitest';
import { groupByCard, groupByCycle } from './groupByCycle';
import type { PaymentMethod, Transaction } from '../types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? Math.random().toString(36), type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-01', categoryId: null, paymentMethodId: 'pm-tc', status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

describe('groupByCycle', () => {
  it('groups by payment date and sums the cycle total', () => {
    const groups = groupByCycle([
      tx({ amount: 150_000, cyclePaymentDate: '2026-11-02' }),
      tx({ amount: 210_000, cyclePaymentDate: '2026-11-02' }),
      tx({ amount: 80_000, cyclePaymentDate: '2026-12-02' }),
    ]);
    expect(groups).toHaveLength(2);
    const nov = groups.find((g) => g.paymentDate === '2026-11-02')!;
    expect(nov.total).toBe(360_000);
    expect(nov.count).toBe(2);
  });

  it('orders cycles from soonest to furthest', () => {
    const groups = groupByCycle([
      tx({ cyclePaymentDate: '2027-01-02' }),
      tx({ cyclePaymentDate: '2026-11-02' }),
    ]);
    expect(groups.map((g) => g.paymentDate)).toEqual(['2026-11-02', '2027-01-02']);
  });

  it('ignores cancelled ones and those with no payment date (not a card)', () => {
    const groups = groupByCycle([
      tx({ cyclePaymentDate: '2026-11-02', status: 'cancelled' }),
      tx({ cyclePaymentDate: undefined }),
    ]);
    expect(groups).toEqual([]);
  });
});

describe('groupByCard', () => {
  const visa: PaymentMethod = {
    id: 'tc-1', type: 'credit', name: 'Visa', isDefault: false,
    cutoffDay: 15, paymentDay: 2, creditLimit: 3_000_000, updatedAt: '',
  };
  const amex: PaymentMethod = {
    id: 'tc-2', type: 'credit', name: 'Amex', isDefault: false,
    cutoffDay: 5, paymentDay: 20, updatedAt: '',
  };
  const debit: PaymentMethod = {
    id: 'pm-debito', type: 'debit', name: 'Débito', isDefault: true, updatedAt: '',
  };

  /* The case that used to break the screen: two cards paid on the SAME
     day. Plain groupByCycle summed them into one row, and each card is
     paid separately. */
  it('does not mix two cards that fall on the same payment date', () => {
    const cards = groupByCard([visa, amex], [
      tx({ paymentMethodId: 'tc-1', amount: 100_000, cyclePaymentDate: '2026-11-02' }),
      tx({ paymentMethodId: 'tc-2', amount: 700_000, cyclePaymentDate: '2026-11-02' }),
    ], '2026-09-26');

    expect(cards).toHaveLength(2);
    expect(cards[0]!.cycles[0]!.total).toBe(100_000);
    expect(cards[1]!.cycles[0]!.total).toBe(700_000);
  });

  it("brings back each card's available credit, and null if it has no limit", () => {
    const cards = groupByCard([visa, amex], [
      tx({ paymentMethodId: 'tc-1', amount: 500_000, date: '2026-09-20', cyclePaymentDate: '2026-11-02' }),
    ], '2026-09-26');

    expect(cards[0]!.available).toEqual({ cupo: 3_000_000, used: 500_000, available: 2_500_000 });
    expect(cards[1]!.available).toBeNull();
  });

  it('a card with no purchases still shows up: its limit is information', () => {
    const cards = groupByCard([visa], [], '2026-09-26');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.cycles).toEqual([]);
    expect(cards[0]!.available!.available).toBe(3_000_000);
  });

  it('ignores methods that are not credit', () => {
    expect(groupByCard([debit], [tx({ paymentMethodId: 'pm-debito' })], '2026-09-26')).toEqual([]);
  });
});
