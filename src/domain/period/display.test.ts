import { describe, expect, it } from 'vitest';
import { daysLeft, displayMonth, displayMonthOf, nameOffset, periodMonthOfDisplay, periodMonthSpan } from './display';

describe('what a month of periods is called', () => {
  it('paid on the 30th, 30 Sep → 29 Oct is October', () => {
    expect(displayMonthOf('2026-10-04', [30])).toEqual({ y: 2026, m: 10 });
    expect(displayMonthOf('2026-09-30', [30])).toEqual({ y: 2026, m: 10 });
    expect(displayMonthOf('2026-09-29', [30])).toEqual({ y: 2026, m: 9 });
  });

  it('paid on the 1st, or on the 10th and 25th, nothing changes', () => {
    expect(nameOffset([1])).toBe(0);
    expect(nameOffset([10, 25])).toBe(0);
    expect(nameOffset([15])).toBe(0);
    expect(displayMonthOf('2026-10-04', [10, 25])).toEqual({ y: 2026, m: 9 });
  });

  it('after the 15th the next month gives the name, across the year end too', () => {
    expect(nameOffset([16])).toBe(1);
    expect(displayMonth({ y: 2026, m: 12 }, [30])).toEqual({ y: 2027, m: 1 });
    expect(periodMonthOfDisplay({ y: 2027, m: 1 }, [30])).toEqual({ y: 2026, m: 12 });
  });

  it('every name appears once: February is not skipped', () => {
    const names = new Set<string>();
    for (let m = 1; m <= 12; m++) {
      const d = displayMonth({ y: 2027, m }, [16]);
      names.add(`${d.y}-${d.m}`);
    }
    expect(names.size).toBe(12);
  });
});

describe('periodMonthSpan', () => {
  it('runs from the first pay day to the day before next month\'s', () => {
    expect(periodMonthSpan({ y: 2026, m: 9 }, [30])).toEqual({ start: '2026-09-30', end: '2026-10-29' });
    expect(periodMonthSpan({ y: 2026, m: 9 }, [10, 25])).toEqual({ start: '2026-09-10', end: '2026-10-09' });
    expect(periodMonthSpan({ y: 2026, m: 9 }, [1])).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });
});

describe('daysLeft', () => {
  it('counts whole days to the end, 0 on the last one', () => {
    expect(daysLeft('2026-10-04', '2026-10-09')).toBe(5);
    expect(daysLeft('2026-10-09', '2026-10-09')).toBe(0);
    expect(daysLeft('2026-12-30', '2027-01-02')).toBe(3);
  });
});
