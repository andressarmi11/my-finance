import { describe, expect, it } from 'vitest';
import type { RecurringRule } from '@/domain/types';
import { monthlyEquivalent, monthlyTotals } from './monthlyTotals';

const rule = (over: Partial<RecurringRule>): RecurringRule => ({
  id: 'r', name: 'x', type: 'expense', amount: 1200, categoryId: null, paymentMethodId: null,
  frequency: 'monthly', startDate: '2026-01-01', isActive: true, updatedAt: '', ...over,
});

describe('monthlyEquivalent', () => {
  it('scales each frequency to an average month', () => {
    expect(monthlyEquivalent(rule({ frequency: 'monthly' }))).toBe(1200);
    expect(monthlyEquivalent(rule({ frequency: 'biweekly' }))).toBe(2400);
    expect(monthlyEquivalent(rule({ frequency: 'yearly' }))).toBe(100);
    expect(monthlyEquivalent(rule({ frequency: 'weekly' }))).toBeCloseTo(5200);
    expect(monthlyEquivalent(rule({ frequency: 'custom', months: [6, 12] }))).toBe(200);
    expect(monthlyEquivalent(rule({ frequency: 'custom', interval: { every: 3, unit: 'months' } }))).toBe(400);
    expect(monthlyEquivalent(rule({ frequency: 'custom', interval: { every: 2, unit: 'weeks' } }))).toBeCloseTo(2600);
  });
});

describe('monthlyTotals', () => {
  it('splits income and expenses and skips paused rules', () => {
    expect(monthlyTotals([
      rule({ type: 'income', amount: 5_000_000 }),
      rule({ amount: 1_500_000 }),
      rule({ amount: 100_000, frequency: 'yearly' }),
      rule({ amount: 999_999, isActive: false }),
    ])).toEqual({ income: 5_000_000, expense: 1_508_333 });
  });
});
