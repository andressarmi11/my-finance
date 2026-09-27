import { describe, expect, it } from 'vitest';
import { groupByPeriod } from './groupByPeriod';
import type { Transaction } from '@/domain/types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? Math.random().toString(36), type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-10', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

describe('groupByPeriod', () => {
  it('groups by pay period and sorts them chronologically: the 10th before the 25th', () => {
    const groups = groupByPeriod([
      tx({ date: '2026-09-10', amount: 10_000 }),
      tx({ date: '2026-09-25', amount: 20_000 }),
      tx({ date: '2026-08-12', amount: 5_000 }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-08-Q1', '2026-09-Q1', '2026-09-Q2']);
  });

  it('assigns the correct color and label based on Q1/Q2', () => {
    const groups = groupByPeriod([tx({ date: '2026-09-10' }), tx({ date: '2026-09-25' })]);
    const q1 = groups.find((g) => g.key === '2026-09-Q1')!;
    const q2 = groups.find((g) => g.key === '2026-09-Q2')!;
    expect(q1.label).toBe('Quincena del 10');
    expect(q1.colorVar).toBe('--q10');
    expect(q2.label).toBe('Quincena del 25');
    expect(q2.colorVar).toBe('--q25');
  });

  it("each group's balance matches calculatePeriodBalance", () => {
    const groups = groupByPeriod([
      tx({ date: '2026-09-10', type: 'income', amount: 1_000_000 }),
      tx({ date: '2026-09-12', type: 'expense', amount: 300_000 }),
    ]);
    const q1 = groups.find((g) => g.key === '2026-09-Q1')!;
    expect(q1.balance.remainder).toBe(700_000);
  });

  it('no transactions means no groups', () => {
    expect(groupByPeriod([])).toEqual([]);
  });

  /**
   * The case that used to break: the card purchase is LISTED in September
   * but the money leaves in the October 25th pay period. If October's
   * header only looked at what October lists, it would show a different
   * remaining amount than the one the dashboard shows for that same
   * period.
   */
  it("a period's remaining amount counts the card purchase even if it's listed in another month", () => {
    const cardPurchase = tx({
      date: '2026-09-20', amount: 500_000,
      cycleCutoffDate: '2026-10-15', cyclePaymentDate: '2026-11-02',
    });
    const octoberSalary = tx({ date: '2026-10-25', type: 'income', amount: 2_000_000 });
    const all = [cardPurchase, octoberSalary];

    // What October's screen lists: only the salary.
    const groups = groupByPeriod([octoberSalary], [10, 25], all);
    const q2 = groups.find((g) => g.key === '2026-10-Q2')!;

    expect(q2.transactions).toHaveLength(1);
    expect(q2.balance.expense).toBe(500_000);
    expect(q2.balance.remainder).toBe(1_500_000);
  });
});
