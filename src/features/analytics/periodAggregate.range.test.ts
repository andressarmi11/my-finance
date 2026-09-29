import { describe, expect, it } from 'vitest';
import { containsToday, filterByRange, rangeBounds, shiftAnchor } from './periodAggregate';
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

describe('paging through ranges', () => {
  it('moves a month back and forth, across the year boundary', () => {
    expect(shiftAnchor('mes', '2026-09-26', -1)).toBe('2026-08-31');
    expect(shiftAnchor('mes', '2026-12-10', 1)).toBe('2027-01-01');
    expect(rangeBounds('mes', shiftAnchor('mes', '2026-01-15', -1))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('moves a quarter and a year as whole units', () => {
    expect(rangeBounds('trimestre', shiftAnchor('trimestre', '2026-09-26', 1))).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(rangeBounds('año', shiftAnchor('año', '2026-09-26', -1))).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });

  it('moves a pay period to the neighbouring pay period, not by calendar', () => {
    const now = rangeBounds('quincena', '2026-09-26', [10, 25]);
    const next = rangeBounds('quincena', shiftAnchor('quincena', '2026-09-26', 1, [10, 25]), [10, 25]);
    const prev = rangeBounds('quincena', shiftAnchor('quincena', '2026-09-26', -1, [10, 25]), [10, 25]);
    expect(next.from > now.to).toBe(true);
    expect(prev.to < now.from).toBe(true);
    // No gap and no overlap between neighbours.
    expect(shiftAnchor('quincena', now.to, 1, [10, 25])).toBe(next.from);
  });

  it('knows when the range shown is the current one', () => {
    expect(containsToday('mes', '2026-09-01', TODAY)).toBe(true);
    expect(containsToday('mes', '2026-08-31', TODAY)).toBe(false);
    expect(containsToday('año', '2026-01-01', TODAY)).toBe(true);
  });
});

describe('paging never stalls or skips, for any pay days', () => {
  const PAY_DAYS = [[10, 25], [15], [1], [31], [30], [29, 30, 31], [10, 31]];
  const RANGES = ['quincena', 'mes', 'trimestre', 'año'] as const;
  // Every ~5 days across three years, Feb 29 2024 included.
  const anchors: string[] = [];
  for (let t = Date.UTC(2024, 0, 1); t <= Date.UTC(2026, 11, 31); t += 5 * 86_400_000) {
    anchors.push(new Date(t).toISOString().slice(0, 10));
  }
  anchors.push('2024-02-29');

  it('the next range starts the day after the current one ends, and back returns', () => {
    for (const payDays of PAY_DAYS) {
      for (const range of RANGES) {
        for (const a of anchors) {
          const now = rangeBounds(range, a, payDays);
          const next = shiftAnchor(range, a, 1, payDays);
          const prev = shiftAnchor(range, a, -1, payDays);
          // Leaves the current range in both directions — no dead taps.
          expect(containsToday(range, a, next, payDays)).toBe(false);
          expect(containsToday(range, a, prev, payDays)).toBe(false);
          // Contiguous: nothing between this range and the next one.
          expect(rangeBounds(range, next, payDays).from).toBe(next);
          expect(shiftAnchor(range, now.to, 1, payDays)).toBe(next);
          // One step forward and one back lands in the range we started from.
          expect(containsToday(range, shiftAnchor(range, next, -1, payDays), a, payDays)).toBe(true);
        }
      }
    }
  });
});
