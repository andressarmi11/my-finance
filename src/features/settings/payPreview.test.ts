import { describe, expect, it } from 'vitest';
import { payPreview } from './payPreview';

describe('payPreview', () => {
  it('two pay days: before the 10th is last month\'s second period', () => {
    const { days, periods } = payPreview(2026, 9, [10, 25]);
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual({ day: 1, index: 2, fromPrevMonth: true });
    expect(days[9]).toEqual({ day: 10, index: 1, fromPrevMonth: false });
    expect(days[23]!.index).toBe(1);
    expect(days[24]).toEqual({ day: 25, index: 2, fromPrevMonth: false });
    expect(periods).toEqual([
      { index: 1, startDay: 10, endDay: 24, endsNextMonth: false },
      { index: 2, startDay: 25, endDay: 9, endsNextMonth: true },
    ]);
  });

  it('once a month on the 15th: the days before belong to last month', () => {
    const { days, periods } = payPreview(2026, 9, [15]);
    expect(days.slice(0, 14).every((d) => d.fromPrevMonth)).toBe(true);
    expect(days.slice(14).every((d) => !d.fromPrevMonth && d.index === 1)).toBe(true);
    expect(periods).toEqual([{ index: 1, startDay: 15, endDay: 14, endsNextMonth: true }]);
  });

  it('once a month on the 1st is the calendar month', () => {
    const { days, periods } = payPreview(2026, 2, [1]);
    // February has 28 days: the strip still shows 30, into March.
    expect(days[27]!.day).toBe(28);
    expect(days[28]!.day).toBe(1);
    expect(days.slice(0, 28).every((d) => !d.fromPrevMonth)).toBe(true);
    expect(periods).toEqual([{ index: 1, startDay: 1, endDay: 28, endsNextMonth: false }]);
  });
});
