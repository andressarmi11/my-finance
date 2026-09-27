/**
 * Monthly calendar grid (6 weeks x 7 days, starting on Sunday).
 * Purely structural — what's in each day is decided by the screen.
 */
import { addDays, parseISO, toISO, weekdayOf } from '@/domain/dates';

export interface CalendarCell {
  date: string;
  inMonth: boolean;
}

export function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = { y: year, m: month, d: 1 };
  const startWeekday = weekdayOf(firstOfMonth); // 0 Sunday .. 6 Saturday
  const gridStart = addDays(firstOfMonth, -startWeekday);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const day = addDays(gridStart, i);
    cells.push({ date: toISO(day), inMonth: day.y === year && day.m === month });
  }
  return cells;
}

export function shiftMonthISO(year: number, month: number, delta: number): { year: number; month: number } {
  const anchor = parseISO(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`);
  const total = anchor.y * 12 + (anchor.m - 1) + delta;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return { year: y, month: m };
}
