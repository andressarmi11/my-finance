import { describe, expect, it } from 'vitest';
import { buildCalendarGrid, shiftMonthISO } from './calendarGrid';

describe('buildCalendarGrid', () => {
  it('siempre devuelve 42 celdas (6 semanas)', () => {
    expect(buildCalendarGrid(2026, 9)).toHaveLength(42);
  });

  it("the in-month cells are exactly that month's days", () => {
    const cells = buildCalendarGrid(2026, 9);
    const inMonth = cells.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(30);
    expect(inMonth[0]?.date).toBe('2026-09-01');
    expect(inMonth[inMonth.length - 1]?.date).toBe('2026-09-30');
  });

  it('the dates are consecutive from start to finish', () => {
    const cells = buildCalendarGrid(2026, 9);
    for (let i = 1; i < cells.length; i++) {
      const prev = new Date(cells[i - 1]!.date);
      const curr = new Date(cells[i]!.date);
      expect(curr.getTime() - prev.getTime()).toBe(86_400_000);
    }
  });

  it('works in a leap-year February', () => {
    const inMonth = buildCalendarGrid(2024, 2).filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(29);
  });
});

describe('shiftMonthISO', () => {
  it('crosses the year both forwards and backwards', () => {
    expect(shiftMonthISO(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonthISO(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});
