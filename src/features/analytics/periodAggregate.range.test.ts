import { describe, expect, it } from 'vitest';
import { filterByRange, rangeBounds } from './periodAggregate';
import type { Transaction } from '@/domain/types';

const TODAY = '2026-09-26';

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36), type: 'expense', concept: 'x', amount: 1000,
    date: '2026-09-20', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...over,
  };
}

describe('rangeBounds — calendar ranges for month, quarter and year', () => {
  it('month runs from the 1st to the last day', () => {
    expect(rangeBounds('mes', TODAY, [10, 25])).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('quarter is the calendar quarter containing it', () => {
    expect(rangeBounds('trimestre', TODAY, [10, 25])).toEqual({ from: '2026-07-01', to: '2026-09-30' });
  });

  it('year is the calendar year', () => {
    expect(rangeBounds('año', TODAY, [10, 25])).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('rangeBounds — the pay period comes from YOUR pay days, not the calendar', () => {
  /* It's the only one of the four that isn't a calendar range. September
     26th falls in the 25th pay period, which runs Sep 25 to Oct 9. */
  it('September 26th falls in the 25th pay period, which crosses into the next month', () => {
    expect(rangeBounds('quincena', TODAY, [10, 25])).toEqual({ from: '2026-09-25', to: '2026-10-09' });
  });

  it('with different pay days, a different window', () => {
    expect(rangeBounds('quincena', TODAY, [1, 16])).toEqual({ from: '2026-09-16', to: '2026-09-30' });
  });

  /* If you get paid once a month there's no half period: the range is the
     whole month from your pay day. */
  it('in monthly mode it returns the whole period, not half of one', () => {
    expect(rangeBounds('quincena', TODAY, [1])).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('filterByRange — counts by when the money LEAVES', () => {
  /* The bug this spec fixes: the purchase was made on September 20th but
     gets paid on November 2nd. Analytics counted it in September. */
  it("a card purchase counts in the month it's paid, not the one it was made in", () => {
    const purchase = tx({ date: '2026-09-20', cyclePaymentDate: '2026-11-02' });
    expect(filterByRange([purchase], 'mes', TODAY, [10, 25])).toEqual([]);
    expect(filterByRange([purchase], 'mes', '2026-11-15', [10, 25])).toHaveLength(1);
  });

  it('an expense without a card counts where it was made: nothing changes', () => {
    const expense = tx({ date: '2026-09-20' });
    expect(filterByRange([expense], 'mes', TODAY, [10, 25])).toHaveLength(1);
  });

  it("each instalment of a plan lands in the month it's paid", () => {
    const installments = [
      tx({ date: '2026-09-20', cyclePaymentDate: '2026-11-02', purchaseDate: '2026-09-20' }),
      tx({ date: '2026-10-20', cyclePaymentDate: '2026-12-02', purchaseDate: '2026-09-20' }),
    ];
    expect(filterByRange(installments, 'mes', '2026-11-15', [10, 25])).toHaveLength(1);
    expect(filterByRange(installments, 'mes', '2026-12-15', [10, 25])).toHaveLength(1);
  });
});
