import { afterEach, describe, expect, it, vi } from 'vitest';
import { filterByRange, untilToday, rangeBounds, fillGaps, toMonthlyPoints, toQuarterlyPoints, toYearlyPoints, type Range } from './periodAggregate';
import type { Transaction } from '@/domain/types';
import type { MonthPoint } from '@/domain/analytics/series';
import { todayISO } from '@/lib/todayISO';

describe('toQuarterlyPoints', () => {
  it('groups months into their correct quarter', () => {
    const points: MonthPoint[] = [
      { year: 2026, month: 1, income: 100, expense: 50 },
      { year: 2026, month: 2, income: 100, expense: 50 },
      { year: 2026, month: 4, income: 200, expense: 0 },
    ];
    const result = toQuarterlyPoints(points);
    expect(result).toEqual([
      { label: 'T1 26', income: 200, expense: 100 },
      { label: 'T2 26', income: 200, expense: 0 },
    ]);
  });
});

describe('toYearlyPoints', () => {
  it('groups months by year', () => {
    const points: MonthPoint[] = [
      { year: 2025, month: 12, income: 100, expense: 0 },
      { year: 2026, month: 1, income: 50, expense: 20 },
    ];
    expect(toYearlyPoints(points)).toEqual([
      { label: '2025', income: 100, expense: 0 },
      { label: '2026', income: 50, expense: 20 },
    ]);
  });
});

describe('rangeBounds — paid on the 1st, the calendar ranges', () => {
  it('month: from the 1st to the last day of the current month', () => {
    expect(rangeBounds('mes', '2026-09-18', [1])).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('month: respects a leap-year February', () => {
    expect(rangeBounds('mes', '2024-02-10', [1])).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('quarter: September falls in Jul-Sep', () => {
    expect(rangeBounds('trimestre', '2026-09-18', [1])).toEqual({ from: '2026-07-01', to: '2026-09-30' });
  });

  it('quarter: January falls in Jan-Mar', () => {
    expect(rangeBounds('trimestre', '2026-01-05', [1])).toEqual({ from: '2026-01-01', to: '2026-03-31' });
  });

  it('year: the full calendar year', () => {
    expect(rangeBounds('año', '2026-09-18', [1])).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('filterByRange', () => {
  const t = (date: string): Transaction => ({
    id: date, type: 'expense', concept: 'x', amount: 1, date,
    categoryId: null, paymentMethodId: null, status: 'paid',
    quincenaKey: null, createdAt: '', updatedAt: '',
  });

  it('excludes the materialized future — month, quarter and year give different results', () => {
    const txs = [t('2026-08-15'), t('2026-09-10'), t('2026-11-20'), t('2027-01-05')];
    const ids = (r: Range) => filterByRange(txs, r, '2026-09-18', [1]).map((x) => x.id);
    expect(ids('mes')).toEqual(['2026-09-10']);
    expect(ids('trimestre')).toEqual(['2026-08-15', '2026-09-10']);
    expect(ids('año')).toEqual(['2026-08-15', '2026-09-10', '2026-11-20']);
  });
});

describe('untilToday + fillGaps — the "historical" view does not show the future', () => {
  const p = (year: number, month: number, expense = 100) => ({ year, month, income: 0, expense });

  it('discards months after the current one and keeps the current one', () => {
    const series = [p(2026, 8), p(2026, 9), p(2026, 10), p(2027, 1)];
    expect(untilToday(series, '2026-09-18').map((x) => `${x.year}-${x.month}`))
      .toEqual(['2026-8', '2026-9']);
  });

  it('with data materialized into 2027, neither month nor quarter shows 2027', () => {
    const series = [p(2026, 4), p(2026, 9), p(2026, 12), p(2027, 3), p(2027, 8)];
    const visibleRows = fillGaps(untilToday(series, '2026-09-18'));

    const monthLabels = toMonthlyPoints(visibleRows).slice(-6).map((x) => x.label);
    const quarterLabels = toQuarterlyPoints(visibleRows).slice(-4).map((x) => x.label);

    expect(monthLabels.some((l) => l.includes('27'))).toBe(false);
    expect(quarterLabels.some((l) => l.includes('27'))).toBe(false);
    // And the last visible period is the one we're living in.
    expect(monthLabels.at(-1)).toBe('Sep 26');
    expect(quarterLabels.at(-1)).toBe('T3 26');
  });

  it('fills empty months in between with zeros, inventing nothing before the first', () => {
    const fill = fillGaps([p(2026, 4, 50), p(2026, 7, 80)]);
    expect(fill.map((x) => `${x.month}:${x.expense}`))
      .toEqual(['4:50', '5:0', '6:0', '7:80']);
  });

  it('crosses the year end when filling', () => {
    expect(fillGaps([p(2025, 11), p(2026, 2)]).map((x) => `${x.year}-${x.month}`))
      .toEqual(['2025-11', '2025-12', '2026-1', '2026-2']);
  });

  it('a single point is left as-is', () => {
    expect(fillGaps([p(2026, 9)])).toEqual([p(2026, 9)]);
  });
});

/**
 * The app has to age on its own. This test moves the system clock to future
 * years and checks that the cutoff follows the clock, not a date written
 * into the code: in 2029 the axis ends in 2029, not in 2026.
 */
describe('the cutoff follows the system clock, year after year', () => {
  afterEach(() => vi.useRealTimers());

  // A long series: one transaction per quarter over six years.
  const longSeries = Array.from({ length: 6 * 12 }, (_, i) => ({
    year: 2026 + Math.floor(i / 12),
    month: (i % 12) + 1,
    income: 1000,
    expense: 500,
  }));

  const testCases = [
    { today: '2026-09-18', month: 'Sep 26', trimestre: 'T3 26', ultimoAño: '2026' },
    { today: '2027-01-02', month: 'Ene 27', trimestre: 'T1 27', ultimoAño: '2027' },
    { today: '2029-12-31', month: 'Dic 29', trimestre: 'T4 29', ultimoAño: '2029' },
    { today: '2031-06-05', month: 'Jun 31', trimestre: 'T2 31', ultimoAño: '2031' },
  ];

  for (const testCase of testCases) {
    it(`el ${testCase.today} el eje termina en ${testCase.month}`, () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${testCase.today}T12:00:00`));

      // Exactly what AnalyticsScreen does, but reading the clock.
      const visibleRows = fillGaps(untilToday(longSeries, todayISO()));

      expect(toMonthlyPoints(visibleRows).slice(-6).at(-1)?.label).toBe(testCase.month);
      expect(toQuarterlyPoints(visibleRows).slice(-4).at(-1)?.label).toBe(testCase.trimestre);
      expect(toYearlyPoints(visibleRows).at(-1)?.label).toBe(testCase.ultimoAño);

      // And nothing after today sneaks in anywhere.
      const añoActual = Number(testCase.today.slice(0, 4));
      expect(visibleRows.every((p) => p.year <= añoActual)).toBe(true);
    });
  }

  it("the 6-month window moves with time, it doesn't get stuck", () => {
    const labels = (today: string) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${today}T12:00:00`));
      const r = toMonthlyPoints(fillGaps(untilToday(longSeries, todayISO()))).slice(-6).map((x) => x.label);
      vi.useRealTimers();
      return r;
    };
    expect(labels('2026-09-18')).toEqual(['Abr 26', 'May 26', 'Jun 26', 'Jul 26', 'Ago 26', 'Sep 26']);
    expect(labels('2027-02-10')).toEqual(['Sep 26', 'Oct 26', 'Nov 26', 'Dic 26', 'Ene 27', 'Feb 27']);
  });
});
