import { describe, expect, it } from 'vitest';
import { calculatePeriod } from './period';
import { calculateMonthBalance, calculatePeriodBalance } from './balance';
import { withResolvedPeriods, resolveChargePeriod } from './resolve';
import { calculateCreditCardCycle } from '../credit-card/cycle';
import type { Transaction } from '../types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36), type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-20', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

/** Card purchase on September 20th, cutoff 15 and payment 2 -> paid on November 2nd. */
function cardPurchase(amount: number): Transaction {
  const cycle = calculateCreditCardCycle('2026-09-20', 15, 2);
  return tx({
    amount, date: '2026-09-20',
    cycleCutoffDate: cycle.cycleCutoff, cyclePaymentDate: cycle.paymentDate,
  });
}

describe('the pay period a payment date falls in (what the domain already knew)', () => {
  it("November 2nd is paid from OCTOBER's 25th pay period, which runs from the 25th to the 9th", () => {
    const p = calculatePeriod('2026-11-02', [10, 25]);
    expect(p.key).toBe('2026-10-Q2');
    expect(p.start).toBe('2026-10-25');
    expect(p.end).toBe('2026-11-09');
  });

  it('if you get paid once a month, November 2nd falls in November as a whole', () => {
    const p = calculatePeriod('2026-11-02', [1]);
    expect(p.key).toBe('2026-11-Q1');
    expect(p.start).toBe('2026-11-01');
    expect(p.end).toBe('2026-11-30');
  });
});

describe('resolveChargePeriod — when the money LEAVES', () => {
  it("a card purchase is charged in its payment date's period, not the purchase's", () => {
    expect(resolveChargePeriod(cardPurchase(500_000), [10, 25])).toBe('2026-10-Q2');
  });

  it('an expense without a card is charged where it was made: nothing changes', () => {
    expect(resolveChargePeriod(tx({ date: '2026-09-20' }), [10, 25])).toBe('2026-09-Q1');
  });

  it("if you moved it by hand, your decision beats the card's cycle", () => {
    const moved = { ...cardPurchase(500_000), quincenaKey: '2026-09-Q2' };
    expect(resolveChargePeriod(moved, [10, 25])).toBe('2026-09-Q2');
  });
});

describe("the balance deducts the card purchase in the pay period it's paid in", () => {
  const txs = [
    tx({ type: 'income', amount: 3_000_000, date: '2026-09-10' }), // salary, Q1 of September
    cardPurchase(500_000),                                            // compra 20 sep, paga 2 nov
  ];

  it("the purchase's pay period keeps the record but NOT the deduction", () => {
    const resolved = withResolvedPeriods(txs, [10, 25]);

    // The record stays in the pay period the purchase was made in.
    const purchase = resolved.find((t) => t.amount === 500_000)!;
    expect(purchase.recordPeriodKey).toBe('2026-09-Q1');

    // But that pay period's money is left untouched.
    const q1 = calculatePeriodBalance(resolved, '2026-09-Q1');
    expect(q1.expense).toBe(0);
    expect(q1.remainder).toBe(3_000_000);
  });

  it('the pay period the statement is paid in does deduct it', () => {
    const resolved = withResolvedPeriods(txs, [10, 25]);
    const charge = calculatePeriodBalance(resolved, '2026-10-Q2');
    expect(charge.expense).toBe(500_000);
    expect(charge.remainder).toBe(-500_000);
  });

  it("September as a whole doesn't lose money that hasn't left yet", () => {
    const sept = calculateMonthBalance(withResolvedPeriods(txs, [10, 25]), 2026, 9, [10, 25]);
    expect(sept.expense).toBe(0);
    expect(sept.leftover).toBe(3_000_000);
  });

  it('in monthly mode the charge lands in November, not September', () => {
    const resolved = withResolvedPeriods(txs, [1]);
    expect(calculateMonthBalance(resolved, 2026, 9, [1]).expense).toBe(0);
    expect(calculateMonthBalance(resolved, 2026, 11, [1]).expense).toBe(500_000);
  });
});
