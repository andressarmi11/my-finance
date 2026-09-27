import { describe, expect, it } from 'vitest';
import { calculateMonthBalance, calculatePeriodBalance } from './balance';
import { withResolvedPeriods } from './resolve';
import type { Transaction } from '../types';

/** Rebuilds September's sheet from the brief, with made-up data. */
function septemberFixture(): Transaction[] {
  const base = { notes: undefined, quincenaKey: null, createdAt: '', updatedAt: '' } as const;
  return [
    // The 10th pay period (Sep 10 - Sep 24)
    { id: '1', type: 'expense', concept: 'iCloud', amount: 13_000, date: '2026-09-10', categoryId: null, paymentMethodId: null, status: 'pending', ...base },
    { id: '2', type: 'expense', concept: 'DGO', amount: 94_000, date: '2026-09-10', categoryId: null, paymentMethodId: null, status: 'pending', ...base },
    { id: '3', type: 'expense', concept: 'Pago plan celular', amount: 48_000, date: '2026-09-12', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '4', type: 'expense', concept: 'Pago compras TC', amount: 1_500_000, date: '2026-09-14', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '5', type: 'expense', concept: 'Viaje Brasil', amount: 500_000, date: '2026-09-14', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '6', type: 'income', concept: 'Retorno a bolsillo/casa', amount: 1_000_000, date: '2026-09-10', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    // The 10th pay period's income (not in the image; inferred from the remainder)
    { id: '7', type: 'income', concept: 'Ingreso quincena 10', amount: 2_370_000, date: '2026-09-10', categoryId: null, paymentMethodId: null, status: 'paid', ...base },

    // The 25th pay period (Sep 25 - Oct 9)
    { id: '8', type: 'expense', concept: 'Arriendo', amount: 2_500_000, date: '2026-10-01', categoryId: null, paymentMethodId: null, status: 'pending', ...base },
    { id: '9', type: 'expense', concept: 'Apple Music', amount: 9_900, date: '2026-09-25', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '10', type: 'expense', concept: 'Gym', amount: 100_000, date: '2026-09-25', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '11', type: 'expense', concept: 'Coomeva', amount: 175_094, date: '2026-09-25', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '12', type: 'income', concept: 'Ingreso quincena 25', amount: 3_952_000, date: '2026-09-25', categoryId: null, paymentMethodId: null, status: 'paid', ...base },

    // A cancelled one: it must not affect any total.
    { id: '13', type: 'expense', concept: 'Compra cancelada', amount: 999_999, date: '2026-09-12', categoryId: null, paymentMethodId: null, status: 'cancelled', ...base },
  ];
}

describe('calculatePeriodBalance', () => {
  it("the 10th pay period's remainder == 1,215,000 (checked against the real sheet)", () => {
    const withKeys = withResolvedPeriods(septemberFixture());
    const balance = calculatePeriodBalance(withKeys, '2026-09-Q1');
    expect(balance.remainder).toBe(1_215_000);
  });

  it("the 25th pay period's remainder == 1,167,006, including the Rent paid on October 1st", () => {
    const withKeys = withResolvedPeriods(septemberFixture());
    const balance = calculatePeriodBalance(withKeys, '2026-09-Q2');
    expect(balance.remainder).toBe(1_167_006);
  });

  it('ignores cancelled transactions', () => {
    const withKeys = withResolvedPeriods(septemberFixture());
    const balance = calculatePeriodBalance(withKeys, '2026-09-Q1');
    // if the cancelled one counted, the remainder would be 1,215,000 - 999,999
    expect(balance.expense).not.toBe(1_500_000 + 94_000 + 13_000 + 999_999);
  });
});

describe('calculateMonthBalance', () => {
  it("the month's leftover == the sum of both remainders == 2,382,006", () => {
    const withKeys = withResolvedPeriods(septemberFixture());
    const month = calculateMonthBalance(withKeys, 2026, 9);
    expect(month.leftover).toBe(2_382_006);
    // The periods are a list now, not always two: the leftover is the sum
    // of however many there are.
    expect(month.periods).toHaveLength(2);
    expect(month.leftover).toBe(month.periods.reduce((a, p) => a + p.remainder, 0));
  });

  it("with a single pay day there's one period and the leftover is its own", () => {
    const withKeys = withResolvedPeriods(septemberFixture(), [1]);
    const month = calculateMonthBalance(withKeys, 2026, 9, [1]);
    expect(month.periods).toHaveLength(1);
    expect(month.leftover).toBe(month.periods[0]?.remainder);
  });
});
