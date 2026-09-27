import { describe, expect, it } from 'vitest';
import { calculatePeriod, makePeriodKey, rangeFromKey } from './period';

describe('calculatePeriod — default (10 y 25)', () => {
  it('the 10th is the first day of the 10th pay period', () => {
    const r = calculatePeriod('2026-09-10');
    expect(r).toMatchObject({ key: '2026-09-Q1', start: '2026-09-10', end: '2026-09-24' });
  });

  it('the 24th is still in the 10th pay period', () => {
    expect(calculatePeriod('2026-09-24').key).toBe('2026-09-Q1');
  });

  it('the 25th is the first day of the 25th pay period', () => {
    const r = calculatePeriod('2026-09-25');
    expect(r.key).toBe('2026-09-Q2');
    expect(r.start).toBe('2026-09-25');
  });

  it('the 25th pay period ends on the 9th of the next month', () => {
    expect(calculatePeriod('2026-09-25').end).toBe('2026-10-09');
  });

  it('October 1st is still September’s 25th pay period (the "Rent" case)', () => {
    const r = calculatePeriod('2026-10-01');
    expect(r.key).toBe('2026-09-Q2');
    expect(r.start).toBe('2026-09-25');
    expect(r.end).toBe('2026-10-09');
  });

  it('October 9th is the last day of that same pay period', () => {
    expect(calculatePeriod('2026-10-09').key).toBe('2026-09-Q2');
  });

  it('October 10th is already a new pay period', () => {
    const r = calculatePeriod('2026-10-10');
    expect(r.key).toBe('2026-10-Q1');
    expect(r.start).toBe('2026-10-10');
  });
});

describe('calculatePeriod — crossing the year boundary', () => {
  it("January 1st falls in the previous year's December 25th pay period", () => {
    const r = calculatePeriod('2027-01-01');
    expect(r.key).toBe('2026-12-Q2');
    expect(r.start).toBe('2026-12-25');
    expect(r.end).toBe('2027-01-09');
  });
});

describe('calculatePeriod — generic configuration, not hard-wired to 10/25', () => {
  it('acepta quincenas clasicas 1-15 / 16-fin', () => {
    expect(calculatePeriod('2026-09-01', [1, 16]).key).toBe('2026-09-Q1');
    expect(calculatePeriod('2026-09-15', [1, 16]).key).toBe('2026-09-Q1');
    expect(calculatePeriod('2026-09-16', [1, 16]).key).toBe('2026-09-Q2');
    // with a=1, Q2 doesn't cross months: it ends on the last day of the same month
    expect(calculatePeriod('2026-09-16', [1, 16]).end).toBe('2026-09-30');
  });

  it("it doesn't care what order the days come in", () => {
    expect(calculatePeriod('2026-09-10', [25, 10])).toEqual(calculatePeriod('2026-09-10', [10, 25]));
  });

  it("clamps if the second day doesn't exist in a short month", () => {
    // startDays=[10,30]: in February (28 days) the "30" clamps to 28
    const r = calculatePeriod('2026-02-28', [10, 30]);
    expect(r.key).toBe('2026-02-Q2');
  });
});

describe('makePeriodKey', () => {
  it('builds the key with correct padding', () => {
    expect(makePeriodKey(2026, 9, 1)).toBe('2026-09-Q1');
    expect(makePeriodKey(2026, 1, 2)).toBe('2026-01-Q2');
  });
});

describe('rangeFromKey', () => {
  it("rebuilds the 10th pay period's range from its key", () => {
    expect(rangeFromKey('2026-09-Q1')).toMatchObject({
      key: '2026-09-Q1', start: '2026-09-10', end: '2026-09-24',
    });
  });

  it("rebuilds the 25th pay period's range, crossing the month", () => {
    expect(rangeFromKey('2026-09-Q2')).toMatchObject({
      key: '2026-09-Q2', start: '2026-09-25', end: '2026-10-09',
    });
  });

  it('rejects a key with an invalid format', () => {
    expect(() => rangeFromKey('no-valida')).toThrow();
  });
});
