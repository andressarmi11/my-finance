import { describe, expect, it } from 'vitest';
import { calculateAvailableCredit, unpaidBalances } from './availableCredit';
import type { PaymentMethod, Transaction } from '../types';

const TODAY = '2026-09-26';

function card(over: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    id: 'tc-1', type: 'credit', name: 'Visa', isDefault: false,
    cutoffDay: 15, paymentDay: 2, creditLimit: 5_000_000, updatedAt: '', ...over,
  };
}

function expense(over: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36), type: 'expense', concept: 'x', amount: 100_000,
    date: '2026-09-20', categoryId: null, paymentMethodId: 'tc-1', status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...over,
  };
}

describe('calculateAvailableCredit', () => {
  it('deducts what has been bought and not paid from the limit', () => {
    const d = calculateAvailableCredit(card(), [expense({ amount: 1_200_000 })], TODAY)!;
    expect(d).toEqual({ cupo: 5_000_000, used: 1_200_000, available: 3_800_000 });
  });

  /* The leak that motivates the date filter: materialize.ts seeds
     recurring transactions with status 'pending' up to ~3 months ahead.
     Without this, a December subscription would eat into today's limit. */
  it('a future purchase does not consume the limit yet', () => {
    const d = calculateAvailableCredit(card(), [expense({ date: '2026-12-01', amount: 900_000 })], TODAY)!;
    expect(d.used).toBe(0);
    expect(d.available).toBe(5_000_000);
  });

  it('a purchase made today does consume the limit', () => {
    const d = calculateAvailableCredit(card(), [expense({ date: TODAY, amount: 400_000 })], TODAY)!;
    expect(d.used).toBe(400_000);
  });

  it('marking it paid frees up the limit', () => {
    const d = calculateAvailableCredit(card(), [expense({ amount: 800_000, status: 'paid' })], TODAY)!;
    expect(d.used).toBe(0);
  });

  it('a cancelled purchase never counted', () => {
    const d = calculateAvailableCredit(card(), [expense({ amount: 800_000, status: 'cancelled' })], TODAY)!;
    expect(d.used).toBe(0);
  });

  it('carries forward old unpaid amounts, even from another cycle', () => {
    const d = calculateAvailableCredit(card(), [
      expense({ date: '2026-06-10', amount: 300_000 }),
      expense({ date: '2026-09-20', amount: 200_000 }),
    ], TODAY)!;
    expect(d.used).toBe(500_000);
  });

  it('being over the limit shows as negative, not clamped to zero', () => {
    const d = calculateAvailableCredit(card({ creditLimit: 1_000_000 }), [expense({ amount: 1_500_000 })], TODAY)!;
    expect(d.available).toBe(-500_000);
  });

  it('with no limit set returns null: there is nothing to show', () => {
    expect(calculateAvailableCredit(card({ creditLimit: undefined }), [expense()], TODAY)).toBeNull();
  });

  it("does not count another card's purchases", () => {
    const d = calculateAvailableCredit(card(), [expense({ paymentMethodId: 'tc-2', amount: 999_999 })], TODAY)!;
    expect(d.used).toBe(0);
  });

  it('an income posted to the card does not consume the limit', () => {
    const d = calculateAvailableCredit(card(), [expense({ type: 'income', amount: 500_000 })], TODAY)!;
    expect(d.used).toBe(0);
  });
});

describe('calculateAvailableCredit with instalment purchases', () => {
  /* A fridge bought today in 12 instalments locks the WHOLE limit today,
     not 100,000 a month: that's what the bank does when you swipe the
     card. Future instalments have a future date, so without looking at
     purchaseDate they would fall outside the `<= today` filter. */
  it('locks the whole limit on the day of the purchase, not instalment by instalment', () => {
    const installments = Array.from({ length: 12 }, (_, i) => expense({
      amount: 100_000,
      date: `2026-${String(9 + i > 12 ? 9 + i - 12 : 9 + i).padStart(2, '0')}-20`,
      purchaseDate: '2026-09-20',
      installmentGroupId: 'g1',
      installmentNumber: i + 1,
      installmentCount: 12,
    }));
    const d = calculateAvailableCredit(card(), installments, TODAY)!;
    expect(d.used).toBe(1_200_000);
    expect(d.available).toBe(3_800_000);
  });

  it('marking one instalment paid frees up only that one', () => {
    const installments = [
      expense({ amount: 100_000, date: '2026-09-20', purchaseDate: '2026-09-20', status: 'paid' }),
      expense({ amount: 100_000, date: '2026-10-20', purchaseDate: '2026-09-20' }),
      expense({ amount: 100_000, date: '2026-11-20', purchaseDate: '2026-09-20' }),
    ];
    expect(calculateAvailableCredit(card(), installments, TODAY)!.used).toBe(200_000);
  });

  it('an instalment purchase not made yet consumes nothing', () => {
    const future = expense({ amount: 900_000, date: '2026-12-20', purchaseDate: '2026-12-20' });
    expect(calculateAvailableCredit(card(), [future], TODAY)!.used).toBe(0);
  });
});

describe('unpaidBalances', () => {
  const visa = card({ id: 'tc-1', name: 'Visa' });
  const amex = card({ id: 'tc-2', name: 'Amex' });

  it('lists the cycles whose payment date has passed and are still unpaid', () => {
    const balances = unpaidBalances([visa], [
      expense({ amount: 300_000, cyclePaymentDate: '2026-08-02' }),
      expense({ amount: 200_000, cyclePaymentDate: '2026-08-02' }),
    ], TODAY);
    expect(balances).toHaveLength(1);
    expect(balances[0]).toMatchObject({ paymentDate: '2026-08-02', total: 500_000, count: 2 });
    expect(balances[0]!.card.name).toBe('Visa');
  });

  it('a cycle not due yet is not an overdue balance', () => {
    expect(unpaidBalances([visa], [expense({ cyclePaymentDate: '2026-11-02' })], TODAY)).toEqual([]);
  });

  it('a cycle already paid disappears from the alert', () => {
    const balances = unpaidBalances([visa], [
      expense({ cyclePaymentDate: '2026-08-02', status: 'paid' }),
    ], TODAY);
    expect(balances).toEqual([]);
  });

  it('separates by card even when they share a payment date', () => {
    const balances = unpaidBalances([visa, amex], [
      expense({ paymentMethodId: 'tc-1', amount: 100_000, cyclePaymentDate: '2026-08-02' }),
      expense({ paymentMethodId: 'tc-2', amount: 700_000, cyclePaymentDate: '2026-08-02' }),
    ], TODAY);
    expect(balances).toHaveLength(2);
    expect(balances.map((s) => s.card.name).sort()).toEqual(['Amex', 'Visa']);
  });

  it('oldest first: that is the most urgent', () => {
    const balances = unpaidBalances([visa], [
      expense({ cyclePaymentDate: '2026-09-02' }),
      expense({ cyclePaymentDate: '2026-07-02' }),
      expense({ cyclePaymentDate: '2026-08-02' }),
    ], TODAY);
    expect(balances.map((s) => s.paymentDate)).toEqual(['2026-07-02', '2026-08-02', '2026-09-02']);
  });
});
