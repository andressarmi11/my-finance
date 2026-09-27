import { describe, expect, it } from 'vitest';
import { calculateReminderTime } from './schedule';

describe('calculateReminderTime', () => {
  it('subtracts the configured days and pins the time to 9am Colombia (14:00 UTC)', () => {
    expect(calculateReminderTime('2026-09-20', 1)).toBe('2026-09-19T14:00:00.000Z');
  });

  it('with 0 days ahead, it reminds on the same day', () => {
    expect(calculateReminderTime('2026-09-20', 0)).toBe('2026-09-20T14:00:00.000Z');
  });

  it('crosses the month and the year correctly', () => {
    expect(calculateReminderTime('2026-01-01', 2)).toBe('2025-12-30T14:00:00.000Z');
  });
});
