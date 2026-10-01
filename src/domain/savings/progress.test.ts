import { describe, expect, it } from 'vitest';
import { calMonths, goalEndDate, planEndDate, planProgress } from './progress';
import type { ProgressInput } from './types';
import type { Transaction } from '../types';

let seq = 0;
function tx(o: Partial<Transaction>): Transaction {
  return {
    id: `t${++seq}`, type: 'expense', concept: 'x', amount: 0,
    date: '2026-10-01', categoryId: 'cat-entretenimiento', paymentMethodId: null, status: 'paid',
    quincenaKey: null, createdAt: '', updatedAt: '', ...o,
  };
}

const plan: ProgressInput['plan'] = {
  startDate: '2026-10-01',
  endDate: '2027-03-31',
  monthlyTarget: 300_000,
  cuts: [{ categoryId: 'cat-entretenimiento', avg: 200_000, cut: 60_000, limit: 140_000 }],
};

function input(o: Partial<ProgressInput> = {}): ProgressInput {
  return { plan, from: '2026-10-01', to: '2026-10-31', isPayPeriod: false, today: '2026-10-16', transactions: [], ...o };
}

describe('calMonths', () => {
  it('adds each month as days covered / days in month', () => {
    expect(calMonths('2026-10-01', '2026-10-31')).toBe(1);
    expect(calMonths('2026-10-01', '2026-12-31')).toBe(3);
    expect(calMonths('2026-02-15', '2026-03-15')).toBe(0.984); // 14/28 + 15/31
    expect(calMonths('2026-10-02', '2026-10-01')).toBe(0);
  });
});

describe('planProgress', () => {
  it('a period before the plan: not started; after it: ended', () => {
    expect(planProgress(input({ from: '2026-09-01', to: '2026-09-30' }))).toEqual({ covers: false, reason: 'notStarted' });
    expect(planProgress(input({ from: '2027-04-01', to: '2027-04-30' }))).toEqual({ covers: false, reason: 'ended' });
  });

  it('a pay period counts at most half a month', () => {
    const r = planProgress(input({ to: '2026-10-20', isPayPeriod: true }));
    if (!r.covers) throw new Error('covers');
    expect(r.planMonths).toBe(0.5);
    expect(r.goal).toBe(150_000);
    expect(r.rows[0]!.top).toBe(70_000);
    const q1 = planProgress(input({ to: '2026-10-15', isPayPeriod: true }));
    if (!q1.covers) throw new Error('covers');
    expect(q1.planMonths).toBeLessThanOrEqual(0.5);
  });

  it('pace, spent, ahead and saved halfway through the month', () => {
    const r = planProgress(
      input({
        transactions: [
          tx({ amount: 60_000, date: '2026-10-03' }),
          tx({ amount: 40_000, date: '2026-10-12' }),
          tx({ amount: 50_000, date: '2026-10-20' }), // after today
          tx({ amount: 90_000, date: '2026-10-05', status: 'cancelled' }),
          tx({ amount: 70_000, date: '2026-09-28' }), // before the period
          tx({ amount: 30_000, date: '2026-10-05', categoryId: 'cat-otros' }),
        ],
      }),
    );
    if (!r.covers) throw new Error('covers');
    expect(r.planMonths).toBe(1);
    expect(r.elapsedMonths).toBe(0.516);
    expect(r.pace).toBe(0.516);
    expect(r.started).toBe(true);
    expect(r.goal).toBe(300_000);
    expect(r.rows).toEqual([{ categoryId: 'cat-entretenimiento', spent: 100_000, top: 140_000, ahead: true, exceeded: false }]);
    expect(r.saved).toBe(3_000); // round1000(200k × 0.516) − 100k
  });

  it('on pace is not ahead; over the top is exceeded', () => {
    const onPace = planProgress(input({ transactions: [tx({ amount: 70_000, date: '2026-10-03' })] }));
    if (!onPace.covers) throw new Error('covers');
    expect(onPace.rows[0]!.ahead).toBe(false);
    const over = planProgress(input({ transactions: [tx({ amount: 150_000, date: '2026-10-03' })] }));
    if (!over.covers) throw new Error('covers');
    expect(over.rows[0]!.exceeded).toBe(true);
    expect(over.saved).toBe(0);
  });

  it('a plan starting after today has not started yet', () => {
    const r = planProgress(input({ today: '2026-09-30' }));
    if (!r.covers) throw new Error('covers');
    expect(r.elapsedMonths).toBe(0);
    expect(r.pace).toBe(0);
    expect(r.started).toBe(false);
    expect(r.rows[0]!.ahead).toBe(false);
  });

  it('projects to December of the period year, within the plan', () => {
    const r = planProgress(input());
    if (!r.covers) throw new Error('covers');
    expect(r.monthsToDecember).toBe(3);
    expect(r.projection).toBe(900_000);
    const short = planProgress(input({ plan: { ...plan, endDate: '2026-11-15' } }));
    if (!short.covers) throw new Error('covers');
    expect(short.monthsToDecember).toBe(1.5);
    expect(short.projection).toBe(450_000);
  });
});

describe('planEndDate / goalEndDate', () => {
  it('inclusive end for each unit', () => {
    expect(planEndDate('2026-10-01', 'days', 10)).toBe('2026-10-10');
    expect(planEndDate('2026-10-01', 'weeks', 2)).toBe('2026-10-14');
    expect(planEndDate('2026-10-01', 'months', 3)).toBe('2026-12-31');
    expect(planEndDate('2026-10-15', 'months', 1)).toBe('2026-11-14');
    expect(planEndDate('2026-10-01', 'year', 1)).toBe('2027-09-30');
    expect(goalEndDate('2026-10-01', 6)).toBe('2027-03-31');
  });

  it('a start day the end month lacks ends on its last day', () => {
    expect(planEndDate('2026-01-31', 'months', 1)).toBe('2026-02-28');
    expect(planEndDate('2026-01-30', 'months', 1)).toBe('2026-02-28');
  });
});
