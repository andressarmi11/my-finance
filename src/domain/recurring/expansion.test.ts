import { describe, expect, it } from 'vitest';
import { expandRecurringRule } from './expansion';
import type { RecurringRule } from '../types';

function rule(overrides: Partial<RecurringRule>): RecurringRule {
  return {
    id: 'r1',
    name: 'Arriendo',
    type: 'expense',
    amount: 2_500_000,
    categoryId: null,
    paymentMethodId: null,
    frequency: 'monthly',
    dayOfMonth: 1,
    startDate: '2026-01-01',
    isActive: true,
    updatedAt: '',
    ...overrides,
  };
}

describe('expandRecurringRule — mensual', () => {
  it('generates one instance per month with periodKey YYYY-MM', () => {
    const occ = expandRecurringRule(rule({}), { from: '2026-01-01', to: '2026-12-31' });
    expect(occ).toHaveLength(12);
    expect(occ[0]).toEqual({ periodKey: '2026-01', date: '2026-01-01' });
    expect(occ[11]).toEqual({ periodKey: '2026-12', date: '2026-12-01' });
  });

  it('clamps dayOfMonth in short months (31 -> 28/30 depending on the month)', () => {
    const occ = expandRecurringRule(
      rule({ dayOfMonth: 31, startDate: '2026-01-01' }),
      { from: '2026-01-01', to: '2026-04-30' },
    );
    expect(occ.map((o) => o.date)).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
    ]);
  });

  it('respects endDate: it generates no instances after the rule ended', () => {
    const occ = expandRecurringRule(
      rule({ dayOfMonth: 1, endDate: '2026-03-15' }),
      { from: '2026-01-01', to: '2026-06-30' },
    );
    expect(occ.map((o) => o.periodKey)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('an inactive rule generates nothing', () => {
    const occ = expandRecurringRule(rule({ isActive: false }), { from: '2026-01-01', to: '2026-12-31' });
    expect(occ).toEqual([]);
  });

  it("it's idempotent: calling it twice with the same range gives exactly the same result", () => {
    const r = rule({});
    const range = { from: '2026-01-01', to: '2026-06-30' };
    expect(expandRecurringRule(r, range)).toEqual(expandRecurringRule(r, range));
  });

  it('it generates nothing before startDate', () => {
    const occ = expandRecurringRule(
      rule({ dayOfMonth: 1, startDate: '2026-06-01' }),
      { from: '2026-01-01', to: '2026-12-31' },
    );
    expect(occ.map((o) => o.periodKey)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
  });
});

describe('expandRecurringRule — semanal / quincenal', () => {
  it('weekly generates every 7 days from the anchor', () => {
    const occ = expandRecurringRule(
      rule({ frequency: 'weekly', startDate: '2026-09-07', dayOfMonth: undefined }),
      { from: '2026-09-01', to: '2026-09-30' },
    );
    expect(occ.map((o) => o.date)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
  });

  it('biweekly generates every 14 days', () => {
    const occ = expandRecurringRule(
      rule({ frequency: 'biweekly', startDate: '2026-09-01', dayOfMonth: undefined }),
      { from: '2026-09-01', to: '2026-10-31' },
    );
    expect(occ.map((o) => o.date)).toEqual(['2026-09-01', '2026-09-15', '2026-09-29', '2026-10-13', '2026-10-27']);
  });
});

describe('expandRecurringRule — anual', () => {
  it('generates one instance per year on the anniversary', () => {
    const occ = expandRecurringRule(
      rule({ frequency: 'yearly', startDate: '2024-06-09', dayOfMonth: undefined }),
      { from: '2024-01-01', to: '2027-12-31' },
    );
    expect(occ.map((o) => o.date)).toEqual(['2024-06-09', '2025-06-09', '2026-06-09', '2027-06-09']);
  });

  it('clamps February 29th in non-leap years', () => {
    const occ = expandRecurringRule(
      rule({ frequency: 'yearly', startDate: '2024-02-29', dayOfMonth: undefined }),
      { from: '2024-01-01', to: '2027-12-31' },
    );
    expect(occ.map((o) => o.date)).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28']);
  });
});
